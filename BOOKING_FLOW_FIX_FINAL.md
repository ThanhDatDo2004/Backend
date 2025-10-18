# 📋 BOOKING FLOW - FIXES SUMMARY

## 🎯 Vấn đề Được Giải Quyết

Backend đã được cập nhật để khắc phục 3 vấn đề chính:

### ✅ Vấn đề 1: Thông tin người đặt không được lưu
**Status:** FIXED ✓

**Frontend gửi:**
```json
POST /fields/:fieldCode/bookings/confirm
{
  "slots": [...],
  "customer": {
    "name": "Nguyễn Văn A",
    "email": "a@example.com",
    "phone": "0912345678"
  },
  "payment_method": "bank_transfer",
  "total_price": 300000
}
```

**Thay đổi Backend:**
- File: `backend/src/services/booking.service.ts` (line 301-328)
- Thêm 3 cột vào INSERT booking: `CustomerName`, `CustomerEmail`, `CustomerPhone`
- Payload từ frontend được lưu trực tiếp vào database

```sql
-- Trước (KHÔNG lưu customer info):
INSERT INTO Bookings (FieldCode, CustomerUserID, PlayDate, ...)

-- Sau (LƯU customer info):
INSERT INTO Bookings (
  FieldCode, 
  CustomerUserID, 
  CustomerName,           -- ✅ NEW
  CustomerEmail,          -- ✅ NEW
  CustomerPhone,          -- ✅ NEW
  PlayDate, 
  ...
)
```

---

### ✅ Vấn đề 2: Giờ đặt bị lock sớm (trước khi thanh toán)
**Status:** FIXED ✓

**Vấn đề cũ:**
- User chọn giờ → Click "Xác nhận đặt sân" → Slot bị `Status = 'booked'` ngay
- Quay lại `/booking/48` → Giờ đã KHÔNG còn available
- **Result:** Giờ bị lock dù chưa thanh toán ❌

**Giải pháp mới (Hold-Lock Pattern):**

```
┌─────────────────────────────────────────────┐
│ FLOW 1: Payment CHƯA hoàn tất (User còn trong payment page)
├─────────────────────────────────────────────┤
│ 1. User chọn giờ + info → Click "Xác nhận"
│ 2. POST /fields/:fieldCode/bookings/confirm
│ 3. Slot Status = 'hold'                ← 15 phút
│    HoldExpiresAt = NOW() + 15 phút
│ 4. Backend return BookingCode + PaymentID
│ 5. Frontend display QR code SePay
│ 6. If User quay lại /booking/48:
│    - Slot vẫn available ✓ (chưa lock)
│ 7. After 15 phút:
│    - Slot auto release → 'available'
│
│ Result: Giờ vẫn có sẵn nếu user không thanh toán ✓
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ FLOW 2: Payment thành công (Webhook từ SePay)
├─────────────────────────────────────────────┤
│ 1. SePay webhook nhận transfer
│ 2. Backend: updatePaymentStatus("paid")
│ 3. Gọi handlePaymentSuccess()
│ 4. Slot Status = 'hold' → 'booked'     ✓ LOCK
│    HoldExpiresAt = NULL
│ 5. Booking Status = 'pending' → 'confirmed'
│    Payment Status = 'pending' → 'paid'
│ 6. Frontend hiển thị mã check-in
│
│ Result: Giờ bị lock vĩnh viễn (đã thanh toán) ✓
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ FLOW 3: Payment thất bại (User không thanh toán)
├─────────────────────────────────────────────┤
│ 1. User không chuyển khoản trong 15 phút
│ 2. Hold expires → Slot auto release
│   (Background job hoặc khi check availability)
│ 3. Slot Status = 'hold' → 'available'
│    BookingCode = NULL
│    HoldExpiresAt = NULL
│ 4. Frontend: User quay lại /booking/48
│    Giờ vừa chọn vẫn available ✓
│
│ Result: Giờ được release, ai cũng có thể đặt ✓
└─────────────────────────────────────────────┘
```

**Thay đổi Backend:**

1. **booking.service.ts** (line 332-340):
   ```typescript
   // Trước: Status = 'booked'
   SET Status = 'booked', BookingCode = ?, UpdateAt = NOW()
   
   // Sau: Status = 'hold' với 15 phút expiry
   const holdExpiryTime = new Date(Date.now() + 15 * 60 * 1000);
   SET Status = 'hold', BookingCode = ?, HoldExpiresAt = ?, UpdateAt = NOW()
   ```

