-- ============================================================================
-- MIGRATION: Create Field_Quantity Table for Multi-Court Management
-- Date: 2025-10-20
-- Purpose: Support multiple physical courts per field type
-- ============================================================================

-- Step 1: Create Field_Quantity table
CREATE TABLE IF NOT EXISTS Field_Quantity (
  QuantityID INT AUTO_INCREMENT PRIMARY KEY,
  FieldCode INT NOT NULL,
  QuantityNumber INT NOT NULL COMMENT 'Court number: 1, 2, 3...',
  Status ENUM('available', 'maintenance', 'inactive') DEFAULT 'available',
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (FieldCode) REFERENCES Fields(FieldCode) ON DELETE CASCADE,
  UNIQUE KEY UniqueFieldQuantity (FieldCode, QuantityNumber),
  INDEX IdxFieldCodeStatus (FieldCode, Status),
  INDEX IdxQuantityNumber (QuantityNumber),
  
  COMMENT='Represents individual physical courts for each field type'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 2: Add QuantityID to Bookings table
ALTER TABLE Bookings ADD COLUMN QuantityID INT AFTER FieldCode;
ALTER TABLE Bookings ADD FOREIGN KEY (QuantityID) REFERENCES Field_Quantity(QuantityID);
ALTER TABLE Bookings ADD INDEX IdxQuantityID (QuantityID);

-- Step 3: Add QuantityCount to Fields table (optional, for caching)
ALTER TABLE Fields ADD COLUMN QuantityCount INT DEFAULT 1 AFTER DefaultPricePerHour;

