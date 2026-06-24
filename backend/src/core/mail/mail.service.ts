import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';

export interface MailConfigOptions {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private currentConfig: MailConfigOptions;
  private readonly logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {
    this.reloadConfig();
  }

  public reloadConfig(customConfig?: MailConfigOptions) {
    if (customConfig) {
      this.currentConfig = { ...customConfig };
    } else {
      const host = this.configService.get<string>('MAIL_HOST') || '';
      const user = this.configService.get<string>('MAIL_USER') || '';
      const pass = this.configService.get<string>('MAIL_PASS') || '';
      const secureVal = this.configService.get<any>('MAIL_SECURE');
      const isSecure = secureVal === true || secureVal === 'true' || secureVal === '1';
      
      const portVal = this.configService.get<any>('MAIL_PORT');
      const port = portVal ? parseInt(String(portVal), 10) : 587;
      const from = this.configService.get<string>('MAIL_FROM') || '"Manager Point" <noreply@managerpoint.com>';

      this.currentConfig = { host, port, secure: isSecure, user, pass, from };
    }

    const { host, port, secure, user, pass } = this.currentConfig;

    if (!host || !user || !pass) {
      this.logger.warn('Missing required SMTP configurations. Mail delivery will fail.');
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }

  public async verifyConnection(testConfig?: MailConfigOptions): Promise<boolean> {
    try {
      if (testConfig) {
        const testTransporter = nodemailer.createTransport({
          host: testConfig.host,
          port: testConfig.port,
          secure: testConfig.secure,
          auth: { user: testConfig.user, pass: testConfig.pass },
        });
        await testTransporter.verify();
      } else {
        await this.transporter.verify();
      }
      return true;
    } catch (error: any) {
      this.logger.error(`SMTP Verify Error: ${error.message}`, error.stack);
      throw new Error(`Kiểm tra kết nối SMTP thất bại: ${error.message}`);
    }
  }

  public async sendTestEmail(to: string, testConfig?: MailConfigOptions) {
    let transporterToUse = this.transporter;
    let from = this.currentConfig.from;

    if (testConfig) {
      transporterToUse = nodemailer.createTransport({
        host: testConfig.host,
        port: testConfig.port,
        secure: testConfig.secure,
        auth: { user: testConfig.user, pass: testConfig.pass },
      });
      from = testConfig.from;
    }

    const mailOptions = {
      from,
      to,
      subject: 'Test SMTP Connection - Manager Point',
      text: 'Nếu bạn nhận được email này, cấu hình SMTP của bạn đã hoạt động bình thường.',
      html: '<p>Nếu bạn nhận được email này, cấu hình SMTP của bạn đã <strong>hoạt động bình thường</strong>.</p>'
    };

    try {
      await transporterToUse.sendMail(mailOptions);
      this.logger.log(`Test email sent successfully to ${to}`);
    } catch (error: any) {
      this.logger.error(`Failed to send test email: ${error.message}`, error.stack);
      throw new Error(`Gửi email thử nghiệm thất bại: ${error.message}`);
    }
  }

  private getEmailHash(email: string): string {
    if (!email) return '***';
    return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  }

  async sendPasswordResetEmail(email: string, token: string) {
    if (!this.currentConfig.host || !this.currentConfig.user || !this.currentConfig.pass) {
      this.logger.error('Cannot send email: SMTP configuration is missing');
      throw new Error('Cấu hình SMTP chưa hoàn thiện. Vui lòng liên hệ quản trị viên.');
    }

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;
    const emailHash = this.getEmailHash(email);

    const mailOptions = {
      from: this.currentConfig.from,
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
      this.logger.log(`Email reset password sent successfully. Hash: ${emailHash}`);
    } catch (error) {
      this.logger.error(`Failed to send reset password email. Hash: ${emailHash}`);
      throw new Error('Gửi email đặt lại mật khẩu thất bại.');
    }
  }

  async sendPasswordResetOtpEmail(email: string, code: string) {
    if (!this.currentConfig.host || !this.currentConfig.user || !this.currentConfig.pass) {
      this.logger.error('Cannot send OTP email: SMTP configuration is missing');
      throw new Error('Cấu hình SMTP chưa hoàn thiện. Vui lòng liên hệ quản trị viên.');
    }

    const emailHash = this.getEmailHash(email);

    const mailOptions = {
      from: this.currentConfig.from,
      to: email,
      subject: 'Mã OTP đặt lại mật khẩu - Manager Point',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #333; text-align: center;">Yêu cầu đặt lại mật khẩu</h2>
          <p>Xin chào,</p>
          <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn tại <strong>Manager Point</strong>.</p>
          <p>Mã OTP của bạn là: <strong style="font-size: 24px; color: #4CAF50; letter-spacing: 5px;">${code}</strong></p>
          <p>Mã này có hiệu lực trong vòng 5 phút. Không chia sẻ mã này với bất kỳ ai.</p>
          <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #777;">Email này được gửi tự động từ hệ thống Manager Point. Vui lòng không trả lời email này.</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`OTP Email sent successfully. Hash: ${emailHash}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email. Hash: ${emailHash}`);
      throw new Error('Gửi email OTP thất bại.');
    }
  }
}

