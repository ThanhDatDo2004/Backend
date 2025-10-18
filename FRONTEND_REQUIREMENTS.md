# 🎨 FRONTEND REQUIREMENTS

**Phiên Bản**: 1.0 | **Ngày**: 17/10/2025

---

## 📋 TỔNG QUAN

Backend hiện tại đã hoàn thành 80% các chức năng chính:

- ✅ Authentication & Authorization (Login, Register, OTP)
- ✅ Shop Management (Create, Update, Bank Account)
- ✅ Field Management (CRUD, Images, Filter)
- ✅ **Payment System (Momo Integration)** ← NEW
- ✅ **Payout System (Shop Withdrawal)** ← NEW
- ✅ **Booking CRUD & Status Management** ← NEW
- ✅ **Wallet & Transaction History** ← NEW
- ✅ **Reviews & Ratings** ← NEW
- ✅ **Notifications** ← NEW

---

## 🎯 FRONTEND PAGES & FEATURES NEEDED

### 1. **CRITICAL - PAYMENT PAGE** 🔴

**What**: Khách hàng thanh toán cho booking
**Frontend Pages Needed**:

- [ ] Booking Detail Page
  - Show booking info, total price, platform fee
  - Button "Thanh Toán"
  - Show CheckinCode (after payment confirmed)
- [ ] Payment Page
  - Display QR Code (from `/api/payments/bookings/:bookingCode/initiate`)
  - Poll payment status every 2-3 seconds
  - Show "Đang chờ thanh toán..."
  - Redirect to booking detail when paid

**API Endpoints to Integrate**:

```
POST /api/payments/bookings/:bookingCode/initiate
→ Get QR Code, amount, fee info

GET /api/payments/bookings/:bookingCode/status
→ Poll for payment confirmation

POST /api/payments/:paymentID/confirm (for testing)
→ Manually confirm payment (dev only)
```

**User Flow**:

1. Customer views booking details
2. Clicks "Thanh Toán" button
3. Redirected to payment page with QR code
4. After paying via Momo, page polls status
5. Redirected back to booking detail with "Đã Thanh Toán" status

---

### 2. **CRITICAL - PAYOUT/WITHDRAWAL SYSTEM** 🔴

**What**: Shop owner rút tiền từ ví

**Frontend Pages Needed**:

- [ ] Shop Wallet Dashboard

  - Show: Current Balance, Total Earned, Total Withdrawn
  - Button "Rút Tiền"

- [ ] Wallet Transaction History

  - List all transactions (credit_settlement, debit_payout)
  - Filter by type
  - Pagination

- [ ] Create Payout Request Page

  - Input amount
  - Select bank account (dropdown)
  - Input note (optional)
  - Submit button

- [ ] Payout Request Status Page
  - List my payout requests
  - Filter by status: requested, processing, paid, rejected
  - Show details: amount, status, requested date, approved date

**API Endpoints**:

```
GET /api/shops/me/wallet
→ Get balance info

GET /api/shops/me/wallet/transactions
→ List transactions with pagination

POST /api/shops/me/payout-requests
→ Create new payout request

GET /api/shops/me/payout-requests
→ List payout requests

GET /api/shops/me/payout-requests/:payoutID
→ Get payout detail
```

**User Flow**:

1. Shop owner views wallet dashboard
2. Clicks "Rút Tiền"
3. Enters amount, selects bank account
4. Submits request
5. Status becomes "requested", waits for admin approval
6. Once admin approves → status "paid" → money transferred

---

### 3. **CRITICAL - BOOKING MANAGEMENT** 🔴

**What**: Customer manage their bookings

**Frontend Pages Needed**:

- [ ] My Bookings List Page

  - Filter: pending, confirmed, cancelled, completed
  - Sort: date, price, status
  - Show: field name, date, time, price, status, action buttons

- [ ] Booking Detail Page

  - Show all booking info
  - Show slots (date, time)
  - Show checkin code (if confirmed)
  - Button "Xem Mã Check-in"
  - Button "Hủy Booking" (if not completed)
  - Button "Thanh Toán" (if pending)
  - Button "Đánh Giá" (if completed)

- [ ] Checkin Code Display Modal
  - Show 6-digit code
  - Copy to clipboard button
  - Share via QR code

**API Endpoints**:

