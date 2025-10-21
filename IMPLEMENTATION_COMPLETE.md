# ✅ Field_Quantity Implementation Complete!

**Status:** ✅ FULLY IMPLEMENTED IN YOUR CODE  
**Date:** October 20, 2025  
**Components Added:** 5 files

---

## 📁 Files Created/Modified

### NEW FILES (5 files):

1. **backend/docs/migrations/001_create_field_quantity_table.sql**
   - SQL migration script
   - Create Field_Quantity table
   - Add QuantityID to Bookings
   - Add indexes

2. **backend/src/models/fieldQuantity.model.ts**
   - Database operations for quantities
   - 12 methods for CRUD operations
   - Availability checks

3. **backend/src/services/fieldQuantity.service.ts**
   - Business logic for quantities
   - Main function: `getAvailableSlot()`
   - Availability validation

4. **backend/src/controllers/fieldQuantity.controller.ts**
   - HTTP request handlers
   - 4 endpoints

5. **backend/src/routes/fieldQuantity.routes.ts**
   - Route definitions
   - 4 API endpoints

### MODIFIED FILES (2 files):

6. **backend/src/services/field.service.ts**
   - Added fieldQuantityService import
   - Updated `createForShop()` to accept `quantityCount`
   - Auto-creates quantities when field is created

7. **backend/src/index.ts**
   - Added fieldQuantityRouter import
   - Registered fieldQuantity routes

---

## 🔌 New API Endpoints

### 1. Get Available Quantities for Time Slot
```
GET /api/fields/:fieldCode/available-quantities?playDate=2025-10-20&startTime=08:00&endTime=09:00
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fieldCode": 1,
    "playDate": "2025-10-20",
    "timeSlot": "08:00-09:00",
    "totalQuantities": 3,
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
      }
    ],
    "availableCount": 2
  }
}
```

---

### 2. Get All Quantities for Field
```
GET /api/fields/:fieldCode/quantities
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fieldCode": 1,
    "totalQuantities": 3,
    "quantities": [
      {
        "quantity_id": 1,
        "field_code": 1,
        "quantity_number": 1,
        "status": "available",
        "created_at": "2025-10-20 10:00:00",
        "updated_at": "2025-10-20 10:00:00"
      },
      {
        "quantity_id": 2,
        "field_code": 1,
        "quantity_number": 2,
        "status": "available",
        "created_at": "2025-10-20 10:00:00",
        "updated_at": "2025-10-20 10:00:00"
      },
      {
        "quantity_id": 3,
        "field_code": 1,
        "quantity_number": 3,
        "status": "available",
        "created_at": "2025-10-20 10:00:00",
        "updated_at": "2025-10-20 10:00:00"
      }
    ]
  }
}
```

---

### 3. Get Single Quantity Details
```
GET /api/fields/:fieldCode/quantities/:quantityId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "quantity_id": 1,
    "field_code": 1,
    "quantity_number": 1,
    "status": "available",
    "created_at": "2025-10-20 10:00:00",
    "updated_at": "2025-10-20 10:00:00"
  }
}
```

---

### 4. Update Quantity Status (Admin)
```
PUT /api/fields/:fieldCode/quantities/:quantityNumber/status
Authorization: Bearer TOKEN
```

**Request Body:**
```json
{
  "status": "maintenance"
}
```

**Valid Status Values:**
- `available` - Court is available for booking
- `maintenance` - Court under maintenance
- `inactive` - Court is inactive/unavailable

---

## 📝 Updated Endpoints

### Create Field (Updated)
```
POST /api/shops/me/fields
```

**Request Body (NEW: quantityCount):**
```json
{
  "fieldName": "Tennis",
  "sportType": "tennis",
  "address": "123 Nguyen Hue",
  "pricePerHour": 100000,
  "quantityCount": 3
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fieldCode": 1,
    "fieldName": "Tennis",
    "sportType": "tennis",
    "quantityCount": 3,
    "quantities": [
      {
        "quantity_id": 1,
        "quantity_number": 1,
        "status": "available"
      },
      {
        "quantity_id": 2,
        "quantity_number": 2,
        "status": "available"
      },
      {
        "quantity_id": 3,
        "quantity_number": 3,
        "status": "available"
      }
    ]
  }
}
```

---

## 🗄️ Database Schema

### Field_Quantity Table
```sql
CREATE TABLE Field_Quantity (
  QuantityID INT AUTO_INCREMENT PRIMARY KEY,
  FieldCode INT NOT NULL,
  QuantityNumber INT NOT NULL,
  Status ENUM('available', 'maintenance', 'inactive'),
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE,
  
  FOREIGN KEY (FieldCode) REFERENCES Fields(FieldCode) ON DELETE CASCADE,
  UNIQUE KEY (FieldCode, QuantityNumber),
  INDEX (FieldCode, Status)
)
```

