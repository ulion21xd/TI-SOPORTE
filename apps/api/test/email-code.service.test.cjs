const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');
const { EmailCodeService } = require('../dist/auth/email-code.service.js');

const previousAllowlist = process.env.OTP_ALLOWED_EMAILS;
afterEach(() => {
  if (previousAllowlist === undefined) delete process.env.OTP_ALLOWED_EMAILS;
  else process.env.OTP_ALLOWED_EMAILS = previousAllowlist;
});

function createService() {
  process.env.OTP_ALLOWED_EMAILS = 'pasante.ti@gruponodos.com';
  const sent = [];
  const mailer = {
    async verifyConfiguration() {},
    async sendOneTimeCode(to, code) { sent.push({ to, code }); },
  };
  return { service: new EmailCodeService(mailer), sent };
}

test('sends only to an allowlisted address using the mailer double', async () => {
  const { service, sent } = createService();
  await service.requestCode('PASANTE.TI@GRUPONODOS.COM', 'ip-a');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'pasante.ti@gruponodos.com');
  assert.match(sent[0].code, /^\d{6}$/);

  const response = await service.requestCode('unknown@example.com', 'ip-b');
  assert.deepEqual(response, { message: 'Si la dirección está autorizada, recibirás un código temporal.' });
  assert.equal(sent.length, 1);
});

test('accepts a code once and invalidates it after successful verification', async () => {
  const { service, sent } = createService();
  await service.requestCode('pasante.ti@gruponodos.com', 'ip-a');
  assert.deepEqual(service.verifyCode('pasante.ti@gruponodos.com', sent[0].code, 'ip-a'), { verified: true });
  assert.deepEqual(service.verifyCode('pasante.ti@gruponodos.com', sent[0].code, 'ip-a'), { verified: false });
});

test('expires a code after five minutes', async (t) => {
  const originalNow = Date.now;
  let now = 1_800_000_000_000;
  Date.now = () => now;
  t.after(() => { Date.now = originalNow; });
  const { service, sent } = createService();
  await service.requestCode('pasante.ti@gruponodos.com', 'ip-a');
  now += 5 * 60 * 1000;
  assert.deepEqual(service.verifyCode('pasante.ti@gruponodos.com', sent[0].code, 'ip-a'), { verified: false });
});

test('invalidates a challenge after five wrong codes', async () => {
  const { service, sent } = createService();
  await service.requestCode('pasante.ti@gruponodos.com', 'ip-a');
  const wrongCode = sent[0].code === '000000' ? '000001' : '000000';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.deepEqual(service.verifyCode('pasante.ti@gruponodos.com', wrongCode, 'ip-a'), { verified: false });
  }
  assert.deepEqual(service.verifyCode('pasante.ti@gruponodos.com', sent[0].code, 'ip-a'), { verified: false });
});

test('limits code requests per email without performing an extra send', async () => {
  const { service, sent } = createService();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await service.requestCode('pasante.ti@gruponodos.com', 'ip-a');
  }
  await assert.rejects(service.requestCode('pasante.ti@gruponodos.com', 'ip-a'), (error) => error.getStatus?.() === 429);
  assert.equal(sent.length, 3);
});

test('does not issue a challenge when SMTP cannot be verified', async () => {
  process.env.OTP_ALLOWED_EMAILS = 'pasante.ti@gruponodos.com';
  let sendCalls = 0;
  const mailer = {
    async verifyConfiguration() { throw new Error('simulated SMTP failure'); },
    async sendOneTimeCode() { sendCalls += 1; },
  };
  const service = new EmailCodeService(mailer);
  await assert.rejects(service.requestCode('pasante.ti@gruponodos.com', 'ip-a'));
  assert.equal(sendCalls, 0);
});
