import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import App from './App.vue';

describe('App', () => {
  it('renders the heading', () => {
    const wrapper = mount(App);
    expect(wrapper.get('h1').text()).toBe('Meal Tracker');
  });

  it('starts in the idle upload state', () => {
    const wrapper = mount(App);
    expect(wrapper.text()).toContain('Add a photo');
    expect(wrapper.find('.review').exists()).toBe(false);
  });
});
