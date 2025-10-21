# 📮 API: Confirm Booking - Chi Tiết & Test Data

## 🔗 API Endpoint

### 1. Create Booking (Từ Booking Page)
```
POST /api/bookings/create
```

**Mục đích:** User chọn sân + khung giờ → Tạo booking

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN
```

**Request Body:**
```json
{
  "fieldCode": 68,
  "quantity_id": 22,
  "playDate": "2025-10-21",
  "startTime": "08:00",
  "endTime": "09:00",
  "customerName": "Nguyễn Văn A",
  "customerEmail": "a@example.com",
  "customerPhone": "0123456789"
}
```

**Response (Success - 201):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Tạo booking thành công",
  "data": {
    "bookingCode": 80,
    "totalPrice": 100000,
    "fieldName": "Sân 00"
  }
}
```

**Response (Error - 409):**
```json
{
  "success": false,
  "statusCode": 409,
  "error": {
    "status": "error",
    "message": "Sân này đã được đặt trong khung giờ này"
  }
}
```

---

### 2. Confirm Booking (Từ Payment Result Page)
```
POST /api/field/68/confirm
```

**Mục đích:** Sau khi thanh toán xong → Confirm booking

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN
```

**Request Body - Single Slot:**
```json
{
  "slots": [
    {
      "playDate": "2025-10-21",
      "startTime": "08:00",
      "endTime": "09:00"
    }
  ],
  "quantity_id": 22,
  "total_price": 100000,
  "payment_method": "bank_transfer",
  "customer": {
    "name": "Nguyễn Văn A",
    "email": "a@example.com",
    "phone": "0123456789"
  },
  "notes": "Xin hãy chuẩn bị sân sạch"
}
```

**Request Body - Multiple Slots (Same Court):**
```json
{
  "slots": [
    {
      "playDate": "2025-10-21",
      "startTime": "08:00",
      "endTime": "09:00"
    },
    {
      "playDate": "2025-10-21",
      "startTime": "09:00",
      "endTime": "10:00"
    }
  ],
  "quantity_id": 22,
  "total_price": 200000,
  "payment_method": "bank_transfer",
  "customer": {
    "name": "Nguyễn Văn A",
    "email": "a@example.com",
    "phone": "0123456789"
  },
  "notes": ""
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Booking xác nhận thành công",
  "data": {
    "booking_code": "80",
    "transaction_id": "TXABCD1234",
    "payment_status": "mock_success",
    "field_code": 68,
    "qr_code": "https://qr.sepay.vn/img?acc=96247THUERE&bank=BIDV&amount=200000&des=BK80",
    "paymentID": 70,
    "amount": 200000,
    "slots": [
      {
        "slot_id": 1,
        "play_date": "2025-10-21",
        "start_time": "08:00",
        "end_time": "09:00"
      },
      {
        "slot_id": 2,
        "play_date": "2025-10-21",
        "start_time": "09:00",
        "end_time": "10:00"
      }
    ]
  }
}
```

---

## 📋 Test Data

### Test Case 1: Book Single Court - Single Slot

**Setup:**
- Field: 68 (Sân 00, bóng đá)
- Court: 22 (Sân 1)
- Date: 2025-10-21
- Time: 08:00-09:00
- Price: 100,000 VNĐ

**Request:**
```json
POST /api/bookings/create

{
  "fieldCode": 68,
  "quantity_id": 22,
  "playDate": "2025-10-21",
  "startTime": "08:00",
  "endTime": "09:00",
  "customerName": "Nguyễn Văn A",
  "customerEmail": "a@example.com",
  "customerPhone": "0123456789"
}
```

**Expected Result:**
```
✅ BookingCode created (e.g., 80)
✅ totalPrice = 100,000
✅ Status: Pending
✅ QuantityID = 22 (Sân 1) saved in Bookings
```

---

### Test Case 2: Book Single Court - Multiple Slots

**Setup:**
- Field: 68
- Court: 23 (Sân 2)
- Date: 2025-10-21
- Time: 10:00-12:00 (2 slots)
- Price: 200,000 VNĐ (100k x 2)

**Request:**
```json
POST /api/field/68/confirm

{
  "slots": [
    {
      "playDate": "2025-10-21",
      "startTime": "10:00",
      "endTime": "11:00"
    },
    {
      "playDate": "2025-10-21",
      "startTime": "11:00",
      "endTime": "12:00"
    }
  ],
  "quantity_id": 23,
  "total_price": 200000,
  "payment_method": "bank_transfer",
  "customer": {
    "name": "Nguyễn Văn B",
    "email": "b@example.com",
    "phone": "0987654321"
  },
  "notes": "Vui lòng chuẩn bị bóng mới"
}
```

**Expected Result:**
```
✅ BookingCode created
✅ totalPrice = 200,000
✅ 2 slots created in Field_Slots
✅ QuantityID = 23 (Sân 2) in both Bookings and Field_Slots
✅ Field_Slots.Status = 'held' (giữ chỗ tạm)
```

---

### Test Case 3: Try to Book Same Court - Should FAIL

**Setup:**
- Same court (22 - Sân 1) at same time (08:00-09:00) on same date

**Request:**
```json
POST /api/bookings/create