```
GET /api/bookings (with filters, sort, pagination)
→ List my bookings

GET /api/bookings/:bookingCode
→ Get booking detail with slots

PATCH /api/bookings/:bookingCode/cancel
→ Cancel booking (before 2 hours)

GET /api/bookings/:bookingCode/checkin-code
→ Get checkin code for display

POST /api/bookings/:bookingCode/verify-checkin
→ Shop verifies checkin code
```

---

### 4. **HIGH - REVIEW & RATING SYSTEM** 🟠

**What**: Customer review sân after booking completed

**Frontend Pages Needed**:

- [ ] Field Reviews Page

  - Show average rating (stars)
  - Show total reviews count
  - List all reviews with pagination
  - Show review: name, rating, comment, date

- [ ] Create Review Modal

  - Star rating input (1-5)
  - Comment textarea
  - Submit button
  - (Only available after booking completed)

- [ ] My Reviews Page (optional)
  - List reviews I created
  - Edit/Delete buttons

**API Endpoints**:

```
GET /api/fields/:fieldCode/reviews
→ List all reviews for field

POST /api/fields/:fieldCode/reviews
→ Create review (customer)

PUT /api/reviews/:reviewCode
→ Update review (customer)

DELETE /api/reviews/:reviewCode
→ Delete review (customer)
```

---

### 5. **HIGH - NOTIFICATIONS** 🟠

**What**: Real-time notifications for user

**Frontend Features Needed**:

- [ ] Notification Bell Icon

  - Show unread count badge
  - Click to open notification dropdown

- [ ] Notification Center Page
  - List all notifications
  - Filter: unread, all
  - Actions: mark as read, delete
  - Mark all as read button

**Notification Types**:

- Booking created
- Payment confirmed
- Payout approved/rejected
- Shop approved
- New review received

**API Endpoints**:

```
GET /api/notifications (with isRead filter)
→ List notifications

PATCH /api/notifications/:notificationID/read
→ Mark single as read

PATCH /api/notifications/read-all
→ Mark all as read

DELETE /api/notifications/:notificationID
→ Delete notification

Polling Strategy:
- Poll every 5-10 seconds
- Or implement WebSocket if you want real-time
```

---

### 6. **ADMIN FEATURES** 👨‍💼

**What**: Admin manage payouts, bookings, reviews

**Admin Pages Needed**:

- [ ] Payout Management Dashboard

  - List all payout requests
  - Filter: requested, processing, paid, rejected
  - Buttons: Approve, Reject
  - Show bank account details

- [ ] Payout Approval Modal

  - Show payout details
  - Approve button → status "paid"
  - Reject button → need reason input

- [ ] Booking Status Management (optional)
  - List all bookings
  - Update status
  - Manual complete if needed

**API Endpoints**:

```
GET /api/admin/payout-requests
→ List all payouts

PATCH /api/admin/payout-requests/:payoutID/approve
→ Approve payout

PATCH /api/admin/payout-requests/:payoutID/reject
→ Reject payout (need reason)

GET /api/admin/shops/:shopCode/wallet
→ View shop wallet

DELETE /api/admin/reviews/:reviewCode
→ Remove inappropriate review
```

---

## 🔄 INTEGRATION CHECKLIST

### Setup

- [ ] Install axios or fetch library
- [ ] Setup API base URL: `http://localhost:5050/api`
- [ ] Setup token storage (localStorage or cookies)
- [ ] Setup interceptor to add Authorization header to all requests

### Pages to Create

- [ ] Login/Register (already done?)
- [ ] Dashboard/Homepage
- [ ] My Bookings List
- [ ] Booking Detail
- [ ] Payment Page
- [ ] Wallet Dashboard
- [ ] Payout Request
- [ ] Payout History
- [ ] Reviews Page
- [ ] Notifications Center
- [ ] (Admin) Payout Management

### Key Features

- [ ] Polling for payment status (every 2-3 sec)
- [ ] Polling for notifications (every 5-10 sec)
- [ ] Error handling & retry logic
- [ ] Loading states for async operations
- [ ] Success/error toast notifications
- [ ] Pagination for lists
- [ ] Filters and sorting

---

## 📱 RESPONSIVE DESIGN TIPS

