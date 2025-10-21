# 🎯 Shop Revenue Backend API - Complete Implementation

## 📌 Summary

Tôi đã implement backend support cho Shop Revenue Page. Tất cả endpoint đã sẵn sàng để frontend call.

---

## 🔌 Các Endpoint Đã Implement

### 1️⃣ GET /api/shops/me/bookings ✅

**Lấy danh sách bookings để tính revenue**

```
GET /api/shops/me/bookings?status=confirmed&limit=100
```

**Require**: 
- Header: `Authorization: Bearer {token}`

**Response**:
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "BookingCode": "BK-123",
        "FieldCode": 48,
        "FieldName": "Sân A",
        "CustomerName": "Nguyễn A",
        "TotalPrice": 100000,
        "BookingStatus": "confirmed",
        "PaymentStatus": "paid",
        "CreateAt": "2025-10-20T10:00:00Z"
      }
    ],
    "pagination": {
      "limit": 100,
      "offset": 0,
      "total": 5
    }
  }
}
```

**Frontend Usage**:
```typescript
// Filter: confirmed + paid only
const bookedAmount = bookings
  .filter(b => b.BookingStatus === 'confirmed' && b.PaymentStatus === 'paid')
  .reduce((sum, b) => sum + b.TotalPrice, 0);

const actualRevenue = bookedAmount * 0.95; // 95%
```

---

### 2️⃣ GET /api/shops/me/wallet ✅

**Lấy thông tin ví (balance, available)**

```
GET /api/shops/me/wallet
```

**Response**:
```json
{
  "success": true,
  "data": {
    "balance": 4750000,
    "available": 4750000,
    "totalCredit": 5000000,
    "totalDebit": 250000
  }
}
```

**Balance Calculation**:
- `balance`: Tiền hiện có = Tổng credit - Tổng debit
- `available`: Tiền có thể rút = balance
- `totalCredit`: Tổng tiền vào từ bookings (95%)
- `totalDebit`: Tổng tiền rút đi

---

### 3️⃣ POST /api/shops/me/payout-requests ✅

**Tạo yêu cầu rút tiền**

```
POST /api/shops/me/payout-requests
Content-Type: application/json
Authorization: Bearer {token}
```

**Request Body**:
```json
{
  "amount": 1000000,
  "bank_id": 5,
  "note": "Rút tiền định kỳ",
  "password": "myPassword123"
}
```

**Parameters**:
- `amount`: Số tiền muốn rút (>0 và ≤ available balance)
- `bank_id`: ID tài khoản ngân hàng (từ Shop_Bank_Accounts.ShopBankID)
- `note`: Ghi chú (optional)
- `password`: ⭐ Mật khẩu của shop owner (required)

**Response**:
```json
{
  "success": true,
  "data": {
    "payoutID": 42,
    "shopCode": 15,
    "amount": 1000000,
    "status": "requested",
    "requestedAt": "2025-10-20T15:30:00Z"
  },
  "message": "Tạo yêu cầu rút tiền thành công"
}
```

**Errors**:
```json
// Mật khẩu sai
{
  "success": false,
  "statusCode": 401,
  "error": {
    "message": "Mật khẩu không chính xác"
  }
}

// Số dư không đủ
{
  "success": false,
  "statusCode": 400,
  "error": {
    "message": "Số dư không đủ"
  }
}
```

**Quy Trình Backend**:
1. ✅ Xác nhận password (so sánh bcrypt hash)
2. ✅ Kiểm tra số dư
3. ✅ Tạo Payout_Requests record (status: 'requested')
4. ✅ ⭐ **IMMEDIATELY DEDUCT từ Shop_Wallets** (Trừ ngay)
5. ✅ Tạo Wallet_Transactions record (type: 'debit_payout', status: 'pending')
6. ✅ Gửi email tới "kubjmisu1999@gmail.com" với thông tin:
   - Shop name
   - Payout ID
   - Số tiền
   - Ngân hàng & số tài khoản
   - Thời gian request
7. ✅ Return payoutID cho frontend

---

### 4️⃣ GET /api/shops/me/payout-requests ✅

**Lấy danh sách payout requests**

```
GET /api/shops/me/payout-requests?status=requested&limit=10
```

**Query Params**:
- `status`: 'requested', 'paid', 'rejected' (optional)
- `limit`: số item (default: 10)
- `offset`: vị trí bắt đầu (default: 0)

**Response**:
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "PayoutID": 42,
        "ShopCode": 15,
        "Amount": 1000000,
        "Status": "requested",
        "BankName": "Vietcombank",
        "AccountNumber": "1234567890",
        "AccountHolder": "Nguyễn Văn A",
        "Note": "Rút tiền định kỳ",
        "RequestedAt": "2025-10-20T15:30:00Z",
        "ProcessedAt": null
      }
    ],
    "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 3
    }
  }
}
```

