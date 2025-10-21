# 📤 GỬI CHO FRONTEND TEAM - Shop Bookings

**Gửi ngày**: 2025-10-18  
**Trạng thái API**: ✅ Ready  
**Status code**: 200 OK

---

## 📋 Thông tin cần thiết

### 1. API Endpoint
```
GET http://localhost:5050/api/shops/me/bookings
```

### 2. Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### 3. Response mẫu (đã test)
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

## 💻 Code sẵn sàng để copy-paste

### React Hook (Copy và dùng ngay)
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

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

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

### React Component (Copy và dùng ngay)
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

  if (loading) return <div>Đang tải dữ liệu...</div>;
  if (error) return <div>Lỗi: {error}</div>;

  return (
    <div className="shop-bookings">
      <h1>📋 Quản lý Bookings</h1>

      <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
        <option value="">📌 Tất cả trạng thái ({total})</option>
        <option value="pending">⏳ Đang chờ</option>
        <option value="confirmed">✅ Xác nhận</option>
        <option value="completed">✔️ Hoàn thành</option>
        <option value="cancelled">❌ Hủy</option>
      </select>

      <table className="bookings-table">
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
          {bookings.map((b) => (
            <tr key={b.BookingCode}>
              <td>{b.BookingCode}</td>
              <td>Sân {b.FieldCode}</td>
              <td>Khách #{b.CustomerUserID}</td>
              <td>{new Date(b.PlayDate).toLocaleDateString('vi-VN')}</td>
              <td>{b.StartTime} - {b.EndTime}</td>
              <td>{b.TotalPrice.toLocaleString('vi-VN')}đ</td>
              <td>{b.PaymentStatus === 'paid' ? '✅ Đã thanh toán' : '⏳ Chưa thanh toán'}</td>
              <td>{b.BookingStatus === 'confirmed' ? '✅' : b.BookingStatus === 'pending' ? '⏳' : '❌'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pagination">
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>Trước</button>
        <span>Trang {page}/{totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Tiếp</button>
      </div>
    </div>
  );
}

export default ShopBookingsPage;
```

---

## 📊 Data Fields Mapping

| API Field | Display | Format |
|-----------|---------|--------|
| BookingCode | Mã Booking | - |
| FieldCode | Mã Sân | - |
| CustomerUserID | ID Khách | - |
| BookingStatus | Trạng thái | pending, confirmed, completed, cancelled |
| PaymentStatus | Thanh toán | pending, paid, failed, refunded |
| PlayDate | Ngày | dd/MM/yyyy |
| StartTime | Bắt đầu | HH:mm |
| EndTime | Kết thúc | HH:mm |
| TotalPrice | Tiền cọc | 2000 → "2.000đ" |
| NetToShop | Tiền shop | 1900 → "1.900đ" |

---

## 🎯 Steps to Implement

1. **Copy Hook** vào `src/hooks/useShopBookings.js`
2. **Copy Component** vào `src/pages/ShopBookingsPage.jsx`
3. **Add Route** vào router: `/shop/bookings`
4. **Update Navigation** để link đến trang này
5. **Test** với backend API
6. **Format** ngày/giờ/tiền theo design

---

## 🧪 Quick Test

```bash
# Test API directly
curl -X GET "http://localhost:5050/api/shops/me/bookings" \
  -H "Authorization: Bearer <your_token>"

# Should return 200 OK with booking data
```

---

## ✅ Checklist

- [ ] Hook import đúng
- [ ] Component render được
- [ ] API call hoạt động
- [ ] Dữ liệu hiển thị đúng
- [ ] Filter hoạt động
- [ ] Pagination hoạt động
- [ ] Format tiền đúng
- [ ] Format ngày đúng

---

## 📞 Troubleshooting

| Problem | Solution |
|---------|----------|
| CORS Error | Check backend CORS config |
| 401 Error | Kiểm tra token trong localStorage |
| Dữ liệu rỗng | Check console.log response |
| Ngày sai | Dùng `toLocaleDateString('vi-VN')` |

---

## 📄 Full Documentation

File `FRONTEND_PROMPT_SHOP_BOOKINGS.md` có:
- ✅ React code đầy đủ
- ✅ Vue.js alternative
- ✅ CSS styling
- ✅ Data mappings
- ✅ UI/UX suggestions

---

**Ready to code?** 🚀

Bắt đầu copy-paste code trên!

