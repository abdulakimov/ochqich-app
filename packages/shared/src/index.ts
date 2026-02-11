import { z } from 'zod';

export const phoneSchema = z
  .string()
  .regex(/^\+998\d{9}$/, 'Phone format +998XXXXXXXXX bo\'lishi kerak');

export const registerDeviceSchema = z.object({
  phone: phoneSchema,
  fingerprint: z.string().min(6),
  publicKey: z.string().min(32),
  deviceName: z.string().min(2)
});

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
