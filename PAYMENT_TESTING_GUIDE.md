# 🧪 PAYMENT TESTING GUIDE - Debug 404 Errors

**Lỗi**: "Không tìm thấy booking" hoặc "Không tìm thấy payment"  
**Nguyên nhân**: Booking chưa tạo hoặc BookingCode format không đúng  

---

## 🔍 STEP 1: Check Booking Exists

### A. Check BookingCode Format
BookingCode trong DB có format gì? (VD: số, string "BK-...", etc?)

```bash
# Connect to MySQL
mysql -u root -p your_database

# Query bookings
SELECT BookingCode, FieldCode, UserID, TotalPrice, PaymentStatus 
FROM Bookings 
LIMIT 5;
```

**Output sẽ hiển thị**:
```
BookingCode | FieldCode | UserID | TotalPrice | PaymentStatus
BK-ABC123   | 5         | 1      | 150000     | pending
...
```

### B. Verify BookingCode Before Testing
```bash
# Use actual BookingCode from DB, VD:
curl -X GET http://localhost:5050/api/bookings/BK-ABC123

# Expected: ✅ Success (return booking details)
```

---

## 🔧 STEP 2: Complete Payment Flow

### ✅ Correct Sequence:

```bash
# 1. Get real BookingCode from database
BookingCode="BK-ABC123"
Token="your_jwt_token"

# 2. Create payment (MUST do this first!)
curl -X POST http://localhost:5050/api/payments/bookings/${BookingCode}/initiate \
  -H "Authorization: Bearer ${Token}" \
  -H "Content-Type: application/json" \
  -d '{"payment_method":"momo"}'

# Expected response:
# {
#   "success": true,
#   "data": {
#     "paymentID": 123,
#     "qr_code": "...",
#     "momo_url": "...",
#     "amount": 150000,
#     "expiresIn": 900,
#     "bookingId": "BK-ABC123"
#   }
# }

# Save the paymentID for later

# 3. Poll status (AFTER creating payment)
curl -X GET http://localhost:5050/api/payments/bookings/${BookingCode}/status

# Expected: status = "pending"

# 4. Confirm payment (for testing)
PaymentID=123  # from step 2 response
curl -X POST http://localhost:5050/api/payments/${PaymentID}/confirm \
  -H "Authorization: Bearer ${Token}"

# Expected: status updated to "paid"

# 5. Check status again
curl -X GET http://localhost:5050/api/payments/bookings/${BookingCode}/status

# Expected: status = "paid"

# 6. Get payment result
curl -X GET http://localhost:5050/api/payments/result/${BookingCode}

# Expected: ✅ Full payment result data
```

---

## 🐛 Common Issues & Fixes

### ❌ Error: "Không tìm thấy booking"

**Cause 1**: BookingCode không tồn tại trong DB
```bash
# Solution: Check DB
SELECT COUNT(*) FROM Bookings WHERE BookingCode = 'BK-ABC123';

# If count = 0 → Tạo booking trước
```

**Cause 2**: BookingCode format sai
```bash
# VD: Nếu DB có "123" nhưng dùng "BK-123"
# Fix: Dùng format chính xác từ DB
```

**Cause 3**: Field tên khác
```bash
# Check column name trong DB
DESCRIBE Bookings;

# Nếu là "Booking_Code" thay vì "BookingCode"
# Cần sửa SQL query
```

---

### ❌ Error: "Không tìm thấy payment"

**Cause 1**: Initiate Payment chưa được gọi
```bash
# Solution: Call initiate BEFORE status
curl -X POST /api/payments/bookings/BK-ABC123/initiate  # Do this first!
curl -X GET /api/payments/bookings/BK-ABC123/status    # Then this
```

**Cause 2**: BookingCode format không khớp
```bash
# Payment record được tạo với một format
# Nhưng query dùng format khác
# → Ensure BookingCode format consistent
```

---

## 🛠️ Debugging Steps

### Step 1: Check Database Connection
```bash
# Test backend can connect to MySQL
curl -X GET http://localhost:5050/api/health

# Expected: { "status": "OK" }
```

### Step 2: Check Booking Data
```bash
# Check if booking exists with exact BookingCode
curl -X GET http://localhost:5050/api/bookings/BK-ABC123

# If 404 → Booking doesn't exist
# If 200 → Booking exists, but payment might not
```

### Step 3: Check Payment Table
```bash
# MySQL query
SELECT * FROM Payments_Admin WHERE BookingCode = 'BK-ABC123';

# If empty → Payment not created yet
# Need to call initiate endpoint first
```

### Step 4: Check SQL Columns
```bash
# Verify table structure
DESCRIBE Bookings;
DESCRIBE Payments_Admin;

# Ensure BookingCode columns match
# Check if column is varchar, int, etc
```

---

## 📊 Complete Test Scenario

```bash
#!/bin/bash

# Configuration
API="http://localhost:5050/api"
BookingCode="BK-TEST-$(date +%s)"  # Generate unique code
Token="your_jwt_token"

echo "🧪 Payment Flow Test"
echo "========================"

# 1. Create Booking (if needed)
echo "1️⃣ Creating booking..."
# Call booking endpoint to create

# 2. Initiate Payment
echo "2️⃣ Initiating payment..."
InitResponse=$(curl -s -X POST "$API/payments/bookings/$BookingCode/initiate" \
  -H "Authorization: Bearer $Token" \
  -H "Content-Type: application/json" \
  -d '{"payment_method":"momo"}')

echo "$InitResponse" | jq .

# Extract paymentID
PaymentID=$(echo "$InitResponse" | jq -r '.data.paymentID')
echo "PaymentID: $PaymentID"

# 3. Poll Status
echo "3️⃣ Polling status..."
StatusResponse=$(curl -s -X GET "$API/payments/bookings/$BookingCode/status")
echo "$StatusResponse" | jq .

# 4. Confirm Payment
echo "4️⃣ Confirming payment..."
ConfirmResponse=$(curl -s -X POST "$API/payments/$PaymentID/confirm" \
  -H "Authorization: Bearer $Token")
echo "$ConfirmResponse" | jq .

# 5. Poll Status Again
echo "5️⃣ Checking updated status..."
UpdatedStatus=$(curl -s -X GET "$API/payments/bookings/$BookingCode/status")
echo "$UpdatedStatus" | jq .

# 6. Get Result
echo "6️⃣ Getting payment result..."
ResultResponse=$(curl -s -X GET "$API/payments/result/$BookingCode")
echo "$ResultResponse" | jq .

echo "✅ Test Complete"
```

---

## ✅ What to Check

- [ ] Booking exists in DB with exact BookingCode
- [ ] BookingCode format matches (string vs number)
- [ ] Initiate payment called BEFORE status check
- [ ] PaymentID returned from initiate endpoint
- [ ] Payment record created in Payments_Admin table
- [ ] No SQL errors in backend logs

---

## 📝 Backend Logs

```bash
# Check backend console for errors
# Terminal running: npm run dev

# Look for:
- "Không tìm thấy booking" → Check DB
- "Unknown column" → Check SQL syntax
- "Connection error" → Check DB connection
```

---

## 🎯 Quick Fixes

### If Booking 404:
```bash
# 1. Create booking first
POST /api/bookings/create

# 2. Note the BookingCode
# 3. Use it for payment endpoints
```

### If Payment 404:
```bash
# 1. Call initiate payment first
POST /api/payments/bookings/:bookingCode/initiate

# 2. Wait for response
# 3. Then call status/result endpoints
```

---

**Status**: Ready to debug  
**Next**: Run test scenarios and check DB

