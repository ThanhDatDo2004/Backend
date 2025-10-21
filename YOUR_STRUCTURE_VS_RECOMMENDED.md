# Field_Quantity Structure - Your Current vs Recommended

## 🔍 So Sánh

### ✅ Your Current Structure
```sql
CREATE TABLE Field_Quantity (
  QuantityID INT AUTO_INCREMENT PRIMARY KEY,
  FieldCode INT NOT NULL,
  QuantityNumber INT NOT NULL,
  Status ENUM('available', 'maintenance', 'inactive') DEFAULT 'available',
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (FieldCode) REFERENCES Fields(FieldCode),
  UNIQUE KEY UniqueFieldQuantity (FieldCode, QuantityNumber)
);

ALTER TABLE Bookings ADD COLUMN QuantityID INT;
ALTER TABLE Bookings ADD FOREIGN KEY (QuantityID) REFERENCES Field_Quantity(QuantityID);
```

**Status:** ✅ Good! Functional and clean


---

## ✨ Recommended Improvements

### Add UpdatedAt Column
```sql
CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
```

**Why?**
- Track when court was last modified
- Useful for maintenance history
- Standard practice in database design
- Helps with auditing


### Add ON DELETE CASCADE to FieldCode FK
```sql
FOREIGN KEY (FieldCode) REFERENCES Fields(FieldCode) ON DELETE CASCADE,
```

**Why?**
- If a field is deleted, automatically delete all its quantities
- Prevents orphaned records
- Maintains referential integrity
- Simplifies deletion logic


---

## 📝 Complete Recommended Schema

```sql
CREATE TABLE Field_Quantity (
  QuantityID INT AUTO_INCREMENT PRIMARY KEY,
  FieldCode INT NOT NULL,
  QuantityNumber INT NOT NULL,
  Status ENUM('available', 'maintenance', 'inactive') DEFAULT 'available',
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (FieldCode) REFERENCES Fields(FieldCode) ON DELETE CASCADE,
  UNIQUE KEY UniqueFieldQuantity (FieldCode, QuantityNumber),
  INDEX IdxFieldCodeStatus (FieldCode, Status)
);

ALTER TABLE Bookings ADD COLUMN QuantityID INT;
ALTER TABLE Bookings ADD FOREIGN KEY (QuantityID) REFERENCES Field_Quantity(QuantityID);
ALTER TABLE Bookings ADD INDEX IdxQuantityID (QuantityID);
```

---

## 📊 Comparison Table

| Feature | Your Current | Recommended | Why? |
|---------|------------|-------------|------|
| UpdatedAt | ❌ No | ✅ Yes | Track modifications |
| ON DELETE CASCADE | ❌ No | ✅ Yes | Auto cleanup |
| Index on (FieldCode, Status) | ❌ No | ✅ Yes | Query performance |
| Index on QuantityID in Bookings | ❌ No | ✅ Yes | Booking queries |

---

## 🎯 Changes to Make

### Option 1: Start Fresh (Cleanest)
If table doesn't exist yet:
```sql
CREATE TABLE Field_Quantity (
  QuantityID INT AUTO_INCREMENT PRIMARY KEY,
  FieldCode INT NOT NULL,
  QuantityNumber INT NOT NULL,
  Status ENUM('available', 'maintenance', 'inactive') DEFAULT 'available',
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (FieldCode) REFERENCES Fields(FieldCode) ON DELETE CASCADE,
  UNIQUE KEY UniqueFieldQuantity (FieldCode, QuantityNumber),
  INDEX IdxFieldCodeStatus (FieldCode, Status)
);

ALTER TABLE Bookings ADD COLUMN QuantityID INT;
ALTER TABLE Bookings ADD FOREIGN KEY (QuantityID) REFERENCES Field_Quantity(QuantityID);
ALTER TABLE Bookings ADD INDEX IdxQuantityID (QuantityID);
```

### Option 2: Modify Existing Table
If table already created:
```sql
-- Add UpdatedAt column
ALTER TABLE Field_Quantity ADD COLUMN UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Update FK (need to drop and recreate)
ALTER TABLE Field_Quantity DROP FOREIGN KEY field_quantity_ibfk_1;
ALTER TABLE Field_Quantity ADD FOREIGN KEY (FieldCode) REFERENCES Fields(FieldCode) ON DELETE CASCADE;

-- Add indexes
CREATE INDEX IdxFieldCodeStatus ON Field_Quantity(FieldCode, Status);
```

---

## ✅ Your Current Structure is Functional

Your structure will work perfectly fine for basic operations:

### ✅ What Works
- Creating Field_Quantity entries
- Tracking court quantities
- Booking specific courts
- Basic queries

### ⚡ What Could Be Improved
- No update timestamp tracking
- Orphaned records if field deleted
- No query indexes (slower queries)

---

## 🚀 Final Recommendation

**Go with Recommended Version** because:
1. ✅ Better data integrity (ON DELETE CASCADE)
2. ✅ Track modification history (UpdatedAt)
3. ✅ Better performance (Indexes)
4. ✅ Follows database best practices
5. ✅ Minimal extra overhead

**Your Version is Already Good**, but Recommended adds production-ready features.

---

## 📈 Performance Impact

### Query: "Find available courts for Tennis at 08:00-09:00"

**Without Index:**
- Table scan: O(n) - Check every row
- Time: ~10-50ms (slow for large data)

**With Index on (FieldCode, Status):**
- Index lookup: O(log n) - Binary search
- Time: ~0.1-1ms (100x faster)

---

## 🎯 Decision

| If... | Choose |
|------|--------|
| Just testing/learning | Your current structure ✅ |
| Production environment | Recommended version ✅ |
| Performance matters | Recommended version ✅ |
| Want audit trail | Recommended version ✅ |
| Simple use case | Either works ✅ |

