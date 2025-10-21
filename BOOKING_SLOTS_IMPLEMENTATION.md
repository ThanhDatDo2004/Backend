# ✅ Booking_Slots Implementation - Code Update Complete

## 🎯 Tóm Tắt Các Thay Đổi

Bạn đã migrate dữ liệu, giờ code đã được update để:
- ✅ Insert vào **Bookings** (thông tin chung, không có time)
- ✅ Insert vào **Booking_Slots** (1 row cho mỗi khung giờ)
- ✅ Query từ **Booking_Slots** thay vì **Field_Slots**

---

## 📝 Files Được Sửa

### 1️⃣ `backend/src/services/booking.service.ts`

**Thay Đổi**: Hàm `confirmFieldBooking()`

```typescript
// CŨ: Insert vào Bookings với PlayDate, StartTime, EndTime
INSERT INTO Bookings (
  FieldCode,
  PlayDate,
  StartTime,
  EndTime,
  TotalPrice,
  ...
)

// MỚI: Insert vào Bookings mà KHÔNG có PlayDate, StartTime, EndTime
INSERT INTO Bookings (
  FieldCode,
  CustomerUserID,
  TotalPrice,
  ...
)

// THÊM: Insert vào Booking_Slots (1 row/slot)
for (const slot of normalizedSlots) {
  INSERT INTO Booking_Slots (
    BookingCode,
    FieldCode,
    PlayDate,
    StartTime,
    EndTime,
    PricePerSlot,
    Status
  )
}

// THÊM: Update Field_Slots để track sân
UPDATE Field_Slots SET Status='held', BookingCode=?, ...
```

**Lợi Ích**:
- ✅ 1 Booking = 1 row trong Bookings
- ✅ N Slots = N rows trong Booking_Slots
- ✅ Rõ ràng, không nhầm lẫn

---

### 2️⃣ `backend/src/controllers/booking.controller.ts`

**Thay Đổi 1**: Hàm `getBooking()`

```typescript
// CŨ: Query từ Field_Slots
SELECT * FROM Field_Slots WHERE BookingCode = ?

// MỚI: Query từ Booking_Slots
SELECT 
  Slot_ID,
  PlayDate,
  DATE_FORMAT(StartTime, '%H:%i') as StartTime,
  DATE_FORMAT(EndTime, '%H:%i') as EndTime,
  PricePerSlot,
  Status
FROM Booking_Slots 
WHERE BookingCode = ?
```

**Thay Đổi 2**: Hàm `listBookings()`

```typescript
// CŨ: Query từ Field_Slots
SELECT * FROM Field_Slots WHERE BookingCode = ?

// MỚI: Query từ Booking_Slots
SELECT 
  Slot_ID,
  PlayDate,
  DATE_FORMAT(StartTime, '%H:%i') as StartTime,
  ...
FROM Booking_Slots 
WHERE BookingCode = ?
```

**Thay Đổi 3**: Hàm `listShopBookings()`

```typescript
// CŨ: Query từ Field_Slots
SELECT * FROM Field_Slots WHERE BookingCode = ?

// MỚI: Query từ Booking_Slots
SELECT ... FROM Booking_Slots WHERE BookingCode = ?
```

**Thay Đổi 4**: Hàm `cancelBooking()`

```typescript
// THÊM: Update Booking_Slots khi hủy booking
UPDATE Booking_Slots 
SET Status = 'cancelled', UpdateAt = NOW()
WHERE BookingCode = ?

// GIỮ NGUYÊN: Update Field_Slots
UPDATE Field_Slots 
SET Status = 'available', BookingCode = NULL, ...
WHERE BookingCode = ?
```

---

### 3️⃣ `backend/src/services/payment.service.ts`

**Thay Đổi**: Hàm `handlePaymentSuccess()`

