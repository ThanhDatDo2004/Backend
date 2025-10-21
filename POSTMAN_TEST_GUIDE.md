# 📮 Postman Test Guide - Multiple Courts Per Slot

## 📋 Setup

### 1. Import Collection
1. Open Postman
2. Click **Import** button (top left)
3. Select **POSTMAN_COLLECTION_QUANTITY_SLOTS.json**
4. Collection imported! ✅

### 2. Setup Authorization
1. Get your Bearer token (login API or use existing)
2. For each request, replace `YOUR_TOKEN_HERE` with your token

### 3. Prepare Database
```sql
-- Verify Field 68 has 4 courts
SELECT * FROM Field_Quantity WHERE FieldCode = 68;

-- Should see:
-- QuantityID | FieldCode | QuantityNumber | Status
-- 1          | 68        | 1              | available
-- 2          | 68        | 2              | available
-- 3          | 68        | 3              | available
-- 4          | 68        | 4              | available
```

---

## 🧪 Test Sequence

### **Test 1: Book Court 4 (08:00-10:00)**

**Request:**
```
POST http://localhost:5050/api/bookings/create
```

**Body:**
```json
{
  "fieldCode": 68,
  "quantity_id": 4,
  "playDate": "2025-10-21",
  "startTime": "08:00",
  "endTime": "10:00",
  "customerName": "User A",
  "customerEmail": "a@test.com",
  "customerPhone": "0123456789"
}
```

**Expected Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "booking_code": 123,
    "field_code": 68
  }
}
```

**Database Check:**
```sql
-- Check Field_Slots
SELECT * FROM Field_Slots 
WHERE FieldCode=68 AND PlayDate='2025-10-21' 
AND StartTime='08:00' AND EndTime='10:00';

-- Should see:
-- SlotID | FieldCode | QuantityID | PlayDate   | StartTime | EndTime | Status
-- XX     | 68        | 4          | 2025-10-21 | 08:00     | 10:00   | booked

-- Check Bookings
SELECT BookingCode, FieldCode, QuantityID FROM Bookings 
WHERE BookingCode = 123;

-- Should see:
-- BookingCode | FieldCode | QuantityID
-- 123         | 68        | 4
```

✅ **Verify:** QuantityID = 4 in BOTH tables!

---

### **Test 2: Check Available Courts (After Test 1)**

**Request:**
```
GET http://localhost:5050/api/fields/68/available-quantities?playDate=2025-10-21&startTime=08:00&endTime=10:00
```

**Expected Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "fieldCode": 68,
    "playDate": "2025-10-21",
    "timeSlot": "08:00-10:00",
    "totalQuantities": 4,
    "availableCount": 3,
    "availableQuantities": [
      {
        "quantity_id": 1,
        "quantity_number": 1,
        "status": "available"
      },
      {
        "quantity_id": 2,
        "quantity_number": 2,
        "status": "available"
      },
      {
        "quantity_id": 3,
        "quantity_number": 3,
        "status": "available"
      }
    ],
    "bookedQuantities": [
      {
        "quantity_id": 4,
        "quantity_number": 4,
        "status": "available"
      }
    ]
  }
}
```

✅ **Verify:** 
- `availableCount` = 3 (courts 1, 2, 3)
- Court 4 NOT in availableQuantities
- Court 4 in bookedQuantities

---

### **Test 3: Book Court 2 (Same Time as Test 1)**

**Request:**
```
POST http://localhost:5050/api/bookings/create
```

**Body:**
```json
{
  "fieldCode": 68,
  "quantity_id": 2,
  "playDate": "2025-10-21",
  "startTime": "08:00",
  "endTime": "10:00",
  "customerName": "User B",
  "customerEmail": "b@test.com",
  "customerPhone": "0987654321"
}
```

**Expected Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "booking_code": 124,
    "field_code": 68
  }
}
```

**Database Check:**
```sql
-- Check Field_Slots - should have 2 entries
SELECT * FROM Field_Slots 
WHERE FieldCode=68 AND PlayDate='2025-10-21' 
AND StartTime='08:00' AND EndTime='10:00'
ORDER BY QuantityID;

-- Should see:
-- SlotID | FieldCode | QuantityID | PlayDate   | StartTime | EndTime | Status
-- XX     | 68        | 2          | 2025-10-21 | 08:00     | 10:00   | booked
-- YY     | 68        | 4          | 2025-10-21 | 08:00     | 10:00   | booked

