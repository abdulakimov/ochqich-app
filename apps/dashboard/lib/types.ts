export type ProviderSettings = {
  name: string;
  redirectUri: string;
  webhookUrl: string;
  apiKey: string;
  updatedAt: string;
};

export type ConsentRequest = {
  id: string;
  requestedAttributes: string[];
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export type WebhookLog = {
  id: string;
  event: string;
  payload: string;
  receivedAt: string;
  status: "received" | "processed" | "failed";
};

export type DashboardDb = {
  providerSettings: ProviderSettings;
  consentRequests: ConsentRequest[];
  webhookLogs: WebhookLog[];
};
