<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  createAdminTrainerGroup,
  createAdminUser,
  deleteAdminTrainerGroup,
  deleteAdminUser,
  getAdminTrainerGroups,
  getAdminUsers,
  updateAdminTrainerGroup,
  updateAdminUser,
  type AdminTrainerGroup,
  type AdminUser,
} from '../lib/api';
import { clearAdminSession } from '../lib/admin-auth';
import ThemeToggle from '../components/ThemeToggle.vue';

type Tab = 'users' | 'trainer-groups';

interface UserDraft {
  id: string | null;
  name: string;
  email: string;
  role: 'client' | 'trainer';
  trainerGroupId: string | null;
  isActive: boolean;
}

interface GroupDraft {
  id: string | null;
  name: string;
  digestTimezone: string;
}

type Selection = { kind: 'user'; draft: UserDraft } | { kind: 'group'; draft: GroupDraft } | null;

const TIMEZONE_OPTIONS = ['UTC', 'Europe/Berlin', 'America/New_York', 'Asia/Kolkata'];

const router = useRouter();
const activeTab = ref<Tab>('users');
const users = ref<AdminUser[]>([]);
const trainerGroups = ref<AdminTrainerGroup[]>([]);
const selection = ref<Selection>(null);
const loading = ref(false);
const errorMessage = ref<string | null>(null);

async function loadAll() {
  loading.value = true;
  errorMessage.value = null;
  try {
    [users.value, trainerGroups.value] = await Promise.all([getAdminUsers(), getAdminTrainerGroups()]);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load admin data';
    if (errorMessage.value.includes('session expired')) {
      await router.push('/admin/login');
    }
  } finally {
    loading.value = false;
  }
}

void loadAll();

function groupName(groupId: string | null): string {
  if (!groupId) return 'Unassigned';
  return trainerGroups.value.find((group) => group.id === groupId)?.name ?? 'Unassigned';
}

function selectUser(user: AdminUser) {
  selection.value = { kind: 'user', draft: { ...user } };
}

function selectGroup(group: AdminTrainerGroup) {
  selection.value = { kind: 'group', draft: { ...group } };
}

function startNewUser() {
  selection.value = {
    kind: 'user',
    draft: { id: null, name: '', email: '', role: 'client', trainerGroupId: null, isActive: true },
  };
}

function startNewGroup() {
  selection.value = { kind: 'group', draft: { id: null, name: '', digestTimezone: 'UTC' } };
}

async function saveUser() {
  if (selection.value?.kind !== 'user') return;
  const draft = selection.value.draft;
  errorMessage.value = null;
  try {
    const input = {
      name: draft.name,
      email: draft.email,
      role: draft.role,
      trainerGroupId: draft.trainerGroupId,
      isActive: draft.isActive,
    };
    if (draft.id) {
      await updateAdminUser(draft.id, input);
    } else {
      await createAdminUser(input);
    }
    selection.value = null;
    await loadAll();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to save user';
  }
}

async function deleteSelectedUser() {
  if (selection.value?.kind !== 'user' || !selection.value.draft.id) return;
  errorMessage.value = null;
  try {
    await deleteAdminUser(selection.value.draft.id);
    selection.value = null;
    await loadAll();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to delete user';
  }
}

async function saveGroup() {
  if (selection.value?.kind !== 'group') return;
  const draft = selection.value.draft;
  errorMessage.value = null;
  try {
    const input = { name: draft.name, digestTimezone: draft.digestTimezone };
    if (draft.id) {
      await updateAdminTrainerGroup(draft.id, input);
    } else {
      await createAdminTrainerGroup(input);
    }
    selection.value = null;
    await loadAll();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to save trainer group';
  }
}

async function deleteSelectedGroup() {
  if (selection.value?.kind !== 'group' || !selection.value.draft.id) return;
  errorMessage.value = null;
  try {
    await deleteAdminTrainerGroup(selection.value.draft.id);
    selection.value = null;
    await loadAll();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to delete trainer group';
  }
}

