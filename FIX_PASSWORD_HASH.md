# ✅ FIX Password Hash - Using Correct Column & Service

## 🔴 Vấn Đề

```
POST /api/shops/me/payout-requests → 500 Error
Cannot compare password hash (PasswordHash từ database)
```

## 🔍 Root Cause

1. Database column là `PasswordHash` (không phải `Password`)
2. Phải dùng `authService.verifyPassword()` (không phải bcrypt.compare() trực tiếp)

## ✅ Giải Pháp

Sử dụng cùng cách như login:

```typescript
import authService from "./auth";

// Query PasswordHash column (correct name)
const [userRows] = await queryService.query<RowDataPacket[]>(
  `SELECT PasswordHash FROM Users WHERE UserID = ?`,
  [userId]
);

const user = userRows[0];

// Use authService.verifyPassword() (same as login)
const isPasswordValid = await authService.verifyPassword(
  password, 
  user.PasswordHash
);

if (!isPasswordValid) {
  throw new ApiError(StatusCodes.UNAUTHORIZED, "Mật khẩu không chính xác");
}
```

---

## 📝 Changes Made

**File**: `backend/src/services/payout.service.ts`

### 1. Import Change
```typescript
// ❌ BEFORE
import bcrypt from "bcrypt";

// ✅ AFTER
import authService from "./auth";
```

### 2. Query Column Name
```typescript
// ❌ BEFORE
`SELECT Password FROM Users WHERE UserID = ?`

// ✅ AFTER
`SELECT PasswordHash FROM Users WHERE UserID = ?`
```

### 3. Password Verification
```typescript
// ❌ BEFORE
const isPasswordValid = await bcrypt.compare(password, user.Password);

// ✅ AFTER
const isPasswordValid = await authService.verifyPassword(password, user.PasswordHash);
```

---

## 🔐 How authService.verifyPassword() Works

```typescript
// From auth.ts
async verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const result = await bcrypt.compare(password, hash);
    return result;
  } catch (error) {
    throw error;
  }
}
```

**Same method used in login flow!** ✅

---

## 🧪 Test

```bash
POST /api/shops/me/payout-requests
{
  "amount": 500000,
  "bank_id": 5,
  "note": "Test payout",
  "password": "correctPassword"
}
```

**Expected Results**:

✅ **Correct password**: 201 Created {payoutID: ...}
❌ **Wrong password**: 401 Unauthorized {message: "Mật khẩu không chính xác"}
❌ **Insufficient balance**: 400 Bad Request {message: "Số dư không đủ"}

---

## 📊 Comparison with Login

| | Login | Payout Request |
|---|---|---|
| Query | `SELECT PasswordHash FROM Users` | `SELECT PasswordHash FROM Users` |
| Method | `authService.verifyPassword()` | `authService.verifyPassword()` |
| Compare | `bcrypt.compare(password, hash)` | `bcrypt.compare(password, hash)` |
| Same? | ✅ YES | ✅ YES |

**Same authentication method = Consistent security!**

---

## ✅ Status

- ✅ Correct column name (PasswordHash)
- ✅ Correct service method (authService.verifyPassword)
- ✅ Same as login implementation
- ✅ 0 linting errors
- ✅ Server restarted
- ✅ Ready to test

---

## 🚀 Ready!

Backend now correctly verifies password hash using the same method as login!

