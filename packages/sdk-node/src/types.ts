export type PrimitiveAttributeValue = string | number | boolean | null;

export type ConsentAttributes = Record<
  string,
  PrimitiveAttributeValue | PrimitiveAttributeValue[]
>;

export type ConsentScope = 'identity' | 'kyc' | 'phone' | 'document' | 'custom';

export type CreateConsentRequestInput = {
  userId: string;
  purpose: string;
  redirectUrl: string;
  scope?: ConsentScope[];
  expiresAt?: string;
  attributes?: ConsentAttributes;
  metadata?: Record<string, string>;
};

export type CreateConsentRequestResponse = {
  consentRequestId: string;
  consentUrl: string;
  status: ConsentStatus;
  createdAt: string;
  expiresAt?: string;
};

export type ConsentStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'cancelled';

export type GetConsentStatusResponse = {
  consentRequestId: string;
  status: ConsentStatus;
  approvedAt?: string;
  rejectedAt?: string;
  expiresAt?: string;
  attributes?: ConsentAttributes;
};

export type OchiqichSdkOptions = {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  webhookSecret?: string;
  userAgent?: string;
};

export type VerifyWebhookSignatureInput = {
  payload: string;
  signature: string;
  timestamp?: string;
  secret?: string;
};
