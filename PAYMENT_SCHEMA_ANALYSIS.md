# 🔍 PAYMENT SCHEMA ANALYSIS - DB Structure

**Based on**: SQL.md database schema  
**Analysis**: Payment system tables & relationships

---

## 📊 Key Tables for Payment

### 1. **Bookings** (line 177-206)
```sql
BookingCode: int (PRIMARY KEY, AUTO_INCREMENT)
FieldCode: int (FK → Fields)
CustomerUserID: int (FK → Users)
TotalPrice: decimal
PlatformFee: decimal
NetToShop: decimal
BookingStatus: enum('pending','confirmed','cancelled','completed')
PaymentID: int (FK → Payments_Admin) ← UNIQUE, NOT NULL
PaymentStatus: enum('pending','paid','failed','refunded')
CheckinCode: varchar(32) (UNIQUE)
CreateAt: datetime
UpdateAt: datetime
```

✅ **BookingCode = INT (not string!)**

### 2. **Payments_Admin** (line 208-227)
```sql
PaymentID: int (PRIMARY KEY, AUTO_INCREMENT)
BookingCode: int (FK → Bookings) ← NOT NULL
AdminBankID: int (FK → Admin_Bank_Accounts)
PaymentMethod: enum
Amount: decimal
MomoTransactionID: varchar(64) (UNIQUE)
MomoRequestID: varchar(64)
PaidAt: datetime
PaymentStatus: enum('pending','paid','failed','refunded')
CreateAt: datetime
UpdateAt: datetime
```

✅ **BookingCode relationship is 1:1 (UNIQUE in Bookings table)**

### 3. **Field_Slots** (line 158-175)
```sql
SlotID: int
FieldCode: int
PlayDate: date
StartTime: time
EndTime: time
BookingCode: int (FK → Bookings) ← UNIQUE, optional
```

✅ **Can query slots by BookingCode**

### 4. **Wallet_Transactions** (line 98-115)
```sql
BookingCode: int (FK → Bookings) ← optional
Type: enum('credit_settlement', 'debit_payout', 'adjustment')
Amount: decimal
```

✅ **Used for crediting shop wallet**

---

## ⚠️ ISSUE FOUND!

### ❌ Problem: BookingCode Format Mismatch

**In SQL schema**: `BookingCode INT AUTO_INCREMENT`
- BookingCode = `1`, `2`, `3`, etc. (numbers)

**In code**: Using as `"BK-ABC123"` (string format)
- This causes:
  1. If DB has numeric BookingCode (1, 2, 3), you need to use them directly
  2. Or use a formatted "BK-{number}" pattern consistently

### 📋 Current Observations

```sql
-- From Bookings table
BookingCode: int AUTO_INCREMENT  -- ✅ This is numeric (1, 2, 3...)

-- Expected values:
BookingCode = 1
BookingCode = 2
BookingCode = 3

-- NOT:
BookingCode = "BK-ABC123"  -- ❌ This is wrong!
```

---

## ✅ SOLUTION

### Option 1: Use Numeric BookingCode (Recommended)
```bash
# Query with number
curl -X GET http://localhost:5050/api/bookings/1
curl -X GET http://localhost:5050/api/bookings/2

# Payment endpoints
curl -X POST http://localhost:5050/api/payments/bookings/1/initiate
curl -X GET http://localhost:5050/api/payments/bookings/1/status
```

### Option 2: Use String Format Consistently
If you want "BK-123" format:
- Needs to be VARCHAR in database
- Currently it's INT

---

## 🔧 Fix Required

### Backend Code Fix
```typescript
// Current (can work with both):
[bookingCode]  // Works if DB format matches

// But SQL schema expects INT, so:
// Use: Number(bookingCode) OR ensure bookingCode is numeric string
```

### Database Query
```sql
-- Works with:
WHERE BookingCode = 1      -- Numeric
WHERE BookingCode = '1'    -- String (MySQL auto-converts)

-- Doesn't work:
WHERE BookingCode = NaN    -- ❌ Error!
```

---

## 🧪 Test with Real BookingCode

```bash
# 1. Check actual BookingCode in DB
SELECT BookingCode, TotalPrice FROM Bookings LIMIT 1;

# Output: BookingCode = 1 (or 2, 3, etc.)

# 2. Use that BookingCode
curl -X GET http://localhost:5050/api/bookings/1

# 3. Create payment with that code
curl -X POST http://localhost:5050/api/payments/bookings/1/initiate \
  -H "Authorization: Bearer <token>"

# 4. Check status
curl -X GET http://localhost:5050/api/payments/bookings/1/status
```

---

## 📊 Relationships

```
Users (1)
  ├→ Bookings (M) [CustomerUserID]
  │   ├→ Fields (1) [FieldCode]
  │   ├→ Payments_Admin (1) [PaymentID]
  │   ├→ Field_Slots (M) [BookingCode]
  │   └→ Wallet_Transactions (M) [BookingCode]
  │
  └→ Shops (1) [UserID - via Users_Level]
      ├→ Admin_Bank_Accounts [AdminBankID]
      ├→ Shop_Wallets [ShopCode]
      └→ Wallet_Transactions [ShopCode]
```

---

## ✅ Wallet Transaction Flow

When payment succeeds:
```sql
-- 1. Create wallet transaction
INSERT INTO Wallet_Transactions (
  ShopCode, BookingCode, Type, Amount, Status
) VALUES (
  30, 1, 'credit_settlement', 142500, 'completed'
);

-- 2. Update shop wallet
UPDATE Shop_Wallets 
SET Balance = Balance + 142500 
WHERE ShopCode = 30;

-- 3. Create notification
INSERT INTO Notifications (UserID, Type, Title, Content)
VALUES (1, 'booking', 'Payment Confirmed', '...');
```

---

## 🎯 Key Takeaway

| Item | Value | Type |
|------|-------|------|
| BookingCode | 1, 2, 3, ... | INT |
| PaymentID | 1, 2, 3, ... | INT |
| FieldCode | 1, 2, 3, ... | INT |
| ShopCode | 1, 2, 3, ... | INT |
| Amount | 150000.00 | DECIMAL |
| Status | pending/paid/failed | ENUM |

✅ **All numeric IDs in DB are INT**

---

## 📝 Next Actions

1. ✅ Check actual BookingCode in DB
2. ✅ Use numeric BookingCode in API calls
3. ✅ Verify payment creation works
4. ✅ Test full flow

