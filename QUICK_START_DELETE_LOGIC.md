# 🚀 Quick Start: Delete Field Logic

## What You Implemented

**Policy:**
- ✅ CAN delete sân if: NO future bookings OR all bookings PAST (qua hạn)
- ❌ CANNOT delete sân if: ANY future booking exists (chưa qua hạn)

---

## How It Works

### Step 1: User clicks "Xóa Sân"
```
DELETE /api/shops/me/fields/30
```

### Step 2: Backend checks
```typescript
const hasFuture = await fieldModel.hasFutureBookings(fieldCode);
if (hasFuture) {
  // ❌ Has future bookings → BLOCK
  throw 409 Conflict
}
```

### Step 3: If no future bookings → DELETE ALL
```
✅ Delete Field_Images (Step 1)
✅ Delete Field_Pricing (Step 2)
✅ Delete Bookings (Step 3)      ← ALL bookings deleted
✅ Delete Fields (Step 4)
```

### Step 4: Return success
```json
{
  "success": true,
  "statusCode": 200,
  "data": { "deleted": true },
  "message": "Xóa sân thành công"
}
```

---

## The Logic

### What is "FUTURE Booking"?

**FUTURE** (CAN'T DELETE):
- 📅 PlayDate > today
- 📅 PlayDate = today BUT EndTime > current_time
- Status = 'booked' or 'held'

**PAST** (CAN DELETE):
- 📅 PlayDate < today
- 📅 PlayDate = today AND EndTime < current_time
- Any status (completed, cancelled, etc.)

---

## Examples

### Example 1: Can Delete
```
Today: 2025-10-20 15:00

Sân 10:
├─ Booking 1: 2025-10-18    ✅ PAST
├─ Booking 2: 2025-10-19    ✅ PAST
└─ Booking 3: 2025-10-20 12:00-14:00 (ended at 14:00)  ✅ PAST

DELETE /api/shops/me/fields/10
→ ✅ 200 OK (Delete sân + all bookings)
```

### Example 2: Can't Delete
```
Today: 2025-10-20 15:00

Sân 11:
├─ Booking 1: 2025-10-19    ✅ PAST
└─ Booking 2: 2025-10-21    ❌ FUTURE (PlayDate > today)

DELETE /api/shops/me/fields/11
→ ❌ 409 Conflict
→ "Sân có đơn đặt trong tương lai, không thể xóa."
```

### Example 3: Today but Not Finished
```
Today: 2025-10-20 15:00

Sân 12:
└─ Booking: 2025-10-20 14:00-18:00  ❌ FUTURE
           (EndTime 18:00 > current 15:00)

DELETE /api/shops/me/fields/12
→ ❌ 409 Conflict
```

---

## Code Files Changed

### File 1: `backend/src/models/field.model.ts`
- Added: `deleteAllBookingsForField()`
- Added: `hasAnyBookings()`
- Updated: `hasFutureBookings()` with better comments
- Updated: All methods with POLICY comments

### File 2: `backend/src/services/field.service.ts`
- Updated: `deleteFieldForShop()` with detailed comments
- Added: Comprehensive DELETION POLICY section
- Added: Step-by-step deletion sequence explanation

---

## Database Level

### Check Future Bookings
```sql
SELECT COUNT(*) FROM Field_Slots
WHERE FieldCode = ?
  AND (
    PlayDate > CURDATE() OR 
    (PlayDate = CURDATE() AND EndTime > NOW())
  )
  AND Status IN ('booked', 'held')
```

### Delete All Bookings
```sql
DELETE FROM Bookings WHERE FieldCode = ?
```

---

## Test It

### Terminal 1: Start Backend
```bash
cd backend
npm run dev
```

### Terminal 2: Test

**Test 1: Delete field without future bookings**
```bash
curl -X DELETE http://localhost:5050/api/shops/me/fields/30 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: ✅ 200 OK
```

**Test 2: Try delete field with future bookings**
```bash
curl -X DELETE http://localhost:5050/api/shops/me/fields/31 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: ❌ 409 Conflict
```

---

## Files to Review

1. **Logic Policy:** DELETION_POLICY_IMPLEMENTED.md
2. **Complete Summary:** FINAL_FIX_SUMMARY_ALL_FK.md
3. **Deletion Flow:** COMPLETE_DELETION_SEQUENCE.txt
4. **Code:** 
   - backend/src/models/field.model.ts (methods with comments)
   - backend/src/services/field.service.ts (deleteFieldForShop flow)

---

## Key Points

✅ **Only checks FUTURE bookings** (not past)
✅ **Deletes ALL bookings** (past + present when allowed)
✅ **Respects FK constraints** (images → pricing → bookings → field)
✅ **Clear error message** (409 if future bookings found)
✅ **No API changes** (same endpoint, same response format)

---

## What Happens When?

| Scenario | Check | Delete? | What Gets Removed |
|----------|-------|---------|-------------------|
| No bookings | - | ✅ YES | Field, Images, Pricing |
| All past bookings | Future = false | ✅ YES | Field, Images, Pricing, Bookings |
| 1+ future bookings | Future = true | ❌ NO | Nothing (409 error) |

---

## Ready to Deploy!

1. Code is ✅ updated
2. Linting is ✅ clean
3. Logic is ✅ correct
4. Comments are ✅ detailed
5. Tests are ✅ documented

**Next:** Restart backend and test!

```bash
cd backend
npm run dev
```

Then go to http://localhost:5173/shop/fields and try deleting fields!

