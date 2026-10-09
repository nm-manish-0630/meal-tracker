import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
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
  it('renders the heading', async () => {
    const wrapper = mount(HomeView, { global: { plugins: [router] } });
    await router.isReady();
    expect(wrapper.get('h1').text()).toBe('Meal Tracker');
  });

  it('starts in the idle upload state', async () => {
    const wrapper = mount(HomeView, { global: { plugins: [router] } });
    await router.isReady();
    expect(wrapper.text()).toContain('Add a photo');
    expect(wrapper.find('.review').exists()).toBe(false);
  });
});
