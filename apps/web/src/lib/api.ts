import type { MealType } from '@repo/shared/meal-type';
import { clearAdminSession, getStoredAdminPassword, setAdminSession } from './admin-auth';

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

export interface TrainerClientSummary {
  id: string;
  name: string;
  lastUploadAt: string | null;
}

export async function getTrainerGroupClients(groupId: string): Promise<TrainerClientSummary[]> {
  const res = await fetch(`${API_BASE_URL}/trainer/group/${groupId}/clients`);
  if (!res.ok) throw new Error(await extractErrorMessage(res));
  return res.json() as Promise<TrainerClientSummary[]>;
}

export async function getTrainerClientMeals(
  clientId: string,
  range: { from: string; to: string },
): Promise<HistoryMeal[]> {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  const res = await fetch(`${API_BASE_URL}/trainer/clients/${clientId}/meals?${params.toString()}`);
  if (!res.ok) throw new Error(await extractErrorMessage(res));
  return res.json() as Promise<HistoryMeal[]>;
}

// --- Admin (ADR-004: shared-password protected) ---

async function adminFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  const password = getStoredAdminPassword();
  if (password) headers.set('X-Admin-Password', password);
  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearAdminSession();
    throw new Error('Admin session expired — please log in again');
  }
  if (!res.ok) throw new Error(await extractErrorMessage(res));
  return res;
}

export async function adminLogin(password: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(await extractErrorMessage(res));
  setAdminSession(password);
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'client' | 'trainer';
  trainerGroupId: string | null;
  isActive: boolean;
}

export interface SaveAdminUserInput {
  name: string;
  email: string;
  role: 'client' | 'trainer';
  trainerGroupId: string | null;
  isActive: boolean;
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const res = await adminFetch('/admin/users');
  return res.json() as Promise<AdminUser[]>;
}

export async function createAdminUser(input: SaveAdminUserInput): Promise<AdminUser> {
  const res = await adminFetch('/admin/users', { method: 'POST', body: JSON.stringify(input) });
  return res.json() as Promise<AdminUser>;
}

export async function updateAdminUser(id: string, input: Partial<SaveAdminUserInput>): Promise<AdminUser> {
  const res = await adminFetch(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(input) });
  return res.json() as Promise<AdminUser>;
}

export async function deleteAdminUser(id: string): Promise<void> {
  await adminFetch(`/admin/users/${id}`, { method: 'DELETE' });
}

export interface AdminTrainerGroup {
  id: string;
  name: string;
  digestTimezone: string;
}

export interface SaveAdminTrainerGroupInput {
  name: string;
  digestTimezone: string;
}

export async function getAdminTrainerGroups(): Promise<AdminTrainerGroup[]> {
  const res = await adminFetch('/admin/trainer-groups');
  return res.json() as Promise<AdminTrainerGroup[]>;
}

export async function createAdminTrainerGroup(input: SaveAdminTrainerGroupInput): Promise<AdminTrainerGroup> {
  const res = await adminFetch('/admin/trainer-groups', { method: 'POST', body: JSON.stringify(input) });
  return res.json() as Promise<AdminTrainerGroup>;
}

export async function updateAdminTrainerGroup(id: string, input: SaveAdminTrainerGroupInput): Promise<AdminTrainerGroup> {
  const res = await adminFetch(`/admin/trainer-groups/${id}`, { method: 'PUT', body: JSON.stringify(input) });
  return res.json() as Promise<AdminTrainerGroup>;
}

export async function deleteAdminTrainerGroup(id: string): Promise<void> {
  await adminFetch(`/admin/trainer-groups/${id}`, { method: 'DELETE' });
}
