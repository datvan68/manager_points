import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('MAIL_HOST');
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASS');
    const secureVal = this.configService.get<any>('MAIL_SECURE');
    const isSecure = secureVal === true || secureVal === 'true' || secureVal === '1';
    
    const portVal = this.configService.get<any>('MAIL_PORT');
    const port = portVal ? parseInt(String(portVal), 10) : 587;

    if (isNaN(port) || port <= 0 || port > 65535) {
      throw new Error('Cấu hình cổng SMTP (MAIL_PORT) không hợp lệ');
    }

    if (!host || !user || !pass) {
      console.error('❌ Missing required SMTP configurations (MAIL_HOST, MAIL_USER, or MAIL_PASS). Mail delivery will fail.');
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: isSecure,
      auth: {
        user,
        pass,
      },
    });
  }

  private getEmailHash(email: string): string {
    if (!email) return '***';
    return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const host = this.configService.get<string>('MAIL_HOST');
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASS');
    if (!host || !user || !pass) {
      console.error('❌ Cannot send email: SMTP configuration is missing');
      throw new Error('Cấu hình SMTP chưa hoàn thiện. Vui lòng liên hệ quản trị viên.');
    }

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;
    const emailHash = this.getEmailHash(email);

    const mailOptions = {
      from:
        this.configService.get<string>('MAIL_FROM') ||
        '"Manager Point" <noreply@managerpoint.com>',
      to: email,
      subject: 'Xác nhận đặt lại mật khẩu - Manager Point',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #333; text-align: center;">Yêu cầu đặt lại mật khẩu</h2>
          <p>Xin chào,</p>
          <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn tại <strong>Manager Point</strong>.</p>
          <p>Vui lòng nhấn vào nút bên dưới để tiến hành đặt lại mật khẩu. Liên kết này sẽ hết hạn sau 60 phút.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Đặt lại mật khẩu</a>
          </div>
          <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #777;">Email này được gửi tự động từ hệ thống Manager Point. Vui lòng không trả lời email này.</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email reset password sent successfully. Hash: ${emailHash}`);
    } catch (error) {
      console.error(`❌ Failed to send reset password email. Hash: ${emailHash}`);
      throw new Error('Gửi email đặt lại mật khẩu thất bại.');
    }
  }
}
