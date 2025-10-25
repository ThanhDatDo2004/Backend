
// SQL templates for booking operations, corrected and aligned with SQL.md
export const BOOKING_QUERIES = {
  GET_EXPIRED_HELD_SLOTS: `
    SELECT SlotID as slotId, BookingCode as bookingCode
    FROM Field_Slots
    WHERE Status = 'held' AND HoldExpiresAt IS NOT NULL AND HoldExpiresAt < NOW()
  `,
  RELEASE_EXPIRED_HELD_SLOTS: `
    UPDATE Field_Slots
    SET Status = 'available', HoldExpiresAt = NULL, BookingCode = NULL
    WHERE Status = 'held' AND HoldExpiresAt IS NOT NULL AND HoldExpiresAt < NOW()
  `,
  RELEASE_HELD_SLOTS_BY_BOOKING: `
    UPDATE Field_Slots
    SET Status = 'available', HoldExpiresAt = NULL, BookingCode = NULL
    WHERE BookingCode = ?
  `,
  LIST_BOOKINGS_BY_CUSTOMER: `
    SELECT b.*, f.FieldName, s.ShopName
    FROM Bookings b
    JOIN Fields f ON b.FieldCode = f.FieldCode
    JOIN Shops s ON f.ShopCode = s.ShopCode
    WHERE b.CustomerUserID = ?
    ORDER BY b.CreateAt DESC
    LIMIT ? OFFSET ?
  `,
  COUNT_BOOKINGS_BY_CUSTOMER: `
    SELECT COUNT(*) as total
    FROM Bookings
    WHERE CustomerUserID = ?
  `,
  GET_BOOKING_DETAIL: `
    SELECT b.*, f.FieldName, s.ShopName
    FROM Bookings b
    JOIN Fields f ON b.FieldCode = f.FieldCode
    JOIN Shops s ON f.ShopCode = s.ShopCode
    WHERE b.BookingCode = ?
  `,
  GET_BOOKING_SLOTS: `
    SELECT * FROM Booking_Slots
    WHERE BookingCode = ?
    ORDER BY PlayDate, StartTime
  `,
  CANCEL_BOOKING: `
    UPDATE Bookings
    SET BookingStatus = 'cancelled', UpdateAt = NOW()
    WHERE BookingCode = ?
  `,
  DECREMENT_FIELD_RENT: `
    UPDATE Fields
    SET Rent = Rent - 1
    WHERE FieldCode = ?
  `,
  GET_FIELD_INFO: `
    SELECT FieldCode, ShopCode, FieldName, DefaultPricePerHour
    FROM Fields
    WHERE FieldCode = ?
  `,
  CHECK_PROMOTION_USAGE_BY_USER: `
    SELECT COUNT(*) as usage_count
    FROM Bookings
    WHERE CustomerUserID = ? AND PromotionID = ?
  `,
  CHECK_PROMOTION_TOTAL_USAGE: `
    SELECT COUNT(*) as total_usage
    FROM Bookings
    WHERE PromotionID = ?
  `,
  CANCEL_EXPIRED_BOOKINGS: `
    UPDATE Bookings
    SET BookingStatus = 'cancelled', PaymentStatus = 'failed', UpdateAt = NOW()
    WHERE BookingStatus = 'pending' AND BookingCode IN (?)
  `,
  CREATE_BOOKING_DETAILED: `
    INSERT INTO Bookings (
      FieldCode, QuantityID, CustomerUserID, CustomerName, CustomerEmail, CustomerPhone,
      TotalPrice, PlatformFee, NetToShop, DiscountAmount, PromotionID, PromotionCode,
      CheckinCode, BookingStatus, PaymentStatus, CreateAt, UpdateAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', NOW(), NOW())
  `,
  INSERT_BOOKING_SLOT_DETAILED: `
    INSERT INTO Booking_Slots (
      BookingCode, FieldCode, QuantityID, PlayDate, StartTime, EndTime,
      PricePerSlot, Status, CreateAt, UpdateAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())
  `,
  GET_BOOKING_BY_CODE: `
    SELECT * FROM Bookings WHERE BookingCode = ?
  `,
  RELEASE_HELD_SLOTS_BY_IDS: `
    UPDATE Field_Slots
    SET Status = 'available', HoldExpiresAt = NULL, BookingCode = NULL
    WHERE SlotID IN (?)
  `,
  RELEASE_HELD_SLOTS_STRICT: `
    UPDATE Field_Slots
    SET Status = 'available', BookingCode = NULL, HoldExpiresAt = NULL, UpdateAt = NOW()
    WHERE BookingCode = ? AND Status = 'held'
  `,
  LOCK_FIELD_SLOT: `
    SELECT SlotID, Status, HoldExpiresAt, QuantityID
    FROM Field_Slots
    WHERE FieldCode = ? AND PlayDate = ? AND StartTime = ? AND EndTime = ? {{QUANTITY_CONDITION}}
    FOR UPDATE
  `,
  UPDATE_EXISTING_FIELD_SLOT: `
    UPDATE Field_Slots
    SET Status = 'booked', HoldExpiresAt = NULL, QuantityID = IFNULL(?, QuantityID), UpdateAt = NOW()
    WHERE SlotID = ?
  `,
  UPSERT_FIELD_SLOT: `
    INSERT INTO Field_Slots (
      FieldCode, QuantityID, PlayDate, StartTime, EndTime, Status, HoldExpiresAt, CreatedBy
    ) VALUES (?, ?, ?, ?, ?, 'available', NULL, ?)
    ON DUPLICATE KEY UPDATE SlotID = LAST_INSERT_ID(SlotID)
  `,
  UPDATE_FIELD_SLOT_TO_HELD: `
    UPDATE Field_Slots
    SET Status = 'held', BookingCode = ?, HoldExpiresAt = ?, UpdateAt = NOW()
    WHERE SlotID = ?
  `,
  UPDATE_FIELD_SLOT_HELD_WITH_QUANTITY: `
    UPDATE Field_Slots
    SET Status = 'held', BookingCode = ?, HoldExpiresAt = ?, QuantityID = IFNULL(?, QuantityID), UpdateAt = NOW()
    WHERE FieldCode = ? AND PlayDate = ? AND StartTime = ? AND EndTime = ? AND (QuantityID = ? OR QuantityID IS NULL)
  `,
  UPSERT_FIELD_SLOT_HELD_WITH_QUANTITY: `
    INSERT INTO Field_Slots (
      FieldCode, QuantityID, PlayDate, StartTime, EndTime, Status,
      BookingCode, HoldExpiresAt, CreatedBy, CreateAt, UpdateAt
    ) VALUES (?, ?, ?, ?, ?, 'held', ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      Status = 'held',
      BookingCode = VALUES(BookingCode),
      HoldExpiresAt = VALUES(HoldExpiresAt),
      QuantityID = IFNULL(VALUES(QuantityID), QuantityID),
      UpdateAt = NOW()
  `,
  UPDATE_FIELD_SLOT_HELD_NO_QUANTITY: `
    UPDATE Field_Slots
    SET Status = 'held', BookingCode = ?, HoldExpiresAt = ?, UpdateAt = NOW()
    WHERE FieldCode = ? AND PlayDate = ? AND StartTime = ? AND EndTime = ?
  `,
  UPSERT_FIELD_SLOT_HELD_NO_QUANTITY: `
    INSERT INTO Field_Slots (
      FieldCode, QuantityID, PlayDate, StartTime, EndTime, Status,
      BookingCode, HoldExpiresAt, CreatedBy, CreateAt, UpdateAt
    ) VALUES (?, NULL, ?, ?, ?, 'held', ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      Status = 'held',
      BookingCode = VALUES(BookingCode),
      HoldExpiresAt = VALUES(HoldExpiresAt),
      UpdateAt = NOW()
  `,
  RELEASE_HELD_SLOTS_BY_BOOKING_CODES: `
    UPDATE Field_Slots
    SET Status = 'available', BookingCode = NULL, HoldExpiresAt = NULL, UpdateAt = NOW()
    WHERE Status = 'pending' AND BookingCode IN (?)
  `,
  CANCEL_BOOKINGS: `
    UPDATE Bookings
    SET BookingStatus = 'cancelled',
        PaymentStatus = CASE WHEN PaymentStatus = 'paid' THEN PaymentStatus ELSE 'failed' END,
        UpdateAt = NOW()
    WHERE BookingStatus = 'pending' AND BookingCode IN (?)
  `,
  FAIL_PENDING_PAYMENTS: `
    UPDATE Payments_Admin
    SET PaymentStatus = 'failed', UpdateAt = NOW()
    WHERE PaymentStatus = 'pending' AND BookingCode IN (?)
  `,
  CHECK_QUANTITY_EXISTS: `
    SELECT QuantityID FROM Field_Quantity
    WHERE QuantityID = ? AND FieldCode = ? LIMIT 1
  `,
  GET_QUANTITY_STATUS: `
    SELECT Status FROM Field_Quantity WHERE QuantityID = ? LIMIT 1
  `,
  CHECK_QUANTITY_BOOKED_FOR_SLOT: `
    SELECT COUNT(*) as cnt
    FROM Bookings b
    JOIN Booking_Slots bs ON b.BookingCode = bs.BookingCode
    WHERE b.QuantityID = ? AND bs.PlayDate = ? AND bs.StartTime = ? AND bs.EndTime = ?
      AND b.BookingStatus IN ('pending', 'confirmed')
    LIMIT 1
  `,
  CHECK_SLOT_EXISTS: `
    SELECT SlotID FROM Field_Slots
    WHERE FieldCode = ? AND PlayDate = ? AND StartTime = ? AND EndTime = ? AND Status = 'available'
    LIMIT 1
  `,
  CREATE_FIELD_SLOT: `
    INSERT INTO Field_Slots (
      FieldCode, QuantityID, PlayDate, StartTime, EndTime, Status, CreateAt, UpdateAt
    ) VALUES (?, ?, ?, ?, ?, 'available', NOW(), NOW())
  `,
  UPDATE_FIELD_SLOT_TO_AVAILABLE: `
    UPDATE Field_Slots
    SET Status = 'available', QuantityID = IFNULL(?, QuantityID), UpdateAt = NOW()
    WHERE FieldCode = ? AND PlayDate = ? AND StartTime = ? AND EndTime = ?
  `,
  UPDATE_BOOKING_STATUS: `
    UPDATE Bookings
    SET BookingStatus = ?, UpdateAt = NOW()
    WHERE BookingCode = ?
  `,
  SET_BOOKING_COMPLETED: `
    UPDATE Bookings
    SET CompletedAt = NOW(), UpdateAt = NOW()
    WHERE BookingCode = ?
  `,
  UPDATE_CHECKIN_TIME: `
    UPDATE Bookings
    SET CheckinTime = NOW(), UpdateAt = NOW()
    WHERE BookingCode = ?
  `,
  GET_CHECKIN_INFO: `
    SELECT BookingCode, CheckinCode, BookingStatus, CheckinTime
    FROM Bookings
    WHERE BookingCode = ?
  `,
  GET_BOOKING_SLOTS_DETAILED: `
    SELECT
      bs.Slot_ID, bs.QuantityID, fq.QuantityNumber,
      DATE_FORMAT(bs.PlayDate, '%Y-%m-%d') AS PlayDate,
      DATE_FORMAT(bs.StartTime, '%H:%i') AS StartTime,
      DATE_FORMAT(bs.EndTime, '%H:%i') AS EndTime,
      bs.PricePerSlot, bs.Status
    FROM Booking_Slots bs
    LEFT JOIN Field_Quantity fq ON bs.QuantityID = fq.QuantityID
    WHERE bs.BookingCode = ?
    ORDER BY bs.PlayDate, bs.StartTime
  `,
  CREATE_SIMPLE_BOOKING: `
    INSERT INTO Bookings (
      FieldCode, QuantityID, CustomerUserID, CustomerName, CustomerEmail, CustomerPhone,
      TotalPrice, PlatformFee, NetToShop, BookingStatus, PaymentStatus, CreateAt, UpdateAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', NOW(), NOW())
  `,
  CREATE_BOOKING_SLOT_SIMPLE: `
    INSERT INTO Booking_Slots (
      BookingCode, FieldCode, QuantityID, PlayDate, StartTime, EndTime,
      PricePerSlot, Status, CreateAt, UpdateAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'booked', NOW(), NOW())
  `,
  UPDATE_FIELD_SLOT_TO_BOOKED_SIMPLE: `
    UPDATE Field_Slots
    SET Status = 'booked', BookingCode = ?, QuantityID = IFNULL(?, QuantityID), UpdateAt = NOW()
    WHERE FieldCode = ? AND PlayDate = ? AND StartTime = ? AND EndTime = ? AND Status = 'available'
  `,
  INCREMENT_FIELD_RENT: `
    UPDATE Fields
    SET Rent = Rent + 1
    WHERE FieldCode = ?
  `,
  CANCEL_PENDING_BOOKINGS_FOR_SHOP: `
    UPDATE Bookings
    SET BookingStatus = 'cancelled', PaymentStatus = 'failed', UpdateAt = NOW()
    WHERE BookingStatus = 'pending'
      AND TIMESTAMPDIFF(MINUTE, CreateAt, NOW()) > 10
      AND FieldCode IN (SELECT FieldCode FROM Fields WHERE ShopCode = ?)
  `,
  LIST_SHOP_BOOKINGS: `
    SELECT b.BookingCode, b.FieldCode, b.CustomerUserID, b.BookingStatus, b.PaymentStatus,
           b.TotalPrice, b.NetToShop, b.CheckinCode, b.CheckinTime, b.CreateAt, b.UpdateAt,
           u.FullName AS CustomerName, b.CustomerPhone, f.FieldName
    FROM Bookings b
    JOIN Fields f ON b.FieldCode = f.FieldCode
    LEFT JOIN Users u ON b.CustomerUserID = u.UserID
    WHERE f.ShopCode = ?
  `,
  COUNT_SHOP_BOOKINGS: `
    SELECT COUNT(*) as total
    FROM Bookings b
    JOIN Fields f ON b.FieldCode = f.FieldCode
    LEFT JOIN Users u ON b.CustomerUserID = u.UserID
    WHERE f.ShopCode = ?
  `,
};
