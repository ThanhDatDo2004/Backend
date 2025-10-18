import { ResultSetHeader, RowDataPacket } from "mysql2";
import { PoolConnection } from "mysql2/promise";
import { StatusCodes } from "http-status-codes";
import ApiError from "../utils/apiErrors";
import queryService from "./query";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

export type BookingSlotInput = {
  slot_id?: number | null;
  play_date: string;
  start_time: string;
  end_time: string;
};

export type ConfirmBookingPayload = {
  slots: BookingSlotInput[];
  total_price?: number;
  payment_method?: string;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  notes?: string;
  created_by?: number | null;
};

type NormalizedSlot = {
  key: string;
  slot_id?: number | null;
  play_date: string;
  start_time: string;
  end_time: string;
  db_date: string;
  db_start_time: string;
  db_end_time: string;
};

type SlotRow = RowDataPacket & {
  SlotID: number;
  Status: string;
  HoldExpiresAt: string | null;
};

export type ConfirmBookingResult = {
  booking_code: string;
  transaction_id: string;
  payment_status: "mock_success";
  field_code: number;
  qr_code: string;
  paymentID: number;
  amount: number;
  slots: Array<{
    slot_id: number;
    play_date: string;
    start_time: string;
    end_time: string;
  }>;
};

const normalizeTime = (value: string) => {
  const trimmed = String(value ?? "").trim();
  const match = trimmed.match(TIME_REGEX);
  if (!match) return null;
  return `${match[1]}:${match[2]}:00`;
};

const normalizeDate = (value: string) => {
  const trimmed = String(value ?? "").trim();
  if (!DATE_REGEX.test(trimmed)) return null;
  return trimmed;
};

function normalizeSlots(slots: BookingSlotInput[]): NormalizedSlot[] {
  if (!Array.isArray(slots) || !slots.length) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Vui lòng chọn ít nhất một khung giờ để đặt sân."
    );
  }

  const normalized = slots.map((slot, index) => {
    const playDate = normalizeDate(slot.play_date);
    if (!playDate) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Ngày thi đấu không hợp lệ ở vị trí ${index + 1}.`
      );
    }

    const startTime = normalizeTime(slot.start_time);
    const endTime = normalizeTime(slot.end_time);

    if (!startTime || !endTime) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Khung giờ không hợp lệ ở vị trí ${index + 1}.`
      );
    }

    if (startTime >= endTime) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Giờ bắt đầu phải nhỏ hơn giờ kết thúc (slot ${index + 1}).`
      );
    }

    const key = `${playDate}|${startTime}|${endTime}`;

    return {
      key,
      slot_id: typeof slot.slot_id === "number" ? slot.slot_id : null,
      play_date: playDate,
      start_time: startTime.slice(0, 5),
      end_time: endTime.slice(0, 5),
      db_date: playDate,
      db_start_time: startTime,
      db_end_time: endTime,
    };
  });

  const unique = new Map<string, NormalizedSlot>();
  normalized.forEach((slot) => {
    if (!unique.has(slot.key)) {
      unique.set(slot.key, slot);
    }
  });

  return Array.from(unique.values()).sort((a, b) => {
    if (a.play_date !== b.play_date) {
      return a.play_date.localeCompare(b.play_date);
    }
    return a.db_start_time.localeCompare(b.db_start_time);
  });
}

const generateBookingCode = () => {
  const partA = Date.now().toString(36).toUpperCase();
  const partB = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BK-${partA}-${partB}`;
};

const generateTransactionId = () => {
  const partA = Math.random().toString(36).slice(2, 6).toUpperCase();
  const partB = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TX-${partA}${partB}`;
};

const generateCheckinCode = () => {
  // Generate unique checkin code: 6-8 alphanumeric
  return Math.random().toString(36).slice(2, 10).toUpperCase();
};

async function lockSlot(
  connection: PoolConnection,
  fieldCode: number,
  slot: NormalizedSlot
): Promise<SlotRow | null> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `
      SELECT SlotID, Status, HoldExpiresAt
      FROM Field_Slots
      WHERE FieldCode = ?
        AND PlayDate = ?
        AND StartTime = ?
        AND EndTime = ?
      FOR UPDATE
    `,
    [fieldCode, slot.db_date, slot.db_start_time, slot.db_end_time]
  );
  return (rows?.[0] as SlotRow) ?? null;
}

async function updateExistingSlot(
  connection: PoolConnection,
  row: SlotRow,
  slot: NormalizedSlot
) {
  if (!row) return;
  if (row.Status !== "available") {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Khung giờ ${slot.start_time} - ${slot.end_time} ngày ${slot.play_date} đã được đặt trước đó.`
    );
  }

  await connection.query<ResultSetHeader>(
    `
      UPDATE Field_Slots
      SET Status = 'booked',
          HoldExpiresAt = NULL,
          UpdateAt = NOW()
      WHERE SlotID = ?
    `,
    [row.SlotID]
  );
}

async function insertNewSlot(
  connection: PoolConnection,
  fieldCode: number,
  slot: NormalizedSlot,
  createdBy?: number | null
): Promise<number> {
  const [result] = await connection.query<ResultSetHeader>(
    `
      INSERT INTO Field_Slots (
        FieldCode,
        PlayDate,
        StartTime,
        EndTime,
        Status,
        HoldExpiresAt,
        CreatedBy
      )
      VALUES (?, ?, ?, ?, 'booked', NULL, ?)
    `,
    [fieldCode, slot.db_date, slot.db_start_time, slot.db_end_time, createdBy]
  );

  return Number(result.insertId);
}

