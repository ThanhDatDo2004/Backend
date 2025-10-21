# 🧪 Comprehensive Test Plan: QuantityID Fix

## ⚙️ Setup

### Step 1: Kill Old Backend
```bash
lsof -i :5050 | grep LISTEN | awk '{print $2}' | xargs kill -9 2>/dev/null || true
sleep 2
```

### Step 2: Restart Backend
```bash
cd /Users/home/Downloads/tsNode-temp-master/backend
npm run dev
```

Wait for: `Server is running on http://localhost:5050` ✅

### Step 3: Prepare Database
```sql
-- Verify Field 68 exists with 4 quantities
SELECT QuantityID, QuantityNumber, Status FROM Field_Quantity 
WHERE FieldCode = 68
ORDER BY QuantityNumber;

-- Expected:
-- QuantityID | QuantityNumber | Status
-- 22         | 1              | available
-- 23         | 2              | available
-- 24         | 3              | available
-- 25         | 4              | available
```

---

## 🧪 Test Suite

### TEST 1: Basic Booking with QuantityID

**Objective:** Verify QuantityID is saved in Bookings table

**Request:**
```bash
curl -X POST http://localhost:5050/api/bookings/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldCode": 68,
    "quantity_id": 25,
    "playDate": "2025-10-21",
    "startTime": "08:00",
    "endTime": "09:00",
    "customerName": "Test User 1",
    "customerEmail": "test1@example.com",
    "customerPhone": "0111111111"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Tạo booking thành công",
  "data": {
    "bookingCode": 82,
    "totalPrice": 1000,
    "fieldName": "Sân 00"
  }
}
```

**Database Verification:**
```sql
SELECT BookingCode, FieldCode, QuantityID FROM Bookings 
WHERE BookingCode = 82;

-- Expected:
-- BookingCode | FieldCode | QuantityID
-- 82          | 68        | 25 ✅
```

**Status:** ✅ PASS (if QuantityID=25 is saved)

---

### TEST 2: QuantityID in Field_Slots

**Objective:** Verify QuantityID is also saved in Field_Slots

**Database Query:**
```sql
SELECT SlotID, FieldCode, QuantityID, PlayDate, StartTime, EndTime, Status 
FROM Field_Slots 
WHERE BookingCode = 82;

-- Expected:
-- SlotID | FieldCode | QuantityID | PlayDate   | StartTime | EndTime | Status
-- XX     | 68        | 25         | 2025-10-21 | 08:00:00  | 09:00:00 | booked ✅
```

**Status:** ✅ PASS (if QuantityID=25 exists in Field_Slots)

---

### TEST 3: Book Different Court Same Time

**Objective:** Multiple courts at same time should work

**Request:**
```bash
curl -X POST http://localhost:5050/api/bookings/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldCode": 68,
    "quantity_id": 24,
    "playDate": "2025-10-21",
    "startTime": "08:00",
    "endTime": "09:00",
    "customerName": "Test User 2",
    "customerEmail": "test2@example.com",
    "customerPhone": "0222222222"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "bookingCode": 83,
    "totalPrice": 1000,
    "fieldName": "Sân 00"
  }
}
```

**Database Verification:**
```sql
SELECT BookingCode, FieldCode, QuantityID FROM Bookings 
WHERE FieldCode = 68 
  AND BookingCode IN (82, 83)
ORDER BY BookingCode;

-- Expected:
-- BookingCode | FieldCode | QuantityID
-- 82          | 68        | 25 ✅
-- 83          | 68        | 24 ✅

-- Both different QuantityID, same time, same field!
```

**Status:** ✅ PASS (if BookingCode=83 with QuantityID=24 is created)

---

### TEST 4: Prevent Double-Booking Same Court

**Objective:** Booking same court twice should fail with 409

**Request:**
```bash
curl -X POST http://localhost:5050/api/bookings/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldCode": 68,
    "quantity_id": 25,
    "playDate": "2025-10-21",
    "startTime": "08:00",
    "endTime": "09:00",
    "customerName": "Test User 3",
    "customerEmail": "test3@example.com",
    "customerPhone": "0333333333"
  }'
```

**Expected Response:**
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

**Status:** ✅ PASS (if 409 error with "đã được đặt" message)

---

### TEST 5: Book Without QuantityID

**Objective:** Booking without quantity_id should still work (backward compatibility)

**Request:**
```bash
curl -X POST http://localhost:5050/api/bookings/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldCode": 68,
    "playDate": "2025-10-21",
    "startTime": "10:00",
    "endTime": "11:00",
    "customerName": "Test User 4",
    "customerEmail": "test4@example.com",
    "customerPhone": "0444444444"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "bookingCode": 84,
    "totalPrice": 1000,
    "fieldName": "Sân 00"
  }
}
```

**Database Verification:**
```sql
SELECT BookingCode, FieldCode, QuantityID FROM Bookings 
WHERE BookingCode = 84;

-- Expected:
-- BookingCode | FieldCode | QuantityID
-- 84          | 68        | NULL  (OK - no quantity specified)
```

**Status:** ✅ PASS (backward compatible - NULL is OK when not specified)

---

### TEST 6: Book Remaining Courts

**Objective:** Fill remaining 2 courts to test full capacity

