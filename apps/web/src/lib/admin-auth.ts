import { ref } from 'vue';

const STORAGE_KEY = 'meal-tracker:adminPassword';

function readStoredPassword(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

const isAdminAuthenticated = ref(readStoredPassword() !== null);

export function getStoredAdminPassword(): string | null {
  return readStoredPassword();
}

export function setAdminSession(password: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, password);
  } catch {
    /* ignore */
  }
  isAdminAuthenticated.value = true;
}

export function clearAdminSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  isAdminAuthenticated.value = false;
}

export function useAdminAuth() {
  return { isAdminAuthenticated };
}
