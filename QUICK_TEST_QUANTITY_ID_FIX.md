# ⚡ Quick Test: QuantityID Fix

## 🔧 Restart Backend

```bash
# Terminal 1: Kill old backend
lsof -i :5050 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Terminal 2: Restart backend
cd /Users/home/Downloads/tsNode-temp-master/backend
npm run dev
```

---

## ✅ Test 1: Direct API Call

**Using curl:**
```bash
curl -X POST http://localhost:5050/api/bookings/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldCode": 68,
    "quantity_id": 4,
    "playDate": "2025-10-21",
    "startTime": "08:00",
    "endTime": "10:00",
    "customerName": "Test User",
    "customerEmail": "test@example.com",
    "customerPhone": "0123456789"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Tạo booking thành công",
  "data": {
    "bookingCode": 82,
    "totalPrice": 1000,
    "fieldName": "Sân 00"
  }
}
```

---

## 🗄️ Test 2: Database Verification

**Run this SQL query:**
```sql
SELECT 
  BookingCode,
  FieldCode,
  QuantityID,
  BookingStatus
FROM Bookings
WHERE BookingCode = 82;
```

**Expected Result:**
```
BookingCode | FieldCode | QuantityID | BookingStatus
82          | 68        | 4          | pending  ✅
```

**❌ If QuantityID is still NULL:**
- Backend service didn't restart
- Try killing backend completely:
  ```bash
  lsof -i :5050
  kill -9 <PID>
  npm run dev
  ```

---

## 📋 Test 3: Full Workflow

### Step 1: Create Booking with Quantity 4
```bash
# POST /api/bookings/create
{
  "fieldCode": 68,
  "quantity_id": 4,
  "playDate": "2025-10-21",
  "startTime": "08:00",
  "endTime": "10:00",
  "customerName": "User A",
  "customerEmail": "a@test.com",
  "customerPhone": "0111111111"
}
```
✅ Should succeed, BookingCode = 82

### Step 2: Verify Database
```sql
SELECT BookingCode, FieldCode, QuantityID FROM Bookings WHERE BookingCode = 82;
-- Should show: 82 | 68 | 4 ✅
```

### Step 3: Try to Book Same Quantity
```bash
# POST /api/bookings/create (same quantity_id, same time)
{
  "fieldCode": 68,
  "quantity_id": 4,
  "playDate": "2025-10-21",
  "startTime": "08:00",
  "endTime": "10:00",
  "customerName": "User B",
  "customerEmail": "b@test.com",
  "customerPhone": "0222222222"
}
```
❌ Should FAIL with: "Sân này đã được đặt trong khung giờ này"

### Step 4: Book Different Quantity (Same Time)
```bash
# POST /api/bookings/create (quantity_id = 3, same time)
{
  "fieldCode": 68,
  "quantity_id": 3,
  "playDate": "2025-10-21",
  "startTime": "08:00",
  "endTime": "10:00",
  "customerName": "User C",
  "customerEmail": "c@test.com",
  "customerPhone": "0333333333"
}
```
✅ Should succeed, BookingCode = 83

### Step 5: Verify Both Bookings
```sql
SELECT BookingCode, FieldCode, QuantityID FROM Bookings 
WHERE FieldCode = 68 AND BookingCode IN (82, 83)
ORDER BY BookingCode;

-- Should show:
-- BookingCode | FieldCode | QuantityID
-- 82          | 68        | 4  ✅
-- 83          | 68        | 3  ✅
```

---

## 🎯 Expected Behavior After Fix

| Test | Before | After |
|------|--------|-------|
| Create booking with quantity_id | ✅ Success | ✅ Success |
| QuantityID in Bookings table | ❌ NULL | ✅ Saved (4) |
| QuantityID in Field_Slots | ❌ NULL | ✅ Saved (4) |
| Book same court twice | ✅ Allowed (BUG) | ❌ Blocked (FIXED) |
| Book different court same time | ✅ Works | ✅ Works |

---

## 🚨 Troubleshooting

### Issue: Still getting QuantityID = NULL

**Cause:** Backend not restarted with new code

**Solution:**
```bash
# Kill backend process
pkill -f "npm run dev"

# Make sure file is saved
ls -la /Users/home/Downloads/tsNode-temp-master/backend/src/controllers/booking.controller.ts

# Restart
npm run dev
```

### Issue: Getting "Cannot read properties of undefined"

**Cause:** Syntax error in controller

**Solution:**
```bash
# Check for syntax errors
cd /Users/home/Downloads/tsNode-temp-master/backend
npm run build
```

### Issue: POST returns 500 error

**Cause:** Database connection or query error

**Solution:**
```bash
# Check backend logs
# Look for the specific error message
# Verify Field_Quantity table exists:
SELECT * FROM Field_Quantity WHERE FieldCode = 68;
```

---

## 📊 Summary

✅ **What was fixed:**
- QuantityID now properly saved in Bookings table
- QuantityID now properly saved in Field_Slots table
- Court-specific booking conflict detection works
- Multiple courts can be booked at same time (different QuantityID)

✅ **Test it now:**
1. Restart backend
2. Send POST /api/bookings/create with quantity_id
3. Check database for QuantityID value
4. Try booking same court twice (should fail)
5. Try booking different court same time (should succeed)

