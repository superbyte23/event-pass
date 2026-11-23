// Low-level SMTP transport. Kept separate from mailer.js so both the legacy
// ticket sender and per-admin account resolution can share one send path.

export async function sendSmtpMail({ config, to, subject, text, html, attachments }) {
  if (!config) return { sent: false, reason: 'mail-not-configured' };
  try {
    const { default: nodemailer } = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    const info = await transporter.sendMail({
      from: config.from,
      to,
      subject,
      text,
      html,
      attachments,
    });
    return { sent: true, messageId: info?.messageId || null };
  } catch (error) {
    console.error('Mail send failed:', error?.message || error);
    return { sent: false, reason: 'error', error: error?.message || 'SMTP send failed.' };
  }
}
