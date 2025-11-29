<!-- - register: -->
schema validate bằng zod.
+ username min 2 kí tự
+ emai phải đúng định dạng string
+ password tối thiểu 6 kí tự
+ nếu không đúng định dạng thì in ra lỗi
+ nếu đúng thì lấy username, email, password
+ gọi authModel.findByEmailOrUserId xem có tồn tại email trong hệ thống chưa, nếu có thì in lỗi
+ gọi authModel.getCusLevelCode nếu không tôn tại level là cus thì in lỗi
+ gọi bcrypt.hash để hash password
+ gọi authModel.insertUser để thêm user vào hệ thống
+ in thông báo thành công, nếu server lỗi thì in lỗi. 

<!-- - sendcode -->
+ lấy email
+ gọi authModel.findByEmailOrUserId nếu tồn tại trong hệ thống thì in lỗi
+ gọi genOTP(6) để đẩy mã
+ Hạn trong 15 phút, dựa theo expiresAt
+ gọi sendVerificationEmail để đẩy email và mã code

<!-- verifyCode -->
+ lấy email và mã code từ request
+ email và mã code null thì in ra lỗi
+ gọi otpStore.get(email) để lấy được mã người dùng nhập vào
