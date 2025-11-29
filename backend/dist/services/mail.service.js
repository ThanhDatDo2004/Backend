"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMail = sendMail;
exports.sendVerificationEmail = sendVerificationEmail;
exports.sendResetPasswordEmail = sendResetPasswordEmail;
exports.sendBookingConfirmationEmail = sendBookingConfirmationEmail;
exports.sendShopRequestEmail = sendShopRequestEmail;
exports.sendShopRequestStatusEmail = sendShopRequestStatusEmail;
exports.sendPayoutDecisionEmail = sendPayoutDecisionEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../utils/env");
const transporter = nodemailer_1.default.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
    },
});
async function sendMail(to, subject, html, text) {
    const appName = process.env.APP_NAME || "SportBooking";
    return transporter.sendMail({
        from: `"${appName}" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        html,
        text,
    });
}
async function sendVerificationEmail(to, code) {
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
async function sendResetPasswordEmail(to, resetLink) {
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
      <p>Liên kết có hiệu lực trong ${process.env.RESET_TOKEN_TTL_MIN || 30} phút.</p>
      <p>Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
    `,
    });
    return info;
}
async function sendBookingConfirmationEmail(to, bookingCode, checkinCode, fieldName, playDate, timeSlot) {
    const appName = process.env.APP_NAME || "ThueRe";
    const appUrl = (0, env_1.resolveFrontendBaseUrl)();
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
async function sendShopRequestEmail(payload) {
    const appName = process.env.APP_NAME || "ThueRe";
    const recipient = process.env.SHOP_REQUEST_RECIPIENT || "thuere2004@gmail.com";
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
async function sendShopRequestStatusEmail(options) {
    const { to, fullName, status } = options;
    const appName = process.env.APP_NAME || "ThueRe";
    const greetingName = fullName?.trim() || "bạn";
    const subjectSuffix = status === "approved" ? "được duyệt" : "không được duyệt";
    const defaultMessage = status === "approved"
        ? "Chúc mừng! Yêu cầu mở shop của bạn đã được duyệt. Bạn có thể đăng nhập và bắt đầu thiết lập gian hàng của mình ngay bây giờ. Vui lòng làm theo các hướng dẫn khi thiết lập"
        : "Rất tiếc, yêu cầu mở shop của bạn chưa thể được duyệt vào thời điểm này. Bạn có thể cập nhật lại thông tin và gửi yêu cầu mới khi đã sẵn sàng.";
    const info = await transporter.sendMail({
        from: `"${appName}" <${process.env.GMAIL_USER}>`,
        to,
        subject: `[${appName}] Yêu cầu mở shop ${subjectSuffix}`,
        text: `Xin chào ${greetingName},

${defaultMessage}

Trân trọng,
${appName}`,
        html: `
      <p>Xin chào ${greetingName},</p>
      <p>${defaultMessage}</p>
      <p>Trân trọng,<br/>${appName}</p>
    `,
    });
    return info;
}
async function sendPayoutDecisionEmail(options) {
    const { to, fullName, shopName, amount, status, reason, note, processedAt, bankName, bankAccountNumber, } = options;
    const appName = process.env.APP_NAME || "ThueRe";
    const greetingName = fullName?.trim() || shopName || "bạn";
    const formattedAmount = Number(amount || 0).toLocaleString("vi-VN");
    const processedAtText = processedAt
        ? new Date(processedAt).toLocaleString("vi-VN")
        : new Date().toLocaleString("vi-VN");
    const bankInfoHtml = bankName || bankAccountNumber
        ? `
        <p><strong>Ngân hàng:</strong> ${bankName || "—"}</p>
        <p><strong>Số tài khoản:</strong> ${bankAccountNumber || "—"}</p>
      `
        : "";
    let subject;
    let bodyText;
    let bodyHtml;
    if (status === "approved") {
        subject = `[${appName}] Yêu cầu rút tiền đã được duyệt`;
        const noteSection = note ? `Ghi chú từ admin: ${note}` : "";
        bodyText = `Xin chào ${greetingName},

Yêu cầu rút tiền từ shop ${shopName} với số tiền ${formattedAmount}đ đã được duyệt và ghi nhận vào lúc ${processedAtText}.
${noteSection}

Trân trọng,
${appName}`;
        bodyHtml = `
      <p>Xin chào ${greetingName},</p>
      <p>Yêu cầu rút tiền từ shop <strong>${shopName}</strong> với số tiền <strong>${formattedAmount}đ</strong> đã được duyệt.</p>
      <p><strong>Thời gian xử lý:</strong> ${processedAtText}</p>
      ${bankInfoHtml}
      ${note ? `<p><strong>Ghi chú:</strong> ${note}</p>` : ""}
      <p>Trân trọng,<br/>${appName}</p>
    `;
    }
    else {
        subject = `[${appName}] Yêu cầu rút tiền bị từ chối`;
        const reasonSection = reason
            ? `Lý do: ${reason}`
            : "Yêu cầu bị từ chối. Vui lòng kiểm tra lại thông tin và gửi lại yêu cầu mới.";
        bodyText = `Xin chào ${greetingName},

Rất tiếc, yêu cầu rút tiền từ shop ${shopName} với số tiền ${formattedAmount}đ đã bị từ chối vào lúc ${processedAtText}.
${reasonSection}

Số tiền đã được hoàn trả lại ví shop của bạn.

Trân trọng,
${appName}`;
        bodyHtml = `
      <p>Xin chào ${greetingName},</p>
      <p>Rất tiếc, yêu cầu rút tiền từ shop <strong>${shopName}</strong> với số tiền <strong>${formattedAmount}đ</strong> đã bị từ chối.</p>
      <p><strong>Thời gian xử lý:</strong> ${processedAtText}</p>
      ${bankInfoHtml}
      ${reason
            ? `<p><strong>Lý do:</strong> ${reason}</p>`
            : "<p>Yêu cầu bị từ chối. Vui lòng kiểm tra lại thông tin và gửi lại yêu cầu mới.</p>"}
      <p>Số tiền đã được hoàn lại vào ví shop của bạn.</p>
      <p>Trân trọng,<br/>${appName}</p>
    `;
    }
    const info = await transporter.sendMail({
        from: `"${appName}" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        text: bodyText,
        html: bodyHtml,
    });
    return info;
}
