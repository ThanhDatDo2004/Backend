# 📋 FRONTEND BOOKING CHECKLIST

> **Backend đã READY!** Các fix sau đây đã được implement trên backend. Frontend team cần verify và integrate.

---

## 🎯 PRIORITY 1: CRITICAL FIXES

### ✅ Issue 1: Add Missing Routes
**Status:** FRONTEND ACTION NEEDED

**Routes cần thêm vào frontend router:**

```javascript
// Cần có route cho chi tiết booking:
{
  path: '/bookings/:bookingId',
  element: <BookingDetailPage />,  // Hiển thị booking details
  requireAuth: true
}

// Cần có route cho mã check-in:
{
  path: '/bookings/:bookingId/checkin-code',
  element: <CheckinCodePage />,  // Hiển thị mã check-in
  requireAuth: true
}
```

**Checklist:**
- [ ] Route `/bookings/:bookingId` đã add
- [ ] Route `/bookings/:bookingId/checkin-code` đã add
- [ ] Có page component cho booking detail
- [ ] Có page component cho checkin code
- [ ] Click "Xem Chi Tiết Booking" từ payment page → navigate đến `/bookings/:id`
- [ ] Click "Xem Mã Check-In" → navigate đến `/bookings/:id/checkin-code`

---

### ✅ Issue 2: Send Customer Info in Booking Payload
**Status:** FRONTEND ACTION NEEDED

**Frontend gửi lúc ấn "Xác nhận đặt sân" phải có:**

```javascript
// ❌ CŨ - Không gửi customer info:
POST /fields/:fieldCode/bookings/confirm
{
  "slots": [...],
  "payment_method": "bank_transfer",
  "total_price": 300000
}

// ✅ MỚI - Phải gửi customer info:
POST /fields/:fieldCode/bookings/confirm
{
  "slots": [
    {
      "play_date": "2025-10-25",
      "start_time": "18:00", 
      "end_time": "19:00"
    }
  ],
  "customer": {
    "name": "Nguyễn Văn A",        ← REQUIRED
    "email": "a@example.com",      ← REQUIRED
    "phone": "0912345678"          ← REQUIRED
  },
  "payment_method": "bank_transfer",
  "total_price": 300000
}
```

**Checklist:**
- [ ] Form ở Step 2 có fields: Tên, Email, Số điện thoại
- [ ] Lấy giá trị từ form fields
- [ ] Gửi trong `customer` object khi POST confirm booking
- [ ] Validate fields không được rỗng
- [ ] Email format validation
- [ ] Phone number validation

**Sample code:**
```javascript
// Form Step 2
const [formData, setFormData] = useState({
  customerName: '',
  customerEmail: '',
  customerPhone: ''
});

// Handle confirm
const handleConfirmBooking = async () => {
  // Validate
  if (!formData.customerName || !formData.customerEmail || !formData.customerPhone) {
    toast.error('Vui lòng điền đầy đủ thông tin');
    return;
  }
  
  const payload = {
    slots: selectedSlots,
    customer: {
      name: formData.customerName,
      email: formData.customerEmail,
      phone: formData.customerPhone
    },
    payment_method: 'bank_transfer',
    total_price: calculateTotal()
  };
  
  const response = await api.post(
    `/fields/${fieldCode}/bookings/confirm`,
    payload
  );
  
  // Success - navigate to payment
  navigate(`/payment/${response.data.booking_code}`);
};
```

---

### ✅ Issue 3: Implement Booking Detail Pages
**Status:** FRONTEND ACTION NEEDED

**Page: `/bookings/:bookingId` - Chi tiết booking**

```javascript
// Phải gọi API này:
GET /api/bookings/:bookingCode

// Response:
{
  "BookingCode": 42,
  "CustomerName": "Nguyễn Văn A",       ← Hiển thị tên người đặt
  "CustomerEmail": "a@example.com",     ← Hiển thị email
  "CustomerPhone": "0912345678",        ← Hiển thị SĐT
  "FieldName": "Sân Bóng Á Châu",
  "FieldCode": 48,
  "PlayDate": "2025-10-25",
  "StartTime": "18:00",
  "EndTime": "19:00",
  "TotalPrice": 300000,
  "BookingStatus": "confirmed",
  "PaymentStatus": "paid",
  "CheckinCode": "ABC123XYZ",
  "CreateAt": "2025-10-20 15:30:00",
  "slots": [...]
}
```

**Checklist:**
- [ ] Component hiển thị tất cả booking info
- [ ] Gọi `GET /api/bookings/:bookingId` khi component mount
- [ ] Handle loading state
- [ ] Handle error state (404, unauthorized, etc.)
- [ ] Hiển thị customer name, email, phone
- [ ] Hiển thị field name, date, time
- [ ] Hiển thị booking status (pending, confirmed, completed, cancelled)
- [ ] Hiển thị payment status (pending, paid, failed)
- [ ] Button "Xem Mã Check-In" (chỉ nếu BookingStatus = 'confirmed')

