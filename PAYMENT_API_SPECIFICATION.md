# 💳 PAYMENT API SPECIFICATION - UPDATED

**Ngày cập nhật**: 17/10/2025  
**Status**: ✅ Backend khớp spec của FE  
**Version**: 1.0

---

## 🔧 CORS Configuration

```
Allow Origin: http://localhost:5173
Methods: GET, POST, PATCH, OPTIONS
Headers: Authorization, Content-Type
Credentials: false
```

**Backend (index.ts)**: ✅ Đã cập nhật

---

## 1️⃣ Khởi Tạo Thanh Toán

### Endpoint
```
POST /api/payments/bookings/:bookingCode/initiate
```

### Authentication
✅ Required (requireAuth middleware)

### Input
```typescript
{
  "payment_method": "momo" // optional, default: "momo"
}
```

### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Khởi tạo thanh toán thành công",
  "data": {
    "paymentID": 123,
    "qr_code": "data:image/png;base64,...",
    "momo_url": "https://test-payment.momo.vn/pay?tx=...",
    "amount": 150000,
    "expiresIn": 900,
    "bookingId": "BK-ABC123"
  }
}
```

### Business Logic
✅ Đã cập nhật:
- Lấy total price thực từ booking
- Link Payments_Admin.PaymentID → Bookings.PaymentID
- Lưu log khởi tạo (Payment_Logs)
- Return đúng fields theo spec FE

**Fields yêu cầu**:
- `paymentID`: number - ID payment trong DB
- `qr_code`: string | null - QR code (base64 hoặc URL)
- `momo_url`: string | null - Direct payment URL
- `amount`: number - Tổng tiền thực của booking
- `expiresIn`: number - Seconds (900 = 15 min)
- `bookingId`: string/number - ID nội bộ để redirect

---

## 2️⃣ Poll Payment Status

### Endpoint
```
GET /api/payments/bookings/:bookingCode/status
```

### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lấy trạng thái thanh toán thành công",
  "data": {
    "paymentID": 123,
    "bookingCode": "BK-ABC123",
    "bookingId": "BK-ABC123",
    "amount": 150000,
    "status": "pending|paid|failed|refunded",
    "paidAt": "2025-10-20T10:00:00Z"
  }
}
```

### Business Logic
✅ Đã cập nhật:
- Lấy status từ Payments_Admin/Bookings thật
- Return bookingId field
- paidAt optional (null nếu chưa thanh toán)

**Status values**:
- `"pending"`: Chờ thanh toán
- `"paid"`: Đã thanh toán
- `"failed"`: Thanh toán thất bại
- `"refunded"`: Đã hoàn tiền

---

## 3️⃣ Webhook Momo Callback

### Endpoint
```
POST /api/payments/webhook/momo-callback
```

### Public (No Auth Required)

### Input (from Momo)
```json
{
  "orderId": "BK-ABC123",
  "amount": 150000,
  "payStatus": 0,
  "transId": "TX-...",
  "requestId": "...",
  "resultCode": 0,
  "resultMessage": "Success"
}
```

### Response (200 OK)
```json
{
  "success": true,
  "message": "Xác nhận thanh toán thành công"
}
```

### Business Logic
🔄 Cần verify:
- [ ] Verify signature Momo
- [ ] Idempotent (nếu đã xử lý → bỏ qua)
- [ ] Khi resultCode === 0:
  - Update Payments_Admin.PaymentStatus = 'paid'
  - Update Payments_Admin.MomoTransactionID
  - Update Payments_Admin.MomoRequestID
  - Update Bookings.PaymentStatus = 'paid'
  - Link Bookings.PaymentID nếu chưa
  - Ghi Wallet_Transactions:
    - Credit shop 95% (netToShop)
    - Platform fee 5% (platformFee)
  - Tạo Notifications cho user/shop
  - Ghi Payment_Logs

---

## 4️⃣ Confirm Payment (Dev/Testing)

### Endpoint
```
POST /api/payments/:paymentID/confirm
```

### Authentication
✅ Required (requireAuth middleware)

### Response (200 OK)
```json
{
  "success": true,
  "message": "Xác nhận thanh toán thành công",
  "data": {
    "success": true,
    "paymentID": 123,
    "bookingCode": "BK-ABC123",
    "amountToPay": 150000,
    "platformFee": 7500,
    "netToShop": 142500
  }
}
```

### Business Logic
✅ Implemented:
- Thực hiện cùng logic như webhook success
- Để test thanh toán mà không cần Momo

---

## 📦 Momo Integration (ENV Variables)

### Required in .env
```bash
MOMO_PARTNER_CODE=MOMO
MOMO_ACCESS_KEY=F8BBA842ECF85
MOMO_SECRET_KEY=K951B6PE1waDMi640xX08PD3vg6EkVlz
MOMO_ENDPOINT=https://test-payment.momo.vn
FRONTEND_BASE_URL=http://localhost:5173
BACKEND_BASE_URL=http://localhost:5050/api
```

