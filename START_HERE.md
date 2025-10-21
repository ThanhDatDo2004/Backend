# 🎯 START HERE - Field_Quantity System Ready!

## ✅ What's Done

**All BACKEND code for Field_Quantity system is 100% implemented!**

| Component | Status | Location |
|-----------|--------|----------|
| Database Schema | ✅ | `backend/docs/migrations/001_create_field_quantity_table.sql` |
| Model (DB Layer) | ✅ | `backend/src/models/fieldQuantity.model.ts` |
| Service (Business Logic) | ✅ | `backend/src/services/fieldQuantity.service.ts` |
| Controller (HTTP Handlers) | ✅ | `backend/src/controllers/fieldQuantity.controller.ts` |
| Routes (API Endpoints) | ✅ | `backend/src/routes/fieldQuantity.routes.ts` |
| Main App Integration | ✅ | `backend/src/index.ts` |
| Field Service Updated | ✅ | `backend/src/services/field.service.ts` |

---

## 🚀 Quick Start (5 Steps)

### Step 1: Run Database Migration
```bash
# Connect to your MySQL database and run:
mysql -u root -p yourdbname < backend/docs/migrations/001_create_field_quantity_table.sql
```

### Step 2: Restart Backend Server
```bash
cd /Users/home/Downloads/tsNode-temp-master/backend
npm run dev
```

### Step 3: Create a Field with Quantities
```bash
curl -X POST http://localhost:5050/api/shops/me/fields \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fieldName": "Tennis",
    "sportType": "tennis",
    "pricePerHour": 100000,
    "quantityCount": 3
  }'
```

**Response:**
- Field created with FieldCode = 1
- Automatically creates 3 quantities (Sân 1, 2, 3)

### Step 4: Check Available Courts for Time Slot
```bash
curl "http://localhost:5050/api/fields/1/available-quantities?playDate=2025-10-20&startTime=08:00&endTime=09:00"
```

**Response shows:**
- Total: 3 courts
- Available: [1, 2, 3]
- Booked: []

### Step 5: Frontend - Show Available Courts to Customer
- After customer selects time slot
- Call `/api/fields/1/available-quantities` endpoint
- Show available courts: [Sân 1] [Sân 2] [Sân 3]
- Customer clicks "Sân 1"
- Include `QuantityID: 1` in booking

---

## 📌 Key APIs

### For Admin (Create Fields)
```
POST /api/shops/me/fields
Body: {
  fieldName: "Tennis",
  quantityCount: 3  ← NEW!
}
```

### For Frontend (Check Availability)
```
GET /api/fields/1/available-quantities
Query: playDate, startTime, endTime
Response: { availableQuantities: [...] }
```

### For Customer Booking
```
POST /api/bookings
Body: {
  fieldCode: 1,
  quantityID: 1,  ← NEW! (Specific court)
  playDate: "2025-10-20",
  startTime: "08:00"
}
```

---

## 🎯 What Each Component Does

| File | Purpose |
|------|---------|
| `fieldQuantity.model.ts` | Database queries (SELECT, INSERT, DELETE) |
| `fieldQuantity.service.ts` | **Main logic**: `getAvailableSlot()` - finds free courts |
| `fieldQuantity.controller.ts` | HTTP request/response handling |
| `fieldQuantity.routes.ts` | Maps URLs to controller methods |

---

## 💡 How It Works

### Creating a Field
```
1. Admin: "Create Tennis field with 3 courts"
2. Backend: Creates 1 Field record + 3 Quantity records
3. Result: Tennis field has Sân 1, 2, 3
```

### Booking a Specific Court
```
1. Customer: "I want Tennis on 2025-10-20 08:00-09:00"
2. Backend: Returns { available: [1, 3], booked: [2] }
3. Customer: "I want Sân 1 (QuantityID 1)"
4. Backend: Creates booking with QuantityID = 1
```

---

## 📋 Implementation Checklist

