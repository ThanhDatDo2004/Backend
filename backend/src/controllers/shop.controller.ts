import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import apiResponse from "../core/respone";
import { sendShopRequestEmail } from "../services/mail.service";
import ApiError from "../utils/apiErrors";
import shopApplicationService from "../services/shopApplication.service";
import shopService from "../services/shop.service";
import queryService from "../services/query";
import { RowDataPacket } from "mysql2";
import {
  listShopUtilities,
  replaceShopUtilities,
} from "../services/shopUtilities.service";

const shopRequestSchema = z.object({
  full_name: z.string().trim().min(2, "Họ và tên phải có ít nhất 2 ký tự"),
  email: z.string().trim().email("Email không hợp lệ"),
  phone_number: z
    .string()
    .trim()
    .regex(/^[0-9]{10,11}$/, "Số điện thoại phải có 10-11 chữ số"),
  address: z.string().trim().min(10, "Địa chỉ phải có ít nhất 10 ký tự"),
  message: z.string().trim().optional(),
});

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const normalizeTimeInput = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed.slice(0, 5);
  }
  return trimmed;
};

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map((part) => Number(part));
  return hours * 60 + minutes;
};

const toBoolFlexible = (value: unknown, fallback = false): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (["1", "true", "y", "yes"].includes(lowered)) return true;
    if (["0", "false", "n", "no"].includes(lowered)) return false;
  }
  return fallback;
};

