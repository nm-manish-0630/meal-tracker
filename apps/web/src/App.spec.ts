import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import App from './App.vue';

describe('App', () => {
  it('renders the heading', () => {
    const wrapper = mount(App);
    expect(wrapper.get('h1').text()).toBe('Meal Tracker');
  });

  it('increments the counter on click', async () => {
    const wrapper = mount(App);
    const button = wrapper.get('button');

    await button.trigger('click');

    expect(button.text()).toBe('Count is 1');
  });
});
