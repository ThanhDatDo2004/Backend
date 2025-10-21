# 🔧 Fix: Slot Availability Per Quantity

## 📋 Problem Analysis

**Current Issue:**
```
Sân 4 được đặt 08:00-10:00
→ Field_Slots có 1 record: FieldCode=68, Status='booked'
→ Backend check: "Sân 68 đã có booking → Khoá toàn bộ"
→ Sân 1, 2, 3 cũng bị khoá dù còn trống ❌
```

**Root Cause:**
- `Field_Slots` table không có `QuantityID` column
- Logic check availability chỉ xem `FieldCode`, không xem `QuantityID`
- Không thể phân biệt sân 1, 2, 3, 4

**Solution:**
Add `QuantityID` to `Field_Slots` table để track từng sân riêng biệt

---

## 🗄️ Database Migration

### Step 1: Add QuantityID Column

```sql
-- Add QuantityID to Field_Slots table
ALTER TABLE Field_Slots 
ADD COLUMN QuantityID INT DEFAULT NULL AFTER BookingCode;

-- Add foreign key constraint
ALTER TABLE Field_Slots
ADD CONSTRAINT FK_Field_Slots_Quantity 
FOREIGN KEY (QuantityID) REFERENCES Field_Quantity(QuantityID) ON DELETE SET NULL;

-- Add index for performance
ALTER TABLE Field_Slots
ADD INDEX IDX_FieldQuantity_Date (FieldCode, QuantityID, PlayDate, StartTime);
```

### Step 2: Update Existing Slots (Optional)

If you have existing slots, you might want to match them with quantities:

```sql
-- This matches existing slots with quantities (if data is consistent)
UPDATE Field_Slots fs
JOIN Bookings b ON fs.BookingCode = b.BookingCode
SET fs.QuantityID = b.QuantityID
WHERE b.QuantityID IS NOT NULL;
```

---

## 💻 Backend Code Changes

### Change 1: Model - listSlots

**File:** `backend/src/models/field.model.ts` - Line 312

**Current (❌ WRONG):**
```typescript
async listSlots(fieldCode: number, playDate?: string) {
  // Only checks FieldCode
  const query = `
    SELECT ... FROM Field_Slots
    WHERE FieldCode = ?
  `;
}
```

**New (✅ CORRECT):**
```typescript
async listSlots(fieldCode: number, playDate?: string, quantityId?: number) {
  const params: any[] = [fieldCode];
  let clause = "WHERE FieldCode = ?";
  
  if (playDate) {
    clause += " AND PlayDate = ?";
    params.push(playDate);
  }
  
  // NEW: Filter by QuantityID if provided
  if (quantityId !== undefined && quantityId !== null) {
    clause += " AND (QuantityID = ? OR QuantityID IS NULL)";
    params.push(quantityId);
  }
  
  const query = `
    SELECT
      SlotID AS slot_id,
      FieldCode AS field_code,
      QuantityID AS quantity_id,
      PlayDate AS play_date,
      StartTime AS start_time,
      EndTime AS end_time,
      Status AS status,
      HoldExpiresAt AS hold_expires_at
    FROM Field_Slots
    ${clause}
    ORDER BY PlayDate, StartTime
  `;
  return (await queryService.execQueryList(query, params)) as FieldSlotRow[];
}
```

---

### Change 2: Service - getAvailability

**File:** `backend/src/services/field.service.ts` - Line 585

**Current (❌ WRONG):**
```typescript
async getAvailability(fieldCode: number, playDate?: string) {
  const [slots, pricing] = await Promise.all([
    fieldModel.listSlots(fieldCode, playDate),  // ← Gets all slots
    // ...
  ]);
}
```

**New (✅ CORRECT):**
```typescript
async getAvailability(
  fieldCode: number,
  playDate?: string,
  quantityId?: number  // NEW parameter
) {
  const [slots, pricing] = await Promise.all([
    fieldModel.listSlots(fieldCode, playDate, quantityId),  // ← Pass quantityId
    // ...
  ]);
}
```

---

### Change 3: Controller - Booking Endpoint

**File:** `backend/src/controllers/booking.controller.ts`

When getting available slots, pass `quantityID`:

**Current (❌ WRONG):**
```typescript
const availability = await fieldService.getAvailability(fieldCode, playDate);
```

**New (✅ CORRECT):**
```typescript
// Get specific quantity's availability
const availability = await fieldService.getAvailability(
  fieldCode,
  playDate,
  quantityID  // ← Pass the selected quantity
);
```

---

### Change 4: Model - Insert Slot with Quantity

**File:** `backend/src/models/field.model.ts`

