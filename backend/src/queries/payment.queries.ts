// SQL templates cho payment operations
export const PAYMENT_QUERIES = {
  // Lấy booking với shop info
  GET_BOOKING_WITH_SHOP: `
    SELECT b.*, f.ShopCode, f.FieldCode, f.DefaultPricePerHour
    FROM Bookings b
    JOIN Fields f ON b.FieldCode = f.FieldCode
    WHERE b.BookingCode = ?
  `,

  // Lấy default admin bank account
  GET_DEFAULT_ADMIN_BANK: `
    SELECT AdminBankID FROM Admin_Bank_Accounts 
    WHERE IsDefault = 'Y' 
    LIMIT 1
  `,

  // Tạo payment
  CREATE_PAYMENT: `
    INSERT INTO Payments_Admin (
      BookingCode, AdminBankID, PaymentMethod, Amount, PaymentStatus, CreateAt
    ) VALUES (?, ?, ?, ?, 'pending', NOW())
  `,

  // Lấy payment theo ID
  GET_PAYMENT_BY_ID: `
    SELECT * FROM Payments_Admin WHERE PaymentID = ?
  `,

  // Lấy payment theo MomoTransactionID
  GET_PAYMENT_BY_MOMO_TRANSACTION: `
    SELECT * FROM Payments_Admin WHERE MomoTransactionID = ?
  `,

  // Lấy payment theo MomoOrderId
  GET_PAYMENT_BY_MOMO_ORDER: `
    SELECT * FROM Payments_Admin WHERE MomoOrderId = ?
  `,

  // Lấy payment theo BookingCode
  GET_PAYMENT_BY_BOOKING: `
    SELECT * FROM Payments_Admin 
    WHERE BookingCode = ? 
    ORDER BY UpdateAt DESC, PaymentID DESC 
    LIMIT 1
  `,

  // Cập nhật payment status
  UPDATE_PAYMENT_STATUS: `
    UPDATE Payments_Admin 
    SET PaymentStatus = ?, MomoTransactionID = ?, MomoRequestID = ?, UpdateAt = NOW()
    WHERE PaymentID = ?
  `,

  // Lấy booking info từ payment ID
  GET_BOOKING_INFO_BY_PAYMENT: `
    SELECT b.*, pa.Amount, pa.PaymentStatus, f.ShopCode
    FROM Bookings b
    JOIN Payments_Admin pa ON b.BookingCode = pa.BookingCode
    JOIN Fields f ON b.FieldCode = f.FieldCode
    WHERE pa.PaymentID = ?
  `,

  // Lấy danh sách payments
  LIST_PAYMENTS: `
    SELECT * FROM Payments_Admin
    ORDER BY CreateAt DESC
    LIMIT ? OFFSET ?
  `,

  // Đếm payments
  COUNT_PAYMENTS: `
    SELECT COUNT(*) as total FROM Payments_Admin
  `,

  // Lấy payments theo status
  LIST_PAYMENTS_BY_STATUS: `
    SELECT * FROM Payments_Admin
    WHERE PaymentStatus = ?
    ORDER BY CreateAt DESC
    LIMIT ? OFFSET ?
  `,

  // Cập nhật booking khi thanh toán thành công
  CONFIRM_BOOKING_STATUS: `
    UPDATE Bookings 
    SET BookingStatus = 'confirmed',
        PaymentStatus = 'paid',
        PaymentID = COALESCE(PaymentID, ?),
        UpdateAt = NOW()
    WHERE BookingCode = ?
  `,

  // Đánh dấu các slot booking là booked
  UPDATE_BOOKING_SLOTS_TO_BOOKED: `
    UPDATE Booking_Slots 
    SET Status = 'booked', UpdateAt = NOW()
    WHERE BookingCode = ? AND Status = 'pending'
  `,

  // Đánh dấu các slot field là booked
  UPDATE_FIELD_SLOTS_TO_BOOKED: `
    UPDATE Field_Slots 
    SET Status = 'booked', HoldExpiresAt = NULL, UpdateAt = NOW()
    WHERE BookingCode = ? AND Status = 'held'
  `,

  // Lấy số tiền thanh toán
  GET_PAYMENT_AMOUNT: `
    SELECT Amount FROM Payments_Admin WHERE PaymentID = ?
  `,

  // Tăng số dư ví shop
  UPSERT_SHOP_WALLET: `
    INSERT INTO Shop_Wallets (ShopCode, Balance, CreateAt, UpdateAt)
    VALUES (?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE 
      Balance = Balance + VALUES(Balance),
      UpdateAt = NOW()
  `,

  // Tăng số lần thuê sân
  INCREMENT_FIELD_RENT: `
    UPDATE Fields
    SET Rent = Rent + 1,
        UpdateAt = NOW()
    WHERE FieldCode = ?
  `,

  // Tạo log giao dịch ví
  CREATE_WALLET_TRANSACTION: `
    INSERT INTO Wallet_Transactions (
      ShopCode,
      BookingCode,
      Type,
      Amount,
      Note,
      Status,
      CreateAt
    ) VALUES (?, ?, ?, ?, ?, ?, NOW())
  `,

  // Lấy thông tin slot đầu tiên để gửi email
  GET_BOOKING_SLOT_FOR_EMAIL: `
    SELECT b.BookingCode,
           b.CustomerEmail,
           b.CustomerName,
           b.CheckinCode,
           f.FieldName, 
           DATE_FORMAT(bs.PlayDate, '%Y-%m-%d') as PlayDate,
           DATE_FORMAT(bs.StartTime, '%H:%i') as StartTime,
           DATE_FORMAT(bs.EndTime, '%H:%i') as EndTime
    FROM Bookings b
    JOIN Fields f ON b.FieldCode = f.FieldCode
    JOIN Booking_Slots bs ON b.BookingCode = bs.BookingCode
    WHERE b.BookingCode = ?
    ORDER BY bs.PlayDate, bs.StartTime
    LIMIT 1
  `,

  // Lưu log thanh toán
  INSERT_PAYMENT_LOG: `
    INSERT INTO Payment_Logs (
      PaymentID,
      Action,
      RequestData,
      ResponseData,
      MomoTransactionID,
      ResultCode,
      ResultMessage,
      CreateAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
  `,

  // Lấy trạng thái booking
  GET_BOOKING_STATUS: `
    SELECT BookingCode, TotalPrice, PaymentStatus
    FROM Bookings
    WHERE BookingCode = ?
  `,

  // Kiểm tra webhook SePay đã ghi log chưa
  CHECK_PAYMENT_LOG_BY_ACTION: `
    SELECT LogID
    FROM Payment_Logs
    WHERE PaymentID = ? AND Action = ?
    LIMIT 1
  `,

  // Kiểm tra log theo transaction id
  CHECK_PAYMENT_LOG_BY_TRANSACTION: `
    SELECT LogID
    FROM Payment_Logs
    WHERE Action = ? AND MomoTransactionID = ?
    LIMIT 1
  `,

  // Tìm payment pending theo số tiền
  FIND_PENDING_PAYMENT_BY_AMOUNT: `
    SELECT *
    FROM Payments_Admin
    WHERE PaymentStatus = 'pending' AND Amount = ?
    ORDER BY CreateAt DESC
    LIMIT 1
  `,

  // Lấy booking và field để trả kết quả thanh toán
  GET_BOOKING_FOR_RESULT: `
    SELECT b.*, f.ShopCode, f.FieldCode, f.FieldName
    FROM Bookings b
    JOIN Fields f ON b.FieldCode = f.FieldCode
    WHERE b.BookingCode = ?
  `,

  // Lấy danh sách slot theo booking
  LIST_SLOTS_BY_BOOKING: `
    SELECT SlotID AS slot_id,
           QuantityID AS quantity_id,
           QuantityNumber AS quantity_number,
           DATE_FORMAT(PlayDate, '%Y-%m-%d') AS play_date,
           DATE_FORMAT(StartTime, '%H:%i') AS start_time,
           DATE_FORMAT(EndTime, '%H:%i') AS end_time,
           Status AS status
    FROM Field_Slots
    WHERE BookingCode = ?
    ORDER BY PlayDate, StartTime
  `,
};
