# DANH SÁCH ENDPOINTS VÀ CHỨC NĂNG CẦN IMPLEMENT

## 🔴 CRITICAL PRIORITY

### 1. Payment System (Thanh Toán) - CRITICAL

**Status**: ❌ Không có (chỉ mock)

#### Endpoints cần tạo:

```
1. GET /api/bookings/:id
   - Lấy chi tiết booking (bao gồm trạng thái thanh toán)
   - File cần tạo: bookings.controller.ts

2. POST /api/bookings/:id/payment/initiate
   - Khởi tạo thanh toán (trả QR code Momo)
   - Tính toán: total_price, platform_fee (5%), net_to_shop (95%)
   - Trả về: qr_code, momo_url, payment_info
   - File cần tạo: payment.controller.ts

3. POST /api/webhooks/payment/callback
   - Webhook callback từ Momo
   - Cập nhật Payments_Admin status → 'paid'
   - Cập nhật Shop_Wallets balance (+95%)
   - Tạo Wallet_Transactions record
   - File cần tạo: webhook.controller.ts

4. GET /api/bookings/:id/payment-status
   - Check trạng thái thanh toán
```

#### Files & Services cần tạo:

- `payment.service.ts` - Tích hợp Momo API
- `payment.controller.ts` - Payment endpoints
- `webhook.controller.ts` - Xử lý callback
- Model update: `booking.model.ts` thêm payment methods

#### Database changes:

- INSERT INTO `Payments_Admin` khi thanh toán thành công
- UPDATE `Shop_Wallets` khi thanh toán confirm
- INSERT INTO `Wallet_Transactions`

---

### 2. Payout System (Rút Tiền) - CRITICAL

**Status**: ❌ Không có

#### Endpoints cần tạo:

```
SHOP OWNER:
1. POST /api/shops/me/payout-requests
   - Tạo yêu cầu rút tiền
   - Validate: balance >= amount, có bank account
   - Body: { amount: number, bank_id?: number }
   - Trả về: payout_request_id, status: 'requested'

2. GET /api/shops/me/payout-requests
   - Liệt kê yêu cầu rút tiền của shop
   - Filter: status (requested, processing, paid, rejected)
   - Pagination

3. GET /api/shops/me/payout-requests/:id
   - Chi tiết yêu cầu rút tiền

ADMIN:
4. GET /api/admin/payout-requests
   - Liệt kê tất cả yêu cầu rút tiền
   - Filter: status, shop_code, date_range
   - Pagination

5. GET /api/admin/payout-requests/:id
   - Chi tiết yêu cầu

6. PATCH /api/admin/payout-requests/:id/approve
   - Duyệt rút tiền
   - Body: { note?: string }
   - UPDATE status → 'paid'
   - Cập nhật Shop_Wallets (debit amount)
   - Tạo Wallet_Transactions type='debit_payout'

7. PATCH /api/admin/payout-requests/:id/reject
   - Từ chối rút tiền
   - Body: { reason: string }
   - UPDATE status → 'rejected'
```

#### Files & Services cần tạo:

- `payout.controller.ts`
- `payout.service.ts`
- `payout.model.ts`

#### Database queries:

- SELECT FROM `Payout_Requests`
- UPDATE `Shop_Wallets` balance

---

### 3. Booking Status Management - CRITICAL

**Status**: ⚠️ Hoàn thành nhưng chưa đầy đủ

#### Endpoints cần tạo:

```
CUSTOMER:
1. GET /api/bookings
   - Liệt kê booking của customer
   - Filter: status (pending, confirmed, completed, cancelled)
   - Sort: date, created_at
   - Pagination

2. GET /api/bookings/:id
   - Chi tiết booking (bao gồm payment status, checkin code)

3. PATCH /api/bookings/:id/cancel
   - Hủy booking (chỉ cho pending, trước 2h)
   - Rollback slot status → 'available'
   - Trả lại tiền nếu đã thanh toán

ADMIN/SYSTEM:
4. PATCH /api/bookings/:id/status
   - Cập nhật trạng thái booking
   - Body: { status: 'pending'|'confirmed'|'completed'|'cancelled', note?: string }
   - Chuyển đổi: pending → confirmed → completed

5. POST /jobs/bookings/auto-complete (cron job)
   - Auto-complete booking hết thời gian + 4 giờ
   - Cập nhật status → 'completed'
   - Tạo notification cho customer để review
```

