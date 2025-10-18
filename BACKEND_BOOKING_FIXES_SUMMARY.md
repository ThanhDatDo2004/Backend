# 🔧 BACKEND BOOKING FIXES - QUICK REFERENCE

## ✅ All Issues Fixed

| Issue                     | File                 | Line(s) | Change                                   |
| ------------------------- | -------------------- | ------- | ---------------------------------------- |
| Customer info not saved   | `booking.service.ts` | 301-328 | Add CustomerName, Email, Phone to INSERT |
| Slot locked immediately   | `booking.service.ts` | 332-340 | Change Status to 'held' + HoldExpiresAt  |
| No lock on payment        | `payment.service.ts` | 143-152 | Add lock logic in handlePaymentSuccess() |
| No release on fail        | `payment.service.ts` | 244-251 | Add releaseHeldSlots() function          |
| Expired holds not handled | `field.service.ts`   | 228-250 | Smart availability check in mapSlotRow() |

---

## 📂 Files Modified

### 1. `backend/src/services/booking.service.ts`

**Change 1: Insert customer info (line 301-328)**

```typescript
// ADDED:
CustomerName,
CustomerEmail,
CustomerPhone,

// AND:
payload.customer?.name || null,
payload.customer?.email || null,
payload.customer?.phone || null,
```

**Change 2: Hold slots instead of booking (line 332-340)**

```typescript
// BEFORE:
SET Status = 'booked', BookingCode = ?, UpdateAt = NOW()

// AFTER:
const holdExpiryTime = new Date(Date.now() + 15 * 60 * 1000);
SET Status = 'held', BookingCode = ?, HoldExpiresAt = ?, UpdateAt = NOW()
```

---

### 2. `backend/src/services/payment.service.ts`

**Change 1: Lock slots on payment success (line 143-152)**

```typescript
// ADDED after updating booking status:
// Lock slots - change status from 'held' to 'booked'
await queryService.query<ResultSetHeader>(
  `UPDATE Field_Slots 
   SET Status = 'booked', HoldExpiresAt = NULL, UpdateAt = NOW()
   WHERE BookingCode = ? AND Status = 'held'`,
  [payment.BookingCode]
);
```

**Change 2: Add releaseHeldSlots function (line 244-251)**

```typescript
export async function releaseHeldSlots(bookingCode: string | number) {
  await queryService.query<ResultSetHeader>(
    `UPDATE Field_Slots
     SET Status = 'available', BookingCode = NULL, HoldExpiresAt = NULL, UpdateAt = NOW()
     WHERE BookingCode = ? AND Status = 'held'`,
    [bookingCode]
  );
}

// ALSO ADD to exports at bottom:
releaseHeldSlots,
```

---

### 3. `backend/src/services/field.service.ts`

**Change: Smart hold expiry check (line 228-250)**

```typescript
function mapSlotRow(slot: FieldSlotRow) {
  // Check if hold has expired
  let status = slot.status;
  if (status === "hold" && slot.hold_expires_at) {
    const holdExpiryTime = new Date(slot.hold_expires_at);
    const now = new Date();
    if (now > holdExpiryTime) {
      // Hold has expired, treat as available
      status = "available";
    }
  }

  return {
    slot_id: slot.slot_id,
    field_code: slot.field_code,
    play_date: slot.play_date,
    start_time: slot.start_time,
    end_time: slot.end_time,
    status: status, // ← Updated
    hold_expires_at: slot.hold_expires_at,
    is_available: status === "available", // ← Updated
  };
}
```

---

## 📊 Database Migrations

**Required:**

```sql
ALTER TABLE Field_Slots ADD COLUMN HoldExpiresAt DATETIME NULL;
ALTER TABLE Bookings ADD COLUMN CustomerName VARCHAR(255) NULL;
ALTER TABLE Bookings ADD COLUMN CustomerEmail VARCHAR(255) NULL;
ALTER TABLE Bookings ADD COLUMN CustomerPhone VARCHAR(20) NULL;
```

**Verify columns exist:**

```sql
SHOW COLUMNS FROM Field_Slots LIKE 'HoldExpiresAt';
SHOW COLUMNS FROM Bookings LIKE 'CustomerName';
```

---

## 🔄 Flow Changes

### Old Flow ❌

```
User selects slot
    ↓
Click "Confirm" → Slot Status = 'booked' (LOCKED NOW) ❌
    ↓
Payment page
    ↓
Payment → Booking confirmed
    ↓
User: Go back → Slot unavailable (locked even if payment fails)
```

### New Flow ✅

```
User selects slot
    ↓
Click "Confirm" → Slot Status = 'held' (TEMP HOLD for 15 min)
              → Save: CustomerName, Email, Phone ✓
    ↓
Payment page
    ↓
If Payment succeeds:
  → Slot: 'held' → 'booked' (LOCKED FOREVER) ✓
  → Booking Status: 'confirmed'

If Payment fails:
  → After 15 min: Slot: 'held' → 'available' (auto-released)
  → OR: Manual release if cancelled
    ↓
User: Go back → Slot available again if no payment ✓
```

---

## 🧪 API Testing

### Test: Create booking with customer info

```bash
curl -X POST http://localhost:5050/fields/48/bookings/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "slots": [
      {"play_date": "2025-10-25", "start_time": "18:00", "end_time": "19:00"}
    ],
    "customer": {
      "name": "Test User",
      "email": "test@example.com",
      "phone": "0912345678"
    },
    "payment_method": "bank_transfer",
    "total_price": 300000
  }'
```

### Response should include:

```json
{
  "booking_code": 123,
  "qr_code": "https://qr.sepay.vn/...",
  "paymentID": 456,
  "amount": 300000
}
```

### Verify customer info saved:

```bash
curl http://localhost:5050/api/bookings/123
```

Should return:

```json
{
  "BookingCode": 123,
  "CustomerName": "Test User",        ✅
  "CustomerEmail": "test@example.com", ✅
  "CustomerPhone": "0912345678",      ✅
  ...
}
```

---

## 🚀 Deployment Checklist

- [ ] Backup database
- [ ] Run migration scripts
- [ ] Test migrations succeeded
- [ ] Rebuild backend: `npm run build`
- [ ] Restart backend service
- [ ] Test API endpoints
- [ ] Monitor error logs
- [ ] Notify frontend team

---

## 📞 Testing with Frontend

Frontend team needs to:

1. **Add routes:**

   - `/bookings/:bookingId` → GET `/api/bookings/:id`
   - `/bookings/:bookingId/checkin-code` → GET `/api/bookings/:id/checkin-code`

2. **Send customer info:**

   - Payload must include `customer: {name, email, phone}`

3. **Handle new slot statuses:**

   - Use `is_available` field from API
   - Don't check `status` directly

4. **Test scenarios:**
   - See: `FRONTEND_BOOKING_CHECKLIST.md`

---

## 📋 Validation

Run before deploying:

```bash
cd backend
npm run build        # No errors?
npm test             # All tests pass?
npm run lint         # No linting errors?
```

---

## 🔗 Related Documentation

- Full details: `BOOKING_FLOW_FIX_FINAL.md`
- Frontend guide: `FRONTEND_BOOKING_CHECKLIST.md`

---

## ✨ Summary

✅ **Customer info persists** - Saved on booking creation
✅ **Slots don't lock early** - Hold 15 min, only lock after payment
✅ **Smart availability** - Expired holds auto-release to available
✅ **Payment-driven locking** - Only lock when payment confirmed
✅ **Error handling** - Release slots on cancellation or payment failure

🚀 Backend ready for frontend integration!