// Group membership from the group's own panel is immediate (toggling a member pill
// commits right away), unlike the user panel's own pickers which stage into the draft
// and commit on "Done" — matches UI_SPEC §6's "adds or removes them from it immediately".
async function toggleGroupMember(user: AdminUser, groupId: string) {
  errorMessage.value = null;
  try {
    const nextGroupId = user.trainerGroupId === groupId ? null : groupId;
    await updateAdminUser(user.id, { trainerGroupId: nextGroupId });
    await loadAll();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to update group membership';
  }
}

const groupMembers = computed(() => {
  if (selection.value?.kind !== 'group' || !selection.value.draft.id) {
    return { trainers: [] as AdminUser[], clients: [] as AdminUser[] };
  }
  return {
    trainers: users.value.filter((user) => user.role === 'trainer'),
    clients: users.value.filter((user) => user.role === 'client'),
  };
});

function isMember(user: AdminUser): boolean {
  if (selection.value?.kind !== 'group' || !selection.value.draft.id) return false;
  return user.trainerGroupId === selection.value.draft.id;
}

function logout() {
  clearAdminSession();
  void router.push('/admin/login');
}
</script>

<template>
  <div class="admin-dashboard">
    <header class="header">
      <div>
        <h1>Admin</h1>
        <p class="subtitle">Manage clients, trainers, and trainer groups</p>
      </div>
      <div class="header-actions">
        <ThemeToggle />
        <button type="button" class="logout" @click="logout">Log out</button>
      </div>
    </header>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-if="loading">Loading…</p>

    <div class="tabs">
      <button type="button" :class="{ active: activeTab === 'users' }" @click="activeTab = 'users'">Users</button>
      <button type="button" :class="{ active: activeTab === 'trainer-groups' }" @click="activeTab = 'trainer-groups'">
        Trainer groups
      </button>
    </div>

    <div class="layout">
      <section class="list-pane">
        <template v-if="activeTab === 'users'">
          <div class="list-pane-header">
            <span>Users</span>
            <button type="button" class="add-button" @click="startNewUser">+ Add user</button>
          </div>
          <div class="list-header-row user-row">
            <span>User</span>
            <span>Role</span>
            <span>Group</span>
            <span>Status</span>
          </div>
          <button
            v-for="user in users"
            :key="user.id"
            type="button"
            class="list-row user-row"
            :class="{ selected: selection?.kind === 'user' && selection.draft.id === user.id }"
            @click="selectUser(user)"
          >
            <span class="identity">
              <span class="avatar" :class="user.role">{{ user.name.charAt(0).toUpperCase() }}</span>
              <span class="identity-text">
                <span class="name">{{ user.name }}</span>
                <span class="email">{{ user.email }}</span>
              </span>
            </span>
            <span class="chip" :class="user.role">{{ user.role === 'trainer' ? 'Trainer' : 'Client' }}</span>
            <span class="group-name">{{ groupName(user.trainerGroupId) }}</span>
            <span class="chip" :class="{ active: user.isActive, inactive: !user.isActive }">
              {{ user.isActive ? 'Active' : 'Inactive' }}
            </span>
          </button>
        </template>

        <template v-else>
          <div class="list-pane-header">
            <span>Trainer groups</span>
            <button type="button" class="add-button" @click="startNewGroup">+ Add group</button>
          </div>
          <div class="list-header-row group-row">
            <span>Group</span>
            <span>Timezone</span>
            <span>Members</span>
          </div>
          <button
            v-for="group in trainerGroups"
            :key="group.id"
            type="button"
            class="list-row group-row"
            :class="{ selected: selection?.kind === 'group' && selection.draft.id === group.id }"
            @click="selectGroup(group)"
          >
            <span class="name">{{ group.name }}</span>
            <code class="timezone">{{ group.digestTimezone }}</code>
            <span class="member-count">
              {{ users.filter((u) => u.trainerGroupId === group.id && u.role === 'trainer').length }} trainers ·
              {{ users.filter((u) => u.trainerGroupId === group.id && u.role === 'client').length }} clients
            </span>
          </button>
        </template>
      </section>

      <section class="detail-pane">
        <div v-if="!selection" class="empty-state">
          <span class="empty-icon">👤</span>
          <p>Select a user or trainer group to edit — or add a new one.</p>
        </div>

        <div v-else-if="selection.kind === 'user'" class="user-detail">
          <div class="detail-header">
            <span class="avatar large" :class="selection.draft.role">
              {{ (selection.draft.name || '?').charAt(0).toUpperCase() }}
            </span>
            <div>
              <h2>{{ selection.draft.id ? 'Edit user' : 'Add user' }}</h2>
            </div>
          </div>

          <label class="field">
            Name
            <input v-model="selection.draft.name" type="text" />
          </label>
          <label class="field">
            Email
            <input v-model="selection.draft.email" type="email" />
          </label>

          <div class="pill-section">
            <p class="pill-label">Role</p>
            <div class="pill-row">
              <button
                type="button"
                :class="{ selected: selection.draft.role === 'client' }"
                @click="selection.draft.role = 'client'"
              >
                Client
              </button>
              <button
                type="button"
                :class="{ selected: selection.draft.role === 'trainer' }"
                @click="selection.draft.role = 'trainer'"
              >
                Trainer
              </button>
            </div>
          </div>

          <div class="pill-section">
            <p class="pill-label">Trainer group</p>
            <div class="pill-row wrap">
              <button
                type="button"
                :class="{ selected: selection.draft.trainerGroupId === null }"
                @click="selection.draft.trainerGroupId = null"
              >
                No group
              </button>
              <button
                v-for="group in trainerGroups"
                :key="group.id"
                type="button"
                :class="{ selected: selection.draft.trainerGroupId === group.id }"
                @click="selection.draft.trainerGroupId = group.id"
              >
                {{ group.name }}
              </button>
            </div>
          </div>

          <div class="pill-section">
            <p class="pill-label">Status</p>
            <div class="pill-row">
              <button type="button" :class="{ selected: selection.draft.isActive }" @click="selection.draft.isActive = true">
                Active
              </button>
              <button
                type="button"
                :class="{ selected: !selection.draft.isActive }"
                @click="selection.draft.isActive = false"
              >
                Inactive
              </button>
            </div>
          </div>

          <div class="detail-footer">
            <button v-if="selection.draft.id" type="button" class="delete" @click="deleteSelectedUser">Delete</button>
            <button type="button" class="done" @click="saveUser">Done</button>
          </div>
        </div>

        <div v-else class="group-detail">
          <div class="detail-header">
            <h2>{{ selection.draft.id ? 'Edit group' : 'Add group' }}</h2>
          </div>

          <label class="field">
            Group name
            <input v-model="selection.draft.name" type="text" />
          </label>

          <div class="pill-section">
            <p class="pill-label">Timezone</p>
            <div class="pill-row wrap">
              <button
                v-for="tz in TIMEZONE_OPTIONS"
                :key="tz"
                type="button"
                :class="{ selected: selection.draft.digestTimezone === tz }"
                @click="selection.draft.digestTimezone = tz"
              >
                {{ tz }}
              </button>
            </div>
          </div>

          <template v-if="selection.draft.id">
            <div class="pill-section">
              <p class="pill-label">Trainers in this group</p>
              <div class="pill-row wrap">
                <button
                  v-for="trainer in groupMembers.trainers"
                  :key="trainer.id"
                  type="button"
                  :class="{ selected: isMember(trainer) }"
                  @click="toggleGroupMember(trainer, selection.draft.id!)"
                >
                  {{ trainer.name }}
                </button>
              </div>
            </div>

            <div class="pill-section">
              <p class="pill-label">Clients in this group</p>
              <div class="pill-row wrap">
                <button
                  v-for="client in groupMembers.clients"
                  :key="client.id"
                  type="button"
                  :class="{ selected: isMember(client) }"
                  @click="toggleGroupMember(client, selection.draft.id!)"
                >
                  {{ client.name }}
                </button>
              </div>
            </div>
          </template>

          <div class="detail-footer">
            <button v-if="selection.draft.id" type="button" class="delete" @click="deleteSelectedGroup">Delete</button>
            <button type="button" class="done" @click="saveGroup">Done</button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.admin-dashboard {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
}

