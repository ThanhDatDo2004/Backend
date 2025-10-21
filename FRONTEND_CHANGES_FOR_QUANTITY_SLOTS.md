# 🎨 Frontend Changes Needed for Quantity Slots

## 📋 Summary

**Backend:** ✅ COMPLETE - Updated to track slots per QuantityID  
**Frontend:** ⚠️ MINOR CHANGES NEEDED

---

## 🔍 What Frontend Needs to Do

### Change 1: Pass `quantityId` When Fetching Availability

**Location:** Booking page / Check availability function

**Before (❌):**
```javascript
const response = await fetch(`/api/fields/${fieldCode}/available-quantities?playDate=${date}&startTime=${start}&endTime=${end}`);
```

**After (✅):**
```javascript
const response = await fetch(`/api/fields/${fieldCode}/available-quantities?playDate=${date}&startTime=${start}&endTime=${end}&quantityId=${selectedQuantityId}`);
```

**Why:** Backend now filters slots by QuantityID, so frontend should pass the selected court number.

---

### Change 2: When Creating Booking, Include `quantityId`

**Location:** Booking confirmation / POST to `/api/bookings` or `/api/confirm-booking`

**Before (❌):**
```json
{
  "fieldCode": 68,
  "playDate": "2025-10-20",
  "startTime": "08:00",
  "endTime": "10:00"
}
```

**After (✅):**
```json
{
  "fieldCode": 68,
  "quantityId": 4,
  "playDate": "2025-10-20",
  "startTime": "08:00",
  "endTime": "10:00"
}
```

**Why:** Backend needs to know which court (QuantityID) to book and link to Field_Slots.

---

### Change 3: UI - Show Available Quantities

**Location:** Booking selection interface

**Display logic (should already work):**
- Show list of available courts for selected time
- User selects a court (Sân 1, 2, 3, 4...)
- Pass `quantity_id` or `quantity_number` to booking

**No code change needed if:**
- ✅ You already show `quantities` array from API
- ✅ You already let user select a court
- ✅ You already send `quantityId` with booking

---

## 🧪 Test Cases

### Test 1: Book Court 4
```
1. Go to booking page
2. Select time: 08:00-10:00
3. Click "Check Availability"
4. Expected: Show 4 available courts (1, 2, 3, 4)
5. Select court 4
6. Complete booking
```

### Test 2: Book Another Court Same Time
```
1. Repeat Test 1 (Court 4 now booked)
2. Go back to booking (or another user)
3. Select same time: 08:00-10:00
4. Click "Check Availability"
5. Expected: Show 3 available courts (1, 2, 3) - NOT 4
6. Select court 1
7. Complete booking
```

### Test 3: Verify Multiple Bookings
```
1. Check database:
   - Field_Slots should have 2 entries with different QuantityID
   - Bookings should have 2 entries with different QuantityID
2. Both bookings should be visible in user's booking list
```

---

## 📝 Specific Frontend Code Locations to Check

### 1. Availability Check Component
```
Search for: "check available slots" OR "available-quantities" OR "getAvailability"
Update: Pass quantityId parameter
```

### 2. Booking Form
```
Search for: "createBooking" OR "POST /api/bookings" OR "confirmBooking"
Update: Include quantityId in request body
```

### 3. Time Slot Display
```
Search for: Display of "Sân X" OR "Court X" OR quantities list
Check: Already showing available quantities? (should already work!)
```

---

## ✅ Checklist for Frontend Team

| Item | Status |
|------|--------|
| Pass `quantityId` to availability check | TODO |
| Include `quantityId` in booking request | TODO |
| Test: Book Court 4 then Court 1 same time | TODO |
| Verify Courts 1-3 still available after 4 booked | TODO |
| Check database for multiple QuantityID entries | TODO |

---

## 🚀 If No Changes Needed

If your frontend already:
- ✅ Shows available quantities
- ✅ Lets user select a court
- ✅ Passes `quantityId` to booking API

Then **NO CHANGES NEEDED!** Backend is now compatible.

---

## 💡 Key Points

1. **Field_Slots now has QuantityID** → Tracks which court is booked
2. **Frontend should pass quantityId** → For availability check
3. **Booking now stores QuantityID** → Links court to specific booking
4. **Multiple courts same time** → Now works! (each gets own QuantityID)

---

## ❓ Questions

**Q: Do I need to change the quantity selection UI?**  
A: No - if you already show quantities, keep it as is!

**Q: What if I pass wrong quantityId?**  
A: Backend will validate - error if quantity doesn't belong to field

**Q: Will old bookings break?**  
A: No - QuantityID is optional (NULL for old bookings)

---

**Backend Ready!** Frontend minimal changes needed. 🎉

