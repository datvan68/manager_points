import * as crypto from 'crypto';

export class OtpUtil {
  static generateOtp(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  static hashOtp(requestId: string, otp: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(`${requestId}:${otp}`)
      .digest('hex');
  }

  static generateResetToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  static hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  static timingSafeEqual(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) {
      crypto.timingSafeEqual(aBuf, aBuf);
      return false;
    }
    return crypto.timingSafeEqual(aBuf, bBuf);
  }
}