.header h1 {
  font-size: 28px;
}

.subtitle {
  color: var(--text-secondary);
  margin-top: 4px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logout {
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
}

.error {
  color: #b00020;
  margin-top: 12px;
}

.tabs {
  display: inline-flex;
  margin-top: 20px;
  border-radius: 999px;
  background: var(--surface-2);
  padding: 4px;
  gap: 4px;
}

.tabs button {
  min-height: 40px;
  padding: 0 20px;
  border: none;
  background: none;
  border-radius: 999px;
  color: var(--text-secondary);
}

.tabs button.active {
  background: var(--surface);
  color: var(--text);
}

.layout {
  display: flex;
  gap: 24px;
  margin-top: 20px;
  align-items: flex-start;
}

.list-pane {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
}

.list-pane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  font-weight: 600;
}

.add-button {
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--accent);
  color: var(--accent);
  background: none;
  border-radius: 999px;
}

.list-header-row {
  display: grid;
  padding: 8px 16px;
  color: var(--text-secondary);
  font-size: 0.8em;
  border-bottom: 1px solid var(--border);
}

.list-header-row.user-row,
.list-row.user-row {
  grid-template-columns: 2fr 1fr 1fr 1fr;
}

.list-header-row.group-row,
.list-row.group-row {
  grid-template-columns: 2fr 1fr 2fr;
}

