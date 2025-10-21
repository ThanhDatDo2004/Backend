# 🎯 Frontend Integration Guide - Shop Revenue Page

## 📌 Quick Start

Frontend team đã hoàn thành Shop Revenue Page. Backend API đã sẵn sàng. 
Dưới đây là hướng dẫn integrate:

---

## 🔗 Các API Call Cần

### 1️⃣ Load Page - Get All Required Data

```typescript
// Gọi cùng lúc 3 API
Promise.all([
  GET /api/shops/me/bookings
  GET /api/shops/me/wallet
  GET /api/shops/me/bank-accounts
])
```

### 2️⃣ Display Revenue Summary

```json
BOOKINGS (Filter: confirmed + paid)
├─ Total Bookings: 5
├─ Total Amount: 5,000,000đ
└─ Shop Revenue (95%): 4,750,000đ

WALLET
├─ Available Balance: 4,750,000đ
└─ Can Withdraw: 4,750,000đ
```

### 3️⃣ Display Bookings Table

```
| Mã Đơn | Sân | Khách | Ngày | Giờ | Tổng Tiền | Thực Thu (95%) |
|--------|-----|-------|------|-----|-----------|-----------------|
| BK-001 | A1  | Nguyễn A | 10/20 | 14:00 | 100,000đ | 95,000đ |
| BK-002 | A2  | Trần B | 10/21 | 15:00 | 150,000đ | 142,500đ |
```

### 4️⃣ Create Withdrawal Request

```typescript
POST /api/shops/me/payout-requests
{
  "amount": 500000,
  "bank_id": 5,
  "note": "Rút tiền định kỳ",
  "password": "userPassword123"  // ⭐ IMPORTANT!
}
```

**Handle Errors**:
```typescript
if (error.statusCode === 401) {
  // Mật khẩu sai
  showError("Mật khẩu không chính xác");
} else if (error.statusCode === 400) {
  // Số dư không đủ
  showError("Số dư không đủ");
}
```

---

## 🔐 Password Verification

**Important**: Password field MUST be included in request body!

```typescript
// ✅ CORRECT
const response = await fetch('/api/shops/me/payout-requests', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    amount: 500000,
    bank_id: 5,
    note: "Test",
    password: userPassword  // ⭐ REQUIRED
  })
});

// ❌ WRONG (will fail)
body: JSON.stringify({
  amount: 500000,
  bank_id: 5,
  note: "Test"
  // Missing password!
});
```

---

## 💰 Wallet Logic

```
FLOW:
1. User creates payout request
   └─ Enter amount + password

2. FRONTEND sends POST /payout-requests
   └─ Backend IMMEDIATELY:
      ├─ Verify password ✓
      ├─ Check balance ✓
      ├─ Deduct from wallet ✓
      ├─ Send email to admin ✓
      └─ Return success

3. FRONTEND:
   ├─ Show success message
   ├─ Refresh wallet balance (GET /wallet)
   ├─ Refresh payout requests (GET /payout-requests)
   └─ Close form

IMPORTANT:
⭐ Wallet is IMMEDIATELY deducted
   (User can see the new balance right away)
⭐ Admin will approve the payout later
   (And transfer money to bank)
```

---

## 📋 Response Examples

### GET /shops/me/bookings
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "BookingCode": "BK-123",
        "FieldName": "Sân A",
        "CustomerName": "Nguyễn A",
        "TotalPrice": 100000,
        "BookingStatus": "confirmed",
        "PaymentStatus": "paid",
        "CreateAt": "2025-10-20T10:00:00Z"
      }
    ],
    "pagination": {
      "total": 5,
      "limit": 100,
      "offset": 0
    }
  }
}
```

### GET /shops/me/wallet
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

### GET /shops/me/bank-accounts
```json
{
  "success": true,
  "data": [
    {
      "ShopBankID": 5,
      "BankName": "Vietcombank",
      "AccountNumber": "1234567890",
      "AccountHolder": "Nguyễn Văn A",
      "BranchName": "Hà Nội"
    }
  ]
}
```

### POST /shops/me/payout-requests (Success)
```json
{
  "success": true,
  "data": {
    "payoutID": 42,
    "amount": 500000,
    "status": "requested",
    "requestedAt": "2025-10-20T15:30:00Z"
  },
  "message": "Tạo yêu cầu rút tiền thành công"
}
```

### POST /shops/me/payout-requests (Error)
```json
{
  "success": false,
  "statusCode": 401,
  "error": {
    "status": "error",
    "message": "Mật khẩu không chính xác"
  }
}
```

---

## 🧪 Testing Checklist

- [ ] Can fetch bookings with confirmed + paid status
- [ ] Revenue calculation correct (95% of total)
- [ ] Wallet balance displays correctly
- [ ] Bank accounts list shows correct accounts
- [ ] Can create payout request with valid password
- [ ] Shows error when password is wrong
- [ ] Shows error when balance insufficient
- [ ] Wallet balance updates after successful request
- [ ] Email is sent to admin (check kubjmisu1999@gmail.com)
- [ ] Payout request appears in list immediately

---

## 🚀 Implementation Timeline

1. **Today**: Backend APIs ready ✅
2. **Tomorrow**: Frontend integrates and tests
3. **Next Day**: E2E testing with mock data
4. **Production**: Deploy when ready

---

## 📞 Support

**Backend Status**: ✅ Ready
**All Endpoints**: ✅ Working
**Password Verification**: ✅ Active
**Email Notification**: ✅ Active

If any issues:
1. Check error message from backend
2. Verify password is included in request
3. Check bank account exists
4. Verify wallet has sufficient balance

---

## ✅ Status

✅ All APIs ready
✅ Password verification working
✅ Email notifications active
✅ Wallet deduction immediate
✅ No errors in backend
✅ Ready to integrate!

**Let's ship it! 🚀**

