import { ref, watch } from 'vue';

const STORAGE_KEY = 'meal-tracker:clientId';

function loadStoredClientId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function useClientId() {
  const clientId = ref(loadStoredClientId());
  watch(clientId, (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  });
  return clientId;
}
