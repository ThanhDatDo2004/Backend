# 🗄️ Database Consolidation Analysis: Booking_Slots vs Field_Slots

## 📊 Hai Bảng So Sánh

### Bảng 1: Booking_Slots (Hiện Tại)
```sql
CREATE TABLE `Booking_Slots` (
  `Slot_ID` int NOT NULL AUTO_INCREMENT,
  `BookingCode` int NOT NULL,           ← Link tới booking cụ thể
  `FieldCode` int NOT NULL,
  `PlayDate` date NOT NULL,
  `StartTime` time NOT NULL,
  `EndTime` time NOT NULL,
  `PricePerSlot` int DEFAULT '100000',
  `Status` enum('pending','booked','cancelled'),
  `CreateAt` timestamp,
  `UpdateAt` timestamp,
  PRIMARY KEY (`Slot_ID`),
  UNIQUE KEY `unique_slot` (`BookingCode`,`PlayDate`,`StartTime`),
  FOREIGN KEY (`BookingCode`) REFERENCES `Bookings` (`BookingCode`) ON DELETE CASCADE
);
```

**Mục đích:**
- Lưu từng khung giờ của mỗi booking
- 1 booking có thể có nhiều Booking_Slots (nếu book 2-3 giờ)
- Được tạo KHI booking được tạo

**Ví dụ:**
```
BookingCode 80:
  Slot_ID 1: 08:00-09:00 (pending)
  Slot_ID 2: 09:00-10:00 (pending)
  → 1 booking = 2 slots
```

---

### Bảng 2: Field_Slots (Hiện Tại - Mới Thêm)
```sql
CREATE TABLE `Field_Slots` (
  `SlotID` int NOT NULL AUTO_INCREMENT,
  `FieldCode` int NOT NULL,             ← Sân nào
  `PlayDate` date NOT NULL,
  `StartTime` time NOT NULL,
  `EndTime` time NOT NULL,
  `Status` enum('available','booked','held'),
  `BookingCode` int DEFAULT NULL,       ← Booking nào (optional)
  `HoldExpiresAt` datetime DEFAULT NULL, ← Giữ chỗ bao lâu
  `QuantityID` int DEFAULT NULL,        ← Sân cụ thể nào (SẦN 1,2,3,4)
  `CreatedBy` int DEFAULT NULL,
  `CreateAt` timestamp,
  `UpdateAt` timestamp,
  PRIMARY KEY (`SlotID`),
  UNIQUE KEY `FieldCode_2` (`FieldCode`,`PlayDate`,`StartTime`,`EndTime`),
  FOREIGN KEY (`BookingCode`) REFERENCES `Bookings` (`BookingCode`) ON DELETE SET NULL
);
```

**Mục đích:**
- Quản lý TẤT CẢ các khung giờ của sân
- Có trạng thái: available, booked, held
- Được tạo TỰ ĐỘNG từ Field_Pricing (available slots)
- Được UPDATE khi có booking

**Ví dụ:**
```
FieldCode 68, 08:00-09:00:
  SlotID 1: Status = 'booked', BookingCode = 80, QuantityID = 22 (Sân 1)
  SlotID 2: Status = 'available', BookingCode = NULL, QuantityID = NULL
```

---

## ⚖️ So Sánh Chi Tiết

| Tiêu Chí | Booking_Slots | Field_Slots |
|---------|---------------|-------------|
| **Mục đích** | Lưu slots của 1 booking | Quản lý availability của sân |
| **Dữ liệu chính** | BookingCode + thời gian | FieldCode + thời gian |
| **Có QuantityID?** | ❌ Không | ✅ Có |
| **Trạng thái** | pending/booked/cancelled | available/booked/held |
| **Được tạo khi** | Booking được tạo | Tự động từ pricing |
| **Được xoá khi** | Booking xoá (CASCADE) | Không tự xoá |
| **Dùng để** | Lưu chi tiết booking | Check availability |

---

## ❓ Có Thể Gộp Lại Không?

### 🔴 Câu Trả Lời: **KHÔNG NÊN**

**Vì sao:**

1. **Mục đích khác nhau**
   - Booking_Slots: Lưu "Booking này có những slots nào"
   - Field_Slots: Lưu "Sân này có slots nào available"

2. **Data Schema khác nhau**
   ```
   Booking_Slots:
   ├─ BookingCode (bắt buộc) ← Quay lại booking
   ├─ Status: pending → booked → cancelled
   └─ Không có HoldExpiresAt
   
   Field_Slots:
   ├─ FieldCode (bắt buộc) ← Quay lại sân
   ├─ Status: available → booked → held
   ├─ HoldExpiresAt (giữ chỗ tạm)
   └─ QuantityID (sân cụ thể nào)
   ```

3. **Truy vấn khác nhau**
   ```sql
   -- Booking_Slots: Tìm slots của 1 booking
   SELECT * FROM Booking_Slots WHERE BookingCode = 80;
   
   -- Field_Slots: Check sân còn trống không?
   SELECT * FROM Field_Slots 
   WHERE FieldCode = 68 
   AND PlayDate = '2025-10-21'
   AND Status = 'available';
   ```

4. **Business Logic khác**
   ```
   Booking_Slots:
   - Tạo khi user book
   - Update khi payment success
   - Xoá khi booking cancelled
   
   Field_Slots:
   - Tạo tự động từ pricing
   - Update khi có booking
   - Luôn tồn tại để track availability
   ```

---

## ✅ Giải Pháp Tối Ưu (Hiện Tại - Đúng)

