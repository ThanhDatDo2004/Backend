# Hướng Dẫn Frontend - Sửa Lỗi Held Slots

## 🎯 Tóm Tắt Vấn Đề & Giải Pháp

### Vấn Đề Cũ
❌ Khung giờ bị stuck ở trạng thái "held" → báo "đã được đặt" sau 15 phút  
❌ Không thể chọn khung giờ này dù đã hết 15 phút  

### Giải Pháp Mới
✅ Backend tự động chuyển "held" → "available" sau 15 phút  
✅ 3 lớp bảo vệ để đảm bảo dữ liệu nhất quán  

---

## 🔄 QUY TRÌNH HOẠT ĐỘNG

### Timeline 1: Người dùng chọn khung giờ
```
User: Chọn khung giờ 10:00 - 11:00
         ↓
Backend: Lưu slot với Status = 'held'
         ↓
Backend: Set HoldExpiresAt = NOW() + 15 phút
         ↓
Frontend: Hiện QR code để thanh toán
```

### Timeline 2: Hết 15 phút (Cleanup)

#### **Cách 1: User truy cập availability endpoint**
```
Frontend: GET /api/fields/48/availability?date=2025-10-22
    ↓
Backend: 
  1. Cleanup held slots expired
  2. Update Field_Slots set Status='available' 
  3. Return slots mới
    ↓
Frontend: Hiện khung giờ này là "available"
```

#### **Cách 2: Xác nhận booking mới**
```
Frontend: POST /api/fields/48/bookings/confirm
    ↓
Backend:
  1. Gọi releaseExpiredHeldSlots()
  2. Update held slots expired → available
  3. Xác nhận booking mới
```

#### **Cách 3: Cron job mỗi 1 phút**
```
Backend: setInterval(cleanupExpiredHeldSlots, 60s)
    ↓
Tự động cleanup toàn cục, ngay cả khi không có request
```

---

## 📱 API ENDPOINTS

### 1. GET /api/fields/{fieldCode}/availability

**Request:**
```
GET /api/fields/48/availability?date=2025-10-22
```

**Response:**
```json
{
  "data": {
    "field_code": 48,
    "date": "2025-10-22",
    "slots": [
      {
        "slot_id": 1,
        "field_code": 48,
        "play_date": "2025-10-22",
        "start_time": "10:00",
        "end_time": "11:00",
        "status": "available",  // ✅ Tự động cập nhật
        "is_available": true
      },
      // ... more slots
    ]
  },
  "message": "Fetched field availability successfully"
}
```

**Chi tiết:**
- ✅ Mỗi lần call, backend tự động cleanup expired held slots
- ✅ Dữ liệu luôn mới nhất
- ✅ Không có cached stale data

---

### 2. POST /api/fields/{fieldCode}/bookings/confirm

**Request:**
```json
{
  "slots": [
    {
      "play_date": "2025-10-22",
      "start_time": "10:00",
      "end_time": "11:00"
    }
  ],
  "customer": {
    "name": "Nguyễn Văn A",
    "email": "a@example.com",
    "phone": "0912345678"
  }
}
```

**Response:**
```json
{
  "data": {
    "booking_code": "123",
    "qr_code": "https://qr.sepay.vn/...",
    "slots": [...]
  }
}
```

**Chi tiết:**
- ✅ Backend cleanup expired held slots trước khi xác nhận
- ✅ Cho phép đặt khung giờ nếu held đã hết hạn
- ✅ Kiểm tra time validation chính xác

---

## 🧪 TEST CASES

### Test 1: Khung giờ tự động chuyển sau 15 phút

**Bước 1: Chọn khung giờ**
```javascript
// Frontend call
const response = await fetch('/api/fields/48/bookings/confirm', {
  method: 'POST',
  body: JSON.stringify({
    slots: [{
      play_date: '2025-10-22',
      start_time: '10:00',
      end_time: '11:00'
    }]
  })
});
// Result: booking_code = 123, Status = 'held'
```

**Bước 2: Đợi 15+ phút**
```javascript
// Sleep 16 minutes
setTimeout(() => {
  // Tiếp tục bước 3
}, 16 * 60 * 1000);
```

**Bước 3: Kiểm tra availability**
```javascript
const slots = await fetch('/api/fields/48/availability?date=2025-10-22');
const data = await slots.json();

// Tìm khung giờ 10:00 - 11:00
const slot = data.data.slots.find(s => 
  s.start_time === '10:00' && s.end_time === '11:00'
);

console.log(slot.status); // ✅ 'available' (không phải 'held')
console.log(slot.is_available); // ✅ true
```

---

### Test 2: Không thể chọn held slot chưa hết hạn