{
  "fieldCode": 68,
  "quantity_id": 22,
  "playDate": "2025-10-21",
  "startTime": "08:00",
  "endTime": "09:00",
  "customerName": "Nguyễn Văn C",
  "customerEmail": "c@example.com",
  "customerPhone": "0111111111"
}
```

**Expected Result:**
```
❌ Error 409 Conflict
❌ Message: "Sân này đã được đặt trong khung giờ này"
```

---

### Test Case 4: Book Different Court - Same Time - Should SUCCESS

**Setup:**
- Court: 24 (Sân 3) - DIFFERENT from Test Case 1
- Same date & time: 2025-10-21, 08:00-09:00

**Request:**
```json
POST /api/bookings/create

{
  "fieldCode": 68,
  "quantity_id": 24,
  "playDate": "2025-10-21",
  "startTime": "08:00",
  "endTime": "09:00",
  "customerName": "Nguyễn Văn D",
  "customerEmail": "d@example.com",
  "customerPhone": "0222222222"
}
```

**Expected Result:**
```
✅ BookingCode created (e.g., 81)
✅ Success! Different court can be booked
✅ QuantityID = 24 (Sân 3)
```

---

## 📊 Verify in Database

### After Test Case 1 & 4

**Check Field_Slots:**
```sql
SELECT 
  SlotID,
  FieldCode,
  QuantityID,
  PlayDate,
  StartTime,
  EndTime,
  Status,
  BookingCode
FROM Field_Slots
WHERE FieldCode = 68 
  AND PlayDate = '2025-10-21'
  AND StartTime = '08:00:00'
ORDER BY QuantityID;

-- Expected:
-- SlotID: 1, FieldCode: 68, QuantityID: 22, Status: held, BookingCode: 80
-- SlotID: 2, FieldCode: 68, QuantityID: 24, Status: held, BookingCode: 81
```

**Check Bookings:**
```sql
SELECT 
  BookingCode,
  FieldCode,
  QuantityID,
  PaymentStatus,
  BookingStatus
FROM Bookings
WHERE BookingCode IN (80, 81);

-- Expected:
-- BookingCode: 80, FieldCode: 68, QuantityID: 22, PaymentStatus: pending
-- BookingCode: 81, FieldCode: 68, QuantityID: 24, PaymentStatus: pending
```

---

## 🔑 Key Points for Testing

1. **quantity_id (lowercase)** - Important!
   ```
   ✅ Correct: "quantity_id": 22
   ❌ Wrong: "quantityID": 22
   ```

2. **Use DIFFERENT BookingCodes for different tests**
   - Test 1: BookingCode 80
   - Test 2: BookingCode 81
   - Test 3: Will fail (same as Test 1)
   - Test 4: BookingCode 82

3. **Check available-quantities API first**
   ```
   GET /api/fields/68/available-quantities?playDate=2025-10-21&startTime=08:00&endTime=09:00
   
   Should show:
   - availableCount: 4 (initially all available)
   - After Test 1: availableCount: 3 (Court 22 booked)
   - After Test 4: availableCount: 2 (Court 22 & 24 booked)
   ```

4. **Payment Status = 'pending'** after creation
   - Change to 'paid' manually in database to complete booking
   - Or use payment endpoint

5. **Field_Slots.Status**
   ```
   'held' = Sân đang được giữ chỗ (15 phút)
   'booked' = Sân đã được đặt (payment confirmed)
   'available' = Sân còn trống
   ```

---

## ⚡ Quick Copy-Paste Test Data

### Postman Pre-request Script
```javascript
// Set token if needed
pm.environment.set("token", "YOUR_TOKEN_HERE");

// Log current time
console.log("Test time:", new Date().toLocaleString());
```

### Test 1 - Single Slot
```json
{
  "fieldCode": 68,
  "quantity_id": 22,
  "playDate": "2025-10-21",
  "startTime": "08:00",
  "endTime": "09:00",
  "customerName": "Nguyễn Văn A",
  "customerEmail": "a@example.com",
  "customerPhone": "0123456789"
}
```

### Test 2 - Multiple Slots
```json
{
  "slots": [
    {
      "playDate": "2025-10-21",
      "startTime": "10:00",
      "endTime": "11:00"
    },
    {
      "playDate": "2025-10-21",
      "startTime": "11:00",
      "endTime": "12:00"
    }
  ],
  "quantity_id": 23,
  "total_price": 200000,
  "payment_method": "bank_transfer",
  "customer": {
    "name": "Nguyễn Văn B",
    "email": "b@example.com",
    "phone": "0987654321"
  }
}
```

---

## ✅ Success Checklist

- [ ] Test 1: Single court, single slot → BookingCode created
- [ ] Test 2: Single court, multiple slots → Multiple slots created
- [ ] Test 3: Same court again → 409 error
- [ ] Test 4: Different court, same time → Success
- [ ] Database: QuantityID saved in Bookings
- [ ] Database: QuantityID saved in Field_Slots
- [ ] API: available-quantities returns correct counts

