# 🧪 Test: Multiple Courts Per Slot (QuantityID Fix)

## ✅ Fix Summary

**Problems Fixed:**
1. ✅ `QuantityID` now properly passed from booking controller to Field_Slots
2. ✅ `QuantityID` now properly passed from booking controller to Bookings
3. ✅ Removed invalid `PlayDate, StartTime, EndTime` columns from Bookings INSERT
4. ✅ Field_Slots now has `QuantityID` to track which court is booked

---

## 🧬 Data Flow

### Before (❌ Wrong)
```
User selects Sân 4, time 08:00-10:00
    ↓
quantityID = null (not passed)
    ↓
Field_Slots INSERT: QuantityID = NULL
Bookings INSERT: QuantityID = NULL
    ↓
❌ Can't tell which court is booked!
```

### After (✅ Correct)
```
User selects Sân 4, time 08:00-10:00, quantity_id = 4
    ↓
Extract quantity_id from request: quantityID = 4
    ↓
Field_Slots INSERT: QuantityID = 4, PlayDate=..., StartTime=..., EndTime=...
Bookings INSERT: QuantityID = 4, FieldCode=...
    ↓
✅ Tracks which court is booked!
```

---

## 🧪 Test Scenario

### Setup
- Field 68 with 4 courts (QuantityID: 1, 2, 3, 4)
- Time slot: 2025-10-21, 08:00-10:00

### Test 1: Book Court 4

**Request:**
```json
POST /api/bookings/create
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
  "data": {
    "booking_code": XX,
    "field_code": 68
  }
}
```

**Database Check:**
```sql
-- Field_Slots should have entry
SELECT * FROM Field_Slots 
WHERE FieldCode=68 AND PlayDate='2025-10-21' 
AND StartTime='08:00' AND EndTime='10:00';

-- Result:
-- SlotID | FieldCode | QuantityID | PlayDate | StartTime | EndTime | Status
-- XX     | 68        | 4          | 2025-... | 08:00     | 10:00   | booked

-- Bookings should have QuantityID = 4
SELECT BookingCode, FieldCode, QuantityID FROM Bookings 
WHERE BookingCode = XX;

-- Result:
-- BookingCode | FieldCode | QuantityID
-- XX          | 68        | 4
```

✅ **Expected:** QuantityID = 4 in both tables

---

### Test 2: Check Availability for Remaining Courts

**Request:**
```
GET /api/fields/68/available-quantities?playDate=2025-10-21&startTime=08:00&endTime=10:00
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
    "availableCount": 3,
    "availableQuantities": [
      { "quantity_id": 1, "quantity_number": 1, "status": "available" },
      { "quantity_id": 2, "quantity_number": 2, "status": "available" },
      { "quantity_id": 3, "quantity_number": 3, "status": "available" }
    ],
    "bookedQuantities": [
      { "quantity_id": 4, "quantity_number": 4, "status": "available" }
    ]
  }
}
```

✅ **Expected:** Only 3 courts available (1, 2, 3), Court 4 is booked

---

### Test 3: Book Another Court (Same Time)

**Request:**
```json
POST /api/bookings/create
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

**Database Check:**
```sql
-- Field_Slots should have 2 entries
SELECT * FROM Field_Slots 
WHERE FieldCode=68 AND PlayDate='2025-10-21' 
AND StartTime='08:00' AND EndTime='10:00'
ORDER BY QuantityID;

-- Result should be:
-- SlotID | FieldCode | QuantityID | PlayDate | StartTime | EndTime | Status
-- XX     | 68        | 4          | 2025-... | 08:00     | 10:00   | booked
-- YY     | 68        | 2          | 2025-... | 08:00     | 10:00   | booked

-- Bookings should have 2 entries with different QuantityID
SELECT BookingCode, FieldCode, QuantityID FROM Bookings 
WHERE FieldCode=68 ORDER BY BookingCode DESC LIMIT 2;

-- Result:
-- BookingCode | FieldCode | QuantityID
-- YY          | 68        | 2
-- XX          | 68        | 4
```

✅ **Expected:** Two separate entries with QuantityID 2 and 4

---

### Test 4: Try to Book Same Court Again

**Request:**
```json
POST /api/bookings/create
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