2. **payment.service.ts** (line 143-152):
   Thêm logic lock slot khi payment success:
   ```typescript
   // Lock slots - change status from 'hold' to 'booked'
   UPDATE Field_Slots 
   SET Status = 'booked', HoldExpiresAt = NULL, UpdateAt = NOW()
   WHERE BookingCode = ? AND Status = 'hold'
   ```

3. **payment.service.ts** (line 244-251):
   Thêm function release held slots:
   ```typescript
   export async function releaseHeldSlots(bookingCode: string | number) {
     UPDATE Field_Slots 
     SET Status = 'available', BookingCode = NULL, HoldExpiresAt = NULL
     WHERE BookingCode = ? AND Status = 'hold'
   }
   ```

4. **field.service.ts** (line 228-250):
   Smart slot availability check:
   ```typescript
   function mapSlotRow(slot: FieldSlotRow) {
     // Check if hold has expired
     if (slot.status === "hold" && slot.hold_expires_at) {
       if (NOW() > hold_expires_at) {
         status = "available"  // Treat as available
       }
     }
   }
   ```

---

### ✅ Vấn đề 3: Route 404 khi xem chi tiết booking
**Status:** FRONTEND NEEDED ✓

**Backend đã có:**
- ✅ `GET /api/bookings/:bookingCode` - Chi tiết booking
- ✅ `GET /api/bookings/:bookingCode/checkin-code` - Mã check-in

**Frontend cần kiểm tra:**
```javascript
// Phải có route trong frontend router:
/bookings/:bookingId          // Trang chi tiết booking
/bookings/:bookingId/checkin-code  // Trang mã check-in

// Khi click "Xem Chi Tiết", gọi:
GET /api/bookings/42

// Khi click "Xem Mã Check-In", gọi:
GET /api/bookings/42/checkin-code
```

---

## 📊 Database Schema Changes

**Field_Slots table** cần support:
```sql
ALTER TABLE Field_Slots ADD COLUMN IF NOT EXISTS HoldExpiresAt DATETIME NULL;

-- Status values:
-- 'available' → Chưa đặt, có sẵn để đặt
-- 'hold'      → Được hold 15 phút, chưa lock vĩnh viễn
-- 'booked'    → Đã lock (payment thành công hoặc booking confirmed)
-- 'cancelled' → Đã hủy
```

**Bookings table** cần support:
```sql
ALTER TABLE Bookings ADD COLUMN IF NOT EXISTS CustomerName VARCHAR(255) NULL;
ALTER TABLE Bookings ADD COLUMN IF NOT EXISTS CustomerEmail VARCHAR(255) NULL;
ALTER TABLE Bookings ADD COLUMN IF NOT EXISTS CustomerPhone VARCHAR(20) NULL;
```

---

## 🔄 API Endpoints

### 1. Create Booking (Hold slots 15 phút)
```
POST /fields/:fieldCode/bookings/confirm
Body: {
  "slots": [
    {"play_date": "2025-10-25", "start_time": "18:00", "end_time": "19:00"}
  ],
  "customer": {
    "name": "Nguyễn Văn A",
    "email": "a@example.com",
    "phone": "0912345678"
  },
  "payment_method": "bank_transfer",
  "total_price": 300000
}

Response:
{
  "booking_code": "123",
  "paymentID": 456,
  "qr_code": "https://qr.sepay.vn/img?...",
  "amount": 300000,
  "slots": [...]
}
```

### 2. Check Payment Status
```
GET /api/payments/bookings/:bookingCode/status

Response:
{
  "status": "pending" | "paid" | "failed",
  "amount": 300000,
  "paidAt": "2025-10-20 18:05:00" | null
}
```

### 3. Get Booking Details
```
GET /api/bookings/:bookingCode

Response:
{
  "BookingCode": 123,
  "CustomerName": "Nguyễn Văn A",
  "CustomerEmail": "a@example.com",
  "CustomerPhone": "0912345678",
  "FieldName": "Sân A",
  "PlayDate": "2025-10-25",
  "StartTime": "18:00",
  "EndTime": "19:00",
  "BookingStatus": "confirmed",
  "PaymentStatus": "paid",
  "slots": [...]
}
```

