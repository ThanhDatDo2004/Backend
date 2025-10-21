# Hướng Dẫn - Hiển Thị Nhiều Khung Giờ Cho 1 Booking

## 🔴 VẤN ĐỀ CŨ

Khi chọn 2 khung giờ (ví dụ: 10:00-11:00 và 11:00-12:00):
- ❌ Chỉ lưu StartTime & EndTime của khung giờ **đầu tiên**
- ❌ Khi hiển thị, chỉ thấy được: **10:00 - 11:00**
- ❌ Khung giờ thứ 2 (11:00 - 12:00) bị mất

## ✅ GIẢI PHÁP MỚI

### Cấu Trúc Database (Không thay đổi)

```
Bookings table:
- BookingCode (PK)
- FieldCode
- StartTime (khung giờ đầu tiên - để hiển thị nhanh)
- EndTime (khung giờ đầu tiên - để hiển thị nhanh)
- TotalPrice (tính theo tất cả slots)
- ... fields khác

Field_Slots table:
- SlotID (PK)
- BookingCode (FK → Bookings)  ← LÀM KHÓA
- PlayDate
- StartTime (khung giờ của slot này)
- EndTime (khung giờ của slot này)
- Status ('booked', 'held', 'available')
```

### Quy Trình Xử Lý (Backend)

#### **Bước 1: Tạo booking với 2 khung giờ**

```javascript
POST /api/fields/48/bookings/confirm
{
  "slots": [
    {
      "play_date": "2025-10-22",
      "start_time": "10:00",
      "end_time": "11:00"
    },
    {
      "play_date": "2025-10-22",
      "start_time": "11:00",
      "end_time": "12:00"
    }
  ]
}
```

#### **Bước 2: Backend xử lý**

```typescript
// booking.service.ts - confirmFieldBooking()

// 1. Tính giá cho tất cả slots
const totalPrice = pricePerSlot * 2;  // 2 slots

// 2. Lưu Bookings (chỉ lấy slot đầu)
INSERT INTO Bookings
  PlayDate = '2025-10-22',
  StartTime = '10:00',  ← Slot đầu
  EndTime = '11:00',    ← Slot đầu
  TotalPrice = price * 2  ← TÍNH CHO TẤT CẢ
  
// 3. Lưu cả 2 slots vào Field_Slots
INSERT INTO Field_Slots (BookingCode, PlayDate, StartTime, EndTime, Status)
VALUES 
  (123, '2025-10-22', '10:00', '11:00', 'held'),
  (123, '2025-10-22', '11:00', '12:00', 'held')
```

#### **Bước 3: Trả về response**

```json
{
  "data": {
    "booking_code": "123",
    "field_code": 48,
    "slots": [
      {
        "slot_id": 1,
        "play_date": "2025-10-22",
        "start_time": "10:00",
        "end_time": "11:00"
      },
      {
        "slot_id": 2,
        "play_date": "2025-10-22",
        "start_time": "11:00",
        "end_time": "12:00"
      }
    ]
  }
}
```

---

## 📱 API ENDPOINTS (CẬP NHẬT)

### 1. GET /api/bookings/:bookingCode

**Response:**
```json
{
  "data": {
    "BookingCode": 123,
    "FieldCode": 48,
    "PlayDate": "2025-10-22",
    "StartTime": "10:00",
    "EndTime": "11:00",
    "TotalPrice": 200000,
    "FieldName": "Sân A",
    "slots": [
      {
        "SlotID": 1,
        "PlayDate": "2025-10-22",
        "StartTime": "10:00",
        "EndTime": "11:00",
        "Status": "held"
      },
      {
        "SlotID": 2,
        "PlayDate": "2025-10-22",
        "StartTime": "11:00",
        "EndTime": "12:00",
        "Status": "held"
      }
    ]
  },
  "message": "Chi tiết booking"
}
```

**Chi tiết:**
- ✅ Trả về **tất cả slots** trong mảng `slots`
- ✅ Slots được sắp xếp theo PlayDate, StartTime
- ✅ StartTime, EndTime được format **HH:mm** (lẹp hơn)

