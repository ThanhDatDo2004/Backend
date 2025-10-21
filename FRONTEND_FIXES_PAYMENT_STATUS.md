# ⚠️ FRONTEND FIXES REQUIRED - PaymentStatus Logic

**Gửi cho Frontend Team ngay lập tức**

---

## 🐛 Problem

Bạn nói: "Vẫn khoá luôn ô chọn giờ mặc dù mới chỉ chọn 1 sân trong khung giờ đó"

**Nguyên nhân:** Frontend không sử dụng API response đúng cách

---

## ✅ Backend Đã Sửa

Backend giờ return API đúng:

### API Response (Ví dụ):
```json
GET /api/fields/68/available-quantities?playDate=2025-10-21&startTime=08:00&endTime=09:00

Response:
{
  "availableCount": 3,
  "availableQuantities": [
    {"quantity_id": 22, "quantity_number": 1},
    {"quantity_id": 24, "quantity_number": 3},
    {"quantity_id": 25, "quantity_number": 4}
  ],
  "bookedQuantities": [
    {"quantity_id": 23, "quantity_number": 2}
  ]
}
```

**Ý nghĩa:**
- `availableCount: 3` = Còn 3 sân trống
- Sân 2 là booked (vì PaymentStatus = 'paid')
- Sân 1,3,4 vẫn available

---

## ❌ Frontend Vấn Đề (Hiện Tại)

Frontend đang làm sai:

```javascript
// WRONG - Frontend vẫn đang làm cái này
if (availableCount === 0) {
  lockTimeSlot();  // ❌ Khoá luôn khung giờ
  hideAllCourts();
}
```

**Kết quả:** Khung giờ bị khoá mặc dù còn 3 sân trống ❌

---

## ✅ Frontend Phải Sửa

### Fix 1: Chỉ Khoá Khi Tất Cả Sân Đều Booked

```javascript
// CORRECT
const response = await fetch(
  `/api/fields/68/available-quantities?playDate=2025-10-21&startTime=08:00&endTime=09:00`
);
const data = await response.json();

// Kiểm tra availableCount
if (data.data.availableCount === 0) {
  // Chỉ khoá khi TẤT CẢ sân đều booked
  return lockTimeSlot("Không có sân nào trống");
} else {
  // Nếu còn sân trống → HIỆN DANH SÁCH SÂN
  showAvailableCourts(data.data.availableQuantities);
  enableBooking();
}
```

---

### Fix 2: Hiển Thị Danh Sách Sân Trống

**Từ API, frontend nhận được:**
```json
"availableQuantities": [
  {"quantity_id": 22, "quantity_number": 1},
  {"quantity_id": 24, "quantity_number": 3},
  {"quantity_id": 25, "quantity_number": 4}
]
```

**Frontend phải render:**
```html
Chọn sân:
☑ Sân 1 (trống)      ← User click để chọn
☐ Sân 2 (đã được đặt) ← Disabled
☑ Sân 3 (trống)      ← User click để chọn
☑ Sân 4 (trống)      ← User click để chọn

[Đặt sân]
```

**Code:**
```javascript
// Render available courts
const coursesList = data.data.availableQuantities.map(court => (
  <label key={court.quantity_id}>
    <input
      type="radio"
      name="court"
      value={court.quantity_id}
      onChange={(e) => setSelectedCourt(Number(e.target.value))}
    />
    Sân {court.quantity_number}
  </label>
));

// Render booked courts (disabled)
const bookedList = data.data.bookedQuantities.map(court => (
  <label key={court.quantity_id} className="disabled">
    <input
      type="radio"
      name="court"
      disabled
    />
    Sân {court.quantity_number} (đã được đặt)
  </label>
));
```

---

### Fix 3: Tất Cả Sân Booked → Khoá Khung Giờ

**Khi availableCount = 0:**

```javascript
if (data.data.availableCount === 0) {
  // Tất cả sân đều booked → Khoá khung giờ
  return (
    <div className="time-slot locked">
      <span className="time">08:00 - 09:00</span>
      <span className="status">Không có sân nào trống</span>
    </div>
  );
}

// Nếu còn sân → Hiển thị bình thường
return (
  <div className="time-slot available">
    <span className="time">08:00 - 09:00</span>
    <div className="courts">
      {availableCourts} {/* Danh sách sân trống */}
    </div>
  </div>
);
```

