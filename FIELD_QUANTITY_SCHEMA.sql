-- ============================================================================
-- Field_Quantity Table Schema - PascalCase Convention
-- ============================================================================
-- Purpose: Store quantity/instance count for each field
-- Example: Field "Tennis" has 2 courts, Field "Badminton" has 3 courts
-- ============================================================================

CREATE TABLE Field_Quantity (
  QuantityID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique identifier for each court instance',
  FieldCode INT NOT NULL COMMENT 'FK to Fields table - identifies field type (Tennis, Badminton, etc)',
  QuantityNumber INT NOT NULL COMMENT 'Court number (1, 2, 3...) within this field',
  Status ENUM('available', 'maintenance', 'inactive') DEFAULT 'available' COMMENT 'Status of this court',
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When this court instance was created',
  UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',
  
  -- Constraints
  FOREIGN KEY (FieldCode) REFERENCES Fields(FieldCode) ON DELETE CASCADE,
  UNIQUE KEY UniqueFieldQuantity (FieldCode, QuantityNumber) COMMENT 'One entry per (Field, QuantityNumber)'
);

-- ============================================================================
-- Index for Query Performance
-- ============================================================================
CREATE INDEX IdxFieldCodeStatus ON Field_Quantity(FieldCode, Status);
CREATE INDEX IdxQuantityStatus ON Field_Quantity(QuantityNumber, Status);

-- ============================================================================
-- Modify Bookings Table to Support Quantity Tracking
-- ============================================================================
ALTER TABLE Bookings ADD COLUMN QuantityID INT COMMENT 'FK to Field_Quantity - which court was booked';
ALTER TABLE Bookings ADD FOREIGN KEY (QuantityID) REFERENCES Field_Quantity(QuantityID) ON DELETE SET NULL;
ALTER TABLE Bookings ADD INDEX IdxQuantityID (QuantityID);

-- ============================================================================
-- Sample Data
-- ============================================================================
-- Assuming Fields table has:
-- FieldCode=30, FieldName='Tennis', ShopCode=1
-- FieldCode=31, FieldName='Badminton', ShopCode=1

-- Insert Tennis courts (Quantity = 2)
INSERT INTO Field_Quantity (FieldCode, QuantityNumber, Status)
VALUES 
  (30, 1, 'available'),   -- Tennis court 1
  (30, 2, 'available');   -- Tennis court 2

-- Insert Badminton courts (Quantity = 3)
INSERT INTO Field_Quantity (FieldCode, QuantityNumber, Status)
VALUES 
  (31, 1, 'available'),   -- Badminton court 1
  (31, 2, 'available'),   -- Badminton court 2
  (31, 3, 'available');   -- Badminton court 3

-- ============================================================================
-- Useful Queries
-- ============================================================================

-- 1. Get all quantities for a field
-- SELECT * FROM Field_Quantity WHERE FieldCode = 30;

-- 2. Get available quantities for a field
-- SELECT * FROM Field_Quantity WHERE FieldCode = 30 AND Status = 'available';

-- 3. Find available courts for a specific time slot
/*
SELECT fq.QuantityID, fq.QuantityNumber
FROM Field_Quantity fq
LEFT JOIN Bookings b ON fq.QuantityID = b.QuantityID
  AND b.PlayDate = '2025-10-20'
  AND b.StartTime < '09:00'
  AND b.EndTime > '08:00'
  AND b.BookingStatus IN ('confirmed', 'pending')
WHERE fq.FieldCode = 30
  AND fq.Status = 'available'
  AND b.BookingCode IS NULL;
*/

-- 4. Count total vs booked courts
/*
SELECT 
  fq.FieldCode,
  COUNT(fq.QuantityID) as TotalCourts,
  SUM(CASE WHEN b.BookingCode IS NOT NULL THEN 1 ELSE 0 END) as BookedCourts
FROM Field_Quantity fq
LEFT JOIN Bookings b ON fq.QuantityID = b.QuantityID
  AND b.PlayDate = '2025-10-20'
  AND b.StartTime < '09:00'
  AND b.EndTime > '08:00'
WHERE fq.FieldCode = 30
GROUP BY fq.FieldCode;
*/

