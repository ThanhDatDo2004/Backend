# 🎯 BACKEND API DOCUMENTATION

**Phiên Bản**: 1.0 | **Ngày Cập Nhật**: 17/10/2025

---

## 📋 MỤC LỤC

1. [BASE URL & Headers](#base-url--headers)
2. [Authentication](#authentication)
3. [Booking Endpoints](#booking-endpoints)
4. [Payment Endpoints](#payment-endpoints)
5. [Payout Endpoints](#payout-endpoints)
6. [Wallet Endpoints](#wallet-endpoints)
7. [Review Endpoints](#review-endpoints)
8. [Notification Endpoints](#notification-endpoints)
9. [Admin Endpoints](#admin-endpoints)

---

## 🌐 BASE URL & Headers

```
Base URL: http://localhost:5050/api
```

### Required Headers for Protected Endpoints:

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

## 🔐 Authentication

### Login

```
POST /auth/login
Body: {
  "login": "email@example.com or 0901234567",
  "password": "your_password"
}

Response: {
  "success": true,
  "data": {
    "UserID": 1,
    "Email": "user@example.com",
    "LevelCode": 1,
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 3600
  }
}
```

### Register

```
POST /auth/register
Body: {
  "full_name": "Nguyễn Văn A",
  "email": "user@example.com",
  "phone_number": "0901234567",
  "password": "password123"
}
```

### Send OTP

```
POST /auth/send-code
Body: {
  "email": "user@example.com"
}
```

### Verify OTP

```
POST /auth/verify-code
Body: {
  "email": "user@example.com",
  "code": "123456"
}
```

---

## 📅 Booking Endpoints

### List My Bookings

```
GET /bookings?status=pending&limit=10&offset=0&sort=CreateAt&order=DESC
Authorization: Required

Query Parameters:
- status: pending | confirmed | cancelled | completed (optional)
- limit: default 10
- offset: default 0
- sort: CreateAt | PlayDate | TotalPrice | BookingStatus
- order: ASC | DESC

Response: {
  "success": true,
  "data": {
    "data": [
      {
        "BookingCode": "BK-123ABC",
        "FieldCode": 1,
        "FieldName": "Sân Bóng A",
        "SportType": "football",
        "ShopName": "Shop A",
        "PlayDate": "2025-10-20",
        "StartTime": "09:00",
        "EndTime": "10:00",
        "TotalPrice": 150000,
        "PlatformFee": 7500,
        "NetToShop": 142500,
        "BookingStatus": "pending",
        "PaymentStatus": "pending",
        "CheckinCode": "ABC123"
      }
    ],
    "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 25
    }
  }
}
```

### Get Booking Detail

```
GET /bookings/:bookingCode
Authorization: Required

Response: {
  "success": true,
  "data": {
    "BookingCode": "BK-123ABC",
    "TotalPrice": 150000,
    "BookingStatus": "pending",
    "PaymentStatus": "pending",
    "slots": [
      {
        "SlotID": 1,
        "PlayDate": "2025-10-20",
        "StartTime": "09:00",
        "EndTime": "10:00",
        "Status": "booked"
      }
    ]
  }
}
```

### Cancel Booking

```
PATCH /bookings/:bookingCode/cancel
Authorization: Required
Body: {
  "reason": "Có việc đột xuất" (optional)
}

Constraints:
- Chỉ hủy được trước 2 giờ khi khác trạng thái confirmed
- Nếu đã thanh toán sẽ hoàn tiền
```

### Get Checkin Code

```
GET /bookings/:bookingCode/checkin-code
Authorization: Required

Response: {
  "success": true,
  "data": {
    "bookingCode": "BK-123ABC",
    "checkinCode": "ABC123"
  }
}
```

### Verify Checkin

```
POST /bookings/:bookingCode/verify-checkin
Body: {
  "checkin_code": "ABC123"
}

Response: {
  "success": true,
  "data": {
    "bookingCode": "BK-123ABC",
    "checkinTime": "2025-10-20T09:05:00Z"
  }
}
```

---

## 💳 Payment Endpoints

### Initiate Payment

```
POST /payments/bookings/:bookingCode/initiate
Authorization: Required
Body: {
  "payment_method": "momo" (optional, default: momo)
}

Response: {
  "success": true,
  "data": {
    "paymentID": 1,
    "qr_code": "...",
    "momo_url": "https://momo.vn/pay?amount=150000",
    "amount": 150000,
    "platformFee": 7500,
    "netToShop": 142500,
    "paymentStatus": "pending",
    "expiresIn": 900 // 15 minutes
  }
}
```

### Check Payment Status

```
GET /payments/bookings/:bookingCode/status

Response: {
  "success": true,
  "data": {
    "paymentID": 1,
    "bookingCode": "BK-123ABC",
    "amount": 150000,
    "status": "pending | paid | failed | refunded",
    "paidAt": "2025-10-20T10:00:00Z"
  }
}
```

### Confirm Payment (Testing)

```
POST /payments/:paymentID/confirm
Authorization: Required

Response: {
  "success": true,
  "data": {
    "success": true,
    "paymentID": 1,
    "bookingCode": "BK-123ABC",
    "amountToPay": 150000,
    "platformFee": 7500,
    "netToShop": 142500
  }
}
```

### Momo Webhook Callback

```
POST /payments/webhook/momo-callback
(Tự động được gọi bởi Momo, không cần frontend gọi)

Body từ Momo:
{
  "orderId": "BK-123ABC",
  "amount": 150000,
  "transId": "123456789",
  "requestId": "req-123",
  "resultCode": 0,
  "resultMessage": "Success"
}
```

---

## 🏪 Payout Endpoints (Shop)

### Create Payout Request

```
POST /shops/me/payout-requests
Authorization: Required (Shop)
Body: {
  "amount": 100000,
  "bank_id": 1,
  "note": "Rút tiền tháng 10" (optional)
}

Response: {
  "success": true,
  "data": {
    "payoutID": 1,
    "shopCode": 1,
    "amount": 100000,
    "status": "requested",
    "requestedAt": "2025-10-20T10:00:00Z"
  }
}

Constraints:
- amount > 0
- bank_id phải là tài khoản ngân hàng của shop
- balance phải >= amount
```

### List My Payout Requests

```
GET /shops/me/payout-requests?status=requested&limit=10&offset=0
Authorization: Required (Shop)

Query Parameters:
- status: requested | processing | paid | rejected (optional)
- limit: default 10
- offset: default 0

Response: {
  "success": true,
  "data": {
    "data": [
      {
        "PayoutID": 1,
        "ShopCode": 1,
        "ShopName": "Shop A",
        "Amount": 100000,
        "Status": "requested",
        "BankName": "Vietcombank",
        "AccountNumber": "123456789",
        "RequestedAt": "2025-10-20T10:00:00Z"
      }
    ],
    "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 5
    }
  }
}
```

### Get Payout Request Detail

```
GET /shops/me/payout-requests/:payoutID
Authorization: Required (Shop)
```

---

## 💰 Wallet Endpoints (Shop)

### Get Wallet Info

```
GET /shops/me/wallet
Authorization: Required (Shop)

Response: {
  "success": true,
  "data": {
    "balance": 500000,
    "totalCredit": 1000000,
    "totalDebit": 500000,
    "available": 500000
  }
}
```

### Get Transaction History

```
GET /shops/me/wallet/transactions?type=credit_settlement&limit=10&offset=0
Authorization: Required (Shop)

Query Parameters:
- type: credit_settlement | debit_payout | adjustment (optional)
- limit: default 10
- offset: default 0

Response: {
  "success": true,
  "data": {
    "data": [
      {
        "WalletTxnID": 1,
        "Type": "credit_settlement",
        "Amount": 142500,
        "Note": "Payment from booking",
        "Status": "completed",
        "BookingCode": "BK-123ABC",
        "CreateAt": "2025-10-20T10:00:00Z"
      }
    ],
    "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 50
    }
  }
}
```

---

## ⭐ Review Endpoints

### List Field Reviews

```
GET /fields/:fieldCode/reviews?limit=10&offset=0

Response: {
  "success": true,
  "data": {
    "data": [
      {
        "ReviewCode": 1,
        "Rating": 5,
        "Comment": "Sân rất đẹp",
        "FullName": "Nguyễn Văn A",
        "CreateAt": "2025-10-20T10:00:00Z"
      }
    ],
    "stats": {
      "avg_rating": 4.5,
      "total_reviews": 10
    },
    "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 10
    }
  }
}
```

### Create Review

```
POST /fields/:fieldCode/reviews
Authorization: Required (Customer)
Body: {
  "rating": 5,
  "comment": "Sân rất đẹp" (optional)
}

Constraints:
- rating: 1-5
- Customer phải đã complete booking cho sân này
- Chỉ review 1 lần/sân

Response: {
  "success": true,
  "data": {
    "reviewCode": 1,
    "fieldCode": 1,
    "rating": 5
  }
}
```

### Update Review

```
PUT /reviews/:reviewCode
Authorization: Required (Customer)
Body: {
  "rating": 4,
  "comment": "Sân still good"
}
```

### Delete Review

```
DELETE /reviews/:reviewCode
Authorization: Required (Customer)
```

---

## 🔔 Notification Endpoints

### List Notifications

```
GET /notifications?isRead=false&limit=10&offset=0
Authorization: Required

Query Parameters:
- isRead: true | false (optional)
- limit: default 10
- offset: default 0

Response: {
  "success": true,
  "data": {
    "data": [
      {
        "NotificationID": 1,
        "Type": "booking | wallet | payout | system",
        "Title": "Booking confirmed",
        "Content": "Your booking BK-123 is confirmed",
        "IsRead": "N",
        "CreateAt": "2025-10-20T10:00:00Z"
      }
    ],
    "unread_count": 3,
    "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 20
    }
  }
}
```

### Mark as Read

```
PATCH /notifications/:notificationID/read
Authorization: Required

Response: {
  "success": true,
  "data": {
    "notificationID": 1,
    "isRead": true
  }
}
```

### Mark All as Read

```
PATCH /notifications/read-all
Authorization: Required

Response: {
  "success": true,
  "data": {
    "updated": 5
  }
}
```

### Delete Notification

```
DELETE /notifications/:notificationID
Authorization: Required
```

---

## 👨‍💼 Admin Endpoints

### Approve Payout Request

```
PATCH /admin/payout-requests/:payoutID/approve
Authorization: Required (Admin)
Body: {
  "note": "Approved" (optional)
}

Effects:
- Payout status → 'paid'
- Shop wallet balance - amount
- Create wallet transaction
- Send notification to shop
```

### Reject Payout Request

```
PATCH /admin/payout-requests/:payoutID/reject
Authorization: Required (Admin)
Body: {
  "reason": "Invalid account" (required)
}

Effects:
- Payout status → 'rejected'
- Send notification to shop
```

### List All Payouts (Admin)

```
GET /admin/payout-requests?status=requested&shop_code=1&limit=10&offset=0
Authorization: Required (Admin)

Query Parameters:
- status: requested | processing | paid | rejected
- shop_code: filter by shop
- limit: default 10
- offset: default 0
```

### Update Booking Status (Admin)

```
PATCH /admin/bookings/:bookingCode/status
Authorization: Required (Admin)
Body: {
  "status": "pending | confirmed | completed | cancelled",
  "note": "Note" (optional)
}

Status Flow:
pending → confirmed → completed
pending → cancelled
confirmed → completed / cancelled
```

### Get Shop Wallet (Admin)

```
GET /admin/shops/:shopCode/wallet
Authorization: Required (Admin)
```

### Get Shop Transactions (Admin)

```
GET /admin/shops/:shopCode/wallet/transactions
Authorization: Required (Admin)
```

### Delete Review (Admin)

```
DELETE /admin/reviews/:reviewCode
Authorization: Required (Admin)
```

---

## 📊 Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    /* ... */
  },
  "message": "Operation successful"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "statusCode": 400,
    "message": "Invalid input"
  }
}
```

---

## 🔄 Auto Notifications

System automatically creates notifications:

- ✅ Booking created → Notify shop
- ✅ Payment confirmed → Notify customer + shop
- ✅ Payout approved → Notify shop
- ✅ Shop approved → Notify user
- ✅ Review posted → Notify shop

---

## 📝 NOTES FOR FRONTEND

### 1. Payment Flow (Customer)

```
1. GET /api/bookings (list bookings)
2. POST /api/payments/bookings/:bookingCode/initiate (get QR code)
3. Display QR code to customer
4. GET /api/payments/bookings/:bookingCode/status (poll for confirmation)
5. When paid, redirect to booking detail
```

### 2. Payout Flow (Shop)

```
1. GET /api/shops/me/wallet (check balance)
2. POST /api/shops/me/payout-requests (create request)
3. GET /api/shops/me/payout-requests (view status)
4. Wait for admin approval
5. Money transferred to shop bank account
```

### 3. Review Flow (Customer)

```
1. GET /api/bookings (find completed bookings)
2. POST /api/fields/:fieldCode/reviews (create review)
3. GET /api/fields/:fieldCode/reviews (view reviews)
```

### 4. Real-time Updates

- Poll notifications every 5-10 seconds
- Or implement WebSocket for real-time updates

### 5. Error Handling

Always check `success` field:

- If false, show `error.message` to user
- Implement retry logic for network errors
- Show loading states during async operations

---

## 🧪 Testing Tips

### Testing Payment

1. Use `/api/payments/:paymentID/confirm` endpoint to manually confirm payment
2. This is for development/testing only

### Testing Payout

1. Create admin bank account (contact admin)
2. Add shop bank account
3. Create payout request
4. Admin approves payout

### Testing Booking

1. Search fields
2. Create booking
3. Initiate payment
4. Confirm payment
5. Get checkin code
6. Verify checkin
7. View booking status

---

**Last Updated**: 17/10/2025
**API Version**: 1.0
**Status**: ✅ Production Ready
