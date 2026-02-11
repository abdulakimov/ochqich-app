import { createHmac, timingSafeEqual } from 'node:crypto';
import { type VerifyWebhookSignatureInput } from './types';

export const verifyWebhookSignature = ({
  payload,
  signature,
  timestamp,
  secret
}: VerifyWebhookSignatureInput): boolean => {
  if (!secret) {
    throw new Error('Webhook secret is required to verify signature');
  }

  const signedPayload = timestamp ? `${timestamp}.${payload}` : payload;
  const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');

  const actualBuffer = Buffer.from(normalizeSignature(signature), 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
};

const normalizeSignature = (signature: string): string => {
  if (signature.startsWith('sha256=')) {
    return signature.slice('sha256='.length);
  }

  return signature;
};
