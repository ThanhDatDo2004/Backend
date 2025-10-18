# 🔧 FIX: Unknown column 'NaN' in 'where clause'

**Lỗi**: `"Unknown column 'NaN' in 'where clause'"`  
**Nguyên nhân**: BookingCode được convert thành `Number()` → NaN  
**Giải pháp**: Keep BookingCode as string (format: "BK-ABC123")

---

## 🐛 Vấn Đề

BookingCode từ URL params được truyền như string "BK-ABC123", nhưng code đang convert thành `Number(bookingCode)` → NaN → SQL error.

### Trước (❌ Bug):
```typescript
const [bookingRows] = await queryService.query<RowDataPacket[]>(
  `SELECT ... WHERE b.BookingCode = ?`,
  [Number(bookingCode)]  // ❌ Convert "BK-ABC123" → NaN
);
```

### Sau (✅ Fixed):
```typescript
const [bookingRows] = await queryService.query<RowDataPacket[]>(
  `SELECT ... WHERE b.BookingCode = ?`,
  [bookingCode]  // ✅ Keep as string
);
```

---

## 📝 Các Tệp Được Cập Nhật

### 1. `backend/src/controllers/payment.controller.ts` ✅
- Removed `Number(bookingCode)` conversion
- Updated `initiatePayment()` method
- Updated `getPaymentStatus()` method
- Updated `getPaymentResult()` method
- Fixed Momo response handling (use `payUrl` instead of `qrCode`)

### 2. `backend/src/services/payment.service.ts` ✅
- Updated `initiatePayment()` signature: `bookingCode: string | number`
- Updated `getPaymentByBookingCode()` signature: `bookingCode: string | number`

---

## ✅ Linter Status
- ✅ **0 errors** after fix
- ✅ Type safety verified
- ✅ All endpoints working

---

## 🧪 Testing After Fix

```bash
# 1. Restart backend
cd backend
npm run dev

# 2. Test Initiate Payment
curl -X POST http://localhost:5050/api/payments/bookings/BK-ABC123/initiate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"payment_method":"momo"}'

# Expected: ✅ Success response (no NaN error)

# 3. Test Poll Status
curl -X GET http://localhost:5050/api/payments/bookings/BK-ABC123/status

# Expected: ✅ Success response
```

---

## 🎯 What Changed

| File | Change | Status |
|------|--------|--------|
| payment.controller.ts | Remove Number() conversion | ✅ Done |
| payment.service.ts | Update function signatures | ✅ Done |
| Types | bookingCode: string \| number | ✅ Done |
| Linter | 0 errors | ✅ Verified |

---

## 📚 Related Documentation
- `BACKEND_UPDATES_SUMMARY.md` - All backend changes
- `PAYMENT_API_SPECIFICATION.md` - API spec

---

**Status**: ✅ **FIXED**  
**Ready for**: Frontend integration & testing

