import type { MealType } from '@repo/api';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000';

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    return Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? res.statusText);
  } catch {
    return res.statusText;
  }
}

export interface UploadUrlResponse {
  mealId: string;
  uploadUrl: string;
  r2ObjectKey: string;
}

export async function createUploadUrl(input: {
  clientId: string;
  mealType: MealType;
  capturedAt: string;
  contentType: string;
}): Promise<UploadUrlResponse> {
  const res = await fetch(`${API_BASE_URL}/meals/upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await extractErrorMessage(res));
  return res.json() as Promise<UploadUrlResponse>;
}

export async function uploadToR2(uploadUrl: string, blob: Blob, contentType: string): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!res.ok) throw new Error('Upload to storage failed');
}

export interface ConfirmUploadResponse {
  photoId: string;
  uploadOrder: number;
}

export async function confirmUpload(input: {
  mealId: string;
  r2ObjectKey: string;
  fileSize: number;
  capturedAt: string;
}): Promise<ConfirmUploadResponse> {
  const res = await fetch(`${API_BASE_URL}/meals/confirm-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await extractErrorMessage(res));
  return res.json() as Promise<ConfirmUploadResponse>;
}
