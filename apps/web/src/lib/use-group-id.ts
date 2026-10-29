import { ref, watch } from 'vue';

const STORAGE_KEY = 'meal-tracker:groupId';

function loadStoredGroupId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function useGroupId() {
  const groupId = ref(loadStoredGroupId());
  watch(groupId, (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  });
  return groupId;
}
