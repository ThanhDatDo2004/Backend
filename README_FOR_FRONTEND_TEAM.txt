╔══════════════════════════════════════════════════════════════════════════════╗
║                      SHOP BOOKINGS - FRONTEND PROMPT                         ║
║                        GỬI CHO FRONTEND TEAM                                ║
║                          2025-10-18                                          ║
╚══════════════════════════════════════════════════════════════════════════════╝

✅ API STATUS
──────────────────────────────────────────────────────────────────────────────
Endpoint:  GET /api/shops/me/bookings
Status:    200 OK ✅
Response:  Full booking data ready

Test Output:
  Trả về 28 bookings tổng cộng
  Mỗi booking có: Mã, Sân, Khách, Ngày, Giờ, Tiền, Thanh toán

✓ API hoàn toàn sẵn sàng cho frontend


📋 HƯỚNG DẪN NHANH
──────────────────────────────────────────────────────────────────────────────

1️⃣ ĐỌC CÁC FILE
   → SEND_TO_FRONTEND_TEAM.md (ngắn gọn, code sẵn sàng)
   → FRONTEND_PROMPT_SHOP_BOOKINGS.md (chi tiết đầy đủ)

2️⃣ COPY CODE
   • useShopBookings hook
   • ShopBookingsPage component
   • CSS styling

3️⃣ TÍCH HỢP
   • Thêm vào project React/Vue
   • Thêm route /shop/bookings
   • Update navigation menu

4️⃣ TEST
   • npm start
   • Vào http://localhost:3000/shop/bookings
   • Xem dữ liệu hiển thị


📊 DỮ LIỆU TRẢ VỀ
──────────────────────────────────────────────────────────────────────────────

{
  "BookingCode": 46,         → Mã booking
  "FieldCode": 48,           → Mã sân
  "CustomerUserID": 1,       → ID khách
  "BookingStatus": "confirmed",      → Trạng thái booking
  "PaymentStatus": "paid",           → Trạng thái thanh toán
  "PlayDate": "2025-10-21",  → Ngày thi đấu
  "StartTime": "09:00:00",   → Giờ bắt đầu
  "EndTime": "10:00:00",     → Giờ kết thúc
  "TotalPrice": 2000,        → Tiền cọc
  "NetToShop": 1900,         → Tiền shop nhận
  "CheckinCode": "3QA5LM91", → Mã check-in
}


💻 CODE SỲN SÀNG COPY-PASTE
──────────────────────────────────────────────────────────────────────────────

React Hook:
  import { useState, useEffect } from 'react';
  
  export function useShopBookings(status = '', limit = 10, offset = 0) {
    const [bookings, setBookings] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
  
    useEffect(() => {
      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      params.append('limit', limit);
      params.append('offset', offset);
  
      fetch(`http://localhost:5050/api/shops/me/bookings?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      .then(r => r.json())
      .then(d => {
        setBookings(d.data.data || []);
        setTotal(d.data.pagination?.total || 0);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
    }, [status, limit, offset]);
  
    return { bookings, total, loading, error };
  }


🎯 STEPS
──────────────────────────────────────────────────────────────────────────────

Step 1: Copy Hook
  → Paste vào src/hooks/useShopBookings.js

Step 2: Copy Component
  → Paste vào src/pages/ShopBookingsPage.jsx

Step 3: Add Route
  → Thêm vào router: path: '/shop/bookings'

Step 4: Test
  → Click vào menu Bookings
  → Xem dữ liệu hiển thị


✨ ĐIỂM CẦN LƯU Ý
──────────────────────────────────────────────────────────────────────────────

✓ Format tiền:     2000 → new Intl.NumberFormat('vi-VN').format(2000) + 'đ'
✓ Format ngày:     "2025-10-21" → new Date("2025-10-21").toLocaleDateString('vi-VN')
✓ Format giờ:      "09:00:00" → "09:00" (cắt bỏ giây)
✓ Token:           localStorage.getItem('authToken')
✓ Status colors:   pending=cam, confirmed=xanh, cancelled=đỏ


📁 FILE CẦN THAM KHẢO
──────────────────────────────────────────────────────────────────────────────

1. SEND_TO_FRONTEND_TEAM.md
   - Code React đầy đủ
   - Dữ liệu mẫu
   - Steps to implement

2. FRONTEND_PROMPT_SHOP_BOOKINGS.md
   - React + Vue code
   - CSS styling
   - Troubleshooting
   - UI/UX suggestions

3. SIMPLIFIED_QUERY_UPDATE.md
   - API query details
   - Performance info


🧪 TEST COMMAND
──────────────────────────────────────────────────────────────────────────────

# Test trực tiếp API
curl -X GET "http://localhost:5050/api/shops/me/bookings" \
  -H "Authorization: Bearer <your_token>"

Expected: 200 OK với 28 bookings


✅ QUALITY CHECKLIST
──────────────────────────────────────────────────────────────────────────────

- [ ] Hook fetch đúng endpoint
- [ ] Component render được table
- [ ] Data display với format đúng
- [ ] Filter by status hoạt động
- [ ] Pagination hoạt động
- [ ] Tiền display format: 2000đ
- [ ] Ngày display format: dd/MM/yyyy
- [ ] Loading state show khi fetch
- [ ] Error state show khi có lỗi
- [ ] Responsive mobile


🔧 TROUBLESHOOTING
──────────────────────────────────────────────────────────────────────────────

Problem: CORS Error
→ Backend CORS config sẵn sàng

Problem: 401 Unauthorized
→ Kiểm tra token trong localStorage

Problem: Dữ liệu không hiển thị
→ Open browser DevTools → Console
→ Xem có error không
→ Check fetch response status

Problem: Ngày/giờ sai múi giờ
→ Dùng toLocaleDateString('vi-VN')


📞 CONTACT BACKEND TEAM
──────────────────────────────────────────────────────────────────────────────

Nếu có vấn đề:
- API đã test ✅
- Response format verify ✅
- CORS headers configure ✅
- Query performance optimize ✅

Everything ready on backend!


🎉 SUMMARY
──────────────────────────────────────────────────────────────────────────────

✅ API sẵn sàng 100%
✅ Code React/Vue sẵn sàng
✅ CSS styling sẵn sàng
✅ Documentation đầy đủ
✅ Test data có sẵn

➜ Bắt đầu code ngay!

═══════════════════════════════════════════════════════════════════════════════

Gửi files này cho Frontend Team:
1. SEND_TO_FRONTEND_TEAM.md (START HERE!)
2. FRONTEND_PROMPT_SHOP_BOOKINGS.md
3. SIMPLIFIED_QUERY_UPDATE.md (Reference)

Họ có thể bắt đầu implement ngay!

