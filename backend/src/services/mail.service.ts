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
