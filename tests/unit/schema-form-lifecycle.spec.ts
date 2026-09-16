import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { FormApi } from '../../src/libs/form/core/api';
import { FormCancelledError } from '../../src/libs/form/internal/errors';

const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).forEach((stop) => stop());
  vi.restoreAllMocks();
});
async function started(check: () => boolean): Promise<void> {
  await vi.waitFor(() => expect(check()).toBe(true), { interval: 1, timeout: 1000 });
}
describe('Vben async lifecycle and snapshots', () => {
  it('keeps manual errors across programmatic value writes and hidden rules', async () => {
    const api = new FormApi({
      schema: [{ fieldName: 'name', component: 'Input', rules: 'required' }],
    });
    cleanup.push(api.dispose);
    api.mount();
    await api.setFieldError('name', 'server error');
    await api.setFieldValue('name', 'valid');
    api.updateSchema([{ fieldName: 'name', hide: true }]);
    expect((await api.validate()).errors.name).toBe('server error');
    await api.clearValidation('name');
    expect((await api.validate()).valid).toBe(true);
  });
  it('reset cancels pending validation and prevents stale errors or submission', async () => {
    let release: ((valid: boolean) => void) | undefined;
    const submit = vi.fn();
    const api = new FormApi({
      schema: [
        {
          fieldName: 'name',
          component: 'Input',
          defaultValue: 'A',
          rules: z.string().refine(
            () =>
              new Promise<boolean>((resolve) => {
                release = resolve;
              }),
            'old error',
          ),
        },
      ],
      handleSubmit: submit,
    });
    cleanup.push(api.dispose);
    api.mount();
    const pending = api.submit().catch((error: unknown) => error);
    await started(() => !!release);
    expect(api.form.meta.validating).toBe(true);
    await api.reset();
    expect(await pending).toBeInstanceOf(FormCancelledError);
    release?.(false);
    await Promise.resolve();
    expect(api.form.errors).toEqual({});
    expect(submit).not.toHaveBeenCalled();
  });
  it('manual errors remain authoritative after an old async validator completes', async () => {
    let release: ((valid: boolean) => void) | undefined;
    const api = new FormApi({
      schema: [
        {
          fieldName: 'name',
          component: 'Input',
          defaultValue: 'A',
          rules: z.string().refine(
            () =>
              new Promise<boolean>((resolve) => {
                release = resolve;
              }),
            'old error',
          ),
        },
      ],
    });
    cleanup.push(api.dispose);
    api.mount();
    const pending = api.validateField('name').catch((error: unknown) => error);
    await started(() => !!release);
    await api.setFieldError('name', 'server error');
    expect(await pending).toBeInstanceOf(FormCancelledError);
    release?.(false);
    await Promise.resolve();
    expect(api.form.errors.name).toBe('server error');
  });
  it('does not wait on an obsolete dependency that never resolves', async () => {
    let evaluations = 0;
    const api = new FormApi({
      schema: [
        { fieldName: 'mode', component: 'Input', defaultValue: 'pending' },
        {
          fieldName: 'name',
          component: 'Input',
          rules: 'required',
          dependencies: {
            triggerFields: ['mode'],
            resolve: ({ values }) => {
              evaluations++;
              return values.mode === 'pending' ? new Promise(() => {}) : { show: false };
            },
          },
        },
      ],
    });
    cleanup.push(api.dispose);
    api.mount();
    await started(() => evaluations > 0);
    await api.setFieldValue('mode', 'ready');
    expect((await api.validate()).valid).toBe(true);
  });
  it('notifies once per batch and leaves codec evaluation lazy', async () => {
    const encode = vi.fn((values: Readonly<Record<string, unknown>>) => ({ ...values }));
    const changed = vi.fn();
    const api = new FormApi({
      schema: [
        { fieldName: 'a', component: 'Input', defaultValue: 'A' },
        { fieldName: 'b', component: 'Input', defaultValue: 'B' },
      ],
      codec: { encode, decode: (values) => ({ ...values }) },
      handleValuesChange: changed,
    });
    cleanup.push(api.dispose);
    api.mount();
    encode.mockClear();
    await api.setValues({ a: 'next', b: 'next' });
    await api.runtime.settle();
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.calls[0]?.[1]).toEqual(['a', 'b']);
    expect(encode).not.toHaveBeenCalled();
    const format: () => unknown = changed.mock.calls[0]?.[2];
    expect(format()).toEqual({ a: 'next', b: 'next' });
    expect(encode).toHaveBeenCalledTimes(1);
  });
  it('creates defaults once at each mount using the latest schema', async () => {
    const initial = vi.fn(() => 'generated');
    const api = new FormApi({
      schema: [{ fieldName: 'name', component: 'Input', rules: z.string().default(initial) }],
    });
    cleanup.push(api.dispose);
    expect(initial).not.toHaveBeenCalled();
    api.setState({
      schema: [
        { fieldName: 'name', component: 'Input', rules: z.string().default(initial) },
        { fieldName: 'extra', component: 'Input', defaultValue: 'before mount' },
      ],
    });
    api.mount();
    expect(initial).toHaveBeenCalledTimes(1);
    expect(await api.getValues()).toEqual({ name: 'generated', extra: 'before mount' });
    await api.reset({ values: { name: 'new baseline' } });
    api.unmount();
    api.mount();
    expect((await api.getValues()).name).toBe('generated');
  });
  it('keeps multi-field selectors stable when unrelated values change', async () => {
    const api = new FormApi({
      schema: [
        { fieldName: 'a', component: 'Input', defaultValue: 1 },
        { fieldName: 'b', component: 'Input', defaultValue: 2 },
      ],
    });
    cleanup.push(api.dispose);
    api.mount();
    const selected = api.form.useFieldValues(['a']);
    const previous = selected.value;
    await api.setFieldValue('b', 3);
    expect(selected.value).toBe(previous);
    await api.setFieldValue('a', 4);
    expect(selected.value).toEqual([4]);
    expect(selected.value).not.toBe(previous);
  });

  it('merges explicit nested defaults over Zod defaults with null fallback', async () => {
    const api = new FormApi({
      schema: [
        {
          fieldName: 'profile',
          component: 'Input',
          rules: z.object({ name: z.string().default('fallback'), age: z.number().default(18) }),
        },
        { fieldName: 'profile.name', component: 'Input', defaultValue: null },
      ],
    });
    cleanup.push(api.dispose);
    api.mount();
    expect(await api.getValues()).toEqual({ profile: { name: 'fallback', age: 18 } });
  });
  it('retains path-based manual errors when schema and array rows are removed', async () => {
    const api = new FormApi({
      schema: [
        { fieldName: 'extra', component: 'Input', defaultValue: 'x' },
        {
          type: 'array',
          fieldName: 'rows',
          defaultValue: [{ name: 'A' }, { name: 'B' }],
          children: [{ fieldName: 'name', component: 'Input' }],
        },
      ],
    });
    cleanup.push(api.dispose);
    api.mount();
    await api.setFieldError('extra', 'server extra');
    await api.setFieldError('rows[0].name', 'server row');
    await api.removeSchemaByFields(['extra']);
    await api.form.removeFieldValue('rows', 0);
    expect(api.form.errors).toEqual({ extra: 'server extra', 'rows[0].name': 'server row' });
    expect(api.form.values.rows).toEqual([{ name: 'B' }]);
    await api.clearValidation();
    expect((await api.validate()).valid).toBe(true);
  });
  it('inherits disabled and dynamic array column definitions', async () => {
    const api = new FormApi({
      schema: [
        {
          fieldName: 'rows',
          component: 'VbenFormFieldArray',
          defaultValue: [{ name: '' }],
          componentProps: () => ({
            disabled: true,
            commonConfig: { hideRequiredMark: true },
            schema: [{ fieldName: 'name', component: 'Input', rules: 'required' }],
          }),
        },
      ],
    });
    cleanup.push(api.dispose);
    api.mount();
    expect(api.runtime.map.get('rows[0].name')?.common.disabled).toBe(true);
    expect(api.runtime.map.get('rows[0].name')?.common.hideRequiredMark).toBe(true);
    expect((await api.validate()).valid).toBe(false);
  });
});