---

### 2. GET /api/bookings (Danh sách bookings)

**Response:**
```json
{
  "data": [
    {
      "BookingCode": 123,
      "FieldName": "Sân A",
      "StartTime": "10:00",
      "EndTime": "11:00",
      "TotalPrice": 200000,
      "slots": [
        {"SlotID": 1, "StartTime": "10:00", "EndTime": "11:00"},
        {"SlotID": 2, "StartTime": "11:00", "EndTime": "12:00"}
      ]
    },
    // ... more bookings
  ],
  "pagination": {
    "total": 50,
    "limit": 10,
    "offset": 0
  }
}
```

---

### 3. GET /api/shops/me/bookings (Shop bookings)

**Response:**
```json
{
  "data": [
    {
      "BookingCode": 123,
      "CustomerName": "Nguyễn Văn A",
      "StartTime": "10:00",
      "EndTime": "11:00",
      "slots": [
        {"SlotID": 1, "StartTime": "10:00", "EndTime": "11:00"},
        {"SlotID": 2, "StartTime": "11:00", "EndTime": "12:00"}
      ]
    }
  ]
}
```

---

## 🎨 FRONTEND DISPLAY EXAMPLES

### Cách 1: Hiển Thị Dạng List (Khuyên Dùng)

```jsx
// React Component
function BookingDetail({ booking }) {
  return (
    <div className="booking-card">
      <h3>{booking.FieldName}</h3>
      
      <div className="time-slots">
        <h4>Khung giờ đã đặt:</h4>
        {booking.slots.map((slot) => (
          <div key={slot.SlotID} className="time-slot-item">
            <span className="date">{slot.PlayDate}</span>
            <span className="time">
              {slot.StartTime} - {slot.EndTime}
            </span>
          </div>
        ))}
      </div>
      
      <div className="total-price">
        <strong>Tổng cộng: {booking.TotalPrice.toLocaleString()}đ</strong>
      </div>
    </div>
  );
}
```

**UI Output:**
```
═══════════════════════════════════
  Sân A - Booking #123
═══════════════════════════════════
Khung giờ đã đặt:
  ☑ 2025-10-22 | 10:00 - 11:00
  ☑ 2025-10-22 | 11:00 - 12:00
  
Tổng cộng: 200,000đ
═══════════════════════════════════
```

---

### Cách 2: Hiển Thị Dạng Bảng

