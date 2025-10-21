# 🏗️ Architecture Recommendations & Key Decisions

## 🎯 Tóm Tắt Gợi Ý

**Yêu cầu của bạn:**
- ✅ Rất hợp lý và khả thi
- ✅ Schema của bạn rất tốt (chỉ cần optimize nhỏ)
- ✅ Có thể implement theo phases

---

## 📌 Key Architectural Decisions

### Decision 1: Pricing Model
**❓ Câu hỏi:** Pricing là per-Field hay per-Quantity?

**✅ Gợi ý:** Per-Field (Shared)
```
Tennis @ 08:00-09:00 = 100,000 VNĐ
- Áp dụng cho cả Sân 1 và Sân 2
- Tất cả quantities của 1 field cùng giá
```

**Lý do:**
- ✅ Đơn giản: Không phải tính giá x quantity
- ✅ Thực tế: Cùng loại sân, cùng giá
- ✅ Linh hoạt: Có thể customize sau nếu cần

### Decision 2: Availability Check
**❓ Câu hỏi:** Availability dựa vào gì?

**✅ Gợi ý:** Dựa vào Bookings + Field_Quantity

```typescript
async getAvailableQuantities(fieldCode, date, startTime, endTime) {
  // Step 1: Get all quantities
  const allQuantities = await db.query(
    SELECT * FROM Field_Quantity 
    WHERE FieldCode = ? AND Status = 'available'
  );
  
  // Step 2: Get booked quantities
  const bookedQuantities = await db.query(
    SELECT DISTINCT QuantityID FROM Bookings
    WHERE FieldCode = ? 
      AND PlayDate = ? 
      AND time overlap
  );
  
  // Step 3: Return available = all - booked
  return allQuantities.filter(q => 
    !bookedQuantities.includes(q.QuantityID)
  );
}
```

### Decision 3: Quantity Creation
**❓ Câu hỏi:** Khi nào tạo Quantities?

**✅ Gợi ý:** Khi Create Field (Automatic)

```typescript
// Khi admin tạo field mới
POST /api/shops/me/fields
Body: {
  "FieldName": "Tennis",
  "SportType": "tennis",
  "QuantityCount": 2         ← NEW!
}

// Backend tự động:
1. Insert vào Fields
2. Insert 2 rows vào Field_Quantity (QuantityNumber 1, 2)
```

---

## 🗄️ Database Schema - Final Version

### ✅ Complete & Optimized Schema

```sql
-- 1. Field_Quantity (Hoàn chỉnh)
CREATE TABLE Field_Quantity (
  QuantityID INT AUTO_INCREMENT PRIMARY KEY,
  FieldCode INT NOT NULL,
  QuantityNumber INT NOT NULL,
  Status ENUM('available', 'maintenance', 'inactive') DEFAULT 'available',
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (FieldCode) REFERENCES Fields(FieldCode) ON DELETE CASCADE,
  UNIQUE KEY UniqueFieldQuantity (FieldCode, QuantityNumber),
  INDEX IdxFieldCodeStatus (FieldCode, Status),
  INDEX IdxQuantityNumber (QuantityNumber)
);

-- 2. Update Bookings
ALTER TABLE Bookings ADD COLUMN QuantityID INT;
ALTER TABLE Bookings ADD FOREIGN KEY (QuantityID) REFERENCES Field_Quantity(QuantityID);
ALTER TABLE Bookings ADD INDEX IdxQuantityID (QuantityID);

-- 3. Update Fields (thêm QuantityCount nếu cần cache)
-- OPTIONAL: Có thể thêm để cache, hoặc query count từ Field_Quantity
ALTER TABLE Fields ADD COLUMN QuantityCount INT DEFAULT 1;
```

---

## 🔌 API Design

### New Endpoints

#### 1. Get Available Quantities (Quan Trọng!)
```
GET /api/fields/:fieldCode/available-quantities
  Query Params:
    playDate: YYYY-MM-DD
    startTime: HH:MM
    endTime: HH:MM

Response: {
  success: true,
  data: {
    fieldCode: 1,
    fieldName: "Tennis",
    playDate: "2025-10-20",
    timeSlot: "08:00-09:00",
    totalQuantities: 2,
    availableQuantities: [
      {
        quantityID: 1,
        quantityNumber: 1,
        status: "available"
      },
      {
        quantityID: 2,
        quantityNumber: 2,
        status: "available"
      }
    ],
    bookedQuantities: [],
    availableCount: 2
  }
}
```

