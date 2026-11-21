import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import {
  ConfigService,
  isProductionLikeEnvironment,
} from '../config/config.service';

/**
 * Sends transactional email over SMTP (#810) — there was previously no
 * mail-sending capability anywhere in this backend, so forgotPassword
 * generated and stored a reset token but could never deliver it.
 *
 * Configured via SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD/SMTP_SECURE/
 * SMTP_FROM. When SMTP_HOST is unset:
 * - in a production-like environment, construction fails fast — there is
 *   no silent email fallback outside development.
 * - otherwise, sendPasswordResetEmail logs the link instead of sending it,
 *   so local development isn't blocked on having real SMTP credentials.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    this.fromAddress = this.configService.get(
      'SMTP_FROM',
      'no-reply@carbonscribe.io',
    );

    const host = process.env.SMTP_HOST;
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.configService.get('SMTP_PORT', 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
      });
      return;
    }

    this.transporter = null;
    if (
      isProductionLikeEnvironment({
        NODE_ENV: process.env.NODE_ENV,
        SERVICE_NAME: process.env.SERVICE_NAME,
        DEPLOY_ENV: process.env.DEPLOY_ENV,
      })
    ) {
      throw new Error(
        'SMTP_HOST must be set in production — there is no email-sending fallback outside development mode',
      );
    }
    this.logger.warn(
      'SMTP_HOST not set — outgoing emails will be logged, not sent (development mode only)',
    );
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    const subject = 'Reset your CarbonScribe password';
    const text =
      'We received a request to reset your password. Use the link below ' +
      'to choose a new one. This link expires soon and can only be used ' +
      `once.\n\n${resetLink}\n\n` +
      "If you didn't request this, you can safely ignore this email.";

    if (!this.transporter) {
      this.logger.warn(`[dev] Password reset link for ${to}: ${resetLink}`);
      return;
    }

    await this.transporter.sendMail({
      from: this.fromAddress,
      to,
      subject,
      text,
    });
  }
}
