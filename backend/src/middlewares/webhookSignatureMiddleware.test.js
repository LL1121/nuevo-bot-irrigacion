const crypto = require('crypto');
const { verifyWebhookSignature, verifyMetaWebhook, getSignatureHeader } = require('./webhookSignatureMiddleware');

describe('webhookSignatureMiddleware', () => {
  const secret = 'test_secret';
  const payload = JSON.stringify({ hello: 'world' });

  function sign(data) {
    const hash = crypto.createHmac('sha256', secret).update(data, 'utf8').digest('hex');
    return `sha256=${hash}`;
  }

  it('verifyWebhookSignature valida firma correcta', () => {
    expect(verifyWebhookSignature(payload, sign(payload), secret)).toBe(true);
  });

  it('verifyWebhookSignature rechaza firma inválida', () => {
    expect(verifyWebhookSignature(payload, 'sha256=deadbeef', secret)).toBe(false);
  });

  it('getSignatureHeader prioriza x-hub-signature-256', () => {
    const req = {
      headers: {
        'x-hub-signature-256': 'sha256=abc',
        'x-hub-signature': 'sha1=def'
      }
    };
    expect(getSignatureHeader(req)).toBe('sha256=abc');
  });

  it('verifyMetaWebhook deja pasar GET', () => {
    const req = { method: 'GET', headers: {} };
    const res = {};
    const next = jest.fn();

    verifyMetaWebhook(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('verifyMetaWebhook responde 400 si no hay rawBody', () => {
    process.env.WEBHOOK_APP_SECRET = secret;
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const req = {
      method: 'POST',
      headers: { 'x-hub-signature-256': sign(payload) },
      body: { hello: 'world' }
    };
    const res = { status, json };
    const next = jest.fn();

    verifyMetaWebhook(req, res, next);

    expect(status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('verifyMetaWebhook deja pasar con firma válida', () => {
    process.env.WEBHOOK_APP_SECRET = secret;
    const req = {
      method: 'POST',
      headers: { 'x-hub-signature-256': sign(payload) },
      rawBody: payload,
      body: { hello: 'world' }
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    verifyMetaWebhook(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
