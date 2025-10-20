/**
 * Field_Quantity Type Definitions
 * Represents individual court/court instances for a field
 * 
 * Example:
 * - Field "Tennis" (FieldCode=30) has 2 courts
 *   - QuantityID 15: FieldCode=30, QuantityNumber=1
 *   - QuantityID 16: FieldCode=30, QuantityNumber=2
 */

export type QuantityStatus = 'available' | 'maintenance' | 'inactive';

export interface FieldQuantityRow {
  quantity_id: number;
  field_code: number;
  quantity_number: number;
  status: QuantityStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateFieldQuantityRequest {
  fieldCode: number;
  quantityNumber: number;
  status?: QuantityStatus;
}

export interface UpdateFieldQuantityRequest {
  status?: QuantityStatus;
}

export interface AvailableQuantity {
  quantity_id: number;
  quantity_number: number;
  status: QuantityStatus;
}

export interface FieldQuantitySummary {
  field_code: number;
  field_name: string;
  total_quantity: number;
  available_quantities: AvailableQuantity[];
  booked_quantities: number[];
}

export interface BookingWithQuantity {
  booking_code: number;
  field_code: number;
  quantity_id: number;
  quantity_number: number;
  play_date: string;
  start_time: string;
  end_time: string;
  booking_status: string;
}

