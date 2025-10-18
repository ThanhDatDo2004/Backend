# RÀ SOÁT VÀ BÁNG CÁO TRạNG THÁI CODE

## 📋 YÊU CẦU VÀ QÚIDỊCH HOẠT ĐỘNG (từ README.md)

Website cho thuê sân thể thao có 3 vai trò chính:
- **Khách hàng (Customer/cus)**: Đặt sân
- **Chủ sân (Shop/shop)**: Quản lý sân
- **Quản lý website (Admin/admin)**: Duyệt shop, quản lý hệ thống

### Quy trình chính:
1. Shop đăng ký → Admin duyệt → Shop có hiệu lực
2. Khách hàng đặt sân → Thanh toán → Hệ thống xác nhận
3. Thanh toán: Admin nhận 100%, sau khi khách hoàn thành, 95% gửi về tài khoản ngân hàng shop, 5% giữ lại admin
4. Khách hoàn thành → Có thể đánh giá sân

---

## ✅ CÁC PHẦN ĐÃ HOÀN THÀNH

### 1. **Hệ Thống Xác Thực & Phân Quyền (A - Users & Roles)**
- ✅ **Login**: Hỗ trợ email/phone, mật khẩu được hash bcrypt
  - File: `auth.controller.ts` (lines 28-117)
  - File: `auth.service.ts` (password hashing/verification)
  
- ✅ **Đăng Ký Khách Hàng (Customer Registration)**
  - File: `auth.controller.ts` (lines 308-355 - register function)
  - Lưu vào database với level_code = 'cus'
  
- ✅ **Quên Mật Khẩu / Reset Password**
  - File: `auth.controller.ts` (lines 202-298)
  - Gửi email với JWT token, người dùng set mật khẩu mới
  - Sử dụng mail.service.ts để gửi email
  
- ✅ **Xác Minh Email (OTP)**
  - File: `auth.controller.ts` (lines 120-187)
  - sendCode + verifyCode endpoints
  - Lưu OTP trong memory với TTL 15 phút (có thể cải thiện lưu vào DB)
  
- ✅ **Phân Quyền Người Dùng**
  - File: `Users_Level` table - 3 mức: cus, shop, admin
  - Middleware: `auth.middleware.ts` - xác thực JWT token
  - Lưu role trong JWT payload

### 2. **Quản Lý Shop (B - Shops & Bank Accounts)**
- ✅ **Yêu Cầu Mở Shop**
  - File: `shop.controller.ts` - submitRequest (lines 22-51)
  - File: `shopApplication.service.ts` - createRequest
  - Lưu vào `Shop_Applications` table
  - Gửi email thông báo (sendShopRequestEmail)

- ✅ **Admin Duyệt/Từ Chối Shop Request**
  - File: `admin.controller.ts` - updateShopRequestStatus (lines 148-217)
  - File: `admin.service.ts` - updateShopRequestStatus (lines 340-461)
  - Tự động tạo shop và cập nhật user level thành 'shop'
  
- ✅ **Cập Nhật Thông Tin Shop**
  - File: `shop.controller.ts` - updateMe (lines 53-95)
  - File: `shop.service.ts` - updateByUserId (lines 91-180)
  - Hỗ trợ cập nhật tên, địa chỉ, tài khoản ngân hàng
  
- ✅ **Lấy Thông Tin Shop Hiện Tại**
  - File: `shop.controller.ts` - current (lines 97-120)
  - File: `shop.service.ts` - getByUserId, getByCode
  
- ✅ **Lưu Tài Khoản Ngân Hàng Shop**
  - File: `Shop_Bank_Accounts` table
  - Trong updateByUserId, tự động thêm/cập nhật tài khoản mặc định

### 3. **Quản Lý Sân (C - Fields, Pricing & Slots)**
- ✅ **Tạo Sân (Shop Owner)**
  - File: `shopField.controller.ts` - createForMe/create
  - File: `field.model.ts` - insertField
  - Hỗ trợ upload hình ảnh (Field_Images)
  
- ✅ **Danh Sách Sân (Công Khai)**
  - File: `field.controller.ts` - list (lines 24-116)
  - File: `field.service.ts` - list
  - Hỗ trợ filter: search, sportType, location, price, status
  - Hỗ trợ sort: price, rating, name
  - Pagination
  
- ✅ **Chi Tiết Sân**
  - File: `field.controller.ts` - detail (lines 118-141)
  - File: `field.service.ts` - getById
  - Trả về đầy đủ info: giá, hình ảnh, đánh giá, thông tin shop
  
- ✅ **Tải Ảnh Sân**
  - File: `field.controller.ts` - uploadImage (lines 143-176)
  - File: `upload.middleware.ts` - fieldImageUpload
  - Hỗ trợ local storage hoặc S3
  
