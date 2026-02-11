import express from 'express';
import { OchiqichSdk, verifyWebhookSignature } from '../src';

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());

const sdk = new OchiqichSdk({
  baseUrl: process.env.OCHIQICH_BASE_URL ?? 'https://api.ochiqich.uz',
  apiKey: process.env.OCHIQICH_API_KEY,
  webhookSecret: process.env.OCHIQICH_WEBHOOK_SECRET
});

app.post('/consent', async (req, res) => {
  try {
    const consent = await sdk.createConsentRequest({
      userId: req.body.userId,
      purpose: req.body.purpose ?? 'KYC verification',
      redirectUrl: req.body.redirectUrl,
      scope: ['identity', 'phone'],
      attributes: {
        fullName: req.body.fullName,
        phone: req.body.phone
      }
    });

    res.json(consent);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

app.get('/consent/:consentRequestId', async (req, res) => {
  try {
    const status = await sdk.getConsentStatus(req.params.consentRequestId);
    res.json(status);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

app.post('/webhooks/consent', express.text({ type: '*/*' }), (req, res) => {
  const signature = req.header('x-ochiqich-signature') ?? '';
  const timestamp = req.header('x-ochiqich-timestamp') ?? undefined;

  const valid = verifyWebhookSignature({
    payload: req.body,
    signature,
    timestamp,
    secret: sdk.webhookSecret
  });

  if (!valid) {
    return res.status(401).json({ message: 'Invalid signature' });
  }

  return res.status(200).json({ ok: true });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Express demo is running on http://localhost:${port}`);
});