---

## 📊 So Sánh Before vs After

### Before (❌ Sai)
```
Khung giờ 08:00-09:00: [KHOÁ] ❌
(Hiển thị khoá mặc dù Sân 1,3,4 vẫn trống)
```

### After (✅ Đúng)
```
Khung giờ 08:00-09:00: [TRỐNG]
Chọn sân:
  ☑ Sân 1
  ☐ Sân 2 (đã được đặt)
  ☑ Sân 3
  ☑ Sân 4
```

---

## 🎯 Frontend Checklist

- [ ] Fix 1: Chỉ lock khi availableCount = 0
- [ ] Fix 2: Hiển thị availableQuantities từ API
- [ ] Fix 3: Render available courts as selectable
- [ ] Fix 4: Render booked courts as disabled
- [ ] Fix 5: Let user select available court
- [ ] Test: 1 court booked → show 3 available
- [ ] Test: All 4 courts booked → lock slot
- [ ] Test: No courts booked → show all 4

---

## 💡 Key Logic

**Backend API trả về:**
```
availableCount: số sân còn trống
availableQuantities: danh sách sân trống (quantity_id, quantity_number)
bookedQuantities: danh sách sân đã booked
```

**Frontend phải:**
```javascript
if (availableCount === 0) {
  // Toàn bộ sân booked → Khoá khung giờ
  lockSlot();
} else {
  // Còn sân trống → Hiển thị danh sách sân
  showCourts(availableQuantities);
  enableSelection();
}
```

---

## 🔗 API Integration

### Step 1: Fetch Available Courts
```javascript
async function getAvailableCourts(fieldCode, playDate, startTime, endTime) {
  const response = await fetch(
    `/api/fields/${fieldCode}/available-quantities?playDate=${playDate}&startTime=${startTime}&endTime=${endTime}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  return response.json();
}
```

### Step 2: Check Availability
```javascript
const data = await getAvailableCourts(68, '2025-10-21', '08:00', '09:00');

if (data.data.availableCount === 0) {
  // Lock time slot
  showError('Không có sân nào trống');
} else {
  // Show available courts
  renderCourts(data.data.availableQuantities, data.data.bookedQuantities);
}
```

### Step 3: Send Booking
```javascript
// User selects court (e.g., Sân 1 with quantity_id = 22)
const bookingData = {
  fieldCode: 68,
  quantity_id: 22,  // ← Selected court
  playDate: '2025-10-21',
  startTime: '08:00',
  endTime: '09:00',
  customerName: 'User',
  customerEmail: 'user@email.com',
  customerPhone: '0123456789'
};

const response = await fetch('/api/bookings/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(bookingData)
});
```

---

## ✅ Test Scenarios

### Test 1: Only 1 Court Booked (Sân 2)
```
Call API
↓
Response: availableCount = 3
↓
Frontend should show:
  ☑ Sân 1
  ☐ Sân 2 (đã được đặt)
  ☑ Sân 3
  ☑ Sân 4
↓
NOT lock the slot ✅
```

### Test 2: All Courts Booked
```
Call API
↓
Response: availableCount = 0
↓
Frontend should:
  Lock entire time slot ✅
  Show: "Không có sân nào trống"
```

### Test 3: No Courts Booked
```
Call API
↓
Response: availableCount = 4
↓
Frontend should show all 4 courts ✅
```

---

## 📝 Summary

| Item | Current (❌) | Should Be (✅) |
|------|--------------|---------------|
| **availableCount = 3** | Lock slot | Show 3 courts |
| **availableCount = 0** | Lock slot | Lock slot |
| **Show courts** | ❌ Never | ✅ When available |
| **User selection** | ❌ Blocked | ✅ Enabled |
| **API usage** | ❌ Ignored | ✅ Used properly |

---

## 🚀 Implementation Priority

1. **Urgent:** Fix availableCount check (only lock when 0)
2. **Urgent:** Show available courts list
3. **Important:** Let user select court
4. **Important:** Send quantity_id when booking

---

**Backend is ready!** Frontend just needs to use the API response correctly.