- ✅ **Cập Nhật Sân**
  - File: `shopField.controller.ts` - updateForMe/update
  - File: `field.model.ts` - updateField
  
- ✅ **Xóa Sân (Soft Delete)**
  - File: `shopField.controller.ts` - removeForMe
  - File: `field.model.ts` - softDeleteField (cập nhật status = 'inactive')

### 4. **Giá & Khung Giờ (Pricing & Slots)**
- ✅ **Quản Lý Giá Theo Ngày/Giờ**
  - File: `pricing.controller.ts` - CRUD operations
  - File: `Field_Pricing` table - DayOfWeek, StartTime, EndTime, PricePerHour
  
- ✅ **Xem Khung Giờ Trống**
  - File: `field.controller.ts` - availability (lines 178-210)
  - File: `field.service.ts` - getAvailability
  - Trả về slots available/booked/held/blocked

### 5. **Đặt Sân & Thanh Toán (D - Bookings & Payments)**
- ✅ **Xác Nhận Đặt Sân**
  - File: `field.controller.ts` - confirmBooking (lines 212-255)
  - File: `booking.service.ts` - confirmFieldBooking (lines 218-281)
  - Tạo booking record, cập nhật slot status → 'booked'
  - Trả về booking_code + transaction_id (mock)
  
- ✅ **Tạo Field_Slots**
  - Tự động tạo khi xác nhận booking nếu slot chưa tồn tại
  - Hỗ trợ lock (FOR UPDATE) để tránh race condition
  
- ⚠️ **Thanh Toán (MOCK - Chưa Thực Hiện Thực)**
  - File: `booking.service.ts` - confirmFieldBooking trả về `payment_status: "mock_success"`
  - ❌ Chưa integrate thực payment gateway (Momo, bank transfer, etc.)
  - ❌ Chưa tạo record trong `Payments_Admin` table
  - ❌ Chưa xử lý tính toán fee (5% platform fee, 95% to shop)

### 6. **Admin Panel**
- ✅ **Liệt Kê Shop**
  - File: `admin.controller.ts` - listShops (lines 17-29)
  - File: `admin.service.ts` - listShops (lines 243-313)
  
- ✅ **Liệt Kê Người Dùng**
  - File: `admin.controller.ts` - listUsers (lines 31-43)
  - File: `admin.service.ts` - listUsers (lines 139-159)
  
- ✅ **Quản Lý Trạng Thái Người Dùng (Lock/Unlock)**
  - File: `admin.controller.ts` - updateUserStatus (lines 59-105)
  - File: `admin.service.ts` - updateUserStatus (lines 182-241)
  
- ✅ **Liệt Kê Shop Request**
  - File: `admin.controller.ts` - listShopRequests (lines 107-119)
  - File: `admin.service.ts` - listShopRequests (lines 315-324)

---

## ❌ CÁC PHẦN CHƯA HOÀN THÀNH HOẶC CẦN CẢI THIỆN

### 1. **Thanh Toán (Payment System)** - ⚠️ QUAN TRỌNG
- ❌ **Mục Đích**: Theo README: "Khi hệ thống xác nhận đã thanh toán thành công thì số tiền hoàn toàn gửi về tài khoản ngân hàng admin"
- **Vấn Đề**:
  - Chỉ có mock payment, không tích hợp thực
  - Không tạo record `Payments_Admin` trong database
  - Không tính toán fee (5% admin, 95% shop)
  - Không có `Wallet_Transactions` record
  - Không có `Payout_Requests` cho shop
  - Chưa có QR code Momo như yêu cầu README
  
- **Cần Implement**:
  1. Tích hợp Momo/payment gateway
  2. Tạo `Payments_Admin` record khi thanh toán thành công
  3. Cập nhật `Shop_Wallets` balance
  4. Tạo `Wallet_Transactions` record
  5. Chuẩn bị `Payout_Requests` cho shop yêu cầu rút tiền

### 2. **Rút Tiền (Payout)** - ❌ KHÔNG CÓ
- **Vấn Đề**:
  - Chưa có endpoint để shop yêu cầu rút tiền
  - Chưa có endpoint để admin duyệt rút tiền
  - Chưa có logic tính toán 95% net to shop
  - Chưa có `Payout_Requests` management
  
- **Cần Implement**:
  1. POST `/api/shops/me/payout-requests` - Tạo yêu cầu rút tiền
  2. GET `/api/shops/me/payout-requests` - Liệt kê yêu cầu rút tiền
  3. GET `/api/admin/payout-requests` - Admin liệt kê rút tiền
  4. PATCH `/api/admin/payout-requests/:id/approve` - Duyệt rút tiền
  5. PATCH `/api/admin/payout-requests/:id/reject` - Từ chối rút tiền