export async function confirmFieldBooking(
  fieldCode: number,
  payload: ConfirmBookingPayload
): Promise<ConfirmBookingResult> {
  if (!Number.isFinite(fieldCode) || fieldCode <= 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Mã sân không hợp lệ.");
  }

  const normalizedSlots = normalizeSlots(payload.slots);

  // Lấy field info để tính giá
  const [fieldRows] = await queryService.query<RowDataPacket[]>(
    `SELECT FieldCode, DefaultPricePerHour FROM Fields WHERE FieldCode = ?`,
    [fieldCode]
  );

  if (!fieldRows?.[0]) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Không tìm thấy sân.");
  }

  const field = fieldRows[0];
  const pricePerSlot = field.DefaultPricePerHour || 100000;
  const totalPrice = pricePerSlot;
  const platformFee = Math.round(totalPrice * 0.05);
  const netToShop = totalPrice - platformFee;

  let bookingCode: number = 0;

  const result = await queryService.execTransaction(
    "confirmFieldBooking",
    async (connection) => {
      // 1. Xử lý slots (lock, update, insert)
      const updatedSlots: ConfirmBookingResult["slots"] = [];

      for (const slot of normalizedSlots) {
        const row = await lockSlot(connection, fieldCode, slot);

        if (row) {
          await updateExistingSlot(connection, row, slot);
          updatedSlots.push({
            slot_id: Number(row.SlotID),
            play_date: slot.play_date,
            start_time: slot.start_time,
            end_time: slot.end_time,
          });
        } else {
          const insertedId = await insertNewSlot(
            connection,
            fieldCode,
            slot,
            payload.created_by ?? null
          );
          updatedSlots.push({
            slot_id: insertedId,
            play_date: slot.play_date,
            start_time: slot.start_time,
            end_time: slot.end_time,
          });
        }
      }

      if (!updatedSlots.length) {
        throw new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          "Không thể ghi nhận khung giờ đã chọn."
        );
      }

      // 2. Tạo booking thực vào DB
      const userID = payload.created_by || 1;
      const playDate = normalizedSlots[0].db_date;
      const startTime = normalizedSlots[0].db_start_time;
      const endTime = normalizedSlots[0].db_end_time;
      const checkinCode = generateCheckinCode();

      const [bookingResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO Bookings (
          FieldCode,
          CustomerUserID,
          CustomerName,
          CustomerEmail,
          CustomerPhone,
          PlayDate,
          StartTime,
          EndTime,
          TotalPrice,
          PlatformFee,
          NetToShop,
          CheckinCode,
          BookingStatus,
          PaymentStatus,
          CreateAt,
          UpdateAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', NOW(), NOW())`,
        [
          fieldCode,
          userID,
          payload.customer?.name || null,
          payload.customer?.email || null,
          payload.customer?.phone || null,
          playDate,
          startTime,
          endTime,
          totalPrice,
          platformFee,
          netToShop,
          checkinCode,
        ]
      );

      bookingCode = (bookingResult as any).insertId;

      // 3. Link slots với booking - set status to 'held' for 15 minutes
      // Only lock when payment is confirmed
      const holdExpiryTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
      for (const slot of updatedSlots) {
        await connection.query<ResultSetHeader>(
          `UPDATE Field_Slots 
           SET Status = 'held', BookingCode = ?, HoldExpiresAt = ?, UpdateAt = NOW()
           WHERE SlotID = ?`,
          [bookingCode, holdExpiryTime, slot.slot_id]
        );
      }

      return updatedSlots;
    }
  );

  // Return INT booking code thực từ DB
  const transactionId = generateTransactionId();

  // Tạo payment record
  const [bankRows] = await queryService.query<RowDataPacket[]>(
    `SELECT AdminBankID FROM Admin_Bank_Accounts WHERE IsDefault = 'Y' LIMIT 1`,
    []
  );

  if (!bankRows?.[0]) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      "Chưa setup tài khoản ngân hàng admin"
    );
  }

  const adminBankID = bankRows[0].AdminBankID;
  const paymentMethod = "bank_transfer";

  // Tạo payment
  const [paymentResult] = await queryService.query<ResultSetHeader>(
    `INSERT INTO Payments_Admin (
      BookingCode,
      AdminBankID,
      PaymentMethod,
      Amount,
      PaymentStatus,
      CreateAt
    ) VALUES (?, ?, ?, ?, 'pending', NOW())`,
    [bookingCode, adminBankID, paymentMethod, totalPrice]
  );

  const paymentID = (paymentResult as any).insertId;

  // Build SePay QR URL
  const sepayAcc = process.env.SEPAY_ACC || "96247THUERE";
  const sepayBank = process.env.SEPAY_BANK || "BIDV";
  const des = `BK${bookingCode}`;
  const qrUrl = `https://qr.sepay.vn/img?acc=${encodeURIComponent(
    sepayAcc
  )}&bank=${encodeURIComponent(sepayBank)}&amount=${encodeURIComponent(
    totalPrice
  )}&des=${encodeURIComponent(des)}`;

  return {
    booking_code: String(bookingCode),
    transaction_id: transactionId,
    payment_status: "mock_success",
    field_code: fieldCode,
    qr_code: qrUrl,
    paymentID: paymentID,
    amount: totalPrice,
    slots: result,
  };
}

const bookingService = {
  confirmFieldBooking,
};

export default bookingService;
