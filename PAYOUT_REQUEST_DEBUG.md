# 🧪 Payout Request - Debug Guide

## 🔴 Lỗi Hiện Tại

```
"Không tìm thấy tài khoản ngân hàng"
```

## 🔍 Nguyên Nhân Có Thể

1. **bank_id sai** - Không tồn tại trong database
2. **bank_id không thuộc shop của user** - Tài khoản ngân hàng của shop khác
3. **Shop không có tài khoản ngân hàng** - Chưa setup bank account

## 🧪 Debug Steps

### Step 1: Check Backend Logs
```bash
tail -f /tmp/backend.log
```

Look for error message:
```
[Payout] Bank account not found - bank_id: 5, shopCode: 15
```

This will show:
- **bank_id**: Value bạn gửi
- **shopCode**: Shop của user

### Step 2: Verify Data in Request

**Correct Format**:
```json
{
  "amount": 500000,
  "bank_id": 5,
  "note": "Test payout",
  "password": "correctPassword"
}
```

**Check**:
- ✅ `bank_id` là số (number)
- ✅ `bank_id` không phải string ("5" ❌ vs 5 ✅)
- ✅ `amount` > 0
- ✅ `password` không empty

### Step 3: Verify Bank Account Exists

Frontend needs to call GET endpoint first:

```bash
GET /api/shops/me/bank-accounts
Authorization: Bearer {token}
```

Response should show available bank accounts:
```json
{
  "success": true,
  "data": [
    {
      "ShopBankID": 5,
      "BankName": "Vietcombank",
      "AccountNumber": "1234567890",
      ...
    }
  ]
}
```

**Then use `ShopBankID` value** from response as `bank_id` in payout request.

### Step 4: Check Database Query

If needed, check database:
```sql
-- Check shop's bank accounts
SELECT ShopBankID, BankName, AccountNumber, ShopCode
FROM Shop_Bank_Accounts
WHERE ShopCode = 15;  -- Replace with actual shopCode

-- Should return rows with the bank_id you're using
```

---

## ✅ Correct Flow

```
1. User logs in
   ↓
2. Frontend: GET /shops/me/bank-accounts
   ↓
   Response: [{ShopBankID: 5, ...}, {ShopBankID: 6, ...}]
   ↓
3. User selects bank account (chooses 5)
   ↓
4. User clicks "Rút Tiền"
   ↓
5. Frontend: POST /shops/me/payout-requests
   Body: {
     amount: 500000,
     bank_id: 5,      ← Use ShopBankID from bank list
     password: "...",
     note: "..."
   }
   ↓
6. Backend verifies:
   ✅ Password correct
   ✅ Bank account exists & belongs to shop
   ✅ Balance sufficient
   ✓ Creates payout request
   ↓
7. Response: 201 Created {payoutID: ...}
```

---

## 🛠️ Common Fixes

### Issue: bank_id is string "5" instead of number 5
```typescript
// ❌ WRONG
bank_id: "5"

// ✅ CORRECT
bank_id: 5  // Parse from input
```

**Fix in frontend**:
```typescript
const bankId = parseInt(selectedBankId);  // Convert to number
```

### Issue: bank_id doesn't exist
```
Solution: Ensure user selected from the list returned by GET /bank-accounts
```

### Issue: bank_id exists but belongs to different shop
```
Solution: Backend validates (ShopBankID = ? AND ShopCode = ?)
Only user's shop accounts allowed
```

---

## 📊 Current Implementation

**What we validate**:
1. ✅ User has password hash
2. ✅ Password matches (using authService.verifyPassword)
3. ✅ Bank account exists
4. ✅ Bank account belongs to user's shop
5. ✅ Wallet has sufficient balance
6. ✅ Amount > 0

**If any validation fails** → Error thrown

---

## 🔍 Check Server Logs

After test, check logs:
```bash
tail -50 /tmp/backend.log | grep -A5 "Payout\|Bank account"
```

You'll see debug messages like:
```
[Payout] Bank account not found - bank_id: 5, shopCode: 15
```

This helps identify what's wrong.

---

## ✅ Ready to Test

1. Verify bank_id is correct (number, not string)
2. Verify bank account exists in Shop_Bank_Accounts table
3. Verify bank account belongs to the same shop
4. Make POST request with correct bank_id
5. Check logs if error occurs

**Let me know the error details and I can help further!**

