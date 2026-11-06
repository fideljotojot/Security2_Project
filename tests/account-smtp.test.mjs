import test from 'node:test';
import assert from 'node:assert/strict';
import { smtpConfiguration, sendSmtpEmail } from '../supabase/functions/create-account-with-email/smtp.js';

const credentials = { SMTP_USERNAME: 'sender@gmail.com', SMTP_PASSWORD: 'test-app-password' };
const configuration = values => smtpConfiguration(name => ({ ...credentials, ...values })[name]);

test('Gmail uses verified TLS on 465 with no Resend dependency', () => {
  const smtp = configuration({});
  assert.equal(smtp.transport.host, 'smtp.gmail.com');
  assert.equal(smtp.transport.port, 465);
  assert.equal(smtp.transport.secure, true);
  assert.equal(smtp.transport.auth.pass, credentials.SMTP_PASSWORD);
  assert.equal(smtp.from, credentials.SMTP_USERNAME);
  assert.equal(smtp.transport.logger, false);
  assert.equal(smtp.transport.debug, false);
  assert.notEqual(smtp.transport.tls?.rejectUnauthorized, false);
  assert.equal(configuration({ SMTP_PASSWORD: '' }), null);
  assert.equal(configuration({ SMTP_PORT: '587' }), null);
  assert.equal(configuration({ SMTP_PORT: '25' }), null);
  assert.equal(configuration({ SMTP_PORT: 'invalid' }), null);
});

test('SMTP success requires acceptance of the exact destination and preserves the message', async () => {
  const message = { to: ['person@example.com'], text: 'Username: test_user\nInitial password: Exact123! ' };
  let closed = false;
  await sendSmtpEmail(options => {
    assert.equal(options.host, 'smtp.gmail.com');
    return {
      async sendMail(input) { assert.equal(input, message); return { accepted: ['PERSON@example.com'] }; },
      close() { closed = true; },
    };
  }, configuration({}), message);
  assert.equal(closed, true);
});

test('recipient rejection and SMTP authentication failure close the connection and fail delivery', async () => {
  for (const kind of ['rejected', 'auth']) {
    let closed = false;
    await assert.rejects(sendSmtpEmail(() => ({
      async sendMail() {
        if (kind === 'auth') throw new Error('SMTP authentication failed');
        return { accepted: [], rejected: ['person@example.com'] };
      },
      close() { closed = true; },
    }), configuration({}), { to: ['person@example.com'] }));
    assert.equal(closed, true);
  }
});
