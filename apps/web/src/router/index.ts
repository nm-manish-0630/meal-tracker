import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import ClientHistoryView from '../views/ClientHistoryView.vue';
import ClientUploadView from '../views/ClientUploadView.vue';
import PerDayView from '../views/PerDayView.vue';
import TrainerDashboardView from '../views/TrainerDashboardView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/clients/:clientId', component: HomeView },
    { path: '/clients/:clientId/history', component: ClientHistoryView },
    { path: '/clients/:clientId/upload', component: ClientUploadView },
    { path: '/clients/:clientId/days/:date', component: PerDayView },
    { path: '/trainer', component: TrainerDashboardView },
  ],
  scrollBehavior(to) {
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' };
    }
    return { top: 0 };
  },
});
