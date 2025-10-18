import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

export async function sendVerificationEmail(to: string, code: string) {
  const appName = process.env.APP_NAME || "ThueRe";
  const info = await transporter.sendMail({
    from: `"${appName}" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Mã xác minh email",
    text: `Mã xác minh của bạn là: ${code}`,
    html: `
      <p>Xin chào,</p>
      <p>Mã xác minh của bạn là: <b>${code}</b></p>
      <p>Mã có hiệu lực trong 15 phút.</p>
    `,
  });

  return info;
}
// NEW: gửi link đặt lại mật khẩu
export async function sendResetPasswordEmail(to: string, resetLink: string) {
  const appName = process.env.APP_NAME || "SportBooking";
  const info = await transporter.sendMail({
    from: `"${appName}" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Đặt lại mật khẩu",
    text: `Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản tại ${appName}. Nhấn vào liên kết sau để đặt mật khẩu mới: ${resetLink}`,
    html: `
      <p>Xin chào,</p>
      <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản tại <b>${appName}</b>.</p>
      <p>Nhấn vào liên kết sau để đặt mật khẩu mới:</p>
      <p><a href="${resetLink}" target="_blank">${resetLink}</a></p>
      <p>Liên kết có hiệu lực trong ${
        process.env.RESET_TOKEN_TTL_MIN || 30
      } phút.</p>
      <p>Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
    `,
  });
  return info;
}

export async function sendBookingConfirmationEmail(
  to: string,
  bookingCode: string,
  checkinCode: string,
  fieldName: string,
  playDate: string,
  timeSlot: string
) {
  const appName = process.env.APP_NAME || "ThueRe";
  const appUrl = process.env.APP_URL || "http://localhost:5173";
  
  const info = await transporter.sendMail({
    from: `"${appName}" <${process.env.GMAIL_USER}>`,
    to,
    subject: `[${appName}] Xác nhận đặt sân - Mã check-in: ${checkinCode}`,
    text: `
Xác nhận đặt sân
- Mã booking: ${bookingCode}
- Sân: ${fieldName}
- Ngày: ${playDate}
- Giờ: ${timeSlot}
- Mã check-in: ${checkinCode}

Vui lòng sử dụng mã check-in này khi đến sân.`,
    html: `
      <h2>Xác nhận đặt sân</h2>
      <p>Chào bạn,</p>
      <p>Đặt sân của bạn đã được xác nhận thành công!</p>
      
      <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
        <tr style="background: #f5f5f5;">
          <td style="border: 1px solid #ddd; padding: 10px;"><strong>Mã Booking</strong></td>
          <td style="border: 1px solid #ddd; padding: 10px;">${bookingCode}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 10px;"><strong>Sân</strong></td>
          <td style="border: 1px solid #ddd; padding: 10px;">${fieldName}</td>
        </tr>
        <tr style="background: #f5f5f5;">
          <td style="border: 1px solid #ddd; padding: 10px;"><strong>Ngày</strong></td>
          <td style="border: 1px solid #ddd; padding: 10px;">${playDate}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 10px;"><strong>Giờ</strong></td>
          <td style="border: 1px solid #ddd; padding: 10px;">${timeSlot}</td>
        </tr>
        <tr style="background: #fff3cd;">
          <td style="border: 1px solid #ddd; padding: 10px;"><strong>Mã Check-in</strong></td>
          <td style="border: 1px solid #ddd; padding: 10px;"><b style="font-size: 18px; color: #d9534f;">${checkinCode}</b></td>
        </tr>
      </table>
      
      <p><strong>Lưu ý:</strong> Vui lòng sử dụng mã check-in này khi đến sân. Mã check-in là bắt buộc!</p>
      <p>Cảm ơn bạn đã sử dụng ${appName}!</p>
    `,
  });

  return info;
}

type ShopRequestPayload = {
  full_name: string;
  email: string;
  phone_number: string;
  address: string;
  message?: string;
};

export async function sendShopRequestEmail(payload: ShopRequestPayload) {
  const appName = process.env.APP_NAME || "ThueRe";
  const recipient =
    process.env.SHOP_REQUEST_RECIPIENT || "kubjmisu1999@gmail.com";

  const { full_name, email, phone_number, address, message } = payload;

  const info = await transporter.sendMail({
    from: `"${appName}" <${process.env.GMAIL_USER}>`,
    to: recipient,
    subject: `[${appName}] Yêu cầu mở shop mới`,
    text: `
Yêu cầu mở shop mới:
- Họ và tên: ${full_name}
- Email: ${email}
- Số điện thoại: ${phone_number}
- Địa chỉ: ${address}
- Tin nhắn: ${message || "(không có)"}`,
    html: `
      <h2>Yêu cầu mở shop mới</h2>
      <p><strong>Họ và tên:</strong> ${full_name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Số điện thoại:</strong> ${phone_number}</p>
      <p><strong>Địa chỉ:</strong> ${address}</p>
      <p><strong>Tin nhắn:</strong></p>
      <p>${(message || "(không có)").replace(/\n/g, "<br/>")}</p>
    `,
  });

  return info;
}