#### 2. Create Field (Updated)
```
POST /api/shops/me/fields
Body: {
  "fieldName": "Tennis",
  "sportType": "tennis",
  "address": "123 Nguyen Hue",
  "pricePerHour": 100000,
  "quantityCount": 2        ← NEW!
}

Response: {
  success: true,
  data: {
    fieldCode: 1,
    fieldName: "Tennis",
    quantityCount: 2,
    quantities: [
      { quantityID: 1, quantityNumber: 1 },
      { quantityID: 2, quantityNumber: 2 }
    ]
  }
}
```

#### 3. Update Quantity Status (Admin)
```
PUT /api/fields/:fieldCode/quantities/:quantityNumber/status
Body: {
  "status": "maintenance"    // available, maintenance, inactive
}

Response: {
  success: true,
  data: {
    quantityID: 1,
    quantityNumber: 1,
    status: "maintenance"
  }
}
```

#### 4. Create Booking (Updated)
```
POST /api/bookings
Body: {
  "fieldCode": 1,
  "quantityID": 1           ← NEW! (Specific court)
  "playDate": "2025-10-20",
  "startTime": "08:00",
  "endTime": "09:00"
}

Response: {
  success: true,
  data: {
    bookingCode: 100,
    quantityID: 1,
    quantityNumber: 1,
    status: "pending"
  }
}
```

---

## 💻 Backend Implementation

### File Structure
```
backend/src/
├─ models/
│  ├─ field.model.ts         (UPDATE)
│  └─ fieldQuantity.model.ts (NEW)
│
├─ services/
│  ├─ field.service.ts        (UPDATE)
│  └─ fieldQuantity.service.ts (NEW)
│
├─ controllers/
│  ├─ field.controller.ts      (UPDATE)
│  └─ fieldQuantity.controller.ts (NEW)
│
└─ routes/
   └─ field.routes.ts         (UPDATE)
```

### Key Models/Methods

#### FieldQuantity Model
```typescript
const fieldQuantityModel = {
  // CREATE
  async create(fieldCode: number, quantityNumber: number)
  
  // READ
  async getByFieldCode(fieldCode: number)
  async getByQuantityID(quantityID: number)
  async getAvailableQuantities(fieldCode: number, status: string)
  
  // UPDATE
  async updateStatus(quantityID: number, status: string)
  async bulkCreate(fieldCode: number, count: number)
  
  // DELETE (Cascade - automatic)
  
  // AVAILABILITY CHECK (Quan trọng!)
  async getAvailableForSlot(
    fieldCode: number, 
    playDate: string, 
    startTime: string, 
    endTime: string
  )
}
```

#### FieldQuantity Service
```typescript
const fieldQuantityService = {
  // Create quantities khi tạo field
  async createQuantitiesForField(fieldCode: number, count: number)
  
  // Get available slots
  async getAvailableSlots(fieldCode: number, playDate: string, startTime: string, endTime: string)
  
  // Check if specific quantity available
  async isQuantityAvailable(quantityID: number, playDate: string, startTime: string, endTime: string)
  
  // Set quantity to maintenance/inactive
  async setQuantityStatus(quantityID: number, status: string)
}
```

---

## 🎨 Frontend Updates

### Components to Update/Create

#### 1. FieldForm (Create/Edit)
```tsx
// BEFORE:
<input name="fieldName" placeholder="Sân 1" />
<input name="sportType" />

// AFTER:
<input name="fieldName" placeholder="Tennis" />
<input name="sportType" />
<input name="quantityCount" type="number" min="1" placeholder="Số sân: 2" />
```

#### 2. AvailableQuantitiesSelector (NEW)
```tsx
// Hiện danh sách sân trống trong khung giờ đó
<AvailableQuantitiesSelector 
  fieldCode={fieldCode}
  playDate={selectedDate}
  timeSlot={selectedTime}
  onSelect={handleSelectQuantity}
/>

// Render
{availableQuantities.map(q => (
  <button onClick={() => onSelect(q.quantityID)}>
    Sân {q.quantityNumber}
  </button>
))}
```

