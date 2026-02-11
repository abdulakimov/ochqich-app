import {
  type CreateConsentRequestInput,
  type CreateConsentRequestResponse,
  type GetConsentStatusResponse,
  type OchiqichSdkOptions
} from './types';

const DEFAULT_TIMEOUT_MS = 15_000;

export class OchiqichSdk {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly userAgent: string;

  constructor(private readonly options: OchiqichSdkOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.userAgent = options.userAgent ?? '@ochqich/sdk-node';
  }

  async createConsentRequest(
    payload: CreateConsentRequestInput
  ): Promise<CreateConsentRequestResponse> {
    return this.request<CreateConsentRequestResponse>('/v1/consent-requests', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getConsentStatus(consentRequestId: string): Promise<GetConsentStatusResponse> {
    return this.request<GetConsentStatusResponse>(`/v1/consent-requests/${consentRequestId}`);
  }

  get webhookSecret(): string | undefined {
    return this.options.webhookSecret;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.userAgent,
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          ...init?.headers
        }
      });

      if (!response.ok) {
        const body = await this.safeReadBody(response);
        throw new Error(
          `Ochiqich API request failed: ${response.status} ${response.statusText}${
            body ? ` - ${body}` : ''
          }`
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(`Ochiqich API request timeout (${this.timeoutMs}ms)`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async safeReadBody(response: Response): Promise<string | null> {
    try {
      return await response.text();
    } catch {
      return null;
    }
  }
}