---

## 🎯 PRIORITY 2: SLOT AVAILABILITY UPDATES

### ✅ Issue 4: Update Slot Display Logic
**Status:** FRONTEND ACTION NEEDED

**Backend giờ trả về slot status khác:**

```javascript
// Old statuses:
"available"  → Có sẵn để đặt
"booked"     → Đã bị đặt

// New statuses (từ backend API):
"available"  → Có sẵn để đặt
"hold"       → Đang được hold (15 phút)
"booked"     → Đã lock vĩnh viễn (thanh toán rồi)
```

**Logic mới:**
- Slot status = `"available"` → Có thể đặt ✓
- Slot status = `"hold"` + `hold_expires_at` chưa hết → **KHÔNG** đặt (ai đó đang trong payment)
- Slot status = `"hold"` + `hold_expires_at` đã hết → Có thể đặt ✓ (hold expired)
- Slot status = `"booked"` → **KHÔNG** đặt (đã được lock)

**Update Frontend:**

```javascript
// API response từ GET /fields/:fieldCode/availability?date=...
// Sẽ có: status, hold_expires_at, is_available

// ❌ CŨ - Check status trực tiếp:
const isAvailable = slot.status === 'available';

// ✅ MỚI - Dùng is_available từ backend:
const isAvailable = slot.is_available === true;

// Backend đã tính toán thông minh:
// - Nếu hold đã expired → is_available = true
// - Nếu hold còn → is_available = false
// - Nếu booked → is_available = false
// - Nếu available → is_available = true
```

**Checklist:**
- [ ] Update slot selection logic: dùng `is_available` thay vì `status`
- [ ] Display hold status nếu slot đang hold (opsional)
- [ ] Show hold expiry time (opsional)
- [ ] Test: Chọn giờ → Check availability quay lại sau 5 phút → Giờ vẫn not available
- [ ] Test: Chọn giờ → Check availability quay lại sau 20 phút → Giờ vẫn available (hold expired)

**Sample code:**
```javascript
// Components/SlotPicker.tsx
const SlotPicker = ({ slots, onSelectSlots }) => {
  const [selectedSlots, setSelectedSlots] = useState<number[]>([]);
  
  const handleSlotClick = (slot: Slot) => {
    // ✅ Dùng is_available
    if (!slot.is_available) {
      toast.warning('Khung giờ này không còn khả dụng');
      return;
    }
    
    // Toggle selection
    const isSelected = selectedSlots.includes(slot.slot_id);
    if (isSelected) {
      setSelectedSlots(selectedSlots.filter(id => id !== slot.slot_id));
    } else {
      setSelectedSlots([...selectedSlots, slot.slot_id]);
    }
  };
  
  return (
    <div className="slot-grid">
      {slots.map(slot => (
        <button
          key={slot.slot_id}
          onClick={() => handleSlotClick(slot)}
          className={`
            slot-button
            ${!slot.is_available ? 'disabled' : ''}
            ${selectedSlots.includes(slot.slot_id) ? 'selected' : ''}
          `}
          disabled={!slot.is_available}
        >
          {slot.start_time} - {slot.end_time}
          {slot.status === 'held' && (
            <small>Đang hold</small>  // Optional display
          )}
        </button>
      ))}
    </div>
  );
};
```

---

## 🎯 PRIORITY 3: PAYMENT & CHECK-IN PAGES

### ✅ Issue 5: Payment Result Page Redirect
**Status:** FRONTEND ACTION NEEDED

**Flow hiện tại:**
1. User thanh toán thành công
2. SePay webhook → Backend xử lý
3. Frontend cần check payment status và redirect

**Thay đổi:**
```javascript
// Payment page - Sau khi SePay xác nhận thanh toán
useEffect(() => {
  const checkPaymentStatus = async () => {
    const response = await api.get(
      `/api/payments/bookings/${bookingCode}/status`
    );
    
    if (response.data.status === 'paid') {
      // Thanh toán thành công
      // Navigate to result page
      navigate(`/payment/${bookingCode}/transfer`);
      // hoặc
      navigate(`/payment/${bookingCode}/result`);
    }
  };
  
  // Check mỗi 3 giây
  const interval = setInterval(checkPaymentStatus, 3000);
  
  return () => clearInterval(interval);
}, [bookingCode]);
```

**Checklist:**
- [ ] Payment page polling `/api/payments/bookings/:bookingCode/status`
- [ ] Check `status` field: "pending", "paid", "failed"
- [ ] Redirect đến result page khi `status === "paid"`
- [ ] Show error nếu `status === "failed"`
- [ ] Result page display booking + payment confirmation

