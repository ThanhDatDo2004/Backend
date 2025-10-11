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
