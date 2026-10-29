import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './HomeView.vue';
import PerDayView from './PerDayView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/clients/:clientId/days/:date', component: PerDayView },
  ],
});

describe('HomeView', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('prompts for a client id when none is set', async () => {
    const wrapper = mount(HomeView, { global: { plugins: [router] } });
    await router.isReady();
    expect(wrapper.get('h1').text()).toBe('Meal Tracker');
    expect(wrapper.find('input').exists()).toBe(true);
  });
});
