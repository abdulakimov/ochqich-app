# @ochqich/sdk-node

Node.js / TypeScript SDK for Ochiqich consent APIs.

## Install

```bash
npm install @ochqich/sdk-node
```

## Usage

```ts
import { OchiqichSdk } from '@ochqich/sdk-node';

const sdk = new OchiqichSdk({
  baseUrl: 'https://api.ochiqich.uz',
  apiKey: process.env.OCHIQICH_API_KEY
});

const consent = await sdk.createConsentRequest({
  userId: 'user_123',
  purpose: 'KYC verification',
  redirectUrl: 'https://merchant.uz/consent/callback',
  scope: ['identity', 'phone'],
  attributes: {
    fullName: 'Ali Valiyev',
    phone: '+998901112233'
  }
});

const status = await sdk.getConsentStatus(consent.consentRequestId);
```

## Webhook verification

```ts
import { verifyWebhookSignature } from '@ochqich/sdk-node';

const isValid = verifyWebhookSignature({
  payload: rawBody,
  signature: req.headers['x-ochiqich-signature'] as string,
  timestamp: req.headers['x-ochiqich-timestamp'] as string,
  secret: process.env.OCHIQICH_WEBHOOK_SECRET
});
```

## Types

The SDK exports `ConsentAttributes` and related request/response types for strict typing.

## Example

See Express demo: [`examples/express-demo.ts`](./examples/express-demo.ts).
