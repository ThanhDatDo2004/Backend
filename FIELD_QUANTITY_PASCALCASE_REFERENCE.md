# Field_Quantity Table - PascalCase Schema Reference

## 📋 Table Schema

```sql
CREATE TABLE Field_Quantity (
  QuantityID INT AUTO_INCREMENT PRIMARY KEY,
  FieldCode INT NOT NULL,
  QuantityNumber INT NOT NULL,
  Status ENUM('available', 'maintenance', 'inactive') DEFAULT 'available',
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (FieldCode) REFERENCES Fields(FieldCode) ON DELETE CASCADE,
  UNIQUE KEY UniqueFieldQuantity (FieldCode, QuantityNumber)
);
```

---

## 📊 Column Definitions

| Column Name | Type | Nullable | Default | Description |
|------------|------|----------|---------|-------------|
| `QuantityID` | INT | NO | AUTO_INCREMENT | Unique identifier for court instance |
| `FieldCode` | INT | NO | - | FK to Fields table |
| `QuantityNumber` | INT | NO | - | Court number (1, 2, 3...) |
| `Status` | ENUM | NO | 'available' | availability status |
| `CreatedAt` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Creation timestamp |
| `UpdatedAt` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Last update timestamp |

---

## 🔑 Constraints

### Primary Key
```
PRIMARY KEY (QuantityID)
```

### Foreign Key
```
FOREIGN KEY (FieldCode) REFERENCES Fields(FieldCode) ON DELETE CASCADE
```
- When a Field is deleted, all its quantities are also deleted

### Unique Constraint
```
UNIQUE KEY UniqueFieldQuantity (FieldCode, QuantityNumber)
```
- Ensures only one entry per field and quantity number
- Example: Can't have 2 entries for Field 30, Quantity 1

---

## 📈 Indexes

```sql
CREATE INDEX IdxFieldCodeStatus ON Field_Quantity(FieldCode, Status);
CREATE INDEX IdxQuantityStatus ON Field_Quantity(QuantityNumber, Status);
```

**Purpose:** 
- Speed up queries filtering by `FieldCode` and `Status`
- Used when getting available courts

---

## 💾 Sample Data

### Tennis Field (2 courts)
```sql
INSERT INTO Field_Quantity (FieldCode, QuantityNumber, Status)
VALUES (30, 1, 'available');  -- Tennis court 1 (QuantityID auto-generated)
INSERT INTO Field_Quantity (FieldCode, QuantityNumber, Status)
VALUES (30, 2, 'available');  -- Tennis court 2
```

Result:
```
QuantityID | FieldCode | QuantityNumber | Status    | CreatedAt | UpdatedAt
-----------|-----------|----------------|-----------|-----------|----------
15         | 30        | 1              | available | 2025-10-20| 2025-10-20
16         | 30        | 2              | available | 2025-10-20| 2025-10-20
```

### Badminton Field (3 courts)
```sql
INSERT INTO Field_Quantity (FieldCode, QuantityNumber, Status)
VALUES 
  (31, 1, 'available'),
  (31, 2, 'available'),
  (31, 3, 'maintenance');  -- Court 3 under maintenance
```

---

## 🔗 Relationship with Bookings

### Updated Bookings Table
```sql
ALTER TABLE Bookings ADD COLUMN QuantityID INT;
ALTER TABLE Bookings ADD FOREIGN KEY (QuantityID) REFERENCES Field_Quantity(QuantityID);
```

### Example Booking
```sql
INSERT INTO Bookings (
  FieldCode,
  QuantityID,      -- NEW: which court
  PlayDate,
  StartTime,
  EndTime,
  BookingStatus
)
VALUES (
  30,
  15,              -- Tennis court 1 (QuantityID)
  '2025-10-20',
  '08:00',
  '09:00',
  'confirmed'
);
```

---

## 🧪 Common Queries

### 1. Get All Courts for a Field
```sql
SELECT QuantityID, QuantityNumber, Status
FROM Field_Quantity
WHERE FieldCode = 30
ORDER BY QuantityNumber;
```

