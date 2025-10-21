# 🎯 Field_Quantity Implementation Guide

## 📋 Yêu Cầu Tóm Tắt

**Từ:** 1 shop = nhiều fields (mỗi field là 1 sân riêng)  
**Sang:** 1 shop = ít fields, nhưng mỗi field có nhiều quantity (sân vật lý)

### Ví Dụ
```
TRƯỚC:
Thành Đạt Sports
├─ Field 1: "Sân Tennis 1"
├─ Field 2: "Sân Tennis 2"
├─ Field 3: "Sân Bóng 1"
├─ Field 4: "Sân Bóng 2"
└─ Field 5: "Sân Bóng 3"

SAU:
Thành Đạt Sports
├─ Field 1: "Tennis" (Quantity: 2)
│  ├─ QuantityID 1: Sân 1
│  └─ QuantityID 2: Sân 2
└─ Field 2: "Bóng" (Quantity: 3)
   ├─ QuantityID 3: Sân 1
   ├─ QuantityID 4: Sân 2
   └─ QuantityID 5: Sân 3
```

---

## 🗄️ Database Schema (Cải Tiến)

### ✅ Bảng Field_Quantity (Hoàn Chỉnh)

```sql
CREATE TABLE Field_Quantity (
  QuantityID INT AUTO_INCREMENT PRIMARY KEY,
  FieldCode INT NOT NULL,
  QuantityNumber INT NOT NULL,           -- Sân 1, Sân 2, Sân 3...
  Status ENUM('available', 'maintenance', 'inactive') DEFAULT 'available',
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign Key với ON DELETE CASCADE (quan trọng!)
  FOREIGN KEY (FieldCode) REFERENCES Fields(FieldCode) ON DELETE CASCADE,
  
  -- Unique constraint: Mỗi (FieldCode, QuantityNumber) là duy nhất
  UNIQUE KEY UniqueFieldQuantity (FieldCode, QuantityNumber),
  
  -- Indexes cho performance
  INDEX IdxFieldCodeStatus (FieldCode, Status),
  INDEX IdxQuantityNumber (QuantityNumber)
);

-- Bookings thêm QuantityID
ALTER TABLE Bookings ADD COLUMN QuantityID INT;
ALTER TABLE Bookings ADD FOREIGN KEY (QuantityID) REFERENCES Field_Quantity(QuantityID);
ALTER TABLE Bookings ADD INDEX IdxQuantityID (QuantityID);
```

---

## 🎯 Lợi Ích Của Cách Tiếp Cận Này

### ✅ Lợi Ích

| Lợi Ích | Giải Thích |
|---------|-----------|
| **Quản lý Pricing dễ hơn** | Cùng sân loại (Tennis) → cùng giá |
| **Quản lý Booking linh hoạt** | Check từng court riêng biệt |
| **Dễ mở rộng** | Thêm 1 sân tennis mới = 1 QuantityNumber mới |
| **API đơn giản hơn** | Không phải tạo nhiều fields |
| **Frontend rõ ràng** | Người dùng thấy "Sân 1, 2, 3" rõ ràng |

### ⚠️ Thách Thức

| Thách Thức | Giải Pháp |
|-----------|----------|
| **Phức tạp hơn queries** | JOIN với Field_Quantity + Bookings |
| **Migration data** | Cần migrate dữ liệu cũ |
| **Update Bookings** | Thêm QuantityID tracking |

---

## 📊 Data Flow - Booking Process

### Step 1: Customer xem Shop
```
GET /api/shops/search
Response:
[
  {
    "ShopCode": 1,
    "ShopName": "Thành Đạt Sports",
    "Fields": [
      {
        "FieldCode": 1,
        "FieldName": "Tennis",
        "SportType": "tennis",
        "QuantityCount": 2
      },
      {
        "FieldCode": 2,
        "FieldName": "Bóng",
        "SportType": "soccer",
        "QuantityCount": 3
      }
    ]
  }
]
```

### Step 2: Customer chọn Sân Loại (Field)
```
GET /api/shops/me/fields/:fieldCode/pricing
Response: [
  {
    "PricingID": 1,
    "DayOfWeek": 1,
    "StartTime": "08:00",
    "EndTime": "09:00",
    "PricePerHour": 100000
  },
  ...
]
```

