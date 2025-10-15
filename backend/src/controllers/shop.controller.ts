import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import apiResponse from "../core/respone";
import { sendShopRequestEmail } from "../services/mail.service";
import ApiError from "../utils/apiErrors";
import shopApplicationService from "../services/shopApplication.service";
import shopService from "../services/shop.service";

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
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ";
        return next(new ApiError(StatusCodes.BAD_REQUEST, message));
      }

      const updated = await shopService.updateByUserId(userId, parsed.data);
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
};

export default shopController;
