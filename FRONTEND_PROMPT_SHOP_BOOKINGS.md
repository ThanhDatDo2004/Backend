# 📋 FRONTEND PROMPT: Hiển thị Bookings - Quản lý Sân

**Status**: API Ready ✅  
**Endpoint**: `GET /api/shops/me/bookings`  
**Date**: 2025-10-18

---

## 🎯 Yêu Cầu

Hiển thị danh sách bookings của shop tại trang `/shop/bookings` hoặc menu quản lý sân.

API đã sẵn sàng và trả về dữ liệu đầy đủ. Frontend cần:
1. Gọi API để lấy dữ liệu
2. Xử lý response
3. Render UI hiển thị bookings

---

## 📡 API Details

### Endpoint
```
GET /api/shops/me/bookings
```

### Headers
```javascript
{
  "Authorization": "Bearer <jwt_token>",
  "Content-Type": "application/json"
}
```

### Query Parameters (Optional)
```
?status=confirmed       // Filter: pending, confirmed, completed, cancelled
&limit=10              // Pagination: 1-100 (default: 10)
&offset=0              // Pagination: skip N items
&sort=CreateAt         // Sort: CreateAt, PlayDate, TotalPrice, BookingStatus
&order=DESC            // Order: ASC or DESC
```

### Response Structure
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Danh sách booking của shop",
  "data": {
    "data": [
      {
        "BookingCode": 46,
        "FieldCode": 48,
        "CustomerUserID": 1,
        "BookingStatus": "confirmed",
        "PaymentStatus": "paid",
        "PlayDate": "2025-10-21T17:00:00.000Z",
        "StartTime": "09:00:00",
        "EndTime": "10:00:00",
        "TotalPrice": 2000,
        "NetToShop": 1900,
        "CheckinCode": "3QA5LM91",
        "CheckinTime": null,
        "CreateAt": "2025-10-18T03:22:21.000Z",
        "UpdateAt": "2025-10-18T03:22:40.000Z"
      }
    ],
    "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 28
    }
  }
}
```

---

## 💻 Code Example - React

### 1. Hook để fetch dữ liệu

```javascript
import { useState, useEffect } from 'react';