```jsx
function BookingsList({ bookings }) {
  return (
    <table className="bookings-table">
      <thead>
        <tr>
          <th>Sân</th>
          <th>Khung giờ</th>
          <th>Giá</th>
          <th>Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        {bookings.map((booking) => (
          <tr key={booking.BookingCode}>
            <td>{booking.FieldName}</td>
            <td>
              <div className="slots-list">
                {booking.slots.map((slot) => (
                  <span key={slot.SlotID} className="slot-badge">
                    {slot.StartTime} - {slot.EndTime}
                  </span>
                ))}
              </div>
            </td>
            <td>{booking.TotalPrice.toLocaleString()}đ</td>
            <td>{booking.BookingStatus}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**UI Output:**
```
┌─────────────┬─────────────────────┬──────────┬────────────┐
│ Sân         │ Khung giờ           │ Giá      │ Trạng thái │
├─────────────┼─────────────────────┼──────────┼────────────┤
│ Sân A       │ 10:00-11:00 11:00-12:00 │ 200,000đ │ pending  │
│ Sân B       │ 14:00-15:00         │ 100,000đ │ confirmed│
└─────────────┴─────────────────────┴──────────┴────────────┘
```

---

### Cách 3: Hiển Thị Dạng Timeline

```jsx
function BookingTimeline({ slots }) {
  return (
    <div className="timeline">
      {slots.map((slot) => (
        <div key={slot.SlotID} className="timeline-item">
          <div className="timeline-dot"></div>
          <div className="timeline-content">
            <p className="time">{slot.StartTime} - {slot.EndTime}</p>
            <p className="status">{slot.Status}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 🔄 TYPESCRIPT TYPES

```typescript
// Booking response type
interface BookingResponse {
  BookingCode: number;
  FieldCode: number;
  FieldName: string;
  PlayDate: string;
  StartTime: string;
  EndTime: string;
  TotalPrice: number;
  BookingStatus: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  slots: BookingSlot[];
}

// Slot type
interface BookingSlot {
  SlotID: number;
  PlayDate: string;
  StartTime: string;  // HH:mm format
  EndTime: string;    // HH:mm format
  Status: 'booked' | 'held' | 'available';
}

// List response
interface BookingListResponse {
  data: BookingResponse[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}
```

---

## 📊 VÍ DỤ DỮ LIỆU

### Database State

```sql
-- Bookings table
BookingCode | PlayDate   | StartTime | EndTime | TotalPrice
123         | 2025-10-22 | 10:00     | 11:00   | 200000

-- Field_Slots table
SlotID | BookingCode | PlayDate   | StartTime | EndTime | Status
1      | 123         | 2025-10-22 | 10:00     | 11:00   | booked
2      | 123         | 2025-10-22 | 11:00     | 12:00   | booked
```

### API Response

```json
{
  "BookingCode": 123,
  "PlayDate": "2025-10-22",
  "StartTime": "10:00",
  "EndTime": "11:00",
  "TotalPrice": 200000,
  "slots": [
    {
      "SlotID": 1,
      "PlayDate": "2025-10-22",
      "StartTime": "10:00",
      "EndTime": "11:00",
      "Status": "booked"
    },
    {
      "SlotID": 2,
      "PlayDate": "2025-10-22",
      "StartTime": "11:00",
      "EndTime": "12:00",
      "Status": "booked"
    }
  ]
}
```

---

## 🧪 TEST CASES

### Test 1: Tạo booking với 2 khung giờ

```bash
curl -X POST http://localhost:5050/api/fields/48/bookings/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "slots": [
      {
        "play_date": "2025-10-22",
        "start_time": "10:00",
        "end_time": "11:00"
      },
      {
        "play_date": "2025-10-22",
        "start_time": "11:00",
        "end_time": "12:00"
      }
    ]
  }'
```

**Response:**
```json
{
  "data": {
    "booking_code": "123",
    "slots": [
      {"slot_id": 1, "start_time": "10:00", "end_time": "11:00"},
      {"slot_id": 2, "start_time": "11:00", "end_time": "12:00"}
    ]
  }
}
```

---

### Test 2: Lấy chi tiết booking

```bash
curl http://localhost:5050/api/bookings/123
```

**Response:**
```json
{
  "data": {
    "BookingCode": 123,
    "slots": [
      {"SlotID": 1, "StartTime": "10:00", "EndTime": "11:00"},
      {"SlotID": 2, "StartTime": "11:00", "EndTime": "12:00"}
    ]
  }
}
```

---

## 🎯 LỢI ÍCH

✅ **Đầy đủ thông tin**: Hiển thị tất cả slots được chọn  
✅ **Tối ưu database**: Không cần thêm cột trong Bookings  
✅ **Dễ mở rộng**: Dễ thêm tính năng trong tương lai  
✅ **Hiệu suất**: Một query để lấy tất cả slots  
✅ **Consistency**: Dữ liệu luôn nhất quán  

---

## 📝 FILES CHANGED

1. `backend/src/controllers/booking.controller.ts`
   - ✅ Sửa `listBookings()` - fetch tất cả slots
   - ✅ Sửa `getBooking()` - fetch tất cả slots
   - ✅ Sửa `listShopBookings()` - fetch tất cả slots

**Không cần thay đổi:**
- ❌ Database schema
- ❌ booking.service.ts (logic tạo booking)
- ❌ Field_Slots table

---

## 🚀 DEPLOY

```bash
# Build backend
cd backend
npm run build

# Start server
npm start

# Test trên frontend
curl http://localhost:5050/api/bookings/123
```

