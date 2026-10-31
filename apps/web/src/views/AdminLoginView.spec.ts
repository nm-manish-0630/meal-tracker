import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from '../router';
import AdminLoginView from './AdminLoginView.vue';

describe('Admin login + route guard', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('redirects an unauthenticated visit to /admin back to /admin/login', async () => {
    await router.push('/admin');
    expect(router.currentRoute.value.path).toBe('/admin/login');
  });

  it('logs in, stores the password, and navigates to /admin on success', async () => {
    await router.push('/admin/login');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(AdminLoginView, { global: { plugins: [router] } });
    await wrapper.get('input[type="password"]').setValue('secret');
    await wrapper.get('form').trigger('submit.prevent');
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/admin'));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/login'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ password: 'secret' }) }),
    );
    expect(localStorage.getItem('meal-tracker:adminPassword')).toBe('secret');
  });

  it('shows an error and does not navigate when the password is rejected', async () => {
    await router.push('/admin/login');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({ message: 'Invalid password' }) }),
    );

    const wrapper = mount(AdminLoginView, { global: { plugins: [router] } });
    await wrapper.get('input[type="password"]').setValue('wrong');
    await wrapper.get('form').trigger('submit.prevent');
    await vi.waitFor(() => expect(wrapper.find('.error').exists()).toBe(true));

    expect(wrapper.get('.error').text()).toBe('Invalid password');
    expect(router.currentRoute.value.path).toBe('/admin/login');
    expect(localStorage.getItem('meal-tracker:adminPassword')).toBeNull();
  });
});
