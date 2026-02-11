import { registerDeviceSchema, type RegisterDeviceInput } from '@ochqich/shared';

export type OchiqichSdkOptions = {
  baseUrl: string;
};

export class OchiqichSdk {
  constructor(private readonly options: OchiqichSdkOptions) {}

  async registerDevice(payload: RegisterDeviceInput) {
    const parsed = registerDeviceSchema.parse(payload);

    const response = await fetch(`${this.options.baseUrl}/v1/devices/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed)
    });

    if (!response.ok) {
      throw new Error(`Register device failed: ${response.status}`);
    }

    return response.json();
  }
}