### 3. **Ví Shop (Shop Wallet)** - ⚠️ CHƯA ĐẦY ĐỦ
- ⚠️ **Vấn Đề**:
  - Table `Shop_Wallets` tồn tại nhưng chưa được sử dụng
  - Không có endpoint GET wallet balance
  - Không có transaction history
  
- **Cần Implement**:
  1. GET `/api/shops/me/wallet` - Lấy balance hiện tại
  2. GET `/api/shops/me/wallet/transactions` - Lịch sử giao dịch

### 4. **Đánh Giá (Reviews)** - ⚠️ CHƯA IMPLEMENT
- ❌ **Vấn Đề**:
  - Table `Reviews` tồn tại nhưng không có endpoint
  - Không có endpoint tạo review
  - Không có endpoint liệt kê review
  
- **Cần Implement**:
  1. POST `/api/fields/:id/reviews` - Tạo review (yêu cầu auth + đã booking)
  2. GET `/api/fields/:id/reviews` - Liệt kê review
  3. Xác thực: Chỉ được review sau khi booking completed

### 5. **Thông Báo (Notifications)** - ❌ KHÔNG CÓ
- ❌ **Vấn Đề**:
  - Table `Notifications` tồn tại nhưng chưa được sử dụng
  - Không có endpoint để lấy/quản lý thông báo
  - Không có logic tạo thông báo khi có events
  
- **Cần Implement**:
  1. GET `/api/notifications` - Liệt kê thông báo của user
  2. PATCH `/api/notifications/:id/read` - Đánh dấu đã đọc
  3. Tự động tạo thông báo khi:
     - Booking được tạo → gửi cho shop
     - Thanh toán thành công → gửi cho customer + shop
     - Rút tiền được duyệt → gửi cho shop

### 6. **Checkout Code (Mã xác nhận)** - ⚠️ CHƯA IMPLEMENT
- ⚠️ **Vấn Đề**:
  - Column `CheckinCode` tồn tại trong `Bookings` table nhưng chưa sử dụng
  - README yêu cầu: "Thanh toán thành công sẽ hiện ra mã code cho khách hàng lưu"
  - Không có endpoint để verify checkin code
  
- **Cần Implement**:
  1. Tạo unique CheckinCode khi booking thành công
  2. POST `/api/bookings/:id/verify-checkin` - Verify checkin code

### 7. **Booking Status Management** - ⚠️ CHƯA ĐẦY ĐỦ
- ⚠️ **Vấn Đề**:
  - Column `BookingStatus` có nhưng logic chuyển đổi trạng thái chưa hoàn thiện
  - Chỉ có 'pending' → 'booked', không có 'completed', 'cancelled'
  - Không có endpoint để cập nhật trạng thái booking
  - Không có logic tự động chuyển 'booked' → 'completed' sau thời gian
  
- **Cần Implement**:
  1. PATCH `/api/bookings/:id/status` - Cập nhật trạng thái (admin/shop)
  2. Scheduled job để auto-complete booking sau thời gian
  3. PATCH `/api/bookings/:id/cancel` - Hủy booking (trước 2h)

### 8. **Email Verification (Setup Database)** - ⚠️ CHƯA HOÀN THIỆN
- ⚠️ **Vấn Đề**:
  - Table `Users_Verification` tồn tại nhưng OTP lưu trong memory
  - Endpoint `/api/auth/verify-email` chỉ trả về thành công mà không verify gì
  - Không check email đã được verify hay chưa
  
- **Nên Cải Thiện**:
  1. Lưu OTP vào database thay vì memory
  2. Implement thực verify email vào bước register
  3. Check `Users_Verification.Consumed` trước khi cho đăng nhập

### 9. **Refresh Token** - ⚠️ CHƯA IMPLEMENT
- ⚠️ **Vấn Đề**:
  - JWT service có generateRefreshToken nhưng không có endpoint
  - Không có cơ chế refresh token
  
- **Cần Implement**:
  1. POST `/api/auth/refresh-token` - Lấy access token mới từ refresh token

### 10. **Validation & Error Handling** - ⚠️ CHƯA ĐẦY ĐỦ
- ⚠️ **Vấn Đề**:
  - Một số endpoint không validate đầy đủ input
  - Một số error message không rõ ràng
  - Không có consistent error response format
  
- **Nên Cải Thiện**:
  1. Thêm zod validation cho tất cả endpoints
  2. Định nghĩa clear error codes và messages
  3. Standardize error response format

### 11. **Upload File Management** - ⚠️ CHƯA HOÀN THIỆN
- ⚠️ **Vấn Đề**:
  - S3 service tồn tại nhưng không rõ configuration
  - Không có cleanup cũ images khi xóa sân
  - File path validation có thể cần cải thiện
  
- **Nên Cải Thiện**:
  1. Test S3 upload/download
  2. Thêm image size validation
  3. Cleanup S3 files khi xóa sân (soft delete)

