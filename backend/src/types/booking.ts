export type BookingSlotInput = {
  slot_id?: number | null;
  play_date: string;
  start_time: string;
  end_time: string;
};

export type ConfirmBookingCustomer = {
  name?: string;
  email?: string;
  phone?: string;
};

export type ConfirmBookingPayload = {
  slots: BookingSlotInput[];
  totalPrice?: number;
  paymentMethod?: string;
  customer?: ConfirmBookingCustomer;
  notes?: string;
  createdBy?: number | null;
  quantityId?: number;
  promotionCode?: string;
  isLoggedInCustomer?: boolean;
};

export type ConfirmBookingRequestSlot = {
  slot_id?: number | null;
  slotId?: number | null;
  play_date?: string;
  playDate?: string;
  start_time?: string;
  startTime?: string;
  end_time?: string;
  endTime?: string;
};

export type ConfirmBookingRequestBody = {
  slots?: ConfirmBookingRequestSlot[];
  payment_method?: string;
  paymentMethod?: string;
  total_price?: number;
  totalPrice?: number;
  customer?: ConfirmBookingCustomer;
  notes?: string;
  created_by?: number;
  createdBy?: number;
  quantity_id?: number;
  quantityId?: number;
  promotion_code?: string;
  promotionCode?: string;
  isLoggedInCustomer?: boolean;
};
