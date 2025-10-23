import fieldModel from "../models/field.model";
import pricingModel from "../models/pricing.model";
import ApiError from "../utils/apiErrors";

export type CreateOperatingHoursRequest = {
  fieldCode: number;
  dayOfWeek: number; // 0-6 (Sunday = 0)
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
};

export type UpdateOperatingHoursRequest = {
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
};

export type OperatingHoursRow = {
  pricing_id: number;
  field_code: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

const pricingService = {
  async validateFieldOwnership(
    fieldCode: number,
    userId: number
  ): Promise<boolean> {
    // Check if the field belongs to the user's shop
    const field = await fieldModel.findById(fieldCode);
    if (!field) {
      return false;
    }

    const shop = await fieldModel.findShopByCode(field.shop_code);
    if (!shop || shop.user_id !== userId) {
      return false;
    }

    return true;
  },

  async listOperatingHoursByField(
    fieldCode: number,
    userId: number
  ): Promise<OperatingHoursRow[]> {
    // Validate field ownership
    const isOwner = await this.validateFieldOwnership(fieldCode, userId);
    if (!isOwner) {
      throw new ApiError(403, "Bạn không có quyền truy cập sân này");
    }

    const pricingData = await fieldModel.listPricing(fieldCode);
    // Remove price_per_hour from response since we only manage operating hours
    return pricingData.map((item) => ({
      pricing_id: item.pricing_id,
      field_code: item.field_code,
      day_of_week: item.day_of_week,
      start_time: item.start_time,
      end_time: item.end_time,
    }));
  },

  async createOperatingHours(
    payload: CreateOperatingHoursRequest,
    userId: number
  ): Promise<OperatingHoursRow> {
    // Validate field ownership
    const isOwner = await this.validateFieldOwnership(
      payload.fieldCode,
      userId
    );
    if (!isOwner) {
      throw new ApiError(403, "Bạn không có quyền quản lý sân này");
    }

    // Validate time format and logic
    this.validateTimeFormat(payload.startTime, payload.endTime);

    // Check for overlapping time slots for the same day
    const overlapCount = await pricingModel.checkTimeOverlap(
      payload.fieldCode,
      payload.dayOfWeek,
      payload.startTime,
      payload.endTime
    );

    if (overlapCount > 0) {
      throw new ApiError(
        400,
        "Khung giờ này đã trùng với khung giờ khác trong cùng ngày"
      );
    }

    // Get default price from Fields table
    const field = await fieldModel.findById(payload.fieldCode);
    if (!field) {
      throw new ApiError(404, "Không tìm thấy sân");
    }

    const defaultPrice = await pricingModel.getDefaultPrice(payload.fieldCode);

    const pricingId = await pricingModel.createOperatingHours(
      payload.fieldCode,
      payload.dayOfWeek,
      payload.startTime,
      payload.endTime,
      defaultPrice
    );

    // Return the created operating hours record
    const createdHours = await pricingModel.getPricingById(pricingId);

    if (!createdHours) {
      throw new ApiError(500, "Không thể lấy thông tin giờ hoạt động vừa tạo");
    }

    return createdHours;
  },

  async updateOperatingHours(
    pricingId: number,
    payload: UpdateOperatingHoursRequest,
    userId: number
  ): Promise<OperatingHoursRow> {
    // Get existing operating hours to validate ownership
    const existingHours = await pricingModel.getOperatingHoursById(
      pricingId,
      userId
    );
    if (!existingHours) {
      throw new ApiError(404, "Không tìm thấy giờ hoạt động");
    }

    // Validate field ownership
    const isOwner = await this.validateFieldOwnership(
      existingHours.field_code,
      userId
    );
    if (!isOwner) {
      throw new ApiError(403, "Bạn không có quyền cập nhật giờ hoạt động này");
    }

    // If updating time fields, validate them
    const startTime = payload.startTime ?? existingHours.start_time;
    const endTime = payload.endTime ?? existingHours.end_time;

    if (payload.startTime || payload.endTime) {
      this.validateTimeFormat(startTime, endTime);
    }

    // If updating day or time, check for overlaps (excluding current record)
    const dayOfWeek = payload.dayOfWeek ?? existingHours.day_of_week;
    if (payload.dayOfWeek || payload.startTime || payload.endTime) {
      const overlapCount = await pricingModel.checkTimeOverlap(
        existingHours.field_code,
        dayOfWeek,
        startTime,
        endTime,
        pricingId
      );

      if (overlapCount > 0) {
        throw new ApiError(
          400,
          "Khung giờ này đã trùng với khung giờ khác trong cùng ngày"
        );
      }
    }

    // Prepare update data
    const updateFields: any = {};
    if (payload.dayOfWeek !== undefined) {
      updateFields.dayOfWeek = payload.dayOfWeek;
    }
    if (payload.startTime !== undefined) {
      updateFields.startTime = payload.startTime;
    }
    if (payload.endTime !== undefined) {
      updateFields.endTime = payload.endTime;
    }

    const updated = await pricingModel.updateOperatingHours(
      pricingId,
      updateFields
    );
    if (!updated) {
      throw new ApiError(500, "Không thể cập nhật giờ hoạt động");
    }

    // Return updated operating hours
    const updatedHours = await pricingModel.getOperatingHoursById(
      pricingId,
      userId
    );
    if (!updatedHours) {
      throw new ApiError(
        500,
        "Không thể lấy thông tin giờ hoạt động đã cập nhật"
      );
    }

    return updatedHours;
  },

  async deleteOperatingHours(
    pricingId: number,
    userId: number
  ): Promise<boolean> {
    // Get existing operating hours to validate ownership
    const existingHours = await pricingModel.getOperatingHoursById(
      pricingId,
      userId
    );
    if (!existingHours) {
      throw new ApiError(404, "Không tìm thấy giờ hoạt động");
    }

    // Validate field ownership
    const isOwner = await this.validateFieldOwnership(
      existingHours.field_code,
      userId
    );
    if (!isOwner) {
      throw new ApiError(403, "Bạn không có quyền xóa giờ hoạt động này");
    }

    return await pricingModel.deleteOperatingHours(pricingId);
  },

  async getOperatingHoursById(
    pricingId: number,
    userId: number
  ): Promise<OperatingHoursRow | null> {
    return await pricingModel.getOperatingHoursById(pricingId, userId);
  },

  validateTimeFormat(startTime: string, endTime: string): void {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

    if (!timeRegex.test(startTime)) {
      throw new ApiError(
        400,
        "Thời gian bắt đầu không hợp lệ (định dạng: HH:MM)"
      );
    }

    if (!timeRegex.test(endTime)) {
      throw new ApiError(
        400,
        "Thời gian kết thúc không hợp lệ (định dạng: HH:MM)"
      );
    }

    // Convert to minutes for comparison
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    if (startMinutes >= endMinutes) {
      throw new ApiError(
        400,
        "Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc"
      );
    }
  },

  timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  },
};

export default pricingService;