const shopController = {
  async submitRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = shopRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        const message =
          parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ";
        return next(new ApiError(StatusCodes.BAD_REQUEST, message));
      }

      const payload = parsed.data;

      const savedRequest = await shopApplicationService.createRequest(payload);

      await sendShopRequestEmail(payload);

      return apiResponse.success(
        res,
        { ok: true, request: savedRequest },
        "Đã gửi yêu cầu mở shop",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Không thể gửi yêu cầu"
        )
      );
    }
  },

  async updateMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = Number(
        req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code
      );
      if (!Number.isFinite(userId) || userId <= 0) {
        return next(
          new ApiError(
            StatusCodes.UNAUTHORIZED,
            "Vui lòng đăng nhập để tiếp tục"
          )
        );
      }

      const schema = z.object({
        shop_name: z.string().trim().min(2, "Tên shop phải có ít nhất 2 ký tự"),
        address: z.string().trim().min(5, "Địa chỉ phải có ít nhất 5 ký tự"),
        bank_account_number: z.string().trim().optional(),
        bank_name: z.string().trim().optional(),
        bank_account_holder: z.string().trim().optional(),
        phone_number: z
          .string()
          .trim()
          .optional()
          .refine(
            (value) =>
              value === undefined ||
              value === "" ||
              /^[0-9]{10,11}$/.test(value),
            "Số điện thoại phải có 10-11 chữ số"
          ),
        opening_time: z.union([z.string(), z.null()]).optional(),
        closing_time: z.union([z.string(), z.null()]).optional(),
        is_open_24h: z.union([z.boolean(), z.string(), z.number()]).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        const message =
          parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ";
        return next(new ApiError(StatusCodes.BAD_REQUEST, message));
      }

      const data = parsed.data;
      let openingTime = normalizeTimeInput(data.opening_time);
      let closingTime = normalizeTimeInput(data.closing_time);
      const isOpen24h = toBoolFlexible(data.is_open_24h, false);

      if (isOpen24h) {
        openingTime = null;
        closingTime = null;
      } else {
        if (!openingTime || !closingTime) {
          return next(
            new ApiError(
              StatusCodes.BAD_REQUEST,
              "Vui lòng nhập đầy đủ giờ mở và giờ đóng cửa"
            )
          );
        }
        if (!TIME_REGEX.test(openingTime) || !TIME_REGEX.test(closingTime)) {
          return next(
            new ApiError(
              StatusCodes.BAD_REQUEST,
              "Giờ mở/đóng cửa phải có định dạng HH:MM"
            )
          );
        }
        if (timeToMinutes(openingTime) >= timeToMinutes(closingTime)) {
          return next(
            new ApiError(
              StatusCodes.BAD_REQUEST,
              "Giờ mở cửa phải nhỏ hơn giờ đóng cửa"
            )
          );
        }
      }

      const updated = await shopService.updateByUserId(userId, {
        ...data,
        opening_time: openingTime,
        closing_time: closingTime,
        is_open_24h: isOpen24h,
      });
      if (!updated) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy shop"));
      }

      return apiResponse.success(
        res,
        updated,
        "Cập nhật shop thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  async current(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = Number(
        req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code
      );
      if (!Number.isFinite(userId) || userId <= 0) {
        return next(
          new ApiError(
            StatusCodes.UNAUTHORIZED,
            "Vui lòng đăng nhập để tiếp tục"
          )
        );
      }

      return apiResponse.success(
        res,
        await shopService.getByUserId(userId),
        "Fetched shop successfully",
        StatusCodes.OK
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Lấy danh sách tài khoản ngân hàng
   * GET /api/shops/me/bank-accounts
   */
  async getBankAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.UserID;

      const [shopRows] = await queryService.query<RowDataPacket[]>(
        `SELECT ShopCode FROM Shops WHERE UserID = ?`,
        [userId]
      );

      if (!shopRows?.[0]) {
        return next(new ApiError(StatusCodes.NOT_FOUND, "Bạn không có shop"));
      }

      const shopCode = shopRows[0].ShopCode;

      const [bankAccounts] = await queryService.query<RowDataPacket[]>(
        `SELECT ShopBankID, ShopCode, BankName, AccountNumber, AccountHolder, IsDefault,
                CreateAt, UpdateAt
         FROM Shop_Bank_Accounts
         WHERE ShopCode = ?
         ORDER BY CreateAt DESC`,
        [shopCode]
      );

      return apiResponse.success(
        res,
        bankAccounts || [],
        "Lấy danh sách tài khoản ngân hàng thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Lỗi lấy danh sách tài khoản ngân hàng"
        )
      );
    }
  },

  async getUtilities(req: Request, res: Response, next: NextFunction) {
    try {
      const shopCode = Number(req.params.shopCode);
      if (!Number.isFinite(shopCode) || shopCode <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã shop không hợp lệ")
        );
      }

      const [shops] = await queryService.query<RowDataPacket[]>(
        `SELECT ShopCode FROM Shops WHERE ShopCode = ?`,
        [shopCode]
      );
      if (!shops?.[0]) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy shop")
        );
      }

      return apiResponse.success(
        res,
        await listShopUtilities(shopCode),
        "Danh sách tiện ích của shop",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Không thể lấy danh sách tiện ích"
        )
      );
    }
  },

  async updateUtilities(req: Request, res: Response, next: NextFunction) {
    try {
      const shopCode = Number(req.params.shopCode);
      if (!Number.isFinite(shopCode) || shopCode <= 0) {
        return next(
          new ApiError(StatusCodes.BAD_REQUEST, "Mã shop không hợp lệ")
        );
      }

      const userId = Number(
        req.user?.UserID ?? req.user?.user_id ?? req.user?.user_code
      );
      if (!Number.isFinite(userId) || userId <= 0) {
        return next(
          new ApiError(
            StatusCodes.UNAUTHORIZED,
            "Vui lòng đăng nhập để tiếp tục"
          )
        );
      }

      const [shops] = await queryService.query<RowDataPacket[]>(
        `SELECT ShopCode, UserID FROM Shops WHERE ShopCode = ?`,
        [shopCode]
      );
      const shop = shops?.[0];
      if (!shop) {
        return next(
          new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy shop")
        );
      }

      if (Number(shop.UserID) !== userId) {
        return next(
          new ApiError(
            StatusCodes.FORBIDDEN,
            "Bạn không có quyền cập nhật tiện ích cho shop này"
          )
        );
      }

      const utilitiesInput = Array.isArray((req.body as any)?.utilities)
        ? (req.body as any).utilities.map((item: unknown) => String(item ?? "").trim())
        : [];

      return apiResponse.success(
        res,
        await replaceShopUtilities(shopCode, utilitiesInput),
        "Cập nhật tiện ích thành công",
        StatusCodes.OK
      );
    } catch (error) {
      next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (error as Error)?.message || "Không thể cập nhật tiện ích"
        )
      );
    }
  },
};

export default shopController;
