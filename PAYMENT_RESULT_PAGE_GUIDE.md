# 🎯 Hướng Dẫn Trang Kết Quả Thanh Toán (Payment Result Page)

## 🔴 VẤN ĐỀ BẠN GẶP PHẢI

Sau khi thanh toán thành công, frontend nhận được response đúng:

```json
{
    "success": true,
    "statusCode": 200,
    "message": "Thanh toán ảo thành công. Khung giờ đã được giữ chỗ.",
    "data": {
        "booking_code": "BK-MGV0VFB7-XMT5F4",
        "transaction_id": "TX-IM5NCS5F",
        "payment_status": "mock_success",
        "field_code": 30,
        "slots": [...],
        "payment_method": "banktransfer"
    }
}
```

Nhưng khi cố gắng truy cập `http://localhost:5173/payment/BK-MGV0VFB7-XMT5F4`, frontend nhận lỗi **404** vì:

❌ **Nguyên nhân**: Trang `/payment/:bookingCode` không tồn tại trên frontend

---

## ✅ GIẢI PHÁP ĐÃ TRIỂN KHAI

### 1️⃣ **Backend - Thêm Endpoint Mới**

**Endpoint mới**: `GET /api/payments/result/:bookingCode`

```bash
curl -X GET http://localhost:5050/api/payments/result/BK-MGV0VFB7-XMT5F4
```

**Response**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lấy kết quả thanh toán thành công",
  "data": {
    "booking_code": "BK-MGV0VFB7-XMT5F4",
    "transaction_id": "TX-IM5NCS5F",
    "payment_status": "paid",
    "field_code": 30,
    "field_name": "Sân Bóng Đá Số 1",
    "total_price": 150000,
    "slots": [
      {
        "slot_id": 24,
        "play_date": "2025-10-17",
        "start_time": "14:00",
        "end_time": "15:00"
      }
    ],
    "payment_method": "banktransfer",
    "paid_at": "2025-10-17T14:23:45.000Z"
  }
}
```

**Các tệp backend được sửa đổi**:

- ✅ `backend/src/controllers/payment.controller.ts` - Thêm `getPaymentResult()` method
- ✅ `backend/src/routes/payment.routes.ts` - Thêm route
- ✅ `backend/src/services/query.ts` - Thêm generic `query()` method

---

## 🎨 FRONTEND - TÀI LIỆU TRIỂN KHAI

### **Luồng Thanh Toán (Payment Flow)**

```
┌──────────────────────────┐
│  Booking Detail Page     │
│  Total: 150,000 VND      │
│  [Pay Now Button]        │
└──────────────────────────┘
           ↓
POST /api/payments/bookings/:bookingCode/initiate
           ↓
┌──────────────────────────┐
│   Payment Page           │
│   [QR Code]              │
│   Scanning...            │
│   [Poll Status]          │
└──────────────────────────┘
           ↓ (After Momo payment)
Momo redirects to → http://localhost:5173/payment/:bookingCode
           ↓
GET /api/payments/result/:bookingCode
           ↓
┌──────────────────────────┐
│  Payment Success Page    │
│  ✅ Thanh toán thành công│
│  Booking: BK-...         │
│  Amount: 150,000 VND     │
│  [View Booking Details]  │
│  [Xem Mã Check-in]       │
└──────────────────────────┘
           ↓
Navigate to → /bookings/:bookingCode
```

### **3️⃣ Frontend - Trang Kết Quả Thanh Toán (React + TypeScript)**

Tạo file `src/pages/PaymentResult.tsx`:

```typescript
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

interface PaymentResultData {
  booking_code: string;
  transaction_id: string;
  payment_status: string;
  field_code: number;
  field_name: string;
  total_price: number;
  slots: Array<{
    slot_id: number;
    play_date: string;
    start_time: string;
    end_time: string;
  }>;
  payment_method: string;
  paid_at: string;
}