export function useShopBookings(status = '', limit = 10, offset = 0) {
  const [bookings, setBookings] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBookings();
  }, [status, limit, offset]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      params.append('limit', limit);
      params.append('offset', offset);

      const response = await fetch(
        `http://localhost:5050/api/shops/me/bookings?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();
      setBookings(result.data.data || []);
      setTotal(result.data.pagination?.total || 0);
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  return { bookings, total, loading, error, refetch: fetchBookings };
}
```

### 2. Component hiển thị Bookings

```javascript
import React, { useState } from 'react';
import { useShopBookings } from './hooks/useShopBookings';

function ShopBookingsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;
  const offset = (page - 1) * limit;

  const { bookings, total, loading, error } = useShopBookings(status, limit, offset);
  const totalPages = Math.ceil(total / limit);

  if (loading) return <div className="loading">Đang tải dữ liệu...</div>;
  if (error) return <div className="error">Lỗi: {error}</div>;

  return (
    <div className="shop-bookings-container">
      <h1>📋 Quản lý Bookings</h1>

      {/* Filter */}
      <div className="filter-section">
        <select 
          value={status} 
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="filter-select"
        >
          <option value="">📌 Tất cả trạng thái ({total})</option>
          <option value="pending">⏳ Đang chờ</option>
          <option value="confirmed">✅ Xác nhận</option>
          <option value="completed">✔️ Hoàn thành</option>
          <option value="cancelled">❌ Hủy</option>
        </select>
      </div>

      {/* Bookings Table */}
      <table className="bookings-table">
        <thead>
          <tr>
            <th>Mã Booking</th>
            <th>Sân</th>
            <th>Khách</th>
            <th>Ngày</th>
            <th>Giờ</th>
            <th>Tiền</th>
            <th>Thanh toán</th>
            <th>Trạng thái</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {bookings.length > 0 ? (
            bookings.map((booking) => (
              <tr key={booking.BookingCode} className={`status-${booking.BookingStatus}`}>
                <td className="code">{booking.BookingCode}</td>
                <td className="field">Sân {booking.FieldCode}</td>
                <td className="customer">Khách #{booking.CustomerUserID}</td>
                <td className="date">
                  {new Date(booking.PlayDate).toLocaleDateString('vi-VN')}
                </td>
                <td className="time">
                  {booking.StartTime} - {booking.EndTime}
                </td>
                <td className="price">
                  {booking.TotalPrice?.toLocaleString('vi-VN')}đ
                </td>
                <td className={`payment ${booking.PaymentStatus}`}>
                  {getPaymentBadge(booking.PaymentStatus)}
                </td>
                <td className={`status ${booking.BookingStatus}`}>
                  {getStatusBadge(booking.BookingStatus)}
                </td>
                <td className="actions">
                  <button onClick={() => viewDetail(booking.BookingCode)}>
                    👁️ Xem
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="9" className="no-data">
                Không có booking nào
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="pagination">
        <button 
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          ← Trước
        </button>
        <span className="page-info">
          Trang {page}/{totalPages}
        </span>
        <button 
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Tiếp → 
        </button>
      </div>
    </div>
  );
}

// Helper functions
function getStatusBadge(status) {
  const badges = {
    'pending': '⏳ Đang chờ',
    'confirmed': '✅ Xác nhận',
    'completed': '✔️ Hoàn thành',
    'cancelled': '❌ Hủy'
  };
  return badges[status] || status;
}

function getPaymentBadge(status) {
  const badges = {
    'pending': '⏳ Chưa thanh toán',
    'paid': '✅ Đã thanh toán',
    'failed': '❌ Thanh toán thất bại',
    'refunded': '↩️ Hoàn tiền'
  };
  return badges[status] || status;
}

function viewDetail(bookingCode) {
  console.log('View detail:', bookingCode);
  // Navigate to detail page hoặc show modal
}

export default ShopBookingsPage;
```

### 3. CSS Styling

```css
.shop-bookings-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.filter-section {
  margin: 20px 0;
  display: flex;
  gap: 10px;
}

.filter-select {
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 14px;
  cursor: pointer;
}

.bookings-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.bookings-table th {
  background: #f5f5f5;
  padding: 12px;
  text-align: left;
  font-weight: 600;
  border-bottom: 2px solid #ddd;
}

.bookings-table td {
  padding: 12px;
  border-bottom: 1px solid #eee;
}

.bookings-table tr:hover {
  background: #f9f9f9;
}

.status-confirmed {
  background-color: #e8f5e9 !important;
}

.status-pending {
  background-color: #fff3e0 !important;
}

.status-cancelled {
  background-color: #ffebee !important;
}

.payment.paid {
  color: #4caf50;
  font-weight: 600;
}

.payment.pending {
  color: #ff9800;
  font-weight: 600;
}

.status.confirmed {
  color: #4caf50;
  font-weight: 600;
}

.status.pending {
  color: #ff9800;
  font-weight: 600;
}

.price {
  font-weight: 600;
  color: #e53935;
}

.actions button {
  padding: 6px 12px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.actions button:hover {
  background: #1976d2;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
}

.pagination button {
  padding: 8px 16px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.pagination button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.no-data {
  text-align: center;
  color: #999;
  padding: 40px !important;
}
```

---

## 🔄 Alternative: Vue.js

```vue
<template>
  <div class="shop-bookings">
    <h1>📋 Quản lý Bookings</h1>

    <!-- Filter -->
    <select v-model="status" @change="page = 1">
      <option value="">Tất cả trạng thái</option>
      <option value="pending">⏳ Đang chờ</option>
      <option value="confirmed">✅ Xác nhận</option>
      <option value="completed">✔️ Hoàn thành</option>
      <option value="cancelled">❌ Hủy</option>
    </select>

    <!-- Loading -->
    <div v-if="loading" class="loading">Đang tải...</div>

    <!-- Error -->
    <div v-if="error" class="error">{{ error }}</div>

    <!-- Table -->
    <table v-if="!loading && bookings.length > 0" class="table">
      <thead>
        <tr>
          <th>Mã</th>
          <th>Sân</th>
          <th>Khách</th>
          <th>Ngày</th>
          <th>Giờ</th>
          <th>Tiền</th>
          <th>Thanh toán</th>
          <th>Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="booking in bookings" :key="booking.BookingCode">
          <td>{{ booking.BookingCode }}</td>
          <td>Sân {{ booking.FieldCode }}</td>
          <td>Khách #{{ booking.CustomerUserID }}</td>
          <td>{{ formatDate(booking.PlayDate) }}</td>
          <td>{{ booking.StartTime }} - {{ booking.EndTime }}</td>
          <td>{{ formatPrice(booking.TotalPrice) }}</td>
          <td>{{ getPaymentStatus(booking.PaymentStatus) }}</td>
          <td>{{ getStatus(booking.BookingStatus) }}</td>
        </tr>
      </tbody>
    </table>

    <!-- Pagination -->
    <div class="pagination">
      <button @click="page--" :disabled="page === 1">Trước</button>
      <span>Trang {{ page }}/{{ totalPages }}</span>
      <button @click="page++" :disabled="page >= totalPages">Tiếp</button>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue';

export default {
  setup() {
    const bookings = ref([]);
    const total = ref(0);
    const loading = ref(true);
    const error = ref(null);
    const status = ref('');
    const page = ref(1);
    const limit = 10;

    const offset = computed(() => (page.value - 1) * limit);
    const totalPages = computed(() => Math.ceil(total.value / limit));

    const fetchBookings = async () => {
      try {
        loading.value = true;
        const token = localStorage.getItem('authToken');
        const params = new URLSearchParams();
        if (status.value) params.append('status', status.value);
        params.append('limit', limit);
        params.append('offset', offset.value);

        const response = await fetch(
          `http://localhost:5050/api/shops/me/bookings?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const result = await response.json();
        bookings.value = result.data.data;
        total.value = result.data.pagination.total;
      } catch (err) {
        error.value = err.message;
      } finally {
        loading.value = false;
      }
    };

    const formatDate = (dateStr) => {
      return new Date(dateStr).toLocaleDateString('vi-VN');
    };

    const formatPrice = (price) => {
      return price.toLocaleString('vi-VN') + 'đ';
    };

    const getStatus = (status) => {
      const map = {
        'pending': '⏳ Đang chờ',
        'confirmed': '✅ Xác nhận',
        'completed': '✔️ Hoàn thành',
        'cancelled': '❌ Hủy'
      };
      return map[status] || status;
    };

    const getPaymentStatus = (status) => {
      const map = {
        'pending': '⏳ Chưa thanh toán',
        'paid': '✅ Đã thanh toán',
        'failed': '❌ Thất bại',
        'refunded': '↩️ Hoàn tiền'
      };
      return map[status] || status;
    };

    onMounted(() => fetchBookings());
    watch([status, page], () => fetchBookings());

    return {
      bookings, total, loading, error, status, page,
      totalPages, formatDate, formatPrice, getStatus, getPaymentStatus
    };
  }
};
</script>
```

---

## 📝 Data Field Mappings

| API Field | Vietnamese Name | Type | Format |
|-----------|-----------------|------|--------|
| BookingCode | Mã Booking | int | - |
| FieldCode | Mã Sân | int | - |
| CustomerUserID | ID Khách | int | - |
| BookingStatus | Trạng thái | string | pending, confirmed, completed, cancelled |
| PaymentStatus | Thanh toán | string | pending, paid, failed, refunded |
| PlayDate | Ngày | date | YYYY-MM-DD |
| StartTime | Giờ bắt đầu | time | HH:MM:SS |
| EndTime | Giờ kết thúc | time | HH:MM:SS |
| TotalPrice | Tiền cọc | decimal | VND |
| NetToShop | Tiền shop nhận | decimal | VND |
| CheckinCode | Mã check-in | string | - |
| CheckinTime | Thời gian check-in | datetime | - |

---

## 🎨 UI/UX Suggestions

### Status Colors
```
pending     → Màu cam (#ff9800) - Đang chờ
confirmed   → Màu xanh (#4caf50) - Xác nhận
completed   → Màu xanh đậm (#2e7d32) - Hoàn thành
cancelled   → Màu đỏ (#f44336) - Hủy
```

### Payment Colors
```
pending     → Màu cam (#ff9800) - Chưa thanh toán
paid        → Màu xanh (#4caf50) - Đã thanh toán
failed      → Màu đỏ (#f44336) - Thanh toán thất bại
refunded    → Màu xám (#9e9e9e) - Đã hoàn tiền
```

---

## 🔗 Integration Steps

1. ✅ Copy hook `useShopBookings` vào project
2. ✅ Copy component `ShopBookingsPage` vào project
3. ✅ Copy CSS styling vào stylesheet
4. ✅ Thêm route vào router: `/shop/bookings`
5. ✅ Update navigation menu để link đến trang này
6. ✅ Test với backend API
7. ✅ Format tiền VND nếu cần
8. ✅ Xử lý timezone nếu cần

---

## 🧪 Testing Checklist

- [ ] Hiển thị được danh sách bookings
- [ ] Filter theo trạng thái hoạt động
- [ ] Pagination hoạt động
- [ ] Tiền hiển thị đúng format VND
- [ ] Ngày/giờ hiển thị đúng format
- [ ] Status badges hiển thị màu đúng
- [ ] Loading state hoạt động
- [ ] Error handling hoạt động
- [ ] Responsive trên mobile

---

## 📞 Issues & Solutions

### "CORS Error"
→ Đảm bảo backend CORS headers đã cấu hình đúng

### "401 Unauthorized"
→ Kiểm tra token trong localStorage

### "Dữ liệu không hiện"
→ Check browser console cho errors

### "Ngày/giờ sai múi giờ"
→ Thêm `new Date(dateStr).toLocaleDateString()` để format

---

## 📚 Resources

- API Response: Response object từ backend
- Date Formatting: `toLocaleDateString('vi-VN')`
- Currency: `.toLocaleString('vi-VN')` + 'đ'
- Status: pending, confirmed, completed, cancelled

---

**Ready to implement?** 🚀

Bắt đầu từ Hook → Component → CSS, rồi test với backend!

