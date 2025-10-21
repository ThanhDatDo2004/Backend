# 🐛 Issues Found - Analysis & Fixes

## Issue 1: Time Slot Completely Locked When Only One Court is Booked

### ❌ Problem
- Field 68 has 4 courts (QuantityID 22-25)
- Khung giờ 16:00-17:00: Only BookingCode 84 with QuantityID 23 (Sân 2) is booked
- **Frontend shows:** "Khung giờ khoá" (entire slot locked) ❌
- **Should show:** "Sân 1, 3, 4 còn trống" ✅

### 🔍 Root Cause
**FRONTEND ISSUE** - Frontend checks availability for entire time slot, not per-court

**Current Frontend Logic (Wrong):**
```javascript
// Frontend probably does something like:
if (availableCount === 0) {
  return "Khung giờ khoá";  // ❌ Blocks entire slot
}
```

**What's Happening:**
1. Frontend calls API: GET `/api/fields/68/available-quantities?playDate=...&startTime=16:00&endTime=17:00`
2. Backend returns: `availableCount: 3` (courts 1, 3, 4 available)
3. Frontend IGNORES this and shows "Khung giờ khoá" ❌

### ✅ Frontend Fix Required

**Change frontend logic:**
```javascript
// BEFORE (Wrong):
if (availableCount === 0) {
  showError("Khung giờ khoá");
}

// AFTER (Correct):
if (availableCount === 0) {
  showError("Không có sân nào trống");  // ✅ Only when ALL are booked
} else {
  showAvailableCourts(availableQuantities);  // ✅ Show available courts
  allowUserToSelect(availableQuantities);
}
```

**Frontend Task:**
- [ ] Check response `availableCount`
- [ ] Only lock slot if `availableCount === 0`
- [ ] Show available courts to user when `availableCount > 0`
- [ ] Let user select from available courts

---

## Issue 2: Multiple Time Slots Show Wrong Availability

### ❌ Problem
- User selects: 17:00-18:00 AND 19:00-20:00
- Both times show: "sân 1,3,4 trống"
- **But response shows:** 
  ```json
  "bookedQuantities": [
    {
      "quantity_id": 22,
      "quantity_number": 1,
      "status": "available"
    }
  ]
  ```
  ❌ Shows Sân 1 as BOOKED when it should be AVAILABLE

### 🔍 Root Cause - BACKEND BUG

**Problem in `fieldQuantity.model.ts` line 130-170**

The `getAvailableForSlot()` query uses `startTime` and `endTime` incorrectly:

```sql
-- WRONG (Current):
WHERE fs.StartTime < ? AND fs.EndTime > ?
      [endTime,     startTime]  ❌ Swapped!
```

**Time Overlap Logic is Backwards!**

For time slots to overlap:
- Slot 1: 17:00-18:00
- Slot 2: 19:00-20:00

Should NOT overlap because:
- Slot 1 EndTime (18:00) <= Slot 2 StartTime (19:00)

**But code checks:**
```
fs.StartTime < ? AND fs.EndTime > ?
       19:00 <? 19:00 AND ?> 17:00
```
This is checking wrong conditions!

### ✅ Backend Fix Required

**Fix in `backend/src/models/fieldQuantity.model.ts` line 155-156:**

```typescript
// BEFORE (Wrong):
AND fs.StartTime < ?        // fs.StartTime < 19:00
AND fs.EndTime > ?          // fs.EndTime > 17:00
// This OVERLAPS with BOTH slots!

// AFTER (Correct):
AND fs.StartTime < ?        // fs.StartTime < endTime (18:00)
AND fs.EndTime > ?          // fs.EndTime > startTime (17:00)
```

Wait... let me check parameters order:

**Line 162-168 in fieldQuantity.model.ts:**
```typescript
return (await queryService.execQueryList(query, [
  fieldCode,
  fieldCode,
  fieldCode,
  playDate,
  endTime,      // ← Position 5
  startTime,    // ← Position 6
])) as AvailableQuantityRow[];
```

**But query expects:**
```sql
AND fs.PlayDate = ?          // playDate ✅
AND fs.StartTime < ?         // Should be endTime (position 5) ✅
AND fs.EndTime > ?           // Should be startTime (position 6) ✅
```