**Bước 1: Chọn khung giờ**
```javascript
const response = await fetch('/api/fields/48/bookings/confirm', {
  method: 'POST',
  body: JSON.stringify({
    slots: [{
      play_date: '2025-10-22',
      start_time: '11:00',
      end_time: '12:00'
    }]
  })
});
// Result: Status = 'held'
```

**Bước 2: Ngay lập tức thử chọn lại**
```javascript
const response2 = await fetch('/api/fields/48/bookings/confirm', {
  method: 'POST',
  body: JSON.stringify({
    slots: [{
      play_date: '2025-10-22',
      start_time: '11:00',
      end_time: '12:00'
    }]
  })
});

// ✅ Error: "Khung giờ 11:00 - 12:00 ngày 2025-10-22 đã được đặt trước đó."
```

---

### Test 3: Cron job cleanup

**Kiểm tra logs:**
```
Backend logs output:
"Đã dọn dẹp các khung giờ đã hết hạn." (every 60 seconds)
```

---

## 🎨 UI/UX CHANGES (Nếu cần)

### Giới thiệu Countdown Timer (Optional)

Nếu muốn thêm UX tốt hơn, frontend có thể:

1. **Hiển thị thời gian countdown**
```javascript
const holdExpiresAt = new Date(slot.hold_expires_at);
const now = new Date();
const secondsLeft = Math.floor((holdExpiresAt - now) / 1000);

console.log(`Khung giờ này sẽ available trong ${secondsLeft} giây`);
```

2. **Auto-refresh availability sau 15 phút**
```javascript
const holdExpiresAt = new Date(slot.hold_expires_at);
const now = new Date();
const msLeft = holdExpiresAt - now;

setTimeout(() => {
  // Gọi lại availability endpoint
  fetchAvailability();
}, msLeft + 1000); // +1s safety margin
```

3. **Hiện thông báo tự động**
```javascript
toast.success('Khung giờ này bây giờ có sẵn!');
```

---

## 🐛 ERROR HANDLING

### Case 1: Held slot hết hạn → Có thể chọn
```javascript
// Trước:
❌ Error: "Khung giờ đã được đặt"

// Sau:
✅ Booking thành công
```

### Case 2: Held slot chưa hết hạn → Không chọn được
```javascript
// Đúng:
❌ Error: "Khung giờ đã được đặt" (nó chưa hết hạn)
```

### Case 3: Available slot → Luôn có thể chọn
```javascript
// Đúng:
✅ Booking thành công
```

---

## 📊 DATABASE CHANGES

### Schema vẫn giữ nguyên (Không thay đổi)

```sql
-- Field_Slots table (unchanged)
CREATE TABLE Field_Slots (
  SlotID INT PRIMARY KEY AUTO_INCREMENT,
  FieldCode INT,
  PlayDate DATE,
  StartTime TIME,
  EndTime TIME,
  Status ENUM('available', 'booked', 'held'),  -- ✅ Vẫn giữ
  HoldExpiresAt DATETIME,  -- ✅ Vẫn dùng
  BookingCode INT,
  CreatedBy INT,
  UpdateAt TIMESTAMP
);
```

---

## 🚀 ROLLOUT PLAN

### Phase 1: Deploy Backend
```bash
cd backend
npm run build
npm start
```

### Phase 2: Test Thoroughly
- ✅ Test 15 phút auto cleanup
- ✅ Test error messages
- ✅ Test database updates

### Phase 3: Monitor
- 📊 Watch backend logs
- 📊 Check held slots in DB
- 📊 Verify cron job runs every minute

### Phase 4: Communicate
- 📢 Inform team frontend
- 📢 Update documentation
- 📢 Add release notes

---

## ❓ FAQ

**Q: Khi nào khung giờ chuyển từ "held" sang "available"?**
A: 3 lúc:
1. Khi user gọi /api/fields/{id}/availability
2. Khi xác nhận booking mới
3. Mỗi 60 giây (cron job)

**Q: Có ảnh hưởng đến UX không?**
A: Không! 
- Người dùng sẽ thấy khung giờ có sẵn lại
- Không cần reload browser
- Tự động cleanup ở background

**Q: Có mất dữ liệu không?**
A: Không!
- Trước: XÓA slots (mất dữ liệu)
- Sau: UPDATE thành 'available' (bảo toàn)

**Q: Performance sẽ như thế nào?**
A: Cải thiện!
- Cron job chạy 1 lần/phút
- Không block request từ user
- Query tối ưu (có index trên Status, HoldExpiresAt)

---

## 📞 SUPPORT

Nếu có vấn đề:
1. Check backend logs
2. Verify database Status, HoldExpiresAt
3. Test API endpoint trực tiếp
4. Contact backend team

