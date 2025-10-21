-- ============================================================================
-- ADD QuantityID COLUMN TO Booking_Slots TABLE
-- ============================================================================

-- Step 1: Add QuantityID column to Booking_Slots
ALTER TABLE Booking_Slots 
ADD COLUMN QuantityID INT DEFAULT NULL 
AFTER FieldCode;

-- Step 2: Add Foreign Key constraint
ALTER TABLE Booking_Slots 
ADD CONSTRAINT FK_BookingSlots_QuantityID 
FOREIGN KEY (QuantityID) REFERENCES Field_Quantity(QuantityID) 
ON DELETE SET NULL;

-- Step 3: Add Index for performance
ALTER TABLE Booking_Slots 
ADD INDEX IDX_BookingSlots_QuantityID (QuantityID);

-- Step 4: Update UNIQUE KEY to include QuantityID (optional - for better uniqueness)
-- First drop the old unique key
ALTER TABLE Booking_Slots 
DROP KEY unique_slot;

-- Add new unique key with QuantityID
ALTER TABLE Booking_Slots 
ADD UNIQUE KEY unique_slot_with_quantity (BookingCode, PlayDate, StartTime, QuantityID);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check column was added successfully
DESCRIBE Booking_Slots;

-- Verify Foreign Key constraint
SELECT CONSTRAINT_NAME, TABLE_NAME, REFERENCED_TABLE_NAME
FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
WHERE TABLE_NAME = 'Booking_Slots';

-- Sample query: Show all booking slots with quantity info
SELECT 
    bs.Slot_ID,
    bs.BookingCode,
    bs.FieldCode,
    bs.QuantityID,
    fq.QuantityNumber,
    bs.PlayDate,
    bs.StartTime,
    bs.EndTime,
    bs.Status
FROM Booking_Slots bs
LEFT JOIN Field_Quantity fq ON bs.QuantityID = fq.QuantityID
ORDER BY bs.BookingCode, bs.PlayDate, bs.StartTime;

