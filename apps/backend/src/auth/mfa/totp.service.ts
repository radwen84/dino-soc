import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';

@Injectable()
export class TotpService {
  constructor() {
    // Configure TOTP settings
    authenticator.options = {
      digits: 6,
      step: 30,
      window: 1, // Allow 1 step before/after (±30 seconds tolerance)
    };
  }

  generateSecret(userEmail: string): { otpauthUrl: string; base32: string } {
    const secret = authenticator.generateSecret(32);
    const otpauthUrl = authenticator.keyuri(userEmail, 'MiniSOC', secret);
    return { otpauthUrl, base32: secret };
  }

  async generateQRCode(otpauthUrl: string): Promise<string> {
    return qrcode.toDataURL(otpauthUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
  }

  verifyToken(secret: string, token: string): boolean {
    try {
      return authenticator.verify({ token, secret });
    } catch {
      return false;
    }
  }

  generateToken(secret: string): string {
    return authenticator.generate(secret);
  }
}
