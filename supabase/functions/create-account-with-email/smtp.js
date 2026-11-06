export function smtpConfiguration(env) {
  const host = env('SMTP_HOST') || 'smtp.gmail.com';
  const port = Number(env('SMTP_PORT') || '465');
  const user = env('SMTP_USERNAME');
  const pass = env('SMTP_PASSWORD');
  const from = env('SMTP_FROM') || user;
  // Hosted Edge Functions cannot connect to ports 25/587. Gmail supports
  // implicit TLS on 465 without changing the existing Auth SMTP settings.
  if (!user || !pass || !from || !Number.isInteger(port) || port < 1 || port > 65535 ||
      [25, 587].includes(port) || (host === 'smtp.gmail.com' && port !== 465)) return null;
  return {
    from,
    transport: {
      host, port, secure: port === 465, requireTLS: port !== 465,
      auth: { user, pass },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true,
    },
  };
}

export async function sendSmtpEmail(createTransport, configuration, message) {
  const transport = createTransport(configuration.transport);
  try {
    const result = await transport.sendMail(message);
    const recipients = result.accepted || [];
    const destination = message.to[0].toLowerCase();
    if (!recipients.some(address => typeof address === 'string' && address.toLowerCase() === destination)) {
      throw new Error('SMTP recipient was not accepted');
    }
  } finally {
    transport.close();
  }
}
