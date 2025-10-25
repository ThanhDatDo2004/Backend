
import fieldQuantityModel, {
  AvailableQuantityRow,
} from "../models/fieldQuantity.model";
import fieldModel from "../models/field.model";
import shopService from "./shop.service";
import ApiError from "../utils/apiErrors";
import { StatusCodes } from "http-status-codes";
import { releaseExpiredHeldSlots } from "./booking.service";

interface SlotAvailability {
  fieldCode: number;
  playDate: string;
  timeSlot: string;
  totalQuantities: number;
  availableQuantities: AvailableQuantityRow[];
  bookedQuantities: AvailableQuantityRow[];
  availableCount: number;
}

async function ensureFieldExists(fieldCode: number) {
  const field = await fieldModel.findById(fieldCode);
  if (!field) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy sân loại");
  }
  return field;
}

async function ensureOwnership(fieldCode: number, userId: number) {
  const field = await ensureFieldExists(fieldCode);
  await shopService.ensureShopOwnership(field.shop_code, userId);
  return field;
}

const fieldQuantityService = {
  async createQuantitiesForField(fieldCode: number, count: number) {
    if (count <= 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Số lượng sân phải lớn hơn 0"
      );
    }

    await ensureFieldExists(fieldCode);
    const created = await fieldQuantityModel.bulkCreate(fieldCode, count);
    if (!created) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Lỗi khi tạo sân"
      );
    }
    return created;
  },

  async getQuantitiesForField(fieldCode: number) {
    await ensureFieldExists(fieldCode);
    return fieldQuantityModel.getByFieldCode(fieldCode);
  },

  async getQuantitiesForOwner(fieldCode: number, userId: number) {
    await ensureOwnership(fieldCode, userId);
    return fieldQuantityModel.getByFieldCode(fieldCode);
  },

  async getAvailableSlot(
    fieldCode: number,
    playDate: string,
    startTime: string,
    endTime: string
  ): Promise<SlotAvailability> {
    await ensureFieldExists(fieldCode);
    await releaseExpiredHeldSlots(fieldCode);

    const allQuantities = await fieldQuantityModel.getByFieldCode(fieldCode);
    const availableQuantities = await fieldQuantityModel.getAvailableForSlot(
      fieldCode,
      playDate,
      startTime,
      endTime
    );
    const bookedQuantities = await fieldQuantityModel.getBookedForSlot(
      fieldCode,
      playDate,
      startTime,
      endTime
    );

    return {
      fieldCode,
      playDate,
      timeSlot: `${startTime}-${endTime}`,
      totalQuantities: allQuantities.length,
      availableQuantities,
      bookedQuantities,
      availableCount: availableQuantities.length,
    };
  },

  async getAvailableSlotForUser(
    fieldCode: number,
    playDate: string,
    startTime: string,
    endTime: string,
    userId: number
  ) {
    await ensureOwnership(fieldCode, userId);
    return this.getAvailableSlot(fieldCode, playDate, startTime, endTime);
  },

  async checkAvailability(
    quantityId: number,
    playDate: string,
    startTime: string,
    endTime: string
  ): Promise<boolean> {
    return fieldQuantityModel.isAvailableForSlot(
      quantityId,
      playDate,
      startTime,
      endTime
    );
  },

  async getQuantityById(quantityId: number) {
    const quantity = await fieldQuantityModel.getById(quantityId);
    if (!quantity) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy sân");
    }
    return quantity;
  },

  async getQuantityByFieldAndNumber(fieldCode: number, quantityNumber: number) {
    const quantities = await fieldQuantityModel.getByFieldCode(fieldCode);
    return quantities.find((q) => q.quantity_number === quantityNumber) || null;
  },

  async updateQuantityStatusByNumber(
    fieldCode: number,
    quantityNumber: number,
    status: "available" | "maintenance" | "inactive",
    userId: number
  ) {
    await ensureOwnership(fieldCode, userId);
    const quantity = await this.getQuantityByFieldAndNumber(
      fieldCode,
      quantityNumber
    );
    if (!quantity) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy sân");
    }
    const updated = await fieldQuantityModel.updateStatus(
      quantity.quantity_id,
      status
    );
    if (!updated) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Lỗi khi cập nhật trạng thái sân"
      );
    }
    return fieldQuantityModel.getById(quantity.quantity_id);
  },

  async updateQuantityStatus(
    quantityId: number,
    status: "available" | "maintenance" | "inactive"
  ) {
    const quantity = await this.getQuantityById(quantityId);
    const updated = await fieldQuantityModel.updateStatus(quantityId, status);
    if (!updated) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Lỗi khi cập nhật trạng thái sân"
      );
    }
    return fieldQuantityModel.getById(quantity.quantity_id);
  },

  async validateQuantityOwnership(
    quantityId: number,
    fieldCode: number
  ): Promise<boolean> {
    const quantity = await fieldQuantityModel.getById(quantityId);
    if (!quantity) return false;
    return quantity.field_code === fieldCode;
  },

  async getAvailableCount(fieldCode: number): Promise<number> {
    await ensureFieldExists(fieldCode);
    const available = await fieldQuantityModel.getAvailableQuantities(
      fieldCode
    );
    return available.length;
  },

  async getTotalCount(fieldCode: number): Promise<number> {
    await ensureFieldExists(fieldCode);
    return fieldQuantityModel.getCountByFieldCode(fieldCode);
  },
};

export default fieldQuantityService;