### Step 3: Customer chọn Giờ → Check Sân Trống

```
GET /api/fields/:fieldCode/available-quantities
Query: { playDate: '2025-10-20', startTime: '08:00', endTime: '09:00' }

Response: {
  "fieldCode": 1,
  "fieldName": "Tennis",
  "availableQuantities": [
    {
      "QuantityID": 1,
      "QuantityNumber": 1,
      "Status": "available"
    },
    {
      "QuantityID": 2,
      "QuantityNumber": 2,
      "Status": "available"
    }
  ],
  "bookedQuantities": [],
  "totalQuantities": 2,
  "availableCount": 2
}
```

### Step 4: Customer Book Cụ Thể 1 Sân

```
POST /api/bookings
Body: {
  "FieldCode": 1,
  "QuantityID": 1,              ← NEW!
  "PlayDate": "2025-10-20",
  "StartTime": "08:00",
  "EndTime": "09:00"
}

Response: {
  "BookingCode": 100,
  "QuantityID": 1,
  "QuantityNumber": 1,
  "Status": "pending"
}
```

---

## 💻 Implementation Tasks

### Task 1: Database Changes
- [ ] Create Field_Quantity table
- [ ] Add QuantityID to Bookings
- [ ] Add indexes

### Task 2: Backend Models
- [ ] Create FieldQuantity model
- [ ] Methods:
  - [ ] getQuantitiesForField(fieldCode)
  - [ ] getAvailableQuantities(fieldCode, date, startTime, endTime)
  - [ ] createQuantities(fieldCode, count)

### Task 3: Backend Services
- [ ] FieldQuantityService methods:
  - [ ] listAvailableForSlot()
  - [ ] checkAvailability()
  - [ ] allocateQuantity()
  
- [ ] Update BookingService:
  - [ ] Include QuantityID in booking

### Task 4: API Endpoints

**New Endpoints:**
```
GET /api/fields/:fieldCode/available-quantities
  Query: playDate, startTime, endTime
  Response: { availableQuantities, bookedQuantities }

GET /api/shops/:shopCode/fields
  Response: List fields with quantity count

POST /api/fields/:fieldCode/quantities
  Body: { count }
  Admin: Tạo quantities mới
```

**Updated Endpoints:**
```
GET /api/fields/:fieldCode/pricing
  Response: Với QuantityCount info

POST /api/bookings
  Body: Thêm QuantityID

GET /api/bookings/:bookingCode
  Response: Với QuantityID + QuantityNumber
```

### Task 5: Frontend Changes

**Shop Fields Management:**
```tsx
// Trước: Phải tạo 3 fields (Sân 1, 2, 3)
// Sau: Tạo 1 field + input số lượng sân

<FieldForm>
  <input name="fieldName" placeholder="Tên sân loại: Tennis" />
  <input name="quantityCount" type="number" placeholder="Số sân: 2" />
</FieldForm>
```

**Booking Flow:**
```tsx
// Step 1: Chọn sân loại
<FieldSelector fields={fields} />

// Step 2: Chọn giờ
<TimeSlotSelector 
  fieldCode={selectedField}
  onTimeSelect={handleTimeSelect}
/>

// Step 3: Chọn sân cụ thể (NEW!)
<AvailableQuantitiesSelector 
  availableQuantities={availableQuantities}
  onQuantitySelect={handleQuantitySelect}
/>

// Step 4: Confirm booking
<BookingConfirm 
  selectedQuantity={selectedQuantity}
  selectedTime={selectedTime}
/>
```

---

## 🔄 Query Logic (Quan Trọng)

### Query: "Tìm sân tennis trống vào 08:00-09:00 ngày 2025-10-20"

```sql
-- Step 1: Get tất cả quantities của field
SELECT * FROM Field_Quantity 
WHERE FieldCode = 1 
  AND Status = 'available';

-- Step 2: Get bookings trong khung giờ đó
SELECT DISTINCT fq.QuantityID 
FROM Bookings b
JOIN Field_Quantity fq ON b.QuantityID = fq.QuantityID
WHERE fq.FieldCode = 1
  AND b.PlayDate = '2025-10-20'
  AND b.StartTime < '09:00' 
  AND b.EndTime > '08:00'
  AND b.BookingStatus IN ('pending', 'confirmed');

-- Step 3: Available = All - Booked
SELECT * FROM Field_Quantity 
WHERE FieldCode = 1 
  AND Status = 'available'
  AND QuantityID NOT IN (booked_list);
```