✅ **Expected:** Error 409 Conflict (already booked)

---

### Test 5: Check Availability Again

**Request:**
```
GET /api/fields/68/available-quantities?playDate=2025-10-21&startTime=08:00&endTime=10:00
```

**Expected Response:**
```json
{
  "availableCount": 2,
  "availableQuantities": [
    { "quantity_id": 1, "quantity_number": 1 },
    { "quantity_id": 3, "quantity_number": 3 }
  ],
  "bookedQuantities": [
    { "quantity_id": 2, "quantity_number": 2 },
    { "quantity_id": 4, "quantity_number": 4 }
  ]
}
```

✅ **Expected:** Only courts 1 and 3 available (2 and 4 are booked)

---

## 📝 SQL Verification Queries

### Check Field_Slots has QuantityID column
```sql
DESCRIBE Field_Slots;
-- Should show QuantityID column
```

### Check all bookings for a time slot
```sql
SELECT 
  fs.SlotID,
  fs.FieldCode,
  fs.QuantityID,
  fs.PlayDate,
  fs.StartTime,
  fs.EndTime,
  b.BookingCode,
  b.QuantityID as BookingQuantityID
FROM Field_Slots fs
LEFT JOIN Bookings b ON fs.BookingCode = b.BookingCode
WHERE fs.FieldCode = 68 
  AND fs.PlayDate = '2025-10-21'
  AND fs.StartTime = '08:00'
ORDER BY fs.QuantityID;
```

### Count available courts
```sql
SELECT 
  COUNT(DISTINCT fq.QuantityID) as available_courts
FROM Field_Quantity fq
WHERE fq.FieldCode = 68
  AND fq.Status = 'available'
  AND fq.QuantityID NOT IN (
    SELECT DISTINCT b.QuantityID
    FROM Bookings b
    JOIN Field_Slots fs ON b.BookingCode = fs.BookingCode
    WHERE b.FieldCode = 68
      AND fs.PlayDate = '2025-10-21'
      AND fs.StartTime = '08:00'
      AND b.BookingStatus IN ('pending', 'confirmed')
  );
```

---

## ✅ Verification Checklist

**After running all tests:**

- [ ] Test 1: Court 4 booked successfully
  - [ ] Field_Slots has QuantityID = 4
  - [ ] Bookings has QuantityID = 4

- [ ] Test 2: Availability shows 3 courts available
  - [ ] Courts 1, 2, 3 in availableQuantities
  - [ ] Court 4 NOT in availableQuantities

- [ ] Test 3: Court 2 booked successfully
  - [ ] Field_Slots has TWO entries (QuantityID 2 and 4)
  - [ ] Bookings has TWO entries (QuantityID 2 and 4)

- [ ] Test 4: Cannot book Court 4 again
  - [ ] Error 409 returned
  - [ ] Message says "đã được đặt"

- [ ] Test 5: Availability shows 2 courts available
  - [ ] Courts 1, 3 in availableQuantities
  - [ ] Courts 2, 4 NOT in availableQuantities

---

## 🚀 Frontend Integration

**Frontend must:**
1. Send `quantity_id` in POST request body
2. Show available courts from API response
3. Let user select a court before booking

**Example:**
```javascript
// User selects court 4
const quantityId = 4;

// Send booking
const response = await fetch('/api/bookings/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fieldCode: 68,
    quantity_id: quantityId,  // IMPORTANT: pass this!
    playDate: '2025-10-21',
    startTime: '08:00',
    endTime: '10:00',
    customerName: 'User',
    customerEmail: 'user@test.com',
    customerPhone: '0123456789'
  })
});
```

---

## 📊 Summary

| Action | Before | After |
|--------|--------|-------|
| **QuantityID in Field_Slots** | NULL | ✅ Populated |
| **QuantityID in Bookings** | NULL | ✅ Populated |
| **Multiple courts same time** | ❌ All blocked | ✅ Individual tracking |
| **Database entries** | 1 per field+time | ✅ 1 per court+time |

---

**Backend is ready to test!** 🎉

