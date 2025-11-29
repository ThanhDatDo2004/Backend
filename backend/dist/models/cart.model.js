"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const query_1 = __importDefault(require("../services/query"));
const cartModel = {
    async upsert(connection, userId, bookingCode, expiresAt) {
        await connection.query(`INSERT INTO Booking_Carts (
         UserID,
         BookingCode,
         ExpiresAt,
         CreatedAt,
         UpdatedAt
       )
       VALUES (?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         ExpiresAt = VALUES(ExpiresAt),
         UpdatedAt = NOW()`, [userId, bookingCode, expiresAt]);
    },
    async deleteByBookingCodes(bookingCodes, connection) {
        if (!Array.isArray(bookingCodes) || bookingCodes.length === 0)
            return;
        const payload = [bookingCodes];
        if (connection) {
            await connection.query(`DELETE FROM Booking_Carts WHERE BookingCode IN (?)`, payload);
        }
        else {
            await query_1.default.query(`DELETE FROM Booking_Carts WHERE BookingCode IN (?)`, payload);
        }
    },
    async purgeByUser(userId) {
        await query_1.default.query(`DELETE bc
       FROM Booking_Carts bc
       LEFT JOIN Bookings b ON bc.BookingCode = b.BookingCode
       WHERE bc.UserID = ?
         AND (
           bc.ExpiresAt <= NOW()
           OR b.BookingStatus IS NULL
           OR b.BookingStatus <> 'pending'
         )`, [userId]);
    },
    async listActiveByUser(userId) {
        const [rows] = await query_1.default.query(`SELECT
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
       ORDER BY bc.ExpiresAt ASC`, [userId]);
        return rows ?? [];
    },
    async getSlotsForBookings(bookingCodes) {
        if (!Array.isArray(bookingCodes) || bookingCodes.length === 0) {
            return [];
        }
        const [rows] = await query_1.default.query(`SELECT
         BookingCode,
         DATE_FORMAT(PlayDate, '%Y-%m-%d') AS PlayDate,
         DATE_FORMAT(StartTime, '%H:%i') AS StartTime,
         DATE_FORMAT(EndTime, '%H:%i') AS EndTime,
         QuantityID,
         Status,
         PricePerSlot
       FROM Booking_Slots
       WHERE BookingCode IN (?)
       ORDER BY PlayDate, StartTime`, [bookingCodes]);
        return rows ?? [];
    },
};
exports.default = cartModel;