### 12. **Field Slots Pre-generation** - ⚠️ CHƯA IMPLEMENT
- ⚠️ **Vấn Đề**:
  - Hiện tại slot chỉ tạo khi booking
  - Không có cơ chế pre-generate slots theo pricing rules
  - Không có endpoint để shop setup operating hours tự động tạo slots
  
- **Nên Cải Thiện**:
  1. Thêm job schedule generate slots từ pricing + date range
  2. Shop có thể tạo "blocked" slots cho maintenance

### 13. **Transaction & Race Condition** - ⚠️ CHƯA ĐẦY ĐỦ
- ⚠️ **Vấn Đề**:
  - confirmFieldBooking sử dụng transaction + FOR UPDATE
  - Nhưng không có retry logic nếu transaction fail
  - Không có deadlock handling
  
- **Nên Cải Thiện**:
  1. Thêm retry mechanism
  2. Better error handling cho transaction failures

### 14. **Pricing Service** - ⚠️ CHƯA HOÀN THIỆN
- ⚠️ **Vấn Đề**:
  - File `pricing.service.ts` tồn tại nhưng không tìm thấy nó
  - Cần xem logic tính giá dựa trên DayOfWeek, StartTime, EndTime
  
- **Nên Cải Thiện**:
  1. Verify pricing calculation logic
  2. Handle default price fallback

### 15. **Admin Bank Accounts** - ⚠️ CHƯA QUẢN LÝ
- ❌ **Vấn Đề**:
  - Table `Admin_Bank_Accounts` tồn tại nhưng không có endpoint
  - Admin không thể setup bank account để nhận tiền
  
- **Cần Implement**:
  1. GET `/api/admin/bank-accounts` - Liệt kê
  2. POST `/api/admin/bank-accounts` - Tạo
  3. PUT `/api/admin/bank-accounts/:id` - Cập nhật

---

## 📊 TÓMT TẮT TÌNH TRẠNG

| Phần | Trạng Thái | Mức Độ Ưu Tiên |
|------|----------|----------------|
| **Authentication** | ✅ Hoàn thành | - |
| **User Roles** | ✅ Hoàn thành | - |
| **Shop Management** | ✅ Hoàn thành | - |
| **Field CRUD** | ✅ Hoàn thành | - |
| **Pricing** | ⚠️ Tạo được nhưng validation chưa đầy đủ | Medium |
| **Field Slots** | ✅ Hoàn thành (tạo khi booking) | - |
| **Booking** | ⚠️ Hoàn thành nhưng chưa đầy đủ flow | High |
| **Payment System** | ❌ Mock only, chưa thực | 🔴 CRITICAL |
| **Payout/Rút tiền** | ❌ Không có | 🔴 CRITICAL |
| **Shop Wallet** | ⚠️ Table tồn tại nhưng chưa dùng | High |
| **Reviews** | ❌ Không có | Medium |
| **Notifications** | ❌ Không có | Medium |
| **CheckinCode** | ⚠️ Chưa implement | Low |
| **Email Verification** | ⚠️ Logic chưa hoàn thiện | Medium |
| **Refresh Token** | ❌ Không có endpoint | Low |
| **Admin Bank Accounts** | ❌ Không có management | High |

---

## 🔴 NHỮNG PHẦN QUAN TRỌNG CẦN ƯU TIÊN

### Cấp độ CRITICAL (Must-Have):
1. **Payment System** - Tích hợp thực payment gateway + tính fee
2. **Payout System** - Cho phép shop rút tiền + admin quản lý
3. **Booking Status Flow** - Hoàn thiện trạng thái booking (pending → confirmed → completed)

### Cấp độ HIGH (Should-Have):
1. **Admin Bank Accounts Management** - Setup tài khoản nhận tiền
2. **Shop Wallet** - Xem balance + transaction history
3. **CheckinCode** - Mã xác nhận khi thanh toán
4. **Notifications** - Thông báo các events

### Cấp độ MEDIUM (Nice-to-Have):
1. **Reviews** - Đánh giá sân
2. **Email Verification DB** - Lưu OTP vào DB thay vì memory
3. **Pre-generate Slots** - Tự động tạo slots theo pricing

### Cấp độ LOW (Future):
1. **Refresh Token Endpoint** - JWT refresh mechanism
2. **Advanced Validations** - Toàn bộ input validation
3. **Transaction Retry** - Better error handling

---

## 🎯 KHUYẾN NGHỊ TIẾP THEO

1. **Tạo Payment Service** - Tích hợp Momo hoặc payment gateway khác
2. **Implement Payout Logic** - Tính toán fee + transfer to shop bank
3. **Create Notification System** - Kích hoạt khi có events
4. **Complete Booking Lifecycle** - Từ pending → completed → review
5. **Add Comprehensive Testing** - Unit + integration tests
