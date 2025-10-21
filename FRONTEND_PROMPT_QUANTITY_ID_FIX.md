# 📋 Frontend Prompt - QuantityID Implementation

Gửi prompt này cho team Frontend để họ chỉnh sửa lại theo yêu cầu:

---

## 🎯 Frontend Requirement: Multiple Courts Per Field - QuantityID Integration

**Dành cho: Frontend Team**

**Deadline:** ASAP (Backend ready, waiting for frontend integration)

**Priority:** CRITICAL - Multiple courts feature depends on this

---

## 📌 Context

Backend đã hoàn thành việc fix QuantityID để support **multiple courts per field**. Hiện tại:

- ✅ Backend có thể save QuantityID trong Bookings và Field_Slots
- ✅ Backend có thể block double-booking (same court)
- ✅ Backend có thể book multiple courts tại cùng time slot
- ❌ **Frontend chưa send `quantity_id` khi booking**

---

## 🔧 What Frontend Needs to Change

### 1. **Booking Creation - Send `quantity_id`**

**Endpoint:** `POST /api/bookings/create`

**Current Request Body:**
```json
{
  "fieldCode": 68,
  "playDate": "2025-10-21",
  "startTime": "08:00",
  "endTime": "09:00",
  "customerName": "User",
  "customerEmail": "user@email.com",
  "customerPhone": "0123456789"
}
```

**NEW - What Backend Expects:**
```json
{
  "fieldCode": 68,
  "quantity_id": 4,                    // ✅ NEW: Court number (1-4)
  "playDate": "2025-10-21",
  "startTime": "08:00",
  "endTime": "09:00",
  "customerName": "User",
  "customerEmail": "user@email.com",
  "customerPhone": "0123456789"
}
```

**Notes:**
- `quantity_id` is **REQUIRED** for multiple courts feature
- `quantity_id` must be a **NUMBER** (1, 2, 3, 4)
- Can be sent as `quantity_id` or `quantityID` (both work)
- If not sent, defaults to NULL (backward compatible)

---

### 2. **Get Available Courts - Use API Response**

**Endpoint:** `GET /api/fields/:fieldCode/available-quantities?playDate=2025-10-21&startTime=08:00&endTime=10:00`

**Backend Response:**
```json
{
  "success": true,
  "statusCode": 200,
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

**How to Use:**
- Call this API when user selects a time slot
- Show available courts from `availableQuantities`
- Show booked courts from `bookedQuantities`
- Only allow booking from available courts
- If `availableCount = 0`, show "Không có sân nào trống"

---

### 3. **UI Changes Required**

#### A. **Booking Page (e.g., http://localhost:5173/booking/68)**

**Current Flow:**
```
1. Select time slot
2. Show "Khung giờ trống" or "Khung giờ khoá"
3. Checkout
```

**NEW Flow:**
```
1. Select time slot
2. Call available-quantities API ← NEW
3. Show available courts as radio buttons or dropdown:
   ○ Sân 1 (available)
   ○ Sân 2 (booked)
   ○ Sân 3 (available)
   ○ Sân 4 (booked)
4. User selects court ← NEW
5. Checkout with selected quantity_id ← NEW
```

**Example UI:**
```
Chọn sân:
☑ Sân 1 (available)  ← user can select
☐ Sân 2 (đã được đặt) ← show as disabled
☑ Sân 3 (available)  ← user can select
☐ Sân 4 (đã được đặt) ← show as disabled
```

#### B. **API Call Before Booking:**

```javascript
// Before booking, get available courts
async function getAvailableCourts(fieldCode, playDate, startTime, endTime) {
  const response = await fetch(
    `/api/fields/${fieldCode}/available-quantities?playDate=${playDate}&startTime=${startTime}&endTime=${endTime}`
  );
  
  const data = await response.json();
  
  // Show available courts to user
  const availableCourts = data.data.availableQuantities;
  // availableCourts = [{quantity_id: 1, quantity_number: 1}, ...]
  
  return availableCourts;
}
```

#### C. **Send quantity_id on Checkout:**

```javascript
// When user books, send quantity_id
async function createBooking(bookingData) {
  const response = await fetch('/api/bookings/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fieldCode: bookingData.fieldCode,
      quantity_id: bookingData.selectedCourtId,  // ← NEW: send this!
      playDate: bookingData.playDate,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      customerName: bookingData.customerName,
      customerEmail: bookingData.customerEmail,
      customerPhone: bookingData.customerPhone
    })
  });
  
  return response.json();
}
```

---

### 4. **Error Handling**

**If user tries to book booked court, backend returns 409:**
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

**Frontend should:**
- Show error message to user
- Refresh available courts list
- Ask user to select different court

---

### 5. **Multiple Time Slots Case**

If booking multiple time slots (e.g., 08:00-09:00 AND 09:00-10:00):

```javascript
// Current code (probably):
const slots = [
  { playDate: "2025-10-21", startTime: "08:00", endTime: "09:00" },
  { playDate: "2025-10-21", startTime: "09:00", endTime: "10:00" }
];