export default function PaymentResult() {
  const { bookingCode } = useParams<{ bookingCode: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<PaymentResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingCode) {
      setError("Booking code không tìm thấy");
      return;
    }

    const fetchPaymentResult = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `http://localhost:5050/api/payments/result/${bookingCode}`
        );

        if (response.data.success) {
          setData(response.data.data);
        } else {
          setError(
            response.data.error?.message || "Lỗi lấy kết quả thanh toán"
          );
        }
      } catch (err) {
        console.error("Error fetching payment result:", err);
        setError("Lỗi khi lấy kết quả thanh toán");
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentResult();
  }, [bookingCode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải kết quả thanh toán...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-2">❌ Lỗi</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate("/bookings")}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Quay Lại
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div>Không tìm thấy dữ liệu thanh toán</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-3xl font-bold text-green-600 mb-2">
            Thanh Toán Thành Công!
          </h1>
          <p className="text-gray-600">
            Khung giờ của bạn đã được giữ chỗ thành công
          </p>
        </div>

        {/* Payment Details */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">
            Chi Tiết Thanh Toán
          </h2>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Mã Booking:</span>
              <span className="font-semibold text-gray-800">
                {data.booking_code}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Mã Giao Dịch:</span>
              <span className="font-semibold text-gray-800">
                {data.transaction_id}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Sân:</span>
              <span className="font-semibold text-gray-800">
                {data.field_name}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Phương Thức Thanh Toán:</span>
              <span className="font-semibold text-gray-800 capitalize">
                {data.payment_method === "banktransfer"
                  ? "Chuyển Khoản"
                  : data.payment_method}
              </span>
            </div>

            <div className="border-t pt-3 flex justify-between">
              <span className="text-gray-600 font-semibold">Tổng Số Tiền:</span>
              <span className="text-xl font-bold text-green-600">
                {data.total_price.toLocaleString("vi-VN")} VND
              </span>
            </div>
          </div>
        </div>

        {/* Slots Information */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">
            Khung Giờ Đã Giữ Chỗ
          </h2>

          <div className="space-y-2">
            {data.slots.map((slot, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-blue-50 p-3 rounded"
              >
                <span className="text-gray-700">
                  <strong>Ngày:</strong>{" "}
                  {new Date(slot.play_date).toLocaleDateString("vi-VN")}
                </span>
                <span className="text-gray-700">
                  <strong>Giờ:</strong> {slot.start_time} - {slot.end_time}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => navigate(`/bookings/${data.booking_code}`)}
            className="flex-1 bg-green-500 text-white font-bold py-3 rounded-lg hover:bg-green-600 transition"
          >
            Xem Chi Tiết Booking
          </button>

          <button
            onClick={() =>
              navigate(`/bookings/${data.booking_code}/checkin-code`)
            }
            className="flex-1 bg-blue-500 text-white font-bold py-3 rounded-lg hover:bg-blue-600 transition"
          >
            Xem Mã Check-in
          </button>
        </div>
      </div>
    </div>
  );
}
```

### **4️⃣ Frontend - Cấu Hình Routing**

Trong `src/App.tsx` hoặc `src/routes.tsx`, thêm route:

```typescript
import { BrowserRouter, Routes, Route } from "react-router-dom";
import PaymentResult from "./pages/PaymentResult";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ... existing routes ... */}

        {/* Payment Result Page - NEW */}
        <Route path="/payment/:bookingCode" element={<PaymentResult />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### **5️⃣ Frontend - Chỉnh Sửa Payment Page (để redirect đúng)**

Khi Momo trả về sau thanh toán, frontend sẽ tự động redirect đến:

```
/payment/:bookingCode
```

Nếu bạn đang sử dụng component Payment, hãy đảm bảo rằng:

```typescript
// Khi Momo redirect về
if (window.location.pathname.includes("/payment/")) {
  // Trang Payment Result sẽ xử lý logic hiển thị
  // Component PaymentResult sẽ fetch dữ liệu từ API mới
}
```

---

## 📊 So Sánh Trước & Sau

| Aspect               | Trước                            | Sau                                        |
| -------------------- | -------------------------------- | ------------------------------------------ |
| **Payment Response** | ✅ Đúng                          | ✅ Vẫn Đúng                                |
| **Redirect URL**     | ❌ `/payment/:bookingCode` (404) | ✅ `/payment/:bookingCode` (200)           |
| **Data Source**      | ❌ Không có endpoint             | ✅ `GET /api/payments/result/:bookingCode` |
| **User Experience**  | ❌ Lỗi 404                       | ✅ Trang thanh toán thành công             |

---

## 🔄 Quy Trình Thanh Toán Hoàn Chỉnh

```
1. Customer views booking & clicks "Thanh Toán"
   ↓
2. POST /api/payments/bookings/:bookingCode/initiate
   → Backend returns QR code + payment info
   ↓
3. Frontend shows Payment Page with QR
   ↓
4. Customer scans & pays via Momo
   ↓
5. Momo redirects to: http://localhost:5173/payment/:bookingCode
   ↓
6. Frontend loads PaymentResult component
   ↓
7. GET /api/payments/result/:bookingCode
   → Backend returns payment + booking details
   ↓
8. PaymentResult component displays success
   ↓
9. Customer can view booking details or check-in code
```

---

## 🧪 Testing Checklist

- [ ] Backend endpoint `GET /api/payments/result/:bookingCode` returns correct data
- [ ] Frontend PaymentResult component renders correctly
- [ ] Payment status displays correctly (paid/pending/failed)
- [ ] Booking details show correctly
- [ ] Slots information displays with correct dates/times
- [ ] Navigation buttons work (View Booking, View Check-in Code)
- [ ] Error handling displays properly
- [ ] Loading state shows while fetching

---

## 📝 Notes

- **API Base URL**: `http://localhost:5050/api`
- **Frontend Base URL**: `http://localhost:5173`
- **Payment Status**: Can be `paid`, `pending`, `failed`, `refunded`
- **Timezone**: Ensure all dates are converted to user's local timezone on frontend
- **Error Messages**: All in Vietnamese - handle appropriately in UI

---

## 🚀 Next Steps

1. ✅ Backend endpoint implemented
2. 📝 Frontend payment result page (provided above)
3. 🧪 Test end-to-end payment flow
4. 📱 Make responsive for mobile devices
5. 🎨 Add loading animation/skeleton
6. 🔔 Add toast notification for success/error