- [x] **DONE:** Database schema
- [x] **DONE:** Models, services, controllers  
- [x] **DONE:** API endpoints
- [ ] **TODO:** Frontend updates
  - [ ] Add `quantityCount` input when creating field
  - [ ] Show available courts after time selection
  - [ ] Let customer pick specific court
  - [ ] Include `quantityID` in booking

---

## 🧪 Quick Test

### Test 1: Create Field with 3 Quantities
```bash
# Response should include 3 quantity records
curl -X POST http://localhost:5050/api/shops/me/fields \
  -H "Authorization: Bearer TOKEN" \
  -d '{"fieldName":"Tennis","sportType":"tennis","quantityCount":3}'
```

### Test 2: Check Availability
```bash
# Should show 3 available courts
curl "http://localhost:5050/api/fields/1/available-quantities?playDate=2025-10-20&startTime=08:00&endTime=09:00"
```

### Test 3: Set Court to Maintenance
```bash
# Court 2 becomes unavailable
curl -X PUT http://localhost:5050/api/fields/1/quantities/2/status \
  -H "Authorization: Bearer TOKEN" \
  -d '{"status":"maintenance"}'
```

---

## 📁 File Structure

```
backend/src/
├── models/
│   └── fieldQuantity.model.ts          ← NEW
├── services/
│   ├── field.service.ts                ← UPDATED
│   └── fieldQuantity.service.ts        ← NEW
├── controllers/
│   └── fieldQuantity.controller.ts     ← NEW
├── routes/
│   └── fieldQuantity.routes.ts         ← NEW
└── index.ts                            ← UPDATED
```

---

## 🎨 Frontend Updates Needed

### 1. Field Creation Form
```tsx
<input 
  name="quantityCount" 
  type="number" 
  placeholder="Số sân: 3"
  min="1"
/>
```

### 2. Court Selector Component (NEW)
```tsx
// After customer picks time, show available courts
<div>
  Chọn sân:
  {availableQuantities.map(q => (
    <button onClick={() => selectCourt(q.quantityID)}>
      Sân {q.quantityNumber}
    </button>
  ))}
</div>
```

### 3. Booking Creation
```tsx
// Include quantityID
const booking = {
  fieldCode: selectedField,
  quantityID: selectedCourt,  // ← NEW!
  playDate: selectedDate,
  startTime: selectedTime,
  endTime: selectedEndTime
}
```

---

## 🎓 Understanding the System

### Before (Single Court per Field)
```
Shop
├─ Field 1: Sân Tennis 1
├─ Field 2: Sân Tennis 2
├─ Field 3: Sân Tennis 3
├─ Field 4: Sân Bóng 1
└─ Field 5: Sân Bóng 2

Problems:
- Many fields to manage
- Hard to see "Tennis courts" vs "Soccer courts"
```

### After (Multiple Courts per Field)
```
Shop
├─ Field 1: Tennis (Quantity: 3)
│  ├─ Sân 1
│  ├─ Sân 2
│  └─ Sân 3
└─ Field 2: Bóng (Quantity: 2)
   ├─ Sân 1
   └─ Sân 2

Benefits:
- Organized by type
- Easy to manage
- Scale up: Just add more quantities
```

---

## ✨ Key Features

✅ Automatic quantity creation when field is created  
✅ Check which specific courts are free  
✅ Book specific court (not just field type)  
✅ Maintenance mode for individual courts  
✅ Indexed queries for performance  
✅ Cascade delete for data integrity  

---

## 📞 Need Help?

**Database Migration Error?**
- Check your database credentials
- Ensure database exists
- Run: `mysql -u root -p yourdb < migrations/...`

**API Not Working?**
- Restart backend: `npm run dev`
- Check authorization token
- Verify database migration ran

**Frontend Issues?**
- Reference: `IMPLEMENTATION_COMPLETE.md`
- Check API response format
- Include `quantityID` in bookings

---

## 🎯 What's Next?

1. **Run the SQL migration** ← Start here!
2. Restart backend
3. Test the APIs with curl/Postman
4. Update frontend UI
5. Test end-to-end booking flow

**Estimated time: 1-2 hours**

Enjoy your new multi-court system! 🎾⚽🏸