// NEW: Need to get availability for EACH slot
for (const slot of slots) {
  const available = await getAvailableCourts(
    fieldCode, 
    slot.playDate, 
    slot.startTime, 
    slot.endTime
  );
  // Show user available courts for each slot
}

// If user books, must use SAME quantity_id for all slots!
const bookingData = {
  quantity_id: 4,  // Same court for all slots
  slots: [
    { playDate: "2025-10-21", startTime: "08:00", endTime: "09:00" },
    { playDate: "2025-10-21", startTime: "09:00", endTime: "10:00" }
  ]
};
```

---

## ✅ Implementation Checklist

### Phase 1: Data Layer
- [ ] Update API client to pass `quantity_id` in booking requests
- [ ] Add API call for `available-quantities` endpoint
- [ ] Parse available courts from API response
- [ ] Handle API errors (409, 404, etc.)

### Phase 2: UI Changes
- [ ] Update booking page to show available courts
- [ ] Add court selection UI (radio buttons / dropdown)
- [ ] Disable booked courts in selection
- [ ] Show "Không có sân nào trống" if all booked

### Phase 3: Integration
- [ ] Connect court selection to booking request
- [ ] Pass `quantity_id` to booking API
- [ ] Show error if user tries to book booked court
- [ ] Refresh availability after failed booking

### Phase 4: Testing
- [ ] Test booking court 1
- [ ] Test booking court 2 at same time (should work)
- [ ] Test booking same court twice (should fail with 409)
- [ ] Test availability API shows correct courts
- [ ] Test multiple time slots with same court

---

## 📊 Example: Before vs After

### Before (Current) ❌
```
User books:
  Field 68
  2025-10-21 08:00-09:00
  ↓
  Backend creates booking with QuantityID = NULL
  ↓
  ❌ Can't track which court
  ❌ Can double-book
  ❌ Availability checks fail
```

### After (Your Task) ✅
```
User:
  1. Selects time slot 08:00-09:00
  2. Sees available courts: Sân 1, Sân 3, Sân 4
  3. Selects Sân 4
  4. Books with quantity_id = 4
  ↓
  Backend creates booking with QuantityID = 4
  ↓
  ✅ Knows court 4 is booked
  ✅ Prevents double-booking
  ✅ Availability works per-court
```

---

## 🔌 API Integration Points

### Required API Calls:

1. **Get Available Courts (New)**
```
GET /api/fields/:fieldCode/available-quantities
  ?playDate=2025-10-21
  &startTime=08:00
  &endTime=09:00
```

2. **Create Booking (Updated)**
```
POST /api/bookings/create
Body: {
  fieldCode, quantity_id, playDate, startTime, endTime,
  customerName, customerEmail, customerPhone
}
```

---

## 📝 Code Examples

### React Example:
```typescript
const [selectedCourt, setSelectedCourt] = useState(null);
const [availableCourts, setAvailableCourts] = useState([]);

// When time slot selected
useEffect(() => {
  // Get available courts
  fetch(`/api/fields/${fieldCode}/available-quantities?playDate=...&startTime=...&endTime=...`)
    .then(r => r.json())
    .then(data => {
      setAvailableCourts(data.data.availableQuantities);
    });
}, [selectedTimeSlot]);

// Render courts
{availableCourts.map(court => (
  <label key={court.quantity_id}>
    <input
      type="radio"
      value={court.quantity_id}
      onChange={(e) => setSelectedCourt(e.target.value)}
    />
    Sân {court.quantity_number}
  </label>
))}

// On booking
const bookingData = {
  fieldCode,
  quantity_id: selectedCourt,  // ← Include this!
  playDate,
  startTime,
  endTime,
  ...customerData
};
```

---

## 🎯 Success Criteria

✅ **Your task is complete when:**
1. ✅ User can see available courts for a time slot
2. ✅ User can select a specific court
3. ✅ `quantity_id` is sent in booking request
4. ✅ Backend confirms QuantityID is saved
5. ✅ Booking same court twice shows 409 error
6. ✅ Booking different courts works
7. ✅ Multiple time slots work with same court

---

## 📞 Questions?

**Backend is ready!** Ask these questions:
- "How do I get QuantityID from available-quantities API?" → Use `quantity_id` field
- "What if user doesn't select a court?" → Don't allow booking, show error
- "Can user select different courts for different time slots?" → NO, must be same
- "What if all courts are booked?" → Show "Không có sân nào trống"

---

## 🚀 Implementation Timeline

- **Today:** Understand requirements (this document)
- **Tomorrow:** Implement available courts fetching
- **Day 3:** Add court selection UI
- **Day 4:** Testing with backend

---

**Backend Status: ✅ READY**
**Frontend Status: ⏳ WAITING FOR YOUR CHANGES**

Let's go! 🚀

