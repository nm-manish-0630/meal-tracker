import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import ClientHistoryView from '../views/ClientHistoryView.vue';
import ClientUploadView from '../views/ClientUploadView.vue';
import PerDayView from '../views/PerDayView.vue';
import TrainerDashboardView from '../views/TrainerDashboardView.vue';
import AdminLoginView from '../views/AdminLoginView.vue';
import AdminDashboardView from '../views/AdminDashboardView.vue';
import { getStoredAdminPassword } from '../lib/admin-auth';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/clients/:clientId', component: HomeView },
    { path: '/clients/:clientId/history', component: ClientHistoryView },
    { path: '/clients/:clientId/upload', component: ClientUploadView },
    { path: '/clients/:clientId/days/:date', component: PerDayView },
    { path: '/trainer', component: TrainerDashboardView },
    { path: '/admin/login', component: AdminLoginView },
    { path: '/admin', component: AdminDashboardView },
  ],
  scrollBehavior(to) {
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' };
    }
    return { top: 0 };
  },
});

// Client-side UX gate only — the real enforcement is server-side (ADR-004's
// shared-password check on every /admin/* request via the X-Admin-Password header).
router.beforeEach((to) => {
  if (to.path === '/admin' && !getStoredAdminPassword()) {
    return '/admin/login';
  }
});
