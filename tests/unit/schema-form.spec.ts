import { afterEach, describe, expect, it, vi } from 'vitest';

import { FormApi } from '@/libs/form/core/api';
import { FormCancelledError } from '@/libs/form/internal/errors';
import { enUS, zhCN } from '@/libs/form/locales';
const cleanups: (() => void)[] = [];
function mount(options: ConstructorParameters<typeof FormApi>[0]) {
  const api = new FormApi(options);
  cleanups.push(api.dispose);
  api.mount();
  return api;
}
afterEach(() => cleanups.splice(0).forEach((stop) => stop()));
describe('unified SchemaForm data and submission contracts', () => {
  it('query collapse and disabled fields still validate before any business submission', async () => {
    const submit = vi.fn();
    const api = mount({
      schema: [{ fieldName: 'keyword', component: 'Input', rules: 'required' }],
      commonConfig: { disabled: true },
      collapsed: true,
      showCollapseButton: true,
      submitButtonOptions: { content: '查询' },
      handleSubmit: submit,
    });
    expect(await api.submit()).toBeUndefined();
    expect(submit).not.toHaveBeenCalled();
    await api.setFieldValue('keyword', 'search');
    expect(await api.submit()).toEqual({ keyword: 'search' });
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it.each([false, 0])('required accepts %s', async (value) => {
    const api = mount({
      schema: [{ fieldName: 'value', component: 'Input', rules: 'required', defaultValue: value }],
    });
    expect((await api.validate()).valid).toBe(true);
  });
  it.each(['', [], null, undefined])('required rejects empty value %j', async (value) => {
    const api = mount({ schema: [{ fieldName: 'value', component: 'Input', rules: 'required' }] });
    await api.setFieldValue('value', value);
    expect((await api.validate()).valid).toBe(false);
  });
  it('rejects accessors before batch write without evaluating them', async () => {
    const getter = vi.fn(() => 'bad');
    const patch = Object.defineProperty({}, 'name', { enumerable: true, get: getter });
    const api = mount({
      schema: [{ fieldName: 'name', component: 'Input', defaultValue: 'safe' }],
    });
    await expect(api.setValues(patch, false)).rejects.toThrow();
    expect(getter).not.toHaveBeenCalled();
    expect((await api.getValues()).name).toBe('safe');
  });
  it('isolates date values and reset baselines from caller mutation', async () => {
    const date = new Date('2026-09-01');
    const api = mount({
      schema: [{ fieldName: 'date', component: 'DatePicker', defaultValue: date }],
    });
    date.setFullYear(2000);
    const snapshot = await api.getRawValues();
    (snapshot.date as Date).setFullYear(2001);
    expect((api.form.getFieldValue('date') as Date).getFullYear()).toBe(2026);
    await api.reset({ values: { date: new Date('2027-09-01') } });
    await api.setFieldValue('date', null);
    await api.reset();
    expect((api.form.getFieldValue('date') as Date).getFullYear()).toBe(2027);
  });
  it('shares concurrent submissions and permits retry after completion', async () => {
    let release!: () => void;
    const business = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const api = mount({ schema: [], handleSubmit: business });
    const first = api.submit();
    const second = api.submit();
    expect(first).toBe(second);
    await vi.waitFor(() => expect(business).toHaveBeenCalledTimes(1));
    release();
    await first;
    const third = api.submit();
    await vi.waitFor(() => expect(business).toHaveBeenCalledTimes(2));
    release();
    await third;
  });
  it('supports remount with a fresh default value and rejects disposed access', async () => {
    const api = mount({
      schema: [{ fieldName: 'name', component: 'Input', defaultValue: 'initial' }],
    });
    await api.setFieldValue('name', 'edited');
    api.unmount();
    api.mount();
    expect((await api.getValues()).name).toBe('initial');
    api.unmount();
    const pending = api.getValues();
    api.dispose();
    await expect(pending).rejects.toBeInstanceOf(FormCancelledError);
  });
});

describe('per-form language configuration', () => {
  it.each([enUS, zhCN])('localizes named rules without changing another form', async (locale) => {
    const localized = mount({
      locale,
      schema: [
        { fieldName: 'name', label: 'Name', component: 'Input', rules: 'required' },
        { fieldName: 'choice', label: 'Choice', component: 'Select', rules: 'selectRequired' },
      ],
    });
    const chinese = mount({
      schema: [{ fieldName: 'name', label: 'Name', component: 'Input', rules: 'required' }],
    });
    expect((await localized.validate()).errors).toEqual({
      name: locale.required('Name'),
      choice: locale.selectRequired?.('Choice'),
    });
    expect((await chinese.validate()).errors.name).toBe(zhCN.required('Name'));
  });
});
