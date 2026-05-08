import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    const mailOptions = {
      from: this.configService.get<string>('MAIL_FROM') || '"Manager Point" <noreply@managerpoint.com>',
      to: email,
      subject: 'Xác nhận đổi mật khẩu - Manager Point',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #333; text-align: center;">Yêu cầu đổi mật khẩu</h2>
          <p>Xin chào,</p>
          <p>Chúng tôi nhận được yêu cầu đổi mật khẩu cho tài khoản của bạn tại <strong>Manager Point</strong>.</p>
          <p>Vui lòng nhấn vào nút bên dưới để tiến hành đổi mật khẩu. Liên kết này sẽ hết hạn sau 60 phút.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Đổi mật khẩu</a>
          </div>
          <p>Nếu bạn không yêu cầu đổi mật khẩu, vui lòng bỏ qua email này.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #777;">Email này được gửi tự động từ hệ thống Manager Point. Vui lòng không trả lời email này.</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email reset password sent to: ${email}`);
    } catch (error) {
      console.error('❌ Failed to send reset password email:', error);
      // We don't throw error here to avoid blocking the API response, 
      // but in production you might want to handle this more robustly.
    }
  }
}