#### Flow cần implement:

```
pending (khách checkout)
  ↓ (thanh toán thành công)
confirmed (sân được giữ)
  ↓ (quá thời gian + 4 giờ)
completed (có thể đánh giá)
```

---

## 🟠 HIGH PRIORITY

### 1. Shop Wallet Management

**Status**: ⚠️ Table tồn tại nhưng không sử dụng

#### Endpoints cần tạo:

```
1. GET /api/shops/me/wallet
   - Lấy thông tin ví hiện tại
   - Trả về: balance, total_credit, total_debit

2. GET /api/shops/me/wallet/transactions
   - Lịch sử giao dịch
   - Filter: type (credit_settlement, debit_payout, adjustment)
   - Pagination, sort by date DESC

3. GET /api/admin/shop/:shopCode/wallet
   - Admin xem ví của shop
```

#### Files cần tạo:

- `wallet.controller.ts`
- `wallet.service.ts`

---

### 2. Admin Bank Accounts Management

**Status**: ❌ Không có

#### Endpoints cần tạo:

```
ADMIN:
1. GET /api/admin/bank-accounts
   - Liệt kê tài khoản ngân hàng admin

2. POST /api/admin/bank-accounts
   - Tạo tài khoản ngân hàng
   - Body: { bank_name, account_number, account_holder, is_default }
   - Auto set is_default = 'Y' nếu là first

3. PUT /api/admin/bank-accounts/:id
   - Cập nhật tài khoản

4. PATCH /api/admin/bank-accounts/:id/set-default
   - Đặt làm tài khoản mặc định
   - Cập nhật: set old default → 'N', new → 'Y'

5. DELETE /api/admin/bank-accounts/:id
   - Xóa tài khoản (chỉ nếu không phải default)
```

#### Files cần tạo:

- `admin-bank.controller.ts`
- `admin-bank.service.ts`

---

### 3. Reviews/Ratings

**Status**: ❌ Không có

#### Endpoints cần tạo:

```
PUBLIC:
1. GET /api/fields/:id/reviews
   - Liệt kê review cho sân
   - Pagination, sort by date DESC

CUSTOMER (requires auth):
2. POST /api/fields/:id/reviews
   - Tạo review
   - Body: { rating (1-5), comment }
   - Validate: customer phải đã complete booking cho field này
   - Trả về: review_code, created_at

3. PUT /api/reviews/:id
   - Cập nhật review (customer)

4. DELETE /api/reviews/:id
   - Xóa review (customer)

ADMIN:
5. DELETE /api/reviews/:id (admin force delete)
   - Xóa review vi phạm
```

#### Files cần tạo:

- `review.controller.ts`
- `review.service.ts`

---

### 4. Notifications System

**Status**: ❌ Không có

#### Endpoints cần tạo:

```
USER:
1. GET /api/notifications
   - Liệt kê thông báo của user hiện tại
   - Filter: isRead (true/false)
   - Pagination

2. PATCH /api/notifications/:id/read
   - Đánh dấu thông báo đã đọc

3. PATCH /api/notifications/read-all
   - Đánh dấu tất cả đã đọc

4. DELETE /api/notifications/:id
   - Xóa thông báo
```

#### Auto-trigger points (Tạo notification tự động):

```
- Booking created → Notify shop
- Payment confirmed → Notify customer + shop
- Payout approved → Notify shop
- Shop approved → Notify user
- Review posted → Notify shop
```

#### Files cần tạo:

- `notification.controller.ts`
- `notification.service.ts`

---

## 🟡 MEDIUM PRIORITY

### 1. Checkin Code Management

**Status**: ⚠️ Column tồn tại nhưng chưa dùng

#### Features cần implement:

```
1. Generate checkin code khi booking thành công
   - Code format: 6 ký tự (mix number + letter)
   - Unique per booking

2. Endpoint verify checkin:
   POST /api/bookings/:id/verify-checkin
   - Body: { checkin_code }
   - Verify & mark booking as checked-in
   - Update status → 'in-progress'

3. Endpoint get checkin code:
   GET /api/bookings/:id/checkin-code
   - Trả về checkin code của booking (for customer)
```

---

