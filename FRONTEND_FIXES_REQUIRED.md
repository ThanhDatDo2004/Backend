# ⚠️ FRONTEND FIXES REQUIRED - Critical Issues

**Gửi cho Frontend Team ngay**

---

## 📋 Issues Found

### Issue 1: Entire Slot Locked When Only 1 Court Booked

**Problem:**
- Field 68, 16:00-17:00: Only Sân 2 is booked
- Frontend shows: "Khung giờ khoá" ❌
- Should show: "Sân 1, 3, 4 còn trống" ✅

**Frontend Code:**
```javascript
// WRONG - Current logic probably does this:
if (availableCount === 0) {
  return "Khung giờ khoá";
}

// CORRECT - Should do this:
if (availableCount === 0) {
  return "Không có sân nào trống"; // Only lock when ALL booked
} else {
  showAvailableCourts();  // Show available courts
}
```

**Frontend Task:**
- [ ] Only lock slot when `availableCount === 0`
- [ ] Show available courts when `availableCount > 0`
- [ ] Let user select from available courts

---

### Issue 2: Wrong Data for Multiple Selected Slots

**Problem:**
When user selects:
- Slot 1: 17:00-18:00 (all courts available)
- Slot 2: 19:00-20:00 (all courts available)

**Response shows:** Sân 1 as BOOKED ❌

**Root Cause:**
Frontend doesn't call API for EACH slot separately. Must get availability for each slot, then find intersection.

**Frontend Fix:**

```javascript
// For multiple slots, call API for EACH slot
const selectedSlots = [
  { start: "17:00", end: "18:00" },
  { start: "19:00", end: "20:00" }
];

// Get availability for each slot
const availabilityBySlot = await Promise.all(
  selectedSlots.map(slot =>
    fetch(`/api/fields/68/available-quantities?playDate=2025-10-21&startTime=${slot.start}&endTime=${slot.end}`)
      .then(r => r.json())
  )
);

// Find courts available in ALL slots (intersection)
const availableInAll = findIntersection(availabilityBySlot);
// Only show these courts!
```

**Frontend Task:**
- [ ] Call API for EACH selected time slot
- [ ] Implement intersection logic (only show courts available in all slots)
- [ ] Display results per slot

---

### Issue 3: Show Available Courts, Not Just Lock/Unlock

**Change from:**
```
16:00-17:00: ☑ Trống | ☐ Khoá
```

**To:**
```
16:00-17:00: ☑ Trống
  Chọn sân:
  ☑ Sân 1   ← Click to select
  ☐ Sân 2   ← Already booked (disabled)
  ☑ Sân 3   ← Click to select
  ☑ Sân 4   ← Click to select
```

---

## ✅ Backend Status

✅ **Backend is CORRECT**
- API returns correct data
- Available courts correctly identified
- Booked courts correctly identified

**Verify backend with:**
```bash
curl "http://localhost:5050/api/fields/68/available-quantities?playDate=2025-10-21&startTime=16:00&endTime=17:00" \
  -H "Authorization: Bearer TOKEN"

# Should return:
{
  "availableCount": 3,
  "availableQuantities": [1, 3, 4],
  "bookedQuantities": [2]
}
```

---

## 🎯 Frontend Checklist

- [ ] Fix 1: Only lock slot when ALL courts booked
- [ ] Fix 2: Call API for each selected slot separately
- [ ] Fix 3: Implement intersection for multiple slots
- [ ] Fix 4: Show available courts with selection UI
- [ ] Test: Single slot with partial booking
- [ ] Test: Multiple slots with all courts available
- [ ] Test: Multiple slots with some booked

---

## 📝 Implementation Order

1. **Fix single slot logic first**
   - Check `availableCount`
   - Show available courts
   
2. **Then fix multiple slots**
   - Call API for each slot
   - Implement intersection
   - Show per-slot availability

3. **Test thoroughly**
   - Single slot, 1 court booked → show 3 available ✅
   - Single slot, all booked → show "không có sân" ✅
   - Multi slots, all available → show intersection ✅

---

**File:** ISSUES_FOUND_AND_FIXES.md - More details there

