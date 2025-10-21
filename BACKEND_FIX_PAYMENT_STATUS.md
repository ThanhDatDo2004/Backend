# ✅ Backend Fix: PaymentStatus = 'paid' Logic

## 📋 Change Summary

### Before (❌ Wrong)
```
Checked: BookingStatus IN ('pending', 'confirmed')
Problem: Shows sân as booked even if payment not completed
```

### After (✅ Correct)
```
Checked: PaymentStatus = 'paid'
Result: Only shows sân as booked when payment is confirmed
```

---

## 🔧 What Was Fixed

**File:** `backend/src/models/fieldQuantity.model.ts`

### Method 1: `getAvailableForSlot()`
**Purpose:** Get available (không được đặt) courts for a time slot

**Old Query (Wrong):**
```sql
AND b.BookingStatus IN ('pending', 'confirmed')
AND EXISTS (
  SELECT 1 FROM Field_Slots fs
  WHERE fs.BookingCode = b.BookingCode
    AND fs.Status IN ('booked', 'held')
)
```

**New Query (Correct):**
```sql
INNER JOIN Field_Slots fs ON b.BookingCode = fs.BookingCode
WHERE b.FieldCode = ?
  AND b.QuantityID IS NOT NULL
  AND b.PaymentStatus = 'paid'
  AND fs.FieldCode = ?
  AND fs.PlayDate = ?
  AND fs.StartTime < ?
  AND fs.EndTime > ?
```

---

### Method 2: `getBookedForSlot()`
**Purpose:** Get booked (được đặt) courts for a time slot

**Old Query (Wrong):**
```sql
AND b.BookingStatus IN ('pending', 'confirmed')
AND EXISTS (...)
```

**New Query (Correct):**
```sql
INNER JOIN Field_Slots fs ON b.BookingCode = fs.BookingCode
WHERE b.FieldCode = ?
  AND b.QuantityID IS NOT NULL
  AND b.PaymentStatus = 'paid'
  AND fs.FieldCode = ?
  AND fs.PlayDate = ?
  AND fs.StartTime < ?
  AND fs.EndTime > ?
```

---

## 📊 How It Works Now

### Scenario 1: Only 1 Court Booked (with payment)
```
Field 68: 4 courts (Sân 1,2,3,4)
Time: 08:00-09:00
Bookings:
  - QuantityID 23 (Sân 2) with PaymentStatus = 'paid'

Result:
  availableCount: 3
  availableQuantities: [Sân 1, Sân 3, Sân 4]
  bookedQuantities: [Sân 2]

Frontend shows: Cho user chọn Sân 1, 3, hoặc 4 ✅
```

### Scenario 2: All Courts Booked (with payment)
```
Field 68: 4 courts (Sân 1,2,3,4)
Time: 08:00-09:00
Bookings:
  - QuantityID 22 (Sân 1) with PaymentStatus = 'paid'
  - QuantityID 23 (Sân 2) with PaymentStatus = 'paid'
  - QuantityID 24 (Sân 3) with PaymentStatus = 'paid'
  - QuantityID 25 (Sân 4) with PaymentStatus = 'paid'

Result:
  availableCount: 0
  availableQuantities: []
  bookedQuantities: [Sân 1, 2, 3, 4]

Frontend shows: "Không có sân nào trống" ❌
Time slot completely hidden ✅
```

### Scenario 3: Pending Payment (Not Paid)
```
Field 68: 4 courts
Bookings:
  - QuantityID 23 (Sân 2) with PaymentStatus = 'pending'

Result:
  availableCount: 4
  availableQuantities: [Sân 1, 2, 3, 4]
  bookedQuantities: []

Frontend shows: All courts available ✅
(Payment not confirmed yet, so sân not blocked)
```

---

## ✅ Verification

### Test SQL Query
```sql
-- Check available courts for field 68, 08:00-09:00, 2025-10-21
SELECT
  fq.QuantityID,
  fq.QuantityNumber,
  fq.Status
FROM Field_Quantity fq
WHERE fq.FieldCode = 68
  AND fq.Status = 'available'
  AND fq.QuantityID NOT IN (
    SELECT DISTINCT b.QuantityID
    FROM Bookings b
    INNER JOIN Field_Slots fs ON b.BookingCode = fs.BookingCode
    WHERE b.FieldCode = 68
      AND b.QuantityID IS NOT NULL
      AND b.PaymentStatus = 'paid'
      AND fs.FieldCode = 68
      AND fs.PlayDate = '2025-10-21'
      AND fs.StartTime < '09:00:00'
      AND fs.EndTime > '08:00:00'
  )
ORDER BY fq.QuantityNumber ASC;

-- Should return:
-- QuantityID 22, QuantityNumber 1 (if not paid booking)
-- QuantityID 24, QuantityNumber 3 (if not paid booking)
-- QuantityID 25, QuantityNumber 4 (if not paid booking)
-- NOT QuantityID 23 (because it has paid booking at this time)
```

---

## 🎯 Data Flow (Correct)

```
User selects time slot: 08:00-09:00 on 2025-10-21
    ↓
Call API: GET /api/fields/68/available-quantities?playDate=2025-10-21&startTime=08:00&endTime=09:00
    ↓
Backend executes:
  1. Get Field_Quantity for FieldCode 68
  2. Check Bookings with PaymentStatus = 'paid'
  3. Check Field_Slots for time overlap
  4. Exclude booked courts
    ↓
Response:
  {
    "availableCount": 3,
    "availableQuantities": [
      {"quantity_id": 22, "quantity_number": 1},
      {"quantity_id": 24, "quantity_number": 3},
      {"quantity_id": 25, "quantity_number": 4}
    ],
    "bookedQuantities": [
      {"quantity_id": 23, "quantity_number": 2}
    ]
  }
    ↓
Frontend shows: "Chọn sân: [1] [2-X] [3] [4]" ✅
```

---

## 📌 Key Changes

| Aspect | Before | After |
|--------|--------|-------|
| **Check** | BookingStatus IN (...) | PaymentStatus = 'paid' |
| **Only blocks when** | Booking pending | Payment confirmed |
| **All paid booking** | Shows as pending | Shows as booked |
| **Pending payment** | Shows as booked | Shows as available |
| **Query method** | EXISTS subquery | INNER JOIN |

---

## ✅ Status

✅ **Backend Fixed**
- File: `backend/src/models/fieldQuantity.model.ts`
- Methods: `getAvailableForSlot()` and `getBookedForSlot()`
- No syntax errors
- Ready to test

---

## 🚀 Next Steps

1. **Restart backend**
   ```bash
   pkill -f "npm run dev"
   npm run dev
   ```

2. **Test with Postman**
   ```bash
   GET /api/fields/68/available-quantities?playDate=2025-10-21&startTime=08:00&endTime=09:00
   ```

3. **Verify:**
   - Only paid bookings show as booked
   - Pending payments don't block courts
   - All courts available when none are paid-booked
   - All courts blocked when all are paid-booked

