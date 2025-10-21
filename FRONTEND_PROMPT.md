# 🎨 Frontend Implementation - Field_Quantity System

## 📌 Overview

Backend đã hoàn thành hệ thống **Field_Quantity** cho phép quản lý nhiều sân (court) trong 1 loại sân.

**Ví dụ:**
- Trước: Tạo 5 fields (Sân Tennis 1, 2, 3 + Sân Bóng 1, 2)
- Sau: Tạo 2 fields (Tennis + Bóng) với số lượng sân (3 + 2)

---

## 🔌 Backend API Endpoints (Ready to Use)

### 1. Create Field (UPDATED)
```
POST /api/shops/me/fields
Headers: Authorization: Bearer TOKEN
Body: {
  "fieldName": "Tennis",
  "sportType": "tennis",
  "address": "123 Nguyen Hue",
  "pricePerHour": 100000,
  "quantityCount": 3    ← NEW!
}

Response: {
  "success": true,
  "data": {
    "fieldCode": 1,
    "fieldName": "Tennis",
    "quantityCount": 3,
    "quantities": [
      { "quantityID": 1, "quantityNumber": 1, "status": "available" },
      { "quantityID": 2, "quantityNumber": 2, "status": "available" },
      { "quantityID": 3, "quantityNumber": 3, "status": "available" }
    ]
  }
}
```

---

### 2. Get Available Courts for Time Slot (KEY!)
```
GET /api/fields/:fieldCode/available-quantities?playDate=YYYY-MM-DD&startTime=HH:MM&endTime=HH:MM

Example:
GET /api/fields/1/available-quantities?playDate=2025-10-20&startTime=08:00&endTime=09:00

Response: {
  "success": true,
  "data": {
    "fieldCode": 1,
    "playDate": "2025-10-20",
    "timeSlot": "08:00-09:00",
    "totalQuantities": 3,
    "availableQuantities": [
      { "quantity_id": 1, "quantity_number": 1, "status": "available" },
      { "quantity_id": 3, "quantity_number": 3, "status": "available" }
    ],
    "bookedQuantities": [
      { "quantity_id": 2, "quantity_number": 2, "status": "available" }
    ],
    "availableCount": 2
  }
}
```

---

### 3. Get All Quantities for Field
```
GET /api/fields/:fieldCode/quantities

Response: {
  "success": true,
  "data": {
    "fieldCode": 1,
    "totalQuantities": 3,
    "quantities": [
      {
        "quantity_id": 1,
        "quantity_number": 1,
        "status": "available",
        "created_at": "2025-10-20 10:00:00",
        "updated_at": "2025-10-20 10:00:00"
      },
      ...
    ]
  }
}
```

---

### 4. Update Quantity Status (Admin)
```
PUT /api/fields/:fieldCode/quantities/:quantityNumber/status
Headers: Authorization: Bearer TOKEN
Body: { "status": "maintenance" }

Valid status: available | maintenance | inactive
```

---

## 📋 Tasks for Frontend

### Task 1: Shop Fields Management Page (Update)

**Location:** `http://localhost:5173/shop/fields`

**Changes needed:**
1. Add `quantityCount` input field when creating/editing field
   ```tsx
   <input 
     name="quantityCount" 
     type="number" 
     placeholder="Số sân: 3"
     min="1"
     required
   />
   ```

2. Display court information
   ```tsx
   // Show field card with:
   // - Field name
   // - Sport type
   // - Number of courts
   // - List of courts (Sân 1, 2, 3)
   ```

3. Maintenance mode for individual courts
   ```tsx
   // For each court, allow setting status:
   // - Available (Green)
   // - Maintenance (Yellow)
   // - Inactive (Gray)
   ```

---

### Task 2: Booking Flow (MAJOR UPDATE)

**Flow:**
1. Customer selects field type (e.g., Tennis)
2. Customer selects time slot (e.g., 08:00-09:00)
3. **NEW STEP:** Show available courts
4. Customer selects specific court
5. Complete booking with `quantityID`

**Implementation:**

#### Step 1: Booking Form (No change)
```tsx
<FieldSelector fields={fields} onChange={handleSelectField} />
<TimeSlotSelector onChange={handleSelectTime} />
```

#### Step 2: New Component - Available Courts Selector
```tsx
// After time is selected, show available courts
<div>Chọn sân:</div>
{availableQuantities.map(q => (
  <button 
    key={q.quantity_id}
    onClick={() => selectCourt(q.quantity_id)}
    className={selectedCourt === q.quantity_id ? 'selected' : ''}
  >
    Sân {q.quantity_number}
  </button>
))}
```

#### Step 3: Fetch Available Courts
```typescript
// When customer selects time:
const response = await fetch(
  `/api/fields/${fieldCode}/available-quantities?playDate=${date}&startTime=${startTime}&endTime=${endTime}`
);
const data = await response.json();
setAvailableQuantities(data.data.availableQuantities);
```

