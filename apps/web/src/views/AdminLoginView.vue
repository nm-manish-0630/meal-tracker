<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { adminLogin } from '../lib/api';
import ThemeToggle from '../components/ThemeToggle.vue';

const router = useRouter();
const password = ref('');
const errorMessage = ref<string | null>(null);
const loading = ref(false);

async function submit() {
  errorMessage.value = null;
  loading.value = true;
  try {
    await adminLogin(password.value);
    await router.push('/admin');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Login failed';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="admin-login">
    <ThemeToggle class="toggle-row" />
    <h1>Admin</h1>
    <p class="subtitle">Enter the shared admin password to continue.</p>
    <form @submit.prevent="submit">
      <label>
        Password
        <input v-model="password" type="password" autocomplete="current-password" />
      </label>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <button type="submit" :disabled="loading || !password">{{ loading ? 'Checking…' : 'Log in' }}</button>
    </form>
  </main>
</template>

<style scoped>
.admin-login {
  max-width: 360px;
  margin: 0 auto;
  padding: 16px;
  padding-top: 64px;
  text-align: center;
}

.toggle-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 24px;
}

h1 {
  font-size: 28px;
}

.subtitle {
  color: var(--text-secondary);
  margin-top: 8px;
}

form {
  margin-top: 24px;
  text-align: left;
}

label {
  display: block;
}

input {
  display: block;
  width: 100%;
  min-height: 44px;
  margin-top: 4px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
}

.error {
  color: #b00020;
  margin-top: 12px;
}

button[type='submit'] {
  display: block;
  width: 100%;
  min-height: 44px;
  margin-top: 16px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-weight: 600;
}

button[type='submit']:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
