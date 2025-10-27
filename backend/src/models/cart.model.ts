import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import queryService from "../services/query";

export type CartDbRow = RowDataPacket & {
  CartID: number;
  UserID: number;
  BookingCode: number;
  ExpiresAt: Date | string;
  TotalPrice: number;
  DiscountAmount: number | null;
  PromotionCode: string | null;
  BookingStatus: string;
  PaymentStatus: string;
  CreateAt: Date | string;
  FieldCode: number;
  FieldName: string;
  SportType: string;
  Address: string | null;
  ShopName: string;
  CheckinCode: string | null;
};

export type CartSlotRow = RowDataPacket & {
  BookingCode: number;
  PlayDate: string;
  StartTime: string;
  EndTime: string;
  QuantityID: number | null;
  Status: string;
  PricePerSlot: number;
};

const cartModel = {
  async upsert(
    connection: PoolConnection,
    userId: number,
    bookingCode: number,
    expiresAt: Date
  ): Promise<void> {
    await connection.query<ResultSetHeader>(
      `INSERT INTO Booking_Carts (
         UserID,
         BookingCode,
         ExpiresAt,
         CreatedAt,
         UpdatedAt
       )
       VALUES (?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         ExpiresAt = VALUES(ExpiresAt),
         UpdatedAt = NOW()`,
      [userId, bookingCode, expiresAt]
    );
  },

  async deleteByBookingCodes(
    bookingCodes: number[],
    connection?: PoolConnection | null
  ): Promise<void> {
    if (!Array.isArray(bookingCodes) || bookingCodes.length === 0) return;

    const payload = [bookingCodes];
    if (connection) {
      await connection.query<ResultSetHeader>(
        `DELETE FROM Booking_Carts WHERE BookingCode IN (?)`,
        payload
      );
    } else {
      await queryService.query<ResultSetHeader>(
        `DELETE FROM Booking_Carts WHERE BookingCode IN (?)`,
        payload
      );
    }
  },

  async purgeByUser(userId: number): Promise<void> {
    await queryService.query<ResultSetHeader>(
      `DELETE bc
       FROM Booking_Carts bc
       LEFT JOIN Bookings b ON bc.BookingCode = b.BookingCode
       WHERE bc.UserID = ?
         AND (
           bc.ExpiresAt <= NOW()
           OR b.BookingStatus IS NULL
           OR b.BookingStatus <> 'pending'
         )`,
      [userId]
    );
  },

  async listActiveByUser(userId: number): Promise<CartDbRow[]> {
    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT
         bc.CartID,
         bc.UserID,
         bc.BookingCode,
         bc.ExpiresAt,
         b.TotalPrice,
         b.DiscountAmount,
         b.PromotionCode,
         b.BookingStatus,
         b.PaymentStatus,
         b.CreateAt,
         b.FieldCode,
         b.CheckinCode,
         f.FieldName,
         f.SportType,
         f.Address,
         s.ShopName
       FROM Booking_Carts bc
       JOIN Bookings b ON bc.BookingCode = b.BookingCode
       JOIN Fields f ON b.FieldCode = f.FieldCode
       JOIN Shops s ON f.ShopCode = s.ShopCode
       WHERE bc.UserID = ?
         AND bc.ExpiresAt > NOW()
         AND b.BookingStatus = 'pending'
       ORDER BY bc.ExpiresAt ASC`,
      [userId]
    );

    return (rows as CartDbRow[]) ?? [];
  },

  async getSlotsForBookings(bookingCodes: number[]): Promise<CartSlotRow[]> {
    if (!Array.isArray(bookingCodes) || bookingCodes.length === 0) {
      return [];
    }

    const [rows] = await queryService.query<RowDataPacket[]>(
      `SELECT
         BookingCode,
         DATE_FORMAT(PlayDate, '%Y-%m-%d') AS PlayDate,
         DATE_FORMAT(StartTime, '%H:%i') AS StartTime,
         DATE_FORMAT(EndTime, '%H:%i') AS EndTime,
         QuantityID,
         Status,
         PricePerSlot
       FROM Booking_Slots
       WHERE BookingCode IN (?)
       ORDER BY PlayDate, StartTime`,
      [bookingCodes]
    );

    return (rows as CartSlotRow[]) ?? [];
  },
};

export default cartModel;