#### Step 4: Create Booking with QuantityID
```typescript
// When submitting booking:
const booking = {
  fieldCode: selectedField,
  quantityID: selectedCourt,    // ← NEW!
  playDate: selectedDate,
  startTime: selectedTime,
  endTime: selectedEndTime,
  // ...other fields
}

await fetch('/api/bookings', {
  method: 'POST',
  body: JSON.stringify(booking)
});
```

---

### Task 3: Display Booking Details (Update)

**When showing booking confirmation or history:**
```tsx
// Show court number along with other details:
<div>
  <p>Sân: {booking.quantityNumber}</p>
  <p>Loại sân: {booking.fieldName}</p>
  <p>Giờ: {booking.startTime} - {booking.endTime}</p>
  <p>Ngày: {booking.playDate}</p>
</div>
```

---

## 🎯 Implementation Priority

### Phase 1 (P0 - Critical)
- [ ] Update Create Field form to accept `quantityCount`
- [ ] Add Available Courts selector in booking flow
- [ ] Include `quantityID` when creating booking
- [ ] Display quantity_number in booking details

### Phase 2 (P1 - Important)
- [ ] Show individual court status (Sân 1, 2, 3) on field card
- [ ] Add maintenance toggle for individual courts
- [ ] Improve UI for court selection

### Phase 3 (P2 - Nice to have)
- [ ] Show real-time availability stats
- [ ] Court status badges/indicators
- [ ] Analytics for court usage

---

## 📊 Data Types

```typescript
// Field with quantities
interface Field {
  fieldCode: number;
  fieldName: string;
  sportType: string;
  quantityCount: number;
  quantities: Quantity[];
}

// Individual court
interface Quantity {
  quantity_id: number;
  quantity_number: number;
  status: 'available' | 'maintenance' | 'inactive';
  created_at: string;
  updated_at: string;
}

// Available courts for time slot
interface SlotAvailability {
  fieldCode: number;
  playDate: string;
  timeSlot: string;
  totalQuantities: number;
  availableQuantities: Quantity[];
  bookedQuantities: Quantity[];
  availableCount: number;
}

// Booking (Updated)
interface Booking {
  bookingCode: number;
  fieldCode: number;
  quantityID: number;      // ← NEW!
  quantityNumber: number;  // ← NEW!
  playDate: string;
  startTime: string;
  endTime: string;
  status: string;
}
```

---

## 🧪 Testing Cases

### Test 1: Create Field with 3 Courts
```
1. Go to Shop Fields page
2. Click "Create Field"
3. Enter:
   - Name: "Tennis"
   - Sport Type: "Tennis"
   - Quantity: 3
4. Submit
5. Verify: Field shows "Sân 1, Sân 2, Sân 3"
```

### Test 2: Booking with Court Selection
```
1. Go to booking page
2. Select Field: "Tennis"
3. Select Date: "2025-10-20"
4. Select Time: "08:00-09:00"
5. Verify: Shows available courts (e.g., Sân 1, 3)
6. Select: "Sân 1"
7. Submit booking
8. Verify: Booking includes quantityID=1
```

### Test 3: Set Court to Maintenance
```
1. Go to Shop Fields page
2. Find "Tennis" field
3. For "Sân 2", click "Maintenance"
4. Go to booking page
5. Select Tennis, 08:00-09:00
6. Verify: Only "Sân 1, 3" show (Sân 2 hidden)
```

---

## 🎨 UI Components Needed

### 1. QuantityCount Input
```tsx
<NumberInput 
  label="Số sân" 
  name="quantityCount" 
  min={1}
  defaultValue={1}
/>
```

### 2. Court Selector Buttons
```tsx
<div className="court-selector">
  {availableQuantities.map(q => (
    <CourtsButton 
      key={q.quantity_id}
      number={q.quantity_number}
      isSelected={selectedCourt === q.quantity_id}
      onClick={() => selectCourt(q.quantity_id)}
    />
  ))}
</div>
```

### 3. Court Status Badge
```tsx
<Badge status={court.status}>
  Sân {court.quantity_number}
</Badge>
```

---

## 📞 Backend Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/shops/me/fields` | Create field (with quantityCount) |
| GET | `/api/fields/:fieldCode/quantities` | List all courts for field |
| GET | `/api/fields/:fieldCode/available-quantities` | Find free courts for time |
| PUT | `/api/fields/:fieldCode/quantities/:quantityNumber/status` | Set court maintenance |
| POST | `/api/bookings` | Create booking (include quantityID) |

---

## 💡 Key Points

✅ **quantityCount** - Number of physical courts per field  
✅ **quantityID** - Unique ID for specific court  
✅ **quantity_number** - Display name (Sân 1, 2, 3...)  
✅ **Status** - available / maintenance / inactive  
✅ **Availability Check** - Query by fieldCode + time slot  

---

## 🚀 Getting Started

1. Backend API is ready ✅
2. Review the 4 endpoints above
3. Update create field form
4. Add court selector to booking flow
5. Include `quantityID` in bookings
6. Test with all 3 test cases

---

## ❓ Questions?

- Check backend API responses above
- All endpoints are live at http://localhost:5050
- Test with Postman/curl before integrating

**Happy coding!** 🎉