### 4. Get Check-In Code
```
GET /api/bookings/:bookingCode/checkin-code

Response:
{
  "bookingCode": 123,
  "checkinCode": "ABC123XYZ"
}
```

---

## 🧪 Testing Checklist

- [ ] **Test 1:** User chọn giờ, điền customer info, click "Xác nhận"
  - [ ] Booking được tạo với status `pending`
  - [ ] Slot status = `hold` (không `booked`)
  - [ ] CustomerName, Email, Phone được lưu
  - [ ] Return booking_code + payment_qr_code

- [ ] **Test 2:** User quay lại `/booking/48` sau 5 phút
  - [ ] Giờ vừa chọn vẫn **không available** (đang hold) ✓

- [ ] **Test 3:** User quay lại `/booking/48` sau 20 phút (quá 15 phút)
  - [ ] Giờ vừa chọn **available lại** (hold expired) ✓

- [ ] **Test 4:** User thanh toán (webhook SePay)
  - [ ] Booking status = `confirmed`
  - [ ] Payment status = `paid`
  - [ ] Slot status = `booked` (lock vĩnh viễn)
  - [ ] Check-in code được tạo

- [ ] **Test 5:** Click "Xem Chi Tiết Booking" từ payment page
  - [ ] Navigate đến `/bookings/123`
  - [ ] Hiển thị booking details (không 404)

- [ ] **Test 6:** Click "Xem Mã Check-In"
  - [ ] Navigate đến `/bookings/123/checkin-code`
  - [ ] Hiển thị mã check-in (không 404)

---

## 📝 Frontend Implementation Notes

**Trong step 2 (Nhập thông tin người đặt):**
```javascript
// Ensure form fields are submitted with booking confirm
const confirmBooking = async () => {
  const payload = {
    slots: selectedSlots,
    customer: {
      name: formData.customerName,      // ← Gửi
      email: formData.customerEmail,    // ← Gửi
      phone: formData.customerPhone     // ← Gửi
    },
    payment_method: "bank_transfer",
    total_price: totalPrice
  };
  
  // POST /fields/:fieldCode/bookings/confirm
  const response = await api.post(
    `/fields/${fieldCode}/bookings/confirm`,
    payload
  );
  
  // Redirect to payment page
  navigate(`/payment/${response.booking_code}`);
};
```

**Display availability correctly:**
```javascript
// getAvailability API trả về slots với:
// - status: "available" | "hold" | "booked"
// - hold_expires_at: "2025-10-20 18:05:00" | null
// - is_available: boolean (AI smart calculate)

const isSlotBookable = (slot) => {
  // Backend đã tính toán smart, chỉ cần check is_available
  return slot.is_available === true;
};
```

---

## 🚀 Deployment Steps

1. **Backup database**
   ```sql
   -- Check columns exist
   SHOW COLUMNS FROM Field_Slots LIKE 'HoldExpiresAt';
   SHOW COLUMNS FROM Bookings LIKE 'CustomerName';
   ```

2. **Add columns if not exists** (migration script)
   ```sql
   ALTER TABLE Field_Slots ADD COLUMN HoldExpiresAt DATETIME NULL;
   ALTER TABLE Bookings ADD COLUMN CustomerName VARCHAR(255) NULL;
   ALTER TABLE Bookings ADD COLUMN CustomerEmail VARCHAR(255) NULL;
   ALTER TABLE Bookings ADD COLUMN CustomerPhone VARCHAR(20) NULL;
   ```

3. **Redeploy backend**
   ```bash
   cd backend
   npm install
   npm run build
   pm2 restart app  # hoặc deployment method của bạn
   ```

4. **Test APIs with Postman/curl**
   ```bash
   curl -X POST http://localhost:5050/api/fields/48/bookings/confirm \
     -H "Content-Type: application/json" \
     -d '{
       "slots": [{"play_date": "2025-10-25", "start_time": "18:00", "end_time": "19:00"}],
       "customer": {"name": "Tester", "email": "test@example.com", "phone": "0912345678"},
       "payment_method": "bank_transfer",
       "total_price": 300000
     }'
   ```

---

## 📞 Support

Nếu gặp lỗi:
- Check `backend/src/services/booking.service.ts` - logic tạo booking
- Check `backend/src/services/payment.service.ts` - logic lock slot khi payment
- Check `backend/src/services/field.service.ts` - logic check availability
- Check database Field_Slots table - HoldExpiresAt column