.list-row {
  display: grid;
  align-items: center;
  width: 100%;
  min-height: 56px;
  padding: 10px 16px;
  border: none;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  text-align: left;
  gap: 8px;
}

.list-row:last-child {
  border-bottom: none;
}

.list-row.selected {
  background: var(--surface-2);
}

.identity {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.identity-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.email {
  font-size: 0.8em;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.avatar {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-family: var(--font-display);
}

.avatar.large {
  width: 48px;
  height: 48px;
}

.avatar.trainer {
  background: var(--accent);
}

.avatar.client {
  background: var(--accent-2);
}

.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 0.75em;
  background: var(--surface-2);
  width: fit-content;
}

.chip.trainer {
  background: color-mix(in srgb, var(--accent) 18%, var(--surface-2));
}

.chip.client {
  background: color-mix(in srgb, var(--accent-2) 18%, var(--surface-2));
}

.chip.active {
  background: color-mix(in srgb, var(--accent) 18%, var(--surface-2));
}

.chip.inactive {
  background: color-mix(in srgb, var(--warn) 25%, var(--surface-2));
}

.group-name {
  color: var(--text-secondary);
  font-size: 0.85em;
}

.timezone {
  font-size: 0.85em;
}

.member-count {
  color: var(--text-secondary);
  font-size: 0.85em;
}

.detail-pane {
  width: 380px;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px;
}

.empty-state {
  text-align: center;
  color: var(--text-secondary);
  padding: 40px 16px;
}

.empty-icon {
  display: block;
  font-size: 32px;
  margin-bottom: 8px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.detail-header h2 {
  font-size: 20px;
}

.field {
  display: block;
  margin-bottom: 14px;
  font-size: 0.85em;
}

.field input {
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

.pill-section {
  margin-bottom: 16px;
}

.pill-label {
  font-size: 0.8em;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.pill-row {
  display: flex;
  gap: 8px;
}

.pill-row.wrap {
  flex-wrap: wrap;
}

.pill-row button {
  min-height: 44px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 0.85em;
}

.pill-row button.selected {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.detail-footer {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 20px;
}

.detail-footer .delete {
  min-height: 44px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid #b00020;
  color: #b00020;
  background: none;
}

.detail-footer .done {
  flex: 1;
  min-height: 44px;
  border-radius: 999px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}

@media (max-width: 768px) {
  .admin-dashboard {
    padding: 16px;
  }

  .layout {
    flex-direction: column;
  }

  .detail-pane {
    width: 100%;
  }

  .list-header-row.user-row,
  .list-row.user-row {
    grid-template-columns: 2fr 1fr;
  }

  .list-header-row.user-row span:nth-child(3),
  .list-header-row.user-row span:nth-child(4),
  .list-row.user-row .group-name,
  .list-row.user-row .chip:last-child {
    display: none;
  }

  .list-header-row.group-row,
  .list-row.group-row {
    grid-template-columns: 1.5fr 1fr;
  }

  .list-header-row.group-row span:nth-child(3),
  .list-row.group-row .member-count {
    display: none;
  }
}
</style>
