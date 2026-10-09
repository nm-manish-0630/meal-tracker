import type { MealType } from '@repo/shared/meal-type';

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

export interface HistoryPhoto {
  id: string;
  uploadOrder: number;
  capturedAt: string;
  fileSize: number;
  downloadUrl: string;
}

export interface HistoryMeal {
  id: string;
  mealType: MealType;
  mealDate: string;
  photos: HistoryPhoto[];
}

export async function getHistory(clientId: string, range?: { from: string; to: string }): Promise<HistoryMeal[]> {
  const params = new URLSearchParams({ clientId });
  if (range) {
    params.set('from', range.from);
    params.set('to', range.to);
  }
  const res = await fetch(`${API_BASE_URL}/meals/history?${params.toString()}`);
  if (!res.ok) throw new Error(await extractErrorMessage(res));
  return res.json() as Promise<HistoryMeal[]>;
}

export async function updateMealType(mealId: string, mealType: MealType): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/meals/${mealId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mealType }),
  });
  if (!res.ok) throw new Error(await extractErrorMessage(res));
}

export async function deleteMeal(mealId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/meals/${mealId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await extractErrorMessage(res));
}

export async function deletePhoto(photoId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/photos/${photoId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await extractErrorMessage(res));
}
