import queryService from "./query";
import fieldModel from "../models/field.model";
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
  async validateFieldOwnership(fieldCode: number, userId: number): Promise<boolean> {
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

  async listOperatingHoursByField(fieldCode: number, userId: number): Promise<OperatingHoursRow[]> {
    // Validate field ownership
    const isOwner = await this.validateFieldOwnership(fieldCode, userId);
    if (!isOwner) {
      throw new ApiError(403, "Bạn không có quyền truy cập sân này");
    }

    const pricingData = await fieldModel.listPricing(fieldCode);
    // Remove price_per_hour from response since we only manage operating hours
    return pricingData.map(item => ({
      pricing_id: item.pricing_id,
      field_code: item.field_code,
      day_of_week: item.day_of_week,
      start_time: item.start_time,
      end_time: item.end_time
    }));
  },

  async createOperatingHours(payload: CreateOperatingHoursRequest, userId: number): Promise<OperatingHoursRow> {
    // Validate field ownership
    const isOwner = await this.validateFieldOwnership(payload.fieldCode, userId);
    if (!isOwner) {
      throw new ApiError(403, "Bạn không có quyền quản lý sân này");
    }

    // Validate time format and logic
    this.validateTimeFormat(payload.startTime, payload.endTime);

    // Check for overlapping time slots for the same day
    await this.checkTimeOverlap(payload.fieldCode, payload.dayOfWeek, payload.startTime, payload.endTime);

    // Get default price from Fields table
    const field = await fieldModel.findById(payload.fieldCode);
    if (!field) {
      throw new ApiError(404, "Không tìm thấy sân");
    }

    // Get default price from Fields table
    const fieldDetails = await queryService.execQueryOne(`
      SELECT DefaultPricePerHour FROM Fields WHERE FieldCode = ?
    `, [payload.fieldCode]);

    const defaultPrice = (fieldDetails as any)?.DefaultPricePerHour || 50000;

    const query = `
      INSERT INTO Field_Pricing (
        FieldCode,
        DayOfWeek,
        StartTime,
        EndTime,
        PricePerHour
      ) VALUES (?, ?, ?, ?, ?)
    `;

    const result = await queryService.execQuery(query, [
      payload.fieldCode,
      payload.dayOfWeek,
      payload.startTime,
      payload.endTime,
      defaultPrice // Use default price from Fields table
    ]);

    if (typeof result === "boolean") {
      throw new ApiError(500, "Không thể tạo giờ hoạt động mới");
    }

    const pricingId = (result as any).insertId;
    
    // Return the created operating hours record
    const selectQuery = `
      SELECT
        p.PricingID AS pricing_id,
        p.FieldCode AS field_code,
        p.DayOfWeek AS day_of_week,
        DATE_FORMAT(p.StartTime, '%H:%i') AS start_time,
        DATE_FORMAT(p.EndTime, '%H:%i') AS end_time
      FROM Field_Pricing p
      WHERE p.PricingID = ?
      LIMIT 1
    `;

    const rows = await queryService.execQueryList(selectQuery, [pricingId]);
    const createdHours = rows[0] as OperatingHoursRow || null;
    
    if (!createdHours) {
      throw new ApiError(500, "Không thể lấy thông tin giờ hoạt động vừa tạo");
    }

    return createdHours;
  },

  async updateOperatingHours(pricingId: number, payload: UpdateOperatingHoursRequest, userId: number): Promise<OperatingHoursRow> {
    // Get existing operating hours to validate ownership
    const existingHours = await this.getOperatingHoursById(pricingId, userId);
    if (!existingHours) {
      throw new ApiError(404, "Không tìm thấy giờ hoạt động");
    }

    // Validate field ownership
    const isOwner = await this.validateFieldOwnership(existingHours.field_code, userId);
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
      await this.checkTimeOverlap(
        existingHours.field_code, 
        dayOfWeek, 
        startTime, 
        endTime, 
        pricingId
      );
    }

    // Build update query
    const updateFields: string[] = [];
    const params: any[] = [];

    if (payload.dayOfWeek !== undefined) {
      updateFields.push("DayOfWeek = ?");
      params.push(payload.dayOfWeek);
    }
    if (payload.startTime !== undefined) {
      updateFields.push("StartTime = ?");
      params.push(payload.startTime);
    }
    if (payload.endTime !== undefined) {
      updateFields.push("EndTime = ?");
      params.push(payload.endTime);
    }

    if (updateFields.length === 0) {
      return existingHours;
    }

    params.push(pricingId);

    const query = `
      UPDATE Field_Pricing
      SET ${updateFields.join(", ")}
      WHERE PricingID = ?
    `;

    const result = await queryService.execQuery(query, params);
    if (typeof result === "boolean" && !result) {
      throw new ApiError(500, "Không thể cập nhật giờ hoạt động");
    }

    // Return updated operating hours
    const updatedHours = await this.getOperatingHoursById(pricingId, userId);
    if (!updatedHours) {
      throw new ApiError(500, "Không thể lấy thông tin giờ hoạt động đã cập nhật");
    }

    return updatedHours;
  },

  async deleteOperatingHours(pricingId: number, userId: number): Promise<boolean> {
    // Get existing operating hours to validate ownership
    const existingHours = await this.getOperatingHoursById(pricingId, userId);
    if (!existingHours) {
      throw new ApiError(404, "Không tìm thấy giờ hoạt động");
    }

    // Validate field ownership
    const isOwner = await this.validateFieldOwnership(existingHours.field_code, userId);
    if (!isOwner) {
      throw new ApiError(403, "Bạn không có quyền xóa giờ hoạt động này");
    }

    const query = `DELETE FROM Field_Pricing WHERE PricingID = ?`;
    const result = await queryService.execQuery(query, [pricingId]);
    
    if (typeof result === "boolean") {
      return result;
    }
    
    return (result as any).affectedRows > 0;
  },

  async getOperatingHoursById(pricingId: number, userId: number): Promise<OperatingHoursRow | null> {
    const query = `
      SELECT
        p.PricingID AS pricing_id,
        p.FieldCode AS field_code,
        p.DayOfWeek AS day_of_week,
        DATE_FORMAT(p.StartTime, '%H:%i') AS start_time,
        DATE_FORMAT(p.EndTime, '%H:%i') AS end_time
      FROM Field_Pricing p
      JOIN Fields f ON f.FieldCode = p.FieldCode
      JOIN Shops s ON s.ShopCode = f.ShopCode
      WHERE p.PricingID = ? AND s.UserID = ?
      LIMIT 1
    `;

    const rows = await queryService.execQueryList(query, [pricingId, userId]);
    return rows[0] as OperatingHoursRow || null;
  },

  validateTimeFormat(startTime: string, endTime: string): void {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    
    if (!timeRegex.test(startTime)) {
      throw new ApiError(400, "Thời gian bắt đầu không hợp lệ (định dạng: HH:MM)");
    }
    
    if (!timeRegex.test(endTime)) {
      throw new ApiError(400, "Thời gian kết thúc không hợp lệ (định dạng: HH:MM)");
    }

    // Convert to minutes for comparison
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    if (startMinutes >= endMinutes) {
      throw new ApiError(400, "Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc");
    }
  },

  timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  },

  async checkTimeOverlap(
    fieldCode: number, 
    dayOfWeek: number, 
    startTime: string, 
    endTime: string,
    excludePricingId?: number
  ): Promise<void> {
    let query = `
      SELECT PricingID
      FROM Field_Pricing
      WHERE FieldCode = ? 
        AND DayOfWeek = ?
        AND NOT (EndTime <= ? OR StartTime >= ?)
    `;
    
    const params = [
      fieldCode,
      dayOfWeek,
      startTime, endTime  // No overlap: endTime <= startTime OR startTime >= endTime
    ];

    if (excludePricingId) {
      query += " AND PricingID != ?";
      params.push(excludePricingId);
    }

    const rows = await queryService.execQueryList(query, params);
    
    if (rows.length > 0) {
      throw new ApiError(400, "Khung giờ này đã trùng với khung giờ khác trong cùng ngày");
    }
  }
};

export default pricingService;