**Court 22 (QuantityNumber=1):**
```bash
curl -X POST http://localhost:5050/api/bookings/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldCode": 68,
    "quantity_id": 22,
    "playDate": "2025-10-21",
    "startTime": "08:00",
    "endTime": "09:00",
    "customerName": "Test User 5",
    "customerEmail": "test5@example.com",
    "customerPhone": "0555555555"
  }'
```

**Court 23 (QuantityNumber=2):**
```bash
curl -X POST http://localhost:5050/api/bookings/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldCode": 68,
    "quantity_id": 23,
    "playDate": "2025-10-21",
    "startTime": "08:00",
    "endTime": "09:00",
    "customerName": "Test User 6",
    "customerEmail": "test6@example.com",
    "customerPhone": "0666666666"
  }'
```

**Database Check (All 4 courts booked):**
```sql
SELECT COUNT(DISTINCT QuantityID) as booked_count
FROM Bookings b
JOIN Field_Slots fs ON b.BookingCode = fs.BookingCode
WHERE b.FieldCode = 68 
  AND fs.PlayDate = '2025-10-21'
  AND fs.StartTime = '08:00:00'
  AND fs.EndTime = '09:00:00';

-- Expected: 4 (all 4 courts booked)
```

**Status:** ✅ PASS (if count = 4)

---

### TEST 7: Try to Book When Full

**Objective:** Booking non-existent quantity should fail

**Request:**
```bash
curl -X POST http://localhost:5050/api/bookings/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldCode": 68,
    "quantity_id": 99,
    "playDate": "2025-10-21",
    "startTime": "08:00",
    "endTime": "09:00",
    "customerName": "Test User 7",
    "customerEmail": "test7@example.com",
    "customerPhone": "0777777777"
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "statusCode": 404,
  "error": {
    "status": "error",
    "message": "Sân không tồn tại hoặc không thuộc sân loại này"
  }
}
```

**Status:** ✅ PASS (if 404 error)

---

### TEST 8: Check Availability API

**Objective:** Verify available-quantities endpoint works

**Request:**
```bash
curl -X GET "http://localhost:5050/api/fields/68/available-quantities?playDate=2025-10-21&startTime=08:00&endTime=09:00" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "fieldCode": 68,
    "playDate": "2025-10-21",
    "timeSlot": "08:00-09:00",
    "totalQuantities": 4,
    "availableCount": 0,
    "availableQuantities": [],
    "bookedQuantities": [
      {"quantity_id": 22, "quantity_number": 1, "status": "available"},
      {"quantity_id": 23, "quantity_number": 2, "status": "available"},
      {"quantity_id": 24, "quantity_number": 3, "status": "available"},
      {"quantity_id": 25, "quantity_number": 4, "status": "available"}
    ]
  }
}
```

**Status:** ✅ PASS (if all 4 courts shown as booked)

---

## 📊 Summary Results

### Quick Check

```sql
-- Count all bookings created
SELECT COUNT(*) FROM Bookings WHERE FieldCode = 68 AND CreateAt > NOW() - INTERVAL 30 MINUTE;
-- Expected: 6 (tests 1-6)

-- Check all have QuantityID
SELECT 
  SUM(CASE WHEN QuantityID IS NOT NULL THEN 1 ELSE 0 END) as with_quantity,
  SUM(CASE WHEN QuantityID IS NULL THEN 1 ELSE 0 END) as without_quantity
FROM Bookings 
WHERE FieldCode = 68 
  AND CreateAt > NOW() - INTERVAL 30 MINUTE;

-- Expected: with_quantity=5, without_quantity=1 (test 5 has no quantity)

-- Check Field_Slots matches Bookings
SELECT 
  COUNT(DISTINCT b.QuantityID) as unique_bookings,
  COUNT(DISTINCT fs.QuantityID) as unique_slots
FROM Bookings b
LEFT JOIN Field_Slots fs ON b.BookingCode = fs.BookingCode
WHERE b.FieldCode = 68 
  AND fs.PlayDate = '2025-10-21'
  AND fs.StartTime = '08:00:00'
  AND fs.EndTime = '09:00:00';

-- Expected: both values same (if all synced)
```

---

## ✅ Final Validation Checklist

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| TEST 1: Save QuantityID | QuantityID=25 | ? | ? |
| TEST 2: Field_Slots has QuantityID | QuantityID=25 | ? | ? |
| TEST 3: Multiple courts same time | BookingCode=83 | ? | ? |
| TEST 4: Prevent double-book | 409 error | ? | ? |
| TEST 5: Backward compat (no quantity) | BookingCode=84 | ? | ? |
| TEST 6: All courts booked | count=4 | ? | ? |
| TEST 7: Invalid quantity | 404 error | ? | ? |
| TEST 8: Availability API | 0 available | ? | ? |

---

## 🎯 Success Criteria

✅ **ALL of the following must be true:**
1. QuantityID is saved in Bookings table
2. QuantityID is saved in Field_Slots table
3. Same court can't be double-booked (409 error)
4. Different courts can be booked at same time
5. Backward compatibility maintained (works without quantity_id)
6. Availability API shows correct counts
7. Multiple courts show as booked in availability

---

## 🚀 If All Tests Pass

The fix is complete and working! 🎉

**Next Steps:**
1. Deploy to production
2. Update frontend to use quantity_id in booking requests
3. Test full workflow in production environment