### Momo Request
```
amount: Tổng tiền thực từ booking
orderId: bookingCode
requestId: UUID (unique ID)
returnUrl: ${FRONTEND_BASE_URL}/payment/${bookingCode}?rt=/booking/${bookingId}
notifyUrl: ${BACKEND_BASE_URL}/payments/webhook/momo-callback
```

---

## 📋 Booking Detail API

### Endpoint
```
GET /api/bookings/:bookingCode
```

### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "BookingCode": "BK-ABC123",
    "BookingID": 30,
    "FieldCode": 5,
    "UserID": 1,
    "TotalPrice": 150000,
    "PaymentStatus": "pending|paid|failed",
    "BookingStatus": "pending|confirmed|cancelled|completed",
    "CreatedAt": "2025-10-20T09:00:00Z"
  }
}
```

### Business Logic
- Return BookingID (numeric) để FE redirect đúng
- Hoặc không cần nếu endpoint initiate/status đã return bookingId

---

## 🔄 Payment Flow Diagram

```
1. Frontend
   POST /api/payments/bookings/:bookingCode/initiate
   ↓
2. Backend
   - Check booking exists & not paid
   - Create Payment record
   - Call Momo API
   - Return: paymentID, qr_code, momo_url, amount, expiresIn, bookingId
   ↓
3. Frontend
   Display QR code or redirect to momo_url
   Poll GET /api/payments/bookings/:bookingCode/status
   ↓
4. Customer
   Scan QR & pay via Momo app
   ↓
5. Momo
   POST /api/payments/webhook/momo-callback
   ↓
6. Backend
   Verify signature → Process payment → Update DB → Create notification
   ↓
7. Frontend (polling)
   Detect status = "paid"
   Redirect to /booking/:bookingId or /payment/:bookingCode
```

---

## ✅ Implementation Checklist

### CORS
- [x] Allow origin: http://localhost:5173
- [x] Methods: GET, POST, PATCH, OPTIONS
- [x] Headers: Authorization, Content-Type
- [x] Credentials: false

### Initiate Payment
- [x] Response fields: paymentID, qr_code, momo_url, amount, expiresIn, bookingId
- [x] Khớp spec FE đang dùng
- [ ] Test với real booking

### Poll Status
- [x] Response fields: paymentID, bookingCode, bookingId, amount, status, paidAt
- [x] Khớp spec FE
- [ ] Test polling logic

### Webhook
- [ ] Verify signature
- [ ] Idempotent handling
- [ ] Update payment status
- [ ] Credit wallet
- [ ] Create notifications

### Confirm Payment
- [x] POST /api/payments/:paymentID/confirm
- [x] Same logic as webhook
- [ ] Test endpoint

### Momo Integration
- [x] ENV variables documented
- [ ] Test with Momo API
- [ ] Verify returnUrl & notifyUrl

---

## 🧪 Testing Checklist

```bash
# 1. Test Initiate Payment
curl -X POST http://localhost:5050/api/payments/bookings/BK-ABC123/initiate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"payment_method":"momo"}'

# Expected: paymentID, qr_code, momo_url, bookingId

# 2. Test Poll Status
curl -X GET http://localhost:5050/api/payments/bookings/BK-ABC123/status

# Expected: status, paymentID, bookingId

# 3. Test Confirm (for dev)
curl -X POST http://localhost:5050/api/payments/123/confirm \
  -H "Authorization: Bearer <token>"

# Expected: success true, payment updated

# 4. Test CORS
curl -X OPTIONS http://localhost:5050/api/payments/bookings/BK-ABC123/initiate \
  -H "Origin: http://localhost:5173"

# Expected: CORS headers returned
```

---

## 📝 Frontend Integration

### Step 1: Initiate Payment
```typescript
const response = await axios.post(
  'http://localhost:5050/api/payments/bookings/:bookingCode/initiate',
  { payment_method: 'momo' },
  { headers: { Authorization: `Bearer ${token}` } }
);

const {
  paymentID,
  qr_code,
  momo_url,
  amount,
  expiresIn,
  bookingId
} = response.data.data;

// Display QR or redirect to momo_url
// Redirect on success: /payment/:bookingCode or /booking/:bookingId
```

### Step 2: Poll Status
```typescript
const pollStatus = async () => {
  const response = await axios.get(
    'http://localhost:5050/api/payments/bookings/:bookingCode/status'
  );
  
  const { status, bookingId } = response.data.data;
  
  if (status === 'paid') {
    // Redirect to booking detail or payment result page
    navigate(`/booking/${bookingId}`);
  }
};

// Poll every 2-3 seconds
```

---

## 🚀 Status

- ✅ CORS: Ready
- ✅ Initiate Payment: Ready
- ✅ Poll Status: Ready
- 🔄 Webhook: Needs verification & idempotent check
- ✅ Confirm Payment: Ready
- 📝 Momo Integration: ENV documented, needs testing

---

**Next Steps**:
1. Verify webhook signature implementation
2. Add idempotent check for webhook
3. Test with real bookings
4. Deploy to production

