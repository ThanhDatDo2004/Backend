import fieldQuantityModel, {
  AvailableQuantityRow,
} from "../models/fieldQuantity.model";
import { ApiError } from "http-errors";
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

const fieldQuantityService = {
  /**
   * Create quantities when a new field is created
   * Automatically called from field.service.ts
   */
  async createQuantitiesForField(fieldCode: number, count: number) {
    console.log("[FIELD_QUANTITY.SERVICE] createQuantitiesForField:", {
      fieldCode,
      count,
      type: typeof count,
    });

    if (count <= 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Số lượng sân phải lớn hơn 0"
      );
    }

    const created = await fieldQuantityModel.bulkCreate(fieldCode, count);
    console.log("[FIELD_QUANTITY.SERVICE] bulkCreate result:", {
      fieldCode,
      count,
      created,
    });

    if (created === 0) {
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "Lỗi khi tạo sân");
    }

    return created;
  },

  /**
   * Get all quantities for a field with their status
   */
  async getQuantitiesForField(fieldCode: number) {
    return await fieldQuantityModel.getByFieldCode(fieldCode);
  },

  /**
   * Get quantities for multiple fields (used in batch hydration)
   */
  async getMultipleFieldQuantities(fieldCodes: number[]) {
    if (!fieldCodes.length) return [];

    const allQuantities: any[] = [];
    for (const fieldCode of fieldCodes) {
      const quantities = await fieldQuantityModel.getByFieldCode(fieldCode);
      allQuantities.push(
        ...quantities.map((q) => ({
          field_code: fieldCode,
          quantity_id: q.quantity_id,
          quantity_number: q.quantity_number,
          status: q.status,
        }))
      );
    }
    return allQuantities;
  },

  /**
   * Get available quantities for a specific time slot
   * MAIN FUNCTION: Check which courts are free at a given time
   */
  async getAvailableSlot(
    fieldCode: number,
    playDate: string,
    startTime: string,
    endTime: string
  ): Promise<SlotAvailability> {
    // Release any expired holds before checking availability
    await releaseExpiredHeldSlots(fieldCode);

    // Get all quantities for this field
    const allQuantities = await fieldQuantityModel.getByFieldCode(fieldCode);

    // Get available quantities (not booked, status=available)
    const availableQuantities = await fieldQuantityModel.getAvailableForSlot(
      fieldCode,
      playDate,
      startTime,
      endTime
    );

    // Get booked quantities
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

  /**
   * Check if a specific quantity is available for booking
   */
  async checkAvailability(
    quantityId: number,
    playDate: string,
    startTime: string,
    endTime: string
  ): Promise<boolean> {
    return await fieldQuantityModel.isAvailableForSlot(
      quantityId,
      playDate,
      startTime,
      endTime
    );
  },

  /**
   * Get quantity details by ID
   */
  async getQuantityById(quantityId: number) {
    const quantity = await fieldQuantityModel.getById(quantityId);
    if (!quantity) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy sân");
    }
    return quantity;
  },

  /**
   * Update quantity status (for maintenance, etc.)
   */
  async updateQuantityStatus(
    quantityId: number,
    status: "available" | "maintenance" | "inactive"
  ) {
    const quantity = await fieldQuantityModel.getById(quantityId);
    if (!quantity) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy sân");
    }

    const updated = await fieldQuantityModel.updateStatus(quantityId, status);
    if (!updated) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Lỗi khi cập nhật trạng thái sân"
      );
    }

    return await fieldQuantityModel.getById(quantityId);
  },

  /**
   * Validate that quantity belongs to field
   */
  async validateQuantityOwnership(
    quantityId: number,
    fieldCode: number
  ): Promise<boolean> {
    const quantity = await fieldQuantityModel.getById(quantityId);
    if (!quantity) return false;
    return quantity.field_code === fieldCode;
  },

  /**
   * Get available quantities count for a field (for quick checks)
   */
  async getAvailableCount(fieldCode: number): Promise<number> {
    const available = await fieldQuantityModel.getAvailableQuantities(
      fieldCode
    );
    return available.length;
  },

  /**
   * Get total quantities count for a field
   */
  async getTotalCount(fieldCode: number): Promise<number> {
    return await fieldQuantityModel.getCountByFieldCode(fieldCode);
  },

  async getMaxQuantityNumber(fieldCode: number): Promise<number> {
    return await fieldQuantityModel.getMaxQuantityNumber(fieldCode);
  },

  async countFutureBookedQuantities(fieldCode: number): Promise<number> {
    return await fieldQuantityModel.countFutureBookedQuantities(fieldCode);
  },

  async getRemovableQuantityIds(fieldCode: number, limit: number) {
    return await fieldQuantityModel.getRemovableQuantityIds(fieldCode, limit);
  },

  async deleteQuantitiesByIds(quantityIds: number[]) {
    if (!quantityIds.length) return 0;
    return await fieldQuantityModel.deleteByIds(quantityIds);
  },
};

export default fieldQuantityService;