---

## 📝 Migration Strategy

### Option 1: Start Fresh (Nếu chưa go live)
- [ ] Backup database
- [ ] Drop existing fields
- [ ] Create new structure
- [ ] Seed Field_Quantity data

### Option 2: Data Migration (Nếu đã có data)
```sql
-- Step 1: Create Field_Quantity table

-- Step 2: Migrate dữ liệu (Ví dụ)
-- Nếu có 5 fields (Sân 1-3 tennis, Sân 1-2 soccer)
INSERT INTO Field_Quantity (FieldCode, QuantityNumber)
SELECT 
  CASE WHEN id IN (1,2,3) THEN 1 ELSE 2 END as FieldCode,
  ROW_NUMBER() OVER () as QuantityNumber
FROM old_fields;

-- Step 3: Update Bookings
UPDATE Bookings b
JOIN Field_Quantity fq ON b.FieldCode = fq.FieldCode
SET b.QuantityID = fq.QuantityID
WHERE b.QuantityID IS NULL;
```

---

## 🎯 Gợi Ý Tốt Nhất

### ✅ Recommended Approach

1. **Use Field_Quantity schema** từ file của bạn (+ improvements)
2. **Thêm ON DELETE CASCADE** để safety
3. **Thêm UpdatedAt** để tracking
4. **Thêm Indexes** cho performance

### 🚀 Implementation Order

1. ✅ Database schema (đã có, chỉ cần optimize)
2. ✅ Models/Services (mới)
3. ✅ APIs (mới)
4. ✅ Frontend (update)
5. ✅ Testing

---

## 📊 Example Data Structure

### Fields Table
```
| FieldCode | ShopCode | FieldName | SportType | DefaultPricePerHour |
|-----------|----------|-----------|-----------|-------------------|
| 1         | 1        | Tennis    | tennis    | 100000            |
| 2         | 1        | Bóng      | soccer    | 80000             |
```

### Field_Quantity Table
```
| QuantityID | FieldCode | QuantityNumber | Status    |
|-----------|-----------|----------------|-----------|
| 1         | 1         | 1              | available |
| 2         | 1         | 2              | available |
| 3         | 2         | 1              | available |
| 4         | 2         | 2              | available |
| 5         | 2         | 3              | available |
```

### Bookings Table
```
| BookingCode | FieldCode | QuantityID | PlayDate   | StartTime | EndTime | Status    |
|------------|-----------|------------|------------|-----------|---------|-----------|
| 1          | 1         | 1          | 2025-10-20 | 08:00     | 09:00   | confirmed |
| 2          | 1         | 2          | 2025-10-20 | 08:00     | 09:00   | confirmed |
| 3          | 2         | 3          | 2025-10-20 | 08:00     | 09:00   | confirmed |
```

**Kết quả:** 
- Field 1 (Tennis) tại 08:00-09:00: CẢ 2 sân ĐẦY
- Field 2 (Bóng) tại 08:00-09:00: Sân 2,3 còn trống

---

## ✨ Key Points

✅ **Pricing = Field level** (không phải Quantity)  
✅ **Booking = Quantity level** (cụ thể 1 sân)  
✅ **Availability check = Query Field_Quantity + Bookings**  
✅ **Frontend shows** = "Sân 1, 2, 3" (không phải Field names)  
✅ **DB integrity** = ON DELETE CASCADE, Indexes, UpdatedAt  

---

## 🎓 Learning Points

### Schema Design
- 1-to-Many: Field (1) → Quantity (Many)
- Booking references Quantity, không Field
- Pricing references Field (shared across all quantities)

### Query Optimization
- Indexes: (FieldCode, Status), QuantityID
- JOIN: Field_Quantity + Bookings
- Check: Booked quantities = NOT available

### API Design
- GET availability = Complex query
- POST booking = Simple, just insert QuantityID
- Response = Include available count