---

### 5️⃣ GET /api/shops/me/bank-accounts ✅

**Lấy danh sách tài khoản ngân hàng**

```
GET /api/shops/me/bank-accounts
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "ShopBankID": 5,
      "ShopCode": 15,
      "BankName": "Vietcombank",
      "AccountNumber": "1234567890",
      "AccountHolder": "Nguyễn Văn A",
      "BranchName": "Hà Nội",
      "CreateAt": "2025-10-15T10:00:00Z"
    }
  ]
}
```

---

## 📊 Data Flow

```
FRONTEND CALL:
1. GET /api/shops/me/bookings
   ↓
   Show list of confirmed+paid bookings
   Calculate: Total = sum of TotalPrice
   Calculate: Actual Revenue = Total * 0.95

2. GET /api/shops/me/wallet
   ↓
   Show available balance for withdrawal

3. GET /api/shops/me/bank-accounts
   ↓
   Show available bank accounts to withdraw to

4. User enters amount & password

5. POST /api/shops/me/payout-requests
   ↓ BACKEND IMMEDIATELY:
   ✓ Verify password
   ✓ Check balance
   ✓ CREATE payout request
   ✓ DEDUCT from wallet (ngay)
   ✓ INSERT wallet transaction
   ✓ SEND EMAIL to admin
   ↓
   FRONTEND:
   ✓ Show success message
   ✓ Refresh wallet balance
   ✓ Refresh payout requests list
```

---

## 🔐 Security Measures

✅ **Password Verification**
- Bcrypt hash verification
- Returns 401 if password wrong
- No password stored in logs

✅ **Authorization**
- Requires Auth token
- Shop validation on all endpoints
- Users can only see their own data

✅ **Balance Check**
- Verifies sufficient balance before creating payout
- Protects against negative wallet

✅ **Bank Account Verification**
- Confirms bank account belongs to shop
- Prevents unauthorized transfers

---

## 📧 Email Format

**To**: kubjmisu1999@gmail.com

**Subject**: `[Yêu Cầu Rút Tiền] {ShopName} - {Amount}đ`

**Body**:
```html
<h2>🔔 Yêu Cầu Rút Tiền Mới</h2>
<p><strong>Shop:</strong> Sân Bóng A</p>
<p><strong>Mã Yêu Cầu:</strong> PAYOUT-42</p>
<p><strong>Số Tiền:</strong> 1,000,000đ</p>
<p><strong>Ngân Hàng:</strong> Vietcombank</p>
<p><strong>Số Tài Khoản:</strong> 1234567890</p>
<p><strong>Chủ Tài Khoản:</strong> Nguyễn Văn A</p>
<p><strong>Ghi Chú:</strong> Rút tiền định kỳ</p>
<p><strong>Thời Gian:</strong> 20/10/2025 15:30</p>
<hr>
<p>Vui lòng xác nhận và xử lý yêu cầu này trong admin dashboard.</p>
```

---

## 💰 Wallet Transaction Types

| Type | Direction | When | Status |
|------|-----------|------|--------|
| `credit_settlement` | In (⬆️) | Payment confirmed | completed |
| `debit_payout` | Out (⬇️) | Payout requested | pending |
| `debit_payout` | Out (⬇️) | Payout approved | completed |

---

## 🧪 Test Endpoints

### Create Payout Request
```bash
curl -X POST http://localhost:5050/api/shops/me/payout-requests \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500000,
    "bank_id": 5,
    "note": "Test withdrawal",
    "password": "testPassword123"
  }'
```

### Get Wallet Info
```bash
curl http://localhost:5050/api/shops/me/wallet \
  -H "Authorization: Bearer {token}"
```

### Get Bookings
```bash
curl http://localhost:5050/api/shops/me/bookings?status=confirmed \
  -H "Authorization: Bearer {token}"
```

---

## ✅ Status

| Feature | Status |
|---------|--------|
| GET /shops/me/bookings | ✅ Ready |
| GET /shops/me/wallet | ✅ Ready |
| GET /shops/me/bank-accounts | ✅ Ready |
| POST /shops/me/payout-requests | ✅ Ready + Password Verification |
| GET /shops/me/payout-requests | ✅ Ready |
| Email Notification | ✅ Ready |
| Immediate Wallet Deduction | ✅ Ready |
| Linting | ✅ Pass |

---

## 🚀 Ready for Frontend!

Frontend có thể bắt đầu integrate các endpoint này ngay bây giờ!

