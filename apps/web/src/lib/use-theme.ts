import { ref, watch } from 'vue';

const STORAGE_KEY = 'meal-tracker:theme';
type Theme = 'light' | 'dark';

function loadInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Module-level singleton: the toggle shown on every screen's header controls one
// shared app-wide theme, not a per-screen setting (UI_SPEC Design System).
const theme = ref<Theme>(loadInitialTheme());

watch(
  theme,
  (value) => {
    document.documentElement.setAttribute('data-theme', value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  },
  { immediate: true },
);

export function useTheme() {
  return { theme };
}