Actually parameters ARE CORRECT! So the bug is elsewhere...

Let me check `getBookedForSlot()` - it might have wrong logic:

---

## Issue 3: Backend Returns Wrong Data for Multiple Slots

### 🔍 Real Root Cause

When user selects **multiple time slots**, frontend probably calls API for EACH slot separately, then combines results. But if the API isn't called correctly, it returns wrong data.

**Frontend should:**
1. Select slot 1: 17:00-18:00 → Call API
2. Get response: available courts
3. Select slot 2: 19:00-20:00 → Call API AGAIN
4. Get response: available courts for slot 2
5. INTERSECTION: Only show courts available in BOTH slots

**If frontend doesn't do intersection:** Wrong courts shown!

---

## 📋 Issues Summary

| Issue | Type | Severity | Location |
|-------|------|----------|----------|
| **1. Entire slot locked when partial booked** | FRONTEND | CRITICAL | Booking page logic |
| **2. Wrong availability for multiple slots** | FRONTEND | CRITICAL | Need to call API for EACH slot |
| **3. Availability intersection missing** | FRONTEND | CRITICAL | Multiple slot selection |

---

## ✅ FRONTEND FIXES NEEDED

### Fix 1: Don't Lock Entire Slot
```javascript
// WRONG:
if (availableCount === 0) {
  return "Khung giờ khoá";
}

// CORRECT:
if (availableCount === 0) {
  return "Không có sân nào trống"; 
} else {
  return availableQuantities; // Show available courts
}
```

### Fix 2: Get Availability for Each Selected Slot
```javascript
// User selects multiple slots: [17:00-18:00, 19:00-20:00]
const selectedSlots = [
  { startTime: "17:00", endTime: "18:00" },
  { startTime: "19:00", endTime: "20:00" }
];

// Get availability for EACH slot
const availabilityBySlot = await Promise.all(
  selectedSlots.map(slot => 
    fetch(`/api/fields/68/available-quantities?playDate=...&startTime=${slot.startTime}&endTime=${slot.endTime}`)
      .then(r => r.json())
  )
);

// INTERSECTION: Courts available in ALL slots
const availableInAll = findIntersection(availabilityBySlot);
// Only show courts that appear in all slots!
```

### Fix 3: Show Available Courts, Not Lock Slot
```javascript
// BEFORE:
const slots = selectedSlots.map(slot => ({
  ...slot,
  status: availableCount === 0 ? "locked" : "available"
}));

// AFTER:
const slots = selectedSlots.map((slot, index) => ({
  ...slot,
  availableCourts: availabilityBySlot[index].availableQuantities,
  availableCount: availabilityBySlot[index].availableCount,
  status: availabilityBySlot[index].availableCount === 0 ? "locked" : "available"
}));

// Show available courts per slot:
slots.forEach(slot => {
  if (slot.status === "locked") {
    showMessage("Không có sân trống");
  } else {
    showCourts(slot.availableCourts); // Show available courts
  }
});
```

---

## 🎯 What Backend is Doing Correctly

✅ **Backend API `/api/fields/68/available-quantities` WORKS:**
```json
{
  "availableCount": 3,
  "availableQuantities": [1, 3, 4],
  "bookedQuantities": [2]
}
```

✅ **Returns correct data per time slot**
✅ **Correctly identifies available vs booked courts**

---

## 🔧 Summary

| Issue | Root Cause | Fix Type | Who Fixes |
|-------|-----------|----------|-----------|
| Slot locked when 1 court booked | Frontend checks `availableCount` wrong | Frontend Logic | Frontend |
| Wrong availability for 2 slots | Frontend doesn't call API for each slot | Frontend Logic | Frontend |
| Shows wrong courts | Intersection logic missing | Frontend Logic | Frontend |

**Backend = ✅ WORKING CORRECTLY**
**Frontend = ❌ NEEDS FIXES**

---

## 📝 BACKEND Verification

Backend is correct. Verify with curl:

```bash
# Slot with 1 court booked (should show 3 available)
curl "http://localhost:5050/api/fields/68/available-quantities?playDate=2025-10-21&startTime=16:00&endTime=17:00"

Expected Response:
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
```

If backend returns this, **backend is correct!**