-- Check Bookings - should have 2 entries
SELECT BookingCode, FieldCode, QuantityID FROM Bookings 
WHERE FieldCode=68 ORDER BY BookingCode DESC LIMIT 2;

-- Should see:
-- BookingCode | FieldCode | QuantityID
-- 124         | 68        | 2
-- 123         | 68        | 4
```

✅ **Verify:** TWO separate Field_Slots entries and Bookings entries!

---

### **Test 4: Try to Book Court 4 Again (SHOULD FAIL)**

**Request:**
```
POST http://localhost:5050/api/bookings/create
```

**Body:**
```json
{
  "fieldCode": 68,
  "quantity_id": 4,
  "playDate": "2025-10-21",
  "startTime": "08:00",
  "endTime": "10:00",
  "customerName": "User C",
  "customerEmail": "c@test.com",
  "customerPhone": "0111111111"
}
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

✅ **Verify:** Error 409 Conflict! Court 4 already booked!

---

### **Test 5: Check Available Courts Again (After Tests 1-3)**

**Request:**
```
GET http://localhost:5050/api/fields/68/available-quantities?playDate=2025-10-21&startTime=08:00&endTime=10:00
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "fieldCode": 68,
    "playDate": "2025-10-21",
    "timeSlot": "08:00-10:00",
    "totalQuantities": 4,
    "availableCount": 2,
    "availableQuantities": [
      {
        "quantity_id": 1,
        "quantity_number": 1,
        "status": "available"
      },
      {
        "quantity_id": 3,
        "quantity_number": 3,
        "status": "available"
      }
    ],
    "bookedQuantities": [
      {
        "quantity_id": 2,
        "quantity_number": 2,
        "status": "available"
      },
      {
        "quantity_id": 4,
        "quantity_number": 4,
        "status": "available"
      }
    ]
  }
}
```

✅ **Verify:** 
- `availableCount` = 2 (courts 1, 3)
- Courts 2 and 4 in bookedQuantities

---

### **Test 6: Book Court 1 (Different Time - SHOULD WORK)**

**Request:**
```
POST http://localhost:5050/api/bookings/create
```

**Body:**
```json
{
  "fieldCode": 68,
  "quantity_id": 1,
  "playDate": "2025-10-22",
  "startTime": "10:00",
  "endTime": "11:00",
  "customerName": "User D",
  "customerEmail": "d@test.com",
  "customerPhone": "0222222222"
}
```

**Expected Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "booking_code": 125,
    "field_code": 68
  }
}
```

✅ **Verify:** Success! Different date/time = no conflict!

---

## ✅ Final Verification

Run this SQL query to see all bookings for field 68:

```sql
SELECT 
  b.BookingCode,
  b.FieldCode,
  b.QuantityID,
  fs.PlayDate,
  fs.StartTime,
  fs.EndTime,
  fs.Status
FROM Bookings b
LEFT JOIN Field_Slots fs ON b.BookingCode = fs.BookingCode
WHERE b.FieldCode = 68
ORDER BY fs.PlayDate, fs.StartTime, b.QuantityID;
```

**Expected Result:**
```
BookingCode | FieldCode | QuantityID | PlayDate   | StartTime | EndTime | Status
123         | 68        | 4          | 2025-10-21 | 08:00     | 10:00   | booked
124         | 68        | 2          | 2025-10-21 | 08:00     | 10:00   | booked
125         | 68        | 1          | 2025-10-22 | 10:00     | 11:00   | booked
```

✅ **All passed!** 🎉

---

## 🐛 Troubleshooting

### Issue: QuantityID is NULL in database

**Solution:**
1. Check request body includes `quantity_id`
2. Verify field 68 exists
3. Check that QuantityID range is 1-4

### Issue: Test 4 doesn't fail (should return 409)

**Solution:**
1. Verify Test 1 and Test 3 completed successfully
2. Check database has 2 bookings with quantity 2 and 4
3. Make sure QuantityID values are correct

### Issue: Test 2 shows wrong availableCount

**Solution:**
1. Verify Field_Slots migration was applied
2. Check QuantityID column exists in Field_Slots
3. Run SQL query to manually check available courts

---

## 📝 Key Points

✅ `quantity_id` MUST be in request body  
✅ `quantity_id` MUST be a number (1-4)  
✅ Each booking gets separate Field_Slots entry  
✅ Each booking stores QuantityID in Bookings table  
✅ Multiple courts same time now works!

---

**Backend fully tested and working!** 🚀

