# Sửa lỗi Khung giờ Held Không Tự Động Chuyển Thành Available

## 🔴 VẤN ĐỀ

Khi người dùng chọn khung giờ ở trang booking:
- Khung giờ được lưu với trạng thái **"held"** với thời hạn 15 phút
- Nếu hết 15 phút nhưng vẫn ở trạng thái **"held"**, hệ thống báo "đã được đặt trước đó"
- Dù trạng thái trong DB vẫn là "held" (không tự động chuyển sang "available")

## ✅ GIẢI PHÁP ĐÃ THỰC HIỆN

### 1. **Sửa logic kiểm tra khung giờ trong `booking.service.ts`** (Line 176-199)

**File:** `backend/src/services/booking.service.ts`

```typescript
// Trước: Chỉ kiểm tra Status !== "available"
if (row.Status !== "available") {
  throw new ApiError(...);
}

// Sau: Kiểm tra xem held slot có hết hạn không
if (row.Status === "held" && row.HoldExpiresAt) {
  const holdExpiryTime = new Date(row.HoldExpiresAt);
  const now = new Date();
  if (now <= holdExpiryTime) {
    // Hold vẫn còn hiệu lực
    throw new ApiError(...);
  }
  // Hold đã hết hạn, có thể tiếp tục
} else if (row.Status !== "available") {
  throw new ApiError(...);
}
```

**Lợi ích:**
- ✅ Cho phép đặt khung giờ nếu hold đã hết hạn
- ✅ Kiểm tra chính xác thời gian hết hạn

---

### 2. **Sửa hàm `releaseExpiredHeldSlots()` trong `booking.service.ts`** (Line 231-245)

**File:** `backend/src/services/booking.service.ts`

```typescript
// Trước: XÓA slots expired
`DELETE FROM Field_Slots 
 WHERE FieldCode = ? 
 AND Status = 'held' 
 AND HoldExpiresAt < NOW()`

// Sau: CẬP NHẬT status thành 'available'
`UPDATE Field_Slots 
 SET Status = 'available', HoldExpiresAt = NULL, UpdateAt = NOW()
 WHERE FieldCode = ? 
 AND Status = 'held' 
 AND HoldExpiresAt < NOW()`
```

**Lợi ích:**
- ✅ Bảo toàn dữ liệu (update thay vì delete)
- ✅ Khung giờ tự động trở thành available
- ✅ Lần sau truy vấn sẽ thấy là "available"

---

### 3. **Thêm cleanup logic trong `field.controller.ts`** (Line 222-271)

**File:** `backend/src/controllers/field.controller.ts`

Khi người dùng truy cập endpoint `/api/fields/{fieldCode}/availability`:

```typescript
// Release expired held slots before getting availability
try {
  await queryService.query(
    `UPDATE Field_Slots 
     SET Status = 'available', HoldExpiresAt = NULL, UpdateAt = NOW()
     WHERE FieldCode = ? 
     AND Status = 'held' 
     AND HoldExpiresAt < NOW()`,
    [fieldCode]
  );
} catch (e) {
  console.error('Lỗi release expired held slots:', e);
}
```

**Lợi ích:**
- ✅ Tự động dọn dẹp khi frontend request availability
- ✅ Đảm bảo dữ liệu luôn cập nhật

---

### 4. **Thêm hàm `cleanupExpiredHeldSlots()` trong `booking.service.ts`**

**File:** `backend/src/services/booking.service.ts`

```typescript
export async function cleanupExpiredHeldSlots() {
  try {
    await queryService.query<ResultSetHeader>(
      `UPDATE Field_Slots 
       SET Status = 'available', HoldExpiresAt = NULL, UpdateAt = NOW()
       WHERE Status = 'held' 
       AND HoldExpiresAt IS NOT NULL 
       AND HoldExpiresAt < NOW()`,
      []
    );
    console.log("Đã dọn dẹp các khung giờ đã hết hạn.");
  } catch (e) {
    console.error('Lỗi dọn dẹp khung giờ:', e);
  }
}
```

---

### 5. **Thêm Cron Job trong `index.ts`** (Line 47, 73-77)

**File:** `backend/src/index.ts`

```typescript
import { cleanupExpiredHeldSlots } from "./services/booking.service";

// ...

// Setup cleanup job for expired held slots
// Run every minute
setInterval(async () => {
  await cleanupExpiredHeldSlots();
}, 60 * 1000); // 60 seconds
```

**Lợi ích:**
- ✅ Chạy tự động mỗi 1 phút
- ✅ Dọn dẹp tất cả held slots đã hết hạn
- ✅ Không phụ thuộc vào request từ client

---

## 🔄 QUY TRÌNH LÀM VIỆC

### Khi người dùng chọn khung giờ (booking):
1. ✅ Slot được lưu với status = **"held"**
2. ✅ Set **HoldExpiresAt** = NOW() + 15 phút
3. ✅ Người dùng có 15 phút để thanh toán

### Khi 15 phút hết (3 điểm dọn dẹp):

#### **Điểm 1: Khi người dùng truy cập availability endpoint**
- API tự động UPDATE held slots hết hạn → available

#### **Điểm 2: Khi xác nhận booking mới**
- Hàm `confirmFieldBooking()` gọi `releaseExpiredHeldSlots()`
- Xóa bỏ held slots hết hạn → available

#### **Điểm 3: Cron job mỗi 1 phút**
- Tự động dọn dẹp toàn bộ held slots hết hạn
- Chạy ngay cả khi không có request nào

---

## 📊 BẢNG SO SÁNH

| Trước | Sau | Lợi ích |
|-------|-----|---------|
| ❌ Held slot không tự động chuyển | ✅ Tự động UPDATE → available | Dữ liệu chính xác |
| ❌ XÓA expired slots (mất dữ liệu) | ✅ UPDATE thành available | Bảo toàn dữ liệu |
| ❌ Chỉ dọn dẹp khi booking | ✅ Cleanup mỗi 1 phút | Đảm bảo consistency |
| ❌ Có thể bị stuck ở "held" | ✅ 3 điểm dọn dẹp | Không bị mắc kẹt |

---

## 🧪 CÁCH KIỂM TRA

### Test 1: Xem khung giờ tự động chuyển trạng thái

1. Truy cập: `http://localhost:5173/booking/48`
2. Chọn khung giờ → status = "held"
3. Đợi 15+ phút
4. Reload trang → Gọi `/api/fields/48/availability`
5. ✅ Khung giờ này sẽ hiện available (nếu chưa thanh toán)

### Test 2: Kiểm tra database

```sql
-- Check trạng thái slot sau 15 phút
SELECT SlotID, Status, HoldExpiresAt, UpdateAt 
FROM Field_Slots 
WHERE FieldCode = 48 
AND PlayDate = '2025-10-22'
AND StartTime = '10:00:00';

-- Kỳ vọng: Status = 'available', HoldExpiresAt = NULL
```

### Test 3: Kiểm tra cron job chạy

- Mở browser DevTools → Console
- Hoặc check backend logs: `Đã dọn dẹp các khung giờ đã hết hạn.`

---

## 📝 GỒM CÓ

✅ Không hold slot > 15 phút  
✅ Không báo sai lỗi "đã được đặt"  
✅ Dữ liệu luôn nhất quán  
✅ 3 lớp bảo vệ (endpoint, booking, cron)  
✅ Bảo toàn lịch sử dữ liệu  