---

### ✅ Issue 6: Check-In Code Page
**Status:** FRONTEND ACTION NEEDED

**Page: `/bookings/:bookingId/checkin-code`**

```javascript
// Phải gọi API này:
GET /api/bookings/:bookingCode/checkin-code

// Response:
{
  "bookingCode": 42,
  "checkinCode": "ABC123XYZ"  ← Hiển thị QR code hoặc text
}

// Hoặc lấy từ booking detail:
GET /api/bookings/:bookingCode
{
  "CheckinCode": "ABC123XYZ",
  ...
}
```

**Checklist:**
- [ ] Component hiển thị mã check-in (text + QR code)
- [ ] Gọi `GET /api/bookings/:bookingCode/checkin-code`
- [ ] Handle loading/error states
- [ ] QR code generation từ `checkinCode`
- [ ] Button "Copy mã" để copy to clipboard
- [ ] Show: "Mã check-in chỉ có sẵn khi booking đã confirmed"

---

## 🧪 TESTING CHECKLIST

### Test 1: Customer Info Persistence
```
1. Navigate to /booking/48
2. Select time slot
3. Go to Step 2
4. Fill: Name, Email, Phone
5. Click "Xác nhận đặt sân"
6. Verify: Booking created
   - Call GET /api/bookings/:id
   - Check CustomerName, Email, Phone are saved ✓
```

### Test 2: Slot Hold Behavior (15 min)
```
1. Select time slot → Click "Xác nhận"
2. Check availability immediately
   - GET /fields/48/availability?date=2025-10-25
   - Slot should show: is_available = false ✓
   - Status = 'held'
3. Wait 5 minutes
   - Check again
   - is_available should still = false ✓
4. Wait 20 minutes total
   - Check again  
   - is_available should = true ✓ (hold expired)
5. Go back to /booking/48
   - Slot should show as available again ✓
```

### Test 3: Payment Lock
```
1. Select slot + confirm booking
2. Payment page - Wait for webhook (mock payment)
3. Check availability after payment
   - GET /fields/48/availability
   - Slot should show: is_available = false ✓
   - Status = 'booked' (permanently locked)
4. Go back to /booking/48
   - Slot should NOT be available
   - Stay locked ✓
```

### Test 4: Booking Detail Page
```
1. After payment, navigate to /bookings/42
2. Verify:
   - [ ] No 404 error
   - [ ] CustomerName displayed
   - [ ] CustomerEmail displayed
   - [ ] CustomerPhone displayed
   - [ ] FieldName displayed
   - [ ] PlayDate & Time displayed
   - [ ] BookingStatus = 'confirmed'
   - [ ] PaymentStatus = 'paid'
```

### Test 5: Check-In Code Page
```
1. Navigate to /bookings/42/checkin-code
2. Verify:
   - [ ] No 404 error
   - [ ] CheckinCode displayed (e.g., "ABC123XYZ")
   - [ ] QR code generated from code
   - [ ] "Copy mã" button works
```

---

## 📝 Database Schema (If Not Already Added)

**Run these migrations:**

```sql
-- Check if columns exist
SHOW COLUMNS FROM Field_Slots LIKE 'HoldExpiresAt';
SHOW COLUMNS FROM Bookings LIKE 'CustomerName';

-- If not exist, add:
ALTER TABLE Field_Slots 
ADD COLUMN HoldExpiresAt DATETIME NULL;

ALTER TABLE Bookings 
ADD COLUMN CustomerName VARCHAR(255) NULL,
ADD COLUMN CustomerEmail VARCHAR(255) NULL,
ADD COLUMN CustomerPhone VARCHAR(20) NULL;
```

---

## 📦 Summary of Changes

| Issue | Backend | Frontend |
|-------|---------|----------|
| Customer info not saved | ✅ FIXED | ✓ Send in payload |
| Slot locked too early | ✅ FIXED | ✓ Use `is_available` |
| 404 on booking detail | ✅ FIXED | ✓ Add routes + pages |
| Hold slot handling | ✅ FIXED | ✓ Check after 15 min |
| Payment → Lock | ✅ FIXED | ✓ Poll status |
| Check-in code page | ✅ FIXED | ✓ Add page |

---

## 🔗 API Reference

**All endpoints ready on backend:**

```
POST /fields/:fieldCode/bookings/confirm
GET /api/bookings/:bookingCode
GET /api/bookings/:bookingCode/checkin-code
GET /api/payments/bookings/:bookingCode/status
GET /fields/:fieldCode/availability?date=YYYY-MM-DD
```

---

## 📞 Questions?

Refer to: `BOOKING_FLOW_FIX_FINAL.md` for detailed technical documentation

Backend Team - Let's sync if any issues! 🚀