1. **Mobile First**: Design for mobile first, then desktop
2. **Payment QR Code**: Make it large and scannable
3. **Checkin Code**: Make it prominent and easy to copy
4. **Wallet Display**: Show balance in large font
5. **Notification Badge**: Make it visible on small screens
6. **Forms**: Full width on mobile, constrained on desktop

---

## 🎨 UI/UX BEST PRACTICES

### Payment Flow

```
┌─────────────────────────────┐
│   Booking Details           │
│ Total: 150,000 VND          │
│ Fee: 7,500 VND              │
│ Your earn: 142,500 VND      │
│                             │
│   [Thanh Toán Button]       │
└─────────────────────────────┘
         ↓
┌─────────────────────────────┐
│   Payment Page              │
│                             │
│   [QR Code Display]         │
│                             │
│   Scanning...               │
│   ⏳ Waiting for payment     │
│                             │
│   [Cancel]                  │
└─────────────────────────────┘
         ↓ (After payment confirmed)
┌─────────────────────────────┐
│   ✅ Payment Successful      │
│                             │
│   Your checkin code:        │
│   [  ABC123  ]              │
│   [Copy] [QR Code]          │
└─────────────────────────────┘
```

### Wallet Flow

```
┌──────────────────────────────┐
│   Your Wallet                │
│                              │
│   Balance: 500,000 VND       │
│   ├─ Total Earned: 1M        │
│   └─ Total Withdrawn: 500K   │
│                              │
│   [Rút Tiền]                 │
│   [Lịch Sử]                  │
└──────────────────────────────┘
           ↓
┌──────────────────────────────┐
│   Rút Tiền                   │
│                              │
│   Số tiền: [150000]          │
│   Tài khoản: [Vietcom ▼]     │
│   Ghi chú: [Optional]        │
│                              │
│   [Hủy]  [Xác Nhận]          │
└──────────────────────────────┘
           ↓
┌──────────────────────────────┐
│   Status: Đang Chờ Duyệt     │
│   Số tiền: 150,000           │
│   Ngân hàng: Vietcombank     │
│   Thời gian: 20/10 10:00     │
│                              │
│   ⏳ Chờ admin duyệt...       │
└──────────────────────────────┘
```

---

## 🧪 TESTING SCENARIOS

### Test Payment

1. Create booking
2. Go to payment page
3. Use `/api/payments/:paymentID/confirm` to manually confirm
4. Should redirect to booking detail with status "Đã Thanh Toán"

### Test Payout

1. Login as shop
2. Create payout request
3. Login as admin
4. Approve payout
5. Check wallet deducted

### Test Booking

1. Create booking
2. List bookings - should appear
3. Get booking detail - should show slots
4. Get checkin code - should show
5. Cancel booking - should rollback slots

### Test Reviews

1. Complete a booking (admin can manually set status)
2. Go to field reviews
3. Create review (1-5 stars, comment)
4. Review should appear in list

### Test Notifications

1. Perform any action (booking, payment, payout)
2. Poll /api/notifications
3. Should see notification in list
4. Mark as read
5. Unread count should decrease

---

## 📞 BACKEND SUPPORT

**API Documentation**: See `BACKEND_API_DOCUMENTATION.md`

**Common Errors**:

```json
{
  "success": false,
  "error": {
    "statusCode": 400,
    "message": "Invalid input"
  }
}
```

**Status Codes**:

- 200/201: Success
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Server Error

**Rate Limits**: None currently, but will be added

---

## 🚀 DEPLOYMENT CHECKLIST

Before going live:

- [ ] Update BASE URL to production endpoint
- [ ] Remove console.logs
- [ ] Test all features end-to-end
- [ ] Test on different browsers/devices
- [ ] Setup error tracking (Sentry)
- [ ] Setup analytics
- [ ] Test payment with real Momo account
- [ ] Load test with multiple users

---

## 📝 NOTES

1. **Payment QR Code**: In development, it's a mock. For production, integrate with real Momo API
2. **Notifications**: Currently using polling. Consider WebSocket for real-time in future
3. **Checkin Code**: Generated automatically, format: 6 alphanumeric characters
4. **Timezone**: All timestamps are server timezone. Frontend should convert to user timezone
5. **Error Messages**: All error messages are in Vietnamese. Handle accordingly

---

**Ready to Build! 🚀**

Next Step: Provide this file to frontend developer and they can start building pages based on API endpoints listed in `BACKEND_API_DOCUMENTATION.md`


