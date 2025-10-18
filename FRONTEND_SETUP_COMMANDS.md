# 📋 Hướng Dẫn Lệnh Cho Frontend - Payment Result Page

## 🚀 Bước 1: Tạo Thư Mục & File Component

```bash
# Tạo thư mục pages nếu chưa có
mkdir -p src/pages

# Tạo file PaymentResult.tsx
touch src/pages/PaymentResult.tsx
```

---

## 📝 Bước 2: Copy Code Component

**Mở file**: `PAYMENT_RESULT_PAGE_GUIDE.md`

**Tìm section**: `### **3️⃣ Frontend - Trang Kết Quả Thanh Toán (React + TypeScript)**`

**Copy toàn bộ code từ**:
```
export default function PaymentResult() {
  ...
}
```

**Dán vào file**: `src/pages/PaymentResult.tsx`

---

## 🔗 Bước 3: Cập Nhật Routing

### Tùy chọn A: Nếu dùng React Router (App.tsx)

```bash
# Mở file src/App.tsx (hoặc src/App.jsx)
```

**Tìm section Import**:
```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
```

**Thêm import**:
```typescript
import PaymentResult from './pages/PaymentResult';
```

**Tìm section Routes** (trong `<Routes>` tag):
```typescript
<Routes>
  {/* ... existing routes ... */}
</Routes>
```

**Thêm route mới**:
```typescript
{/* Payment Result Page */}
<Route path="/payment/:bookingCode" element={<PaymentResult />} />
```

### Tùy chọn B: Nếu dùng file routing riêng

```bash
# Nếu có file src/routes.tsx hoặc src/router.tsx
# Thêm import:
```

```typescript
import PaymentResult from './pages/PaymentResult';
```

**Rồi thêm route**:
```typescript
{
  path: '/payment/:bookingCode',
  element: <PaymentResult />
}
```

---

## 🧪 Bước 4: Cài Đặt Dependencies (Nếu Cần)

```bash
# Kiểm tra đã có react-router-dom chưa
npm list react-router-dom

# Nếu chưa có, cài đặt
npm install react-router-dom

# Kiểm tra đã có axios chưa
npm list axios

# Nếu chưa có, cài đặt
npm install axios
```

---

## ✅ Bước 5: Kiểm Tra & Test

```bash
# Dừng dev server hiện tại (nếu đang chạy)
# Ctrl + C

# Khởi động lại dev server
npm run dev

# Hoặc (tùy vào project setup):
yarn dev
```

**Kiểm tra**:
1. Tạo booking
2. Nhấn "Thanh Toán"
3. Hoàn thành payment (hoặc dùng test endpoint)
4. Kiểm tra redirect đến `/payment/:bookingCode`
5. Xác nhận page hiển thị đúng ✅

---

## 🔧 Bước 6: Test Endpoint Trực Tiếp (Optional)

```bash
# Test endpoint API backend
curl -X GET http://localhost:5050/api/payments/result/BK-MGV0VFB7-XMT5F4

# Hoặc sử dụng Postman:
# - Method: GET
# - URL: http://localhost:5050/api/payments/result/BK-MGV0VFB7-XMT5F4
# - Kỳ vọng: Response với payment data
```

---

## 🎨 Bước 7: Tùy Chỉnh (Optional)

### Thay Đổi Màu Sắc

Trong `PaymentResult.tsx`, tìm `className` và thay đổi:
```typescript
// Ví dụ: Thay màu xanh
className="text-green-600"  // → "text-blue-600"
```

### Thay Đổi Text Tiếng Việt

Tìm và thay đổi các string:
```typescript
"Thanh Toán Thành Công!" // Thay bằng text khác
"Xem Chi Tiết Booking"   // Thay bằng text khác
```

### Thay Đổi API Base URL

Nếu backend không chạy ở `localhost:5050`:
```typescript
// Tìm dòng:
`http://localhost:5050/api/payments/result/${bookingCode}`

// Thay bằng:
`${process.env.REACT_APP_API_URL}/api/payments/result/${bookingCode}`

// Hoặc hardcode URL khác nếu cần
```

---

## 📚 Quick Reference - Các Bước Cơ Bản

```bash
# 1. Tạo file
touch src/pages/PaymentResult.tsx

# 2. Copy code từ PAYMENT_RESULT_PAGE_GUIDE.md

# 3. Import trong App.tsx
# - Thêm: import PaymentResult from './pages/PaymentResult';

# 4. Thêm route
# - Thêm: <Route path="/payment/:bookingCode" element={<PaymentResult />} />

# 5. Restart server
npm run dev

# 6. Test payment flow
```

---

## ⚠️ Có Lỗi? Hãy Kiểm Tra

### Lỗi: "Cannot find module 'react-router-dom'"
```bash
npm install react-router-dom
npm run dev
```

### Lỗi: "Cannot find module 'axios'"
```bash
npm install axios
npm run dev
```

### Lỗi: 404 khi vào /payment/:bookingCode
✅ Kiểm tra:
- [ ] Route được thêm đúng trong App.tsx?
- [ ] Import PaymentResult được thêm?
- [ ] File PaymentResult.tsx tồn tại?
- [ ] Dev server đã restart?

### Lỗi: API trả về 404
✅ Kiểm tra:
- [ ] Backend đang chạy?
- [ ] BookingCode có tồn tại?
- [ ] Payment record tương ứng có tồn tại?

### Lỗi: Page trắng không hiển thị gì
✅ Kiểm tra:
- [ ] Browser console có error không? (F12)
- [ ] Network tab: request có thành công không?
- [ ] Component code có cú pháp đúng không?

---

## 🎯 File Cuối Cùng Sẽ Trông Như Thế Này

```
your-project/
├── src/
│   ├── pages/
│   │   ├── PaymentResult.tsx        ← NEW FILE
│   │   └── ... (other pages)
│   ├── App.tsx                       ← MODIFIED (add route)
│   └── ... (other files)
└── ... (other files)
```

---

## 📞 Hỗ Trợ

Nếu gặp vấn đề:

1. **Đọc console error**: F12 → Console tab
2. **Kiểm tra Network**: F12 → Network tab → Xem request/response
3. **Xem tài liệu**: `PAYMENT_RESULT_PAGE_GUIDE.md`
4. **Xem ví dụ**: `QUICK_START_PAYMENT_RESULT.md`

---

## ✨ Hoàn Tất!

Sau khi hoàn thành các bước trên, payment flow sẽ:
- ✅ Thanh toán thành công
- ✅ Redirect đến `/payment/:bookingCode`
- ✅ Hiển thị trang kết quả thành công
- ✅ Cho phép xem chi tiết booking
- ✅ Cho phép xem mã check-in

**Thời gian**: ~20-30 phút



