import {
  type BookingSlotInput,
  type ConfirmBookingCustomer,
  type ConfirmBookingPayload,
  type ConfirmBookingRequestBody,
  type ConfirmBookingRequestSlot,
} from "../types/booking";

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const asString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }
  return undefined;
};

const normalizeCustomer = (
  customer?: ConfirmBookingCustomer | null
): ConfirmBookingCustomer | undefined => {
  if (!customer || typeof customer !== "object") {
    return undefined;
  }

  const name = asString(customer.name);
  const email = asString(customer.email);
  const phone = asString(customer.phone);

  if (!name && !email && !phone) {
    return undefined;
  }

  return {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  };
};

const normalizeSlots = (
  slots?: ConfirmBookingRequestSlot[]
): BookingSlotInput[] => {
  if (!Array.isArray(slots)) {
    return [];
  }

  const normalized: BookingSlotInput[] = [];

  slots.forEach((slot) => {
    if (!slot || typeof slot !== "object") {
      return;
    }
    const slotId = asNumber(slot.slot_id ?? slot.slotId);
    const playDate = asString(slot.play_date ?? slot.playDate);
    const startTime = asString(slot.start_time ?? slot.startTime);
    const endTime = asString(slot.end_time ?? slot.endTime);

    if (!playDate || !startTime || !endTime) {
      return;
    }

    normalized.push({
      ...(slotId !== undefined ? { slot_id: slotId } : {}),
      play_date: playDate,
      start_time: startTime,
      end_time: endTime,
    });
  });

  return normalized;
};

export const normalizeConfirmBookingRequest = (
  body: ConfirmBookingRequestBody | null | undefined
): ConfirmBookingPayload => {
  const safeBody = body ?? {};

  const slots = normalizeSlots(safeBody.slots);
  const paymentMethod =
    asString(safeBody.paymentMethod) ?? asString(safeBody.payment_method);
  const totalPrice =
    asNumber(safeBody.totalPrice) ?? asNumber(safeBody.total_price);
  const notes = asString(safeBody.notes);
  const createdBy =
    asNumber(safeBody.createdBy) ?? asNumber(safeBody.created_by);
  const quantityId =
    asNumber(safeBody.quantityId) ?? asNumber(safeBody.quantity_id);
  const promotionCodeRaw =
    asString(safeBody.promotionCode) ?? asString(safeBody.promotion_code);
  const promotionCode = promotionCodeRaw?.toUpperCase();
  const customer = normalizeCustomer(safeBody.customer);
  const isLoggedInCustomer =
    typeof safeBody.isLoggedInCustomer === "boolean"
      ? safeBody.isLoggedInCustomer
      : undefined;

  return {
    slots,
    ...(paymentMethod ? { paymentMethod } : {}),
    ...(totalPrice !== undefined ? { totalPrice } : {}),
    ...(notes ? { notes } : {}),
    ...(createdBy !== undefined ? { createdBy } : {}),
    ...(quantityId !== undefined ? { quantityId } : {}),
    ...(promotionCode ? { promotionCode } : {}),
    ...(customer ? { customer } : {}),
    ...(isLoggedInCustomer !== undefined ? { isLoggedInCustomer } : {}),
  };
};