### Updated Bookings Table
```sql
ALTER TABLE Bookings ADD COLUMN QuantityID INT;
ALTER TABLE Bookings ADD FOREIGN KEY (QuantityID) REFERENCES Field_Quantity(QuantityID);
ALTER TABLE Bookings ADD INDEX (QuantityID);
```

---

## 🚀 How to Use

### Step 1: Run Database Migration
```bash
mysql -u root -p yourdbname < backend/docs/migrations/001_create_field_quantity_table.sql
```

### Step 2: Restart Backend
```bash
cd backend
npm run dev
```

### Step 3: Create Field with Quantities
```bash
curl -X POST http://localhost:5050/api/shops/me/fields \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fieldName": "Tennis",
    "sportType": "tennis",
    "quantityCount": 3
  }'
```

### Step 4: Check Available Quantities
```bash
curl "http://localhost:5050/api/fields/1/available-quantities?playDate=2025-10-20&startTime=08:00&endTime=09:00"
```

### Step 5: In Booking, Include QuantityID
```typescript
// When creating booking, you now include:
{
  "FieldCode": 1,
  "QuantityID": 1,  // ← NEW!
  "PlayDate": "2025-10-20",
  "StartTime": "08:00",
  "EndTime": "09:00"
}
```

---

## 📊 Example Usage Flow

### Scenario: Tennis Shop with 3 Courts

**1. Create Field:**
```
POST /api/shops/me/fields
{
  "fieldName": "Tennis",
  "sportType": "tennis",
  "quantityCount": 3  ← Creates 3 quantity records
}
```

**2. Backend Auto-Creates:**
```
QuantityID 1: FieldCode 1, QuantityNumber 1
QuantityID 2: FieldCode 1, QuantityNumber 2
QuantityID 3: FieldCode 1, QuantityNumber 3
```

**3. User Checks Availability:**
```
GET /api/fields/1/available-quantities?playDate=2025-10-20&startTime=08:00&endTime=09:00
Response: Available: [1, 3], Booked: [2]
```

**4. User Books Court 1:**
```
POST /api/bookings
{
  "FieldCode": 1,
  "QuantityID": 1,  ← Booking specific court
  "PlayDate": "2025-10-20",
  "StartTime": "08:00",
  "EndTime": "09:00"
}
```

---

## 🧪 Testing

### Test Available Quantity Endpoint
```bash
# All 3 courts available
curl "http://localhost:5050/api/fields/1/available-quantities?playDate=2025-10-20&startTime=08:00&endTime=09:00"

# Book court 1
# Then check again - should show only 2 available
```

### Test Status Update
```bash
# Set court 2 to maintenance
curl -X PUT http://localhost:5050/api/fields/1/quantities/2/status \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "maintenance"}'
```

---

## ✨ Key Features

✅ **Auto-Creation** - Quantities created automatically with field  
✅ **Availability Checks** - Complex query to find free courts  
✅ **Status Management** - Each court can be available/maintenance/inactive  
✅ **Individual Tracking** - Each booking tracks specific QuantityID  
✅ **Scalable** - Easy to add/remove courts  
✅ **Performance** - Indexed queries for fast lookups  
✅ **Integrity** - CASCADE delete if field is removed  

---

## 📋 What's Next (Frontend)

### 1. Update FieldForm
```tsx
<input name="quantityCount" type="number" placeholder="Số sân: 3" />
```

### 2. Create AvailableQuantitiesSelector
```tsx
// After time slot selected, show available courts:
// [Sân 1] [Sân 3]
```

### 3. Update Booking to use QuantityID
```tsx
// Include quantityID in booking creation
```

---

## ✅ Implementation Checklist

- [x] Database migration SQL
- [x] FieldQuantity model
- [x] FieldQuantity service
- [x] FieldQuantity controller
- [x] FieldQuantity routes
- [x] Update field.service to create quantities
- [x] Update main index.ts with routes
- [x] API endpoints ready
- [ ] Frontend updates (your task)
- [ ] Booking integration (your task)

---

## 🎯 Summary

**All backend code is READY!** 

Just:
1. Run the SQL migration
2. Restart your backend
3. Start using the new APIs
4. Update frontend to use QuantityID in bookings

The system will now:
- Allow creating 1 Field with multiple Quantities
- Check which specific courts are free at each time
- Let customers book specific courts
- Track each booking to a specific court

Enjoy your new multi-court system! 🎾⚽🏸