#### 3. BookingFlow (Updated)
```tsx
// Step 1: Select Field Type
<FieldSelector fields={fields} />

// Step 2: Select Time Slot
<TimeSlotSelector fieldCode={fieldCode} />

// Step 3: Select Specific Court (NEW!)
<AvailableQuantitiesSelector 
  availableQuantities={availableQuantities}
/>

// Step 4: Confirm
<BookingConfirm 
  selectedQuantity={selectedQuantity}
  selectedTime={selectedTime}
/>
```

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
describe('FieldQuantity', () => {
  // Test creating quantities
  test('should create N quantities when creating field')
  
  // Test availability check
  test('should return available quantities for time slot')
  test('should exclude booked quantities')
  test('should exclude maintenance quantities')
  
  // Test booking
  test('should fail if quantity already booked')
  test('should succeed with available quantity')
});
```

### Integration Tests

```typescript
describe('Booking Flow with Quantities', () => {
  // Scenario 1: All courts available
  test('should show all courts as available')
  
  // Scenario 2: Some courts booked
  test('should show only available courts')
  
  // Scenario 3: All courts booked
  test('should show time slot as unavailable')
  
  // Scenario 4: Some courts in maintenance
  test('should exclude maintenance courts')
});
```

---

## 📊 Data Migration Plan

### If you have existing data:

```sql
-- Step 1: Create Field_Quantity table

-- Step 2: Migrate current fields to quantities
-- Ví dụ: 5 fields (Sân 1-3 tennis, Sân 1-2 bóng)
-- Mong muốn: 2 fields (Tennis, Bóng) with quantities

-- Strategy A: Group by Sport Type
INSERT INTO Field_Quantity (FieldCode, QuantityNumber, Status)
SELECT 
  ROW_NUMBER() OVER (PARTITION BY SportType ORDER BY FieldCode) as QuantityNumber,
  FieldCode,
  CASE WHEN Status = 'active' THEN 'available' ELSE Status END
FROM Fields
WHERE ShopCode = 1;

-- Step 3: Update Bookings
UPDATE Bookings b
JOIN Field_Quantity fq ON b.FieldCode = fq.FieldCode
SET b.QuantityID = fq.QuantityID
WHERE b.QuantityID IS NULL;
```

---

## ✅ Implementation Phases

### Phase 1: Database (1-2 days)
- [ ] Create Field_Quantity table
- [ ] Add QuantityID to Bookings
- [ ] Create indexes

### Phase 2: Backend Core (3-5 days)
- [ ] Create FieldQuantity model
- [ ] Create FieldQuantity service
- [ ] Update Field service for quantity creation
- [ ] Create availability check logic

### Phase 3: APIs (2-3 days)
- [ ] Create GET /available-quantities endpoint
- [ ] Update POST /fields endpoint
- [ ] Update POST /bookings endpoint
- [ ] Add quantity management endpoints

### Phase 4: Frontend (3-5 days)
- [ ] Update FieldForm component
- [ ] Create AvailableQuantitiesSelector
- [ ] Update BookingFlow
- [ ] Add quantity display

### Phase 5: Testing (2-3 days)
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing
- [ ] Edge cases

---

## ⚠️ Common Pitfalls to Avoid

### ❌ Don't:
1. **Don't store quantities in Fields.QuantityCount only**
   - Use Field_Quantity table for proper tracking
   
2. **Don't forget indexes**
   - Will cause performance issues with many bookings
   
3. **Don't handle edge cases late**
   - Implement maintenance/inactive status from start
   
4. **Don't make quantities immutable**
   - Allow adding/removing quantities later

### ✅ Do:
1. **Do use proper FK constraints** with ON DELETE CASCADE
2. **Do add audit fields** (CreatedAt, UpdatedAt)
3. **Do cache availability** if needed (Redis)
4. **Do test edge cases** thoroughly

---

## 🎓 Best Practices

### Query Optimization
```typescript
// ❌ DON'T: N+1 queries
for (const field of fields) {
  const quantities = await getQuantities(field.id);
}

// ✅ DO: JOIN query
const quantities = await db.query(
  SELECT * FROM Field_Quantity 
  WHERE FieldCode IN (...)
);
```

### Error Handling
```typescript
// ✅ Clear error messages
if (!availableQuantities.length) {
  throw new Error("Sân bóng 08:00-09:00 ngày 20/10 đã đầy. Vui lòng chọn khung giờ khác.");
}
```

### Frontend UX
```typescript
// ✅ Show availability clearly
{availableCount === 0 && <Badge>FULL</Badge>}
{availableCount > 0 && <Badge>{availableCount} available</Badge>}
```

---

## 🎯 Final Recommendation

### ✅ Your Plan is Excellent!

**Strengths:**
- ✅ Solves pricing/booking management elegantly
- ✅ Scalable (easy to add/remove courts)
- ✅ Flexible (individual court maintenance)
- ✅ User-friendly (clear court selection)

**Implementation Path:**
1. Start with database schema
2. Build backend models/services
3. Create APIs
4. Update frontend
5. Test thoroughly

**Expected Timeline:** 2-3 weeks of development

**Complexity:** Medium (More complex queries, but still manageable)