```typescript
// MỚI: Update Booking_Slots
UPDATE Booking_Slots 
SET Status = 'booked', UpdateAt = NOW()
WHERE BookingCode = ? AND Status = 'pending'

// GIỮ NGUYÊN: Update Field_Slots
UPDATE Field_Slots 
SET Status = 'booked', HoldExpiresAt = NULL, ...
WHERE BookingCode = ? AND Status = 'held'
```

---

## 📊 Flow Mới

### Khi User Chọn 2 Khung Giờ

```
1. POST /api/fields/48/bookings/confirm
   {
     slots: [
       {play_date: "2025-10-22", start_time: "10:00", end_time: "11:00"},
       {play_date: "2025-10-22", start_time: "11:00", end_time: "12:00"}
     ]
   }

2. Backend: confirmFieldBooking()
   ✅ INSERT Bookings (1 row)
      BookingCode = 123
      (NO PlayDate, StartTime, EndTime)
   
   ✅ INSERT Booking_Slots (2 rows)
      Row 1: BookingCode=123, StartTime="10:00", EndTime="11:00", Status='pending'
      Row 2: BookingCode=123, StartTime="11:00", EndTime="12:00", Status='pending'
   
   ✅ UPDATE Field_Slots (2 rows)
      Row 1: BookingCode=123, Status='held'
      Row 2: BookingCode=123, Status='held'

3. Response:
   {
     booking_code: 123,
     slots: [2 items]
   }

4. Frontend: Hiện QR thanh toán

5. User thanh toán thành công

6. Backend: handlePaymentSuccess()
   ✅ UPDATE Bookings: PaymentStatus='paid', BookingStatus='confirmed'
   ✅ UPDATE Booking_Slots: Status='booked'
   ✅ UPDATE Field_Slots: Status='booked'
```

---

## 🧪 Test API

### Test 1: Tạo Booking
```bash
curl -X POST http://localhost:5050/api/fields/48/bookings/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "slots": [
      {"play_date": "2025-10-22", "start_time": "10:00", "end_time": "11:00"},
      {"play_date": "2025-10-22", "start_time": "11:00", "end_time": "12:00"}
    ]
  }'
```

**Expected**:
```json
{
  "booking_code": 123,
  "slots": [
    {"slot_id": 1, "start_time": "10:00", "end_time": "11:00"},
    {"slot_id": 2, "start_time": "11:00", "end_time": "12:00"}
  ]
}
```

### Test 2: Lấy Chi Tiết Booking
```bash
curl http://localhost:5050/api/bookings/123
```

**Expected**: Có `slots` array với 2 items

### Test 3: Verify Database
```sql
-- Check Bookings (không có PlayDate, StartTime, EndTime)
SELECT BookingCode, FieldCode, TotalPrice FROM Bookings WHERE BookingCode = 123;

-- Check Booking_Slots (có tất cả time info)
SELECT * FROM Booking_Slots WHERE BookingCode = 123;

-- Check Field_Slots (để reference)
SELECT * FROM Field_Slots WHERE BookingCode = 123;
```

---

## ✅ Kiểm Tra Danh Sách

- [x] booking.service.ts - Insert vào Booking_Slots
- [x] booking.controller.ts - Query từ Booking_Slots
- [x] payment.service.ts - Update Booking_Slots
- [x] cancelBooking - Update Booking_Slots
- [x] No linting errors
- [x] Code compiles

---

## 🚀 Deploy

```bash
cd backend
npm run build   # ✅ Should compile
npm start       # ✅ Should start
curl http://localhost:5050/api/bookings  # ✅ Should return bookings with slots
```

---

## 📌 Quan Trọng

✅ **Bookings table** - Chỉ thông tin chung
✅ **Booking_Slots table** - Chi tiết khung giờ (NEW)
✅ **Field_Slots table** - Track sân (giữ nguyên)

Tất cả code đã update để dùng Booking_Slots thay vì Bookings.PlayDate/StartTime/EndTime

---

## 🎉 Hoàn Thành!

Code đã sẵn sàng để test!