### 2. Get Available Courts
```sql
SELECT QuantityID, QuantityNumber
FROM Field_Quantity
WHERE FieldCode = 30
  AND Status = 'available'
ORDER BY QuantityNumber;
```

### 3. Find Available Courts for Time Slot
```sql
SELECT fq.QuantityID, fq.QuantityNumber, fq.Status
FROM Field_Quantity fq
LEFT JOIN Bookings b ON fq.QuantityID = b.QuantityID
  AND b.PlayDate = '2025-10-20'
  AND b.StartTime < '09:00'
  AND b.EndTime > '08:00'
  AND b.BookingStatus IN ('confirmed', 'pending')
WHERE fq.FieldCode = 30
  AND fq.Status = 'available'
  AND b.BookingCode IS NULL
ORDER BY fq.QuantityNumber;
```

### 4. Count Booked vs Available
```sql
SELECT 
  COUNT(*) as TotalCourts,
  SUM(CASE WHEN Status = 'available' THEN 1 ELSE 0 END) as AvailableCourts,
  SUM(CASE WHEN Status = 'maintenance' THEN 1 ELSE 0 END) as MaintenanceCourts
FROM Field_Quantity
WHERE FieldCode = 30;
```

### 5. Get Booking Details with Court Number
```sql
SELECT 
  b.BookingCode,
  f.FieldName,
  fq.QuantityNumber as CourtNumber,
  b.PlayDate,
  b.StartTime,
  b.EndTime
FROM Bookings b
JOIN Fields f ON b.FieldCode = f.FieldCode
JOIN Field_Quantity fq ON b.QuantityID = fq.QuantityID
WHERE b.FieldCode = 30
  AND b.PlayDate = '2025-10-20'
ORDER BY b.StartTime, fq.QuantityNumber;
```

---

## 🏗️ TypeScript Interface

```typescript
interface FieldQuantityRow {
  quantity_id: number;        // QuantityID in DB
  field_code: number;         // FieldCode in DB
  quantity_number: number;    // QuantityNumber in DB
  status: QuantityStatus;     // 'available' | 'maintenance' | 'inactive'
  created_at: string;         // CreatedAt in DB
  updated_at: string;         // UpdatedAt in DB
}
```

---

## 📝 Data Mapping

**Database → Application:**
```
QuantityID → quantity_id
FieldCode → field_code
QuantityNumber → quantity_number
Status → status
CreatedAt → created_at
UpdatedAt → updated_at
```

---

## 🔄 CRUD Operations

### CREATE
```sql
INSERT INTO Field_Quantity (FieldCode, QuantityNumber, Status)
VALUES (?, ?, 'available');
```

### READ
```sql
SELECT * FROM Field_Quantity WHERE QuantityID = ?;
SELECT * FROM Field_Quantity WHERE FieldCode = ? AND QuantityNumber = ?;
```

### UPDATE
```sql
UPDATE Field_Quantity SET Status = ? WHERE QuantityID = ?;
UPDATE Field_Quantity SET UpdatedAt = NOW() WHERE QuantityID = ?;
```

### DELETE
```sql
DELETE FROM Field_Quantity WHERE QuantityID = ?;
DELETE FROM Field_Quantity WHERE FieldCode = ?;
```

---

## ✅ Naming Convention Summary

**PascalCase (Chosen):**
- ✅ QuantityID
- ✅ FieldCode
- ✅ QuantityNumber
- ✅ Status
- ✅ CreatedAt
- ✅ UpdatedAt

**Consistent with existing tables:**
- Fields: FieldCode, FieldName, DefaultPricePerHour, IsApproved
- Bookings: BookingCode, BookingStatus
- Reviews: ReviewCode, Rating

---

## 🎯 Summary

| Item | Value |
|------|-------|
| Table Name | `Field_Quantity` |
| Primary Key | `QuantityID` (AUTO_INCREMENT) |
| Foreign Key | `FieldCode` → `Fields(FieldCode)` |
| Unique Constraint | `(FieldCode, QuantityNumber)` |
| Status Values | 'available', 'maintenance', 'inactive' |
| Cascading Delete | YES (ON DELETE CASCADE) |

