# ✅ FIX Bcrypt Error - POST /api/shops/me/payout-requests 500

## 🔴 Vấn Đề

```
POST /api/shops/me/payout-requests → 500 Error
Error: "data and hash arguments required"
```

## 🔍 Nguyên Nhân

Bcrypt `compare()` function yêu cầu:
- `data` (plain text password): không được null/undefined
- `hash` (hashed password từ DB): không được null/undefined

**Lỗi xảy ra khi**: `user.Password` từ database là `NULL` hoặc `undefined`

```typescript
// ❌ WRONG
const isPasswordValid = await bcrypt.compare(password, user.Password);
// Nếu user.Password = null → Error: "data and hash arguments required"
```

---

## ✅ Giải Pháp

Thêm null check trước khi gọi bcrypt.compare():

```typescript
// ✅ CORRECT
if (!user.Password) {
  throw new ApiError(StatusCodes.UNAUTHORIZED, "Người dùng không có mật khẩu được cấu hình");
}

const isPasswordValid = await bcrypt.compare(password, user.Password);
```

---

## 📝 Changes Made

**File**: `backend/src/services/payout.service.ts`

**Before**:
```typescript
const user = userRows[0];
const isPasswordValid = await bcrypt.compare(password, user.Password);
```

**After**:
```typescript
const user = userRows[0];

// Check if password exists in database
if (!user.Password) {
  throw new ApiError(StatusCodes.UNAUTHORIZED, "Người dùng không có mật khẩu được cấu hình");
}

const isPasswordValid = await bcrypt.compare(password, user.Password);
```

---

## 🧪 Test

### Scenario 1: User has password (Normal case)
```bash
curl -X POST http://localhost:5050/api/shops/me/payout-requests \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500000,
    "bank_id": 5,
    "password": "correctPassword"
  }'

Expected: 201 Created ✅
OR 401 if password wrong ✅
```

### Scenario 2: User has NO password (Edge case - now handled)
```
Expected: 401 Unauthorized 
Message: "Người dùng không có mật khẩu được cấu hình"
```

---

## ✅ Status

- ✅ Null check added
- ✅ Proper error handling
- ✅ 0 linting errors
- ✅ Server restarted
- ✅ Ready to test

---

## 💡 Root Cause Analysis

This can happen if:
1. User account was created without password
2. Password field is NULL in Users table
3. User profile is incomplete

**Solution**: Always ensure users have passwords before creating payout requests, OR handle the edge case gracefully (which we now do).

