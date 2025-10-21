# ✅ FIX - Default Bank Account Support

## 🔴 Vấn Đề

Backend không check `IsDefault = 'Y'` khi lấy bank account.

## ✅ Giải Pháp

Thêm logic để:
1. Nếu frontend không gửi `bank_id` → dùng tài khoản default (IsDefault = 'Y')
2. Nếu frontend gửi `bank_id` cụ thể → dùng tài khoản đó
3. Cả hai trường hợp đều phải thuộc shop của user (ShopCode validation)

---

## 📝 Changes Made

### 1. `payout.controller.ts` - Make bank_id optional

**Before**:
```typescript
if (!bank_id) {
  return next(new ApiError(StatusCodes.BAD_REQUEST, "Vui lòng chọn tài khoản ngân hàng"));
}

const result = await payoutService.createPayoutRequest(
  shopCode,
  bank_id,  // Required
  ...
);
```

**After**:
```typescript
// bank_id is optional now
const bankId = bank_id || 0;  // 0 = use default

const result = await payoutService.createPayoutRequest(
  shopCode,
  bankId,   // 0 or specified ID
  ...
);
```

### 2. `payout.service.ts` - Smart bank account selection

**Before**:
```typescript
const [bankRows] = await queryService.query<RowDataPacket[]>(
  `SELECT ... FROM Shop_Bank_Accounts 
   WHERE ShopBankID = ? AND ShopCode = ?`,
  [shopBankID, shopCode]
);
```

**After**:
```typescript
// 2 scenarios:
let bankQuery: string;
let bankParams: any[];

if (shopBankID === 0 || !shopBankID) {
  // 🔍 Get DEFAULT account
  bankQuery = `SELECT ... FROM Shop_Bank_Accounts 
               WHERE ShopCode = ? AND IsDefault = 'Y'`;
  bankParams = [shopCode];
} else {
  // 🔍 Get SPECIFIC account
  bankQuery = `SELECT ... FROM Shop_Bank_Accounts 
               WHERE ShopBankID = ? AND ShopCode = ?`;
  bankParams = [shopBankID, shopCode];
}

const [bankRows] = await queryService.query(bankQuery, bankParams);
```

---

## 🧪 Test Scenarios

### Scenario 1: Use Default Account
```bash
POST /api/shops/me/payout-requests
{
  "amount": 500000,
  "password": "...",
  "note": "..."
  // NO bank_id → will use IsDefault = 'Y'
}
```

**Expected**:
✅ Fetches bank account where IsDefault = 'Y'
✅ Creates payout request
✅ 201 Created

### Scenario 2: Use Specific Account
```bash
POST /api/shops/me/payout-requests
{
  "amount": 500000,
  "bank_id": 5,
  "password": "...",
  "note": "..."
}
```

**Expected**:
✅ Fetches bank account with ShopBankID = 5
✅ Creates payout request
✅ 201 Created

### Scenario 3: No Default, No bank_id
```bash
POST /api/shops/me/payout-requests
{
  "amount": 500000,
  "password": "..."
  // NO bank_id AND NO default account
}
```

**Expected**:
❌ 404 Not Found
❌ Message: "Không tìm thấy tài khoản ngân hàng. Vui lòng chọn hoặc thêm tài khoản."

---

## 💰 Database Query Logic

```
IF bank_id = 0 or NULL:
  SELECT FROM Shop_Bank_Accounts 
  WHERE ShopCode = ? AND IsDefault = 'Y'
  
ELSE (bank_id provided):
  SELECT FROM Shop_Bank_Accounts 
  WHERE ShopBankID = ? AND ShopCode = ?

If not found → Error (validate shop still)
If found → Use that account
```

---

## 🔐 Security

✅ Still validates:
- ShopCode ownership (chỉ user's shop accounts)
- Password verification
- Balance check
- Amount validation

✅ No changes to security, just UX improvement

---

## 📊 Frontend Integration

**Option 1: Auto-use Default**
```typescript
// Don't send bank_id, let backend use default
const response = await fetch('/api/shops/me/payout-requests', {
  method: 'POST',
  body: JSON.stringify({
    amount: 500000,
    password: userPassword,
    note: "Monthly withdrawal"
    // bank_id: optional
  })
});
```

**Option 2: Let User Choose**
```typescript
// 1. Fetch bank accounts
const bankAccounts = await fetch('/api/shops/me/bank-accounts');

// 2. User selects (or use default)
const selectedBankId = userSelection || 0;

// 3. Send request
const response = await fetch('/api/shops/me/payout-requests', {
  method: 'POST',
  body: JSON.stringify({
    amount: 500000,
    bank_id: selectedBankId,
    password: userPassword
  })
});
```

---

## ✅ Status

- ✅ Default bank account support added
- ✅ bank_id is now optional
- ✅ IsDefault = 'Y' check added
- ✅ Backward compatible (if bank_id provided, still works)
- ✅ Security maintained
- ✅ 0 linting errors
- ✅ Server restarted
- ✅ Ready to test

---

## 🚀 Ready!

Now backend supports:
1. ✅ Default bank account (IsDefault = 'Y')
2. ✅ Specific bank account selection
3. ✅ Proper error handling
4. ✅ Shop ownership validation

Test it out! 🎉