### Cấu Trúc Đúng:

```
1. Bookings
   └─ QuantityID ✅ (Quay lại sân cụ thể)

2. Booking_Slots
   └─ Chi tiết từng khung giờ của booking
   └─ NO QuantityID needed (được lấy từ Booking)

3. Field_Slots
   └─ QuantityID ✅ (Track sân cụ thể nào booked)
   └─ Dùng để check availability
```

### Dữ Liệu Flow:

```
User chọn Sân 1 (QuantityID=22), 08:00-09:00:
    ↓
Tạo Bookings:
  - QuantityID = 22
  - BookingCode = 80
    ↓
Tạo Booking_Slots:
  - BookingCode = 80
  - PlayDate = 2025-10-21
  - StartTime = 08:00
  - EndTime = 09:00
  - Status = pending
  (QuantityID được lấy từ Bookings.QuantityID)
    ↓
Update Field_Slots:
  - SlotID = 1
  - QuantityID = 22
  - Status = booked
  - BookingCode = 80
  (Field_Slots dùng để check: Sân 1 còn trống không?)
```

---

## 🚫 Tại Sao Không Thể Gộp?

### Problem 1: Mục Đích Khác Nhau
```
Booking_Slots:
  Purpose: "Booking 80 có những slots nào?"
  Query: SELECT * FROM Booking_Slots WHERE BookingCode = 80
  
Field_Slots:
  Purpose: "Sân 68 ngày 21/10, 08:00-09:00 còn trống không?"
  Query: SELECT * FROM Field_Slots 
         WHERE FieldCode = 68 AND PlayDate = ... AND Status = 'available'
```

Nếu gộp → Query phức tạp, performance tệ

### Problem 2: Status Khác Nhau
```
Booking_Slots Status: pending → booked → cancelled
Field_Slots Status: available → booked → held

"Held" (giữ chỗ tạm) chỉ có ý nghĩa cho Field_Slots
- Booking_Slots không cần trạng thái "held"
```

### Problem 3: HoldExpiresAt Chỉ Cần Field_Slots
```
Field_Slots.HoldExpiresAt = Thời gian giữ chỗ hết hạn
- Dùng để auto-release held slots

Booking_Slots không cần, vì:
- Booking không bao giờ ở trạng thái "held"
- Booking hoặc "pending" hoặc "booked"
```

---

## 📈 Nếu Bạn Muốn Gộp (Cons vs Pros)

### Cons (Mất lợi):
```
❌ 1. Query phức tạp hơn nhiều
❌ 2. Có nhiều NULL fields
❌ 3. Business logic lộn xộn
❌ 4. Hard to debug
❌ 5. Performance đi xuống
❌ 6. Migration phức tạp
```

### Pros (Lợi):
```
✅ 1 table thay vì 2? (nhưng...lại phức tạp hơn)
```

**Tỷ lệ: 1 lợi vs 6 mất → KHÔNG ĐÁNG GI**

---

## 💡 Giải Pháp Hiện Tại (Đúng Nhất)

**Giữ nguyên 2 bảng, nhưng sử dụng thông minh:**

### 1. Bookings Table
```sql
Bookings
├─ BookingCode (PK)
├─ FieldCode
├─ QuantityID ✅ (Sân cụ thể)
├─ PaymentStatus ✅ (Dùng để check paid)
└─ ...
```

### 2. Booking_Slots Table
```sql
Booking_Slots
├─ Slot_ID (PK)
├─ BookingCode (FK)
├─ PlayDate, StartTime, EndTime
├─ Status (pending/booked/cancelled)
└─ (QuantityID được lấy từ Bookings)
```

### 3. Field_Slots Table
```sql
Field_Slots
├─ SlotID (PK)
├─ FieldCode
├─ QuantityID ✅ (Track từng sân)
├─ PlayDate, StartTime, EndTime
├─ Status (available/booked/held)
├─ BookingCode (reference)
└─ HoldExpiresAt (auto-release)
```

---

## 🎯 Cách Dùng Field_Slots Để Check Availability

```sql
-- Check Sân 68, ngày 21/10, 08:00-09:00 còn trống không?
SELECT 
  QuantityID,
  Status,
  BookingCode
FROM Field_Slots
WHERE FieldCode = 68
  AND PlayDate = '2025-10-21'
  AND StartTime = '08:00:00'
  AND EndTime = '09:00:00'
  AND Status IN ('available', 'held');

-- Result:
-- QuantityID: 22, Status: booked, BookingCode: 80 (Sân 1 - booked)
-- QuantityID: 23, Status: available, BookingCode: NULL (Sân 2 - trống)
-- QuantityID: 24, Status: available, BookingCode: NULL (Sân 3 - trống)
-- QuantityID: 25, Status: available, BookingCode: NULL (Sân 4 - trống)
```

---

## ✅ Kết Luận

### ❌ KHÔNG NÊN GỘP
- Quá phức tạp
- Performance tệ
- Business logic rối

### ✅ NÊN GIỮ NGUYÊN
- 2 bảng riêng biệt
- Mục đích rõ ràng
- Query đơn giản
- Performance tốt

### 🎯 QuantityID Placement
```
✅ Bookings.QuantityID     → Sân nào được đặt
✅ Field_Slots.QuantityID  → Track sân cụ thể cho availability
❌ Booking_Slots.QuantityID → KHÔNG CẦN (lấy từ Bookings)
```

---

**Khuyến nghị:** Giữ nguyên cấu trúc hiện tại, nó đã tối ưu! 🚀