When creating slots during booking, include `QuantityID`:

**Current (❌ WRONG):**
```typescript
INSERT INTO Field_Slots (FieldCode, PlayDate, StartTime, EndTime, Status, BookingCode)
VALUES (?, ?, ?, ?, 'available', ?)
```

**New (✅ CORRECT):**
```typescript
INSERT INTO Field_Slots (FieldCode, QuantityID, PlayDate, StartTime, EndTime, Status, BookingCode)
VALUES (?, ?, ?, ?, ?, 'available', ?)
```

---

## 🧪 Test Scenarios

### Test 1: Book Sân 4 (08:00-10:00)
```
POST /api/bookings
{
  "fieldCode": 68,
  "quantityID": 4,        // Sân 4
  "playDate": "2025-10-20",
  "startTime": "08:00",
  "endTime": "10:00"
}
```

**Expected:**
- ✅ Booking created for Sân 4
- ✅ Field_Slots: (FieldCode=68, QuantityID=4, Status='booked')

### Test 2: Check Availability (Same Time)
```
GET /api/fields/68/available-quantities?playDate=2025-10-20&startTime=08:00&endTime=10:00
```

**Expected (❌ BEFORE):**
```json
{
  "availableCount": 0,
  "availableQuantities": []  // ← All blocked!
}
```

**Expected (✅ AFTER):**
```json
{
  "availableCount": 3,
  "availableQuantities": [
    { "quantity_id": 1, "quantity_number": 1, "status": "available" },
    { "quantity_id": 2, "quantity_number": 2, "status": "available" },
    { "quantity_id": 3, "quantity_number": 3, "status": "available" }
    // ← Sân 4 không có (đã book)
  ]
}
```

### Test 3: Book Sân 1 (Same Time)
```
POST /api/bookings
{
  "fieldCode": 68,
  "quantityID": 1,        // Sân 1
  "playDate": "2025-10-20",
  "startTime": "08:00",
  "endTime": "10:00"
}
```

**Expected:**
- ✅ Booking created for Sân 1
- ✅ Field_Slots now has 2 records: (QuantityID=4) and (QuantityID=1)
- ✅ Sân 2, 3 still available

---

## 📊 Updated Data Flow

### Before (❌ Wrong)
```
Booking Sân 4 (08:00-10:00)
    ↓
Field_Slots: {FieldCode: 68, Status: 'booked'}
    ↓
Check availability for Sân 1
    ↓
Query: WHERE FieldCode = 68
    ↓
Found: 'booked' status
    ↓
❌ Block all time slots (Sân 1,2,3 also blocked!)
```

### After (✅ Correct)
```
Booking Sân 4 (08:00-10:00)
    ↓
Field_Slots: {FieldCode: 68, QuantityID: 4, Status: 'booked'}
    ↓
Check availability for Sân 1
    ↓
Query: WHERE FieldCode = 68 AND (QuantityID = 1 OR QuantityID IS NULL)
    ↓
Not found: This quantity is NOT booked
    ↓
✅ Sân 1 is available!
```

---

## ✅ Implementation Checklist

Database Migration:
- [ ] Add QuantityID column to Field_Slots
- [ ] Add foreign key constraint
- [ ] Add index for performance
- [ ] (Optional) Update existing slots with QuantityID

Backend Code:
- [ ] Update Field_Slots model: Add QuantityID SELECT
- [ ] Update listSlots(): Accept quantityId parameter
- [ ] Update getAvailability(): Accept quantityId parameter
- [ ] Update Booking creation: Include QuantityID in INSERT
- [ ] Update Booking API: Pass quantityID to service

Testing:
- [ ] Book Sân 4 in specific time
- [ ] Check that other sâns are still available
- [ ] Book Sân 1 at same time
- [ ] Verify both bookings exist in database

---

## 🚀 Frontend Impact

Frontend should:
1. Pass `quantityID` when fetching available quantities
2. Show available quantities based on `quantity_number`
3. Allow booking other quantities even if one is booked

**No changes needed** if backend fixes availability logic!

---

## 📝 Summary

| Aspect | Before | After |
|--------|--------|-------|
| **FieldSlots tracks** | Only FieldCode | FieldCode + QuantityID |
| **Availability check** | Block all if any booked | Block only specific quantity |
| **Sân 1,2,3 when 4 booked** | ❌ All blocked | ✅ Available |
| **Database efficiency** | Low (checks whole field) | ✅ High (checks specific quantity) |

---

## ❓ Questions?

- Database schema confirmed ✅
- Backend logic identified ✅
- Frontend should work once backend fixed ✅

Ready to implement? 🚀

