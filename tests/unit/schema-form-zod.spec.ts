import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { FormApi } from '@/libs/form/core/api';
import { zodDefaultValue } from '@/libs/form/internal/zod';
const cleanups: (() => void)[] = [];
function mount(rules: z.ZodType, defaultValue?: unknown) {
  const api = new FormApi({
    schema: [
      {
        fieldName: 'value',
        component: 'Input',
        rules,
        ...(defaultValue === undefined ? {} : { defaultValue }),
      },
    ],
  });
  cleanups.push(api.dispose);
  api.mount();
  return api;
}
afterEach(() => cleanups.splice(0).forEach((stop) => stop()));
describe('unified Zod input and validation behavior', () => {
  it('preserves optional email empty string and first union error', async () => {
    const api = mount(
      z
        .union([z.literal(''), z.email({ error: '请输入有效邮箱' })], { error: '请输入有效邮箱' })
        .optional(),
    );
    await api.setFieldValue('value', 'bad');
    expect((await api.validate()).errors.value).toBe('请输入有效邮箱');
    for (const value of ['', undefined, 'a@example.com']) {
      await api.setFieldValue('value', value);
      expect((await api.validate()).valid).toBe(true);
    }
  });
  it('reports the first issue and leaves parsed output outside the raw model', async () => {
    const api = mount(
      z
        .string()
        .min(3, 'too short')
        .regex(/^A/, 'prefix')
        .transform((value) => value.toUpperCase()),
      'x',
    );
    expect((await api.validate()).errors.value).toBe('too short');
    await api.setFieldValue('value', 'Alice');
    expect(await api.submit()).toEqual({ value: 'Alice' });
  });
  it('extracts input defaults without executing transforms or refinements', () => {
    const transform = vi.fn((value: string) => value.length);
    const refine = vi.fn(() => true);
    expect(zodDefaultValue(z.string().default('input').refine(refine).transform(transform))).toBe(
      'input',
    );
    expect(transform).not.toHaveBeenCalled();
    expect(refine).not.toHaveBeenCalled();
    expect(
      zodDefaultValue(z.object({ email: z.email(), count: z.int(), list: z.array(z.string()) })),
    ).toEqual({ email: '', count: 0, list: [] });
  });
  it('uses explicit field defaults over rule defaults', async () => {
    const api = mount(z.string().default('fallback'), 'explicit');
    expect(await api.getValues()).toEqual({ value: 'explicit' });
  });
  it('propagates validator execution failure as a rejected validation', async () => {
    const api = mount(
      z.string().refine(async () => {
        throw new Error('service failure');
      }),
      'input',
    );
    await expect(api.validate()).rejects.toThrow('service failure');
  });
  it('validates only the selected field', async () => {
    const other = vi.fn(() => true);
    const api = new FormApi({
      schema: [
        { fieldName: 'name', component: 'Input', rules: 'required' },
        {
          fieldName: 'other',
          component: 'Input',
          defaultValue: 'x',
          rules: z.string().refine(other),
        },
      ],
    });
    cleanups.push(api.dispose);
    api.mount();
    other.mockClear();
    expect((await api.validateField('name')).valid).toBe(false);
    expect(other).not.toHaveBeenCalled();
  });
});