### 2. Email Verification with Database

**Status**: ⚠️ OTP lưu trong memory

#### Improvements needed:

```
1. Lưu OTP vào Users_Verification table:
   - INSERT vào Users_Verification khi gửi code
   - UPDATE Consumed='Y' khi verify thành công
   - DELETE expired records

2. Endpoint verify:
   POST /api/auth/verify-email
   - Body: { user_id, code }
   - Check Users_Verification.Consumed='N' AND ExpiresAt > NOW()
   - UPDATE Consumed='Y'

3. Flow update:
   - Register → Tạo user IsActive=0
   - Gửi OTP → INSERT Users_Verification
   - Verify OTP → UPDATE Users IsActive=1
   - Đăng nhập → Check IsActive=1
```

---

### 3. Refresh Token Endpoint

**Status**: ❌ No endpoint

#### Endpoint cần tạo:

```
POST /api/auth/refresh-token
- Body: { refresh_token }
- Verify refresh token signature
- Generate new access token
- Trả về: { access_token, expires_in }

POST /api/auth/logout
- Invalidate refresh token (optional, nếu lưu DB)
```

---

### 4. Field Pre-generation & Operating Hours

**Status**: ⚠️ Pricing CRUD tồn tại nhưng logic tạo slot chưa có

#### Features needed:

```
1. Endpoint auto-generate slots từ pricing:
   POST /api/shops/me/fields/:fieldCode/generate-slots
   - Body: { start_date, end_date, recurring: boolean }
   - Tạo slots based on Field_Pricing rules
   - Example: Monday 9:00-17:00 → generate slots for all Mondays

2. Endpoint block time (maintenance):
   POST /api/shops/me/fields/:fieldCode/block-time
   - Body: { play_date, start_time, end_time, reason }
   - Create slot with status='blocked'
```

---

## 🟢 LOW PRIORITY

### 1. Advanced Validations

**Status**: ⚠️ Basic validation exists

#### Improvements:

- Add stricter phone number validation (Vietnamese format)
- Add address validation (coordinates, etc.)
- Add image format/size validation
- Add business hours overlap validation

### 2. Transaction Retry & Error Handling

**Status**: ⚠️ Basic transaction exists

#### Improvements:

- Add retry logic for failed transactions
- Better deadlock handling
- Comprehensive error logging

### 3. Booking Analytics

**Status**: ❌ Không có

#### Possible endpoints:

```
GET /api/admin/analytics/bookings
GET /api/admin/analytics/revenue
GET /api/shops/me/analytics/performance
```

### 4. Rate Limiting & Security

**Status**: ⚠️ Basic middleware exists

#### Improvements:

- Add rate limiting per user
- Add CSRF protection
- Add request validation limits

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1 - CRITICAL (Week 1-2)

- [ ] Payment Service & Momo integration
- [ ] Payout System
- [ ] Booking Status Flow
- [ ] Wallet Transactions

### Phase 2 - HIGH (Week 3)

- [ ] Admin Bank Accounts
- [ ] Shop Wallet endpoints
- [ ] Reviews System
- [ ] Notifications System

### Phase 3 - MEDIUM (Week 4)

- [ ] Checkin Code
- [ ] Email Verification DB
- [ ] Refresh Token
- [ ] Auto-generate Slots

### Phase 4 - LOW (Optional)

- [ ] Advanced validations
- [ ] Transaction retry
- [ ] Analytics
- [ ] Security hardening

---

## 🔗 Database Tables Already Exist

These tables are already in schema but endpoints/logic needed:

```
✓ Bookings - Needs full CRUD + status management
✓ Payments_Admin - Needs write logic
✓ Payout_Requests - Needs full management
✓ Shop_Wallets - Needs read endpoints
✓ Wallet_Transactions - Needs write logic
✓ Reviews - Needs CRUD
✓ Notifications - Needs CRUD
✓ Admin_Bank_Accounts - Needs CRUD
✓ Users_Verification - Needs proper usage
✓ Shop_Request_Inbox - Needs sync with Shop_Applications
```

---

## 📝 Testing Recommendations

After implementing each feature:

1. Unit tests for services
2. Integration tests for endpoints
3. Payment flow testing (mock → real testing)
4. Concurrent booking tests (race condition check)
5. Transaction rollback tests
