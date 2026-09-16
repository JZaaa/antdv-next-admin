import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { registerFormRules } from '../../src/libs/form/config';
import { FormApi } from '../../src/libs/form/core/api';
import { FormCancelledError } from '../../src/libs/form/internal/errors';

const cleanup: (() => void)[] = [];
function mounted(options: ConstructorParameters<typeof FormApi>[0] = {}) {
  const api = new FormApi(options);
  cleanup.push(api.dispose);
  api.mount();
  return api;
}
afterEach(() => {
  cleanup.splice(0).forEach((stop) => stop());
  vi.useRealTimers();
});
describe('modern Vben form contracts', () => {
  it('waits for mount and rejects pending calls when disposed', async () => {
    const api = new FormApi({
      schema: [{ fieldName: 'name', component: 'Input', defaultValue: 'Ada' }],
    });
    cleanup.push(api.dispose);
    let done = false;
    const result = api.getValues().then((value) => {
      done = true;
      return value;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    api.mount();
    expect(await result).toEqual({ name: 'Ada' });
    api.unmount();
    const pending = api.getRawValues();
    api.dispose();
    await expect(pending).rejects.toBeInstanceOf(FormCancelledError);
  });
  it('validates every submit entry, returns a result, and preserves business exceptions', async () => {
    const submit = vi.fn();
    const api = mounted({
      schema: [{ fieldName: 'name', component: 'Input', rules: 'required' }],
      handleSubmit: submit,
    });
    expect(await api.validate()).toEqual({ valid: false, errors: { name: '请填写name' } });
    expect(await api.submit()).toBeUndefined();
    expect(await api.validateAndSubmit()).toBeUndefined();
    expect(submit).not.toHaveBeenCalled();
    await api.setFieldValue('name', 'Ada');
    expect(await api.submit()).toEqual({ name: 'Ada' });
    expect(submit).toHaveBeenCalledWith({ name: 'Ada' }, { name: 'Ada' });
    api.setState({
      handleSubmit: () => {
        throw new Error('server');
      },
    });
    await expect(api.submit()).rejects.toThrow('server');
  });
  it('does not validate setters by default; isFieldValid only reads errors', async () => {
    const rule = vi.fn(() => false);
    registerFormRules({ counted: rule });
    const api = mounted({ schema: [{ fieldName: 'x', component: 'Input', rules: 'counted' }] });
    await api.setFieldValue('x', 1);
    expect(rule).not.toHaveBeenCalled();
    expect(await api.isFieldValid('x')).toBe(true);
    expect(rule).not.toHaveBeenCalled();
    await api.setFieldValue('x', 2, true);
    expect(rule).toHaveBeenCalledTimes(1);
    expect(await api.isFieldValid('x')).toBe(false);
    await api.clearValidation('x');
    expect(await api.isFieldValid('x')).toBe(true);
  });
  it('merges filtered object patches, replaces arrays, and supports unfiltered branches', async () => {
    const api = mounted({
      schema: [
        { fieldName: 'user.name', component: 'Input', defaultValue: 'A' },
        { fieldName: 'user.age', component: 'InputNumber', defaultValue: 20 },
        { fieldName: 'items', component: 'Select', defaultValue: [1, 2] },
      ],
    });
    await api.setValues({ user: { name: 'B', unknown: true }, items: [3], extra: 'ignored' });
    expect(await api.getRawValues()).toEqual({ user: { name: 'B', age: 20 }, items: [3] });
    await api.setValues({ user: { name: null }, extra: true }, false);
    expect(await api.getRawValues()).toEqual({ user: { name: null }, items: [3], extra: true });
    await api.setFieldValue('user', { name: undefined });
    expect(await api.getRawValues()).toEqual({
      user: { name: undefined },
      items: [3],
      extra: true,
    });
  });
  it('retains literal dotted names and nested array values', async () => {
    const api = mounted({
      schema: [
        { fieldName: '[a.b]', component: 'Input', defaultValue: 'literal' },
        { fieldName: 'rows[0].name', component: 'Input', defaultValue: 'nested' },
      ],
    });
    await api.setFieldValue('[a.b]', 'next');
    await api.setFieldValue('rows[0].name', 'row');
    expect(await api.getRawValues()).toEqual({ 'a.b': 'next', rows: [{ name: 'row' }] });
    expect(api.form.getFieldValue('[a.b]')).toBe('next');
  });
  it('uses reset state/options and leaves custom button reset in charge', async () => {
    const reset = vi.fn();
    const api = mounted({
      schema: [
        { fieldName: 'a', component: 'Input', defaultValue: 1 },
        { fieldName: 'b', component: 'Input', defaultValue: 2 },
      ],
      handleReset: reset,
    });
    await api.setValues({ a: 9 });
    await api.resetByButton();
    expect(reset).toHaveBeenCalledWith({ a: 9, b: 2 });
    expect((await api.getValues()).a).toBe(9);
    await api.reset({ values: { a: 3 } }, { keepDefaultValues: true });
    expect(await api.getValues()).toEqual({ a: 3, b: 2 });
    await api.reset();
    expect(await api.getValues()).toEqual({ a: 1, b: 2 });
    await api.reset({ values: { a: 4 } }, { force: true });
    expect(await api.getValues()).toEqual({ a: 4 });
    await api.setFieldValue('a', 7);
    await api.reset();
    expect(await api.getValues()).toEqual({ a: 4 });
  });
  it('captures raw and encoded values together and isolates codec mutations', async () => {
    const api = new FormApi<{ name: string }, string, Record<never, never>, { display: string }>({
      schema: [{ fieldName: 'name', component: 'Input', defaultValue: 'Ada' }],
      codec: {
        encode: (raw) => ({ display: raw.name.toUpperCase() }),
        decode: (payload) => ({ name: payload.display.toLowerCase() }),
      },
    });
    cleanup.push(api.dispose);
    api.mount();
    expect(await api.getValueSnapshot()).toEqual({
      rawValues: { name: 'Ada' },
      values: { display: 'ADA' },
    });
    await api.setSubmitValues({ display: 'NEW' });
    expect(await api.getRawValues()).toEqual({ name: 'new' });
    await api.submit();
    const latest = api.getLatestSubmissionValues();
    latest.display = 'mutated';
    expect(api.getLatestSubmissionValues()).toEqual({ display: 'NEW' });
  });
  it('skips hidden rules and retains writable hidden values in submission', async () => {
    const api = mounted({
      schema: [
        { fieldName: 'toggle', component: 'Switch', defaultValue: false },
        { fieldName: 'hide', component: 'Input', hide: true, rules: 'required' },
        {
          fieldName: 'if',
          component: 'Input',
          rules: 'required',
          dependencies: {
            triggerFields: ['toggle'],
            resolve: ({ values }) => ({ if: !!values.toggle }),
          },
        },
        {
          fieldName: 'show',
          component: 'Input',
          rules: 'required',
          dependencies: {
            triggerFields: ['toggle'],
            resolve: ({ values }) => ({ show: !!values.toggle }),
          },
        },
      ],
    });
    expect((await api.validate()).valid).toBe(true);
    await api.setFieldValue('hide', 'kept');
    expect((await api.submit())?.hide).toBe('kept');
    await api.setFieldValue('toggle', true);
    expect(Object.keys((await api.validate()).errors)).toEqual(['if', 'show']);
    await api.setFieldValue('toggle', false);
    expect((await api.validate()).valid).toBe(true);
  });
  it('matches named rules, Zod wrappers and does not write parsed output', async () => {
    const api = mounted({
      schema: [
        {
          fieldName: 'x',
          component: 'Input',
          defaultValue: '  value  ',
          rules: z.string().transform((value) => value.trim()),
        },
        { fieldName: 'a', component: 'Input', defaultValue: [], rules: z.array(z.string()).min(1) },
      ],
    });
    expect((await api.validate()).errors.a).toBeTruthy();
    await api.setFieldValue('a', ['ok']);
    expect(await api.submit()).toEqual({ x: '  value  ', a: ['ok'] });
  });
  it('provides actions/controller/schema and replaces dynamic state including explicit null', async () => {
    const api = mounted({
      schema: [
        { fieldName: 'toggle', component: 'Switch', defaultValue: false },
        {
          fieldName: 'x',
          component: 'Input',
          rules: 'required',
          dependencies: {
            triggerFields: ['toggle'],
            resolve: ({ values, actions, controller, schema }) => {
              expect(actions.getFieldValue('toggle')).toBe(values.toggle);
              expect(controller.getState().schema).toBeDefined();
              expect(schema.fieldName).toBe('x');
              return values.toggle ? {} : { rules: null, help: null, renderComponentContent: {} };
            },
          },
        },
      ],
    });
    expect((await api.validate()).valid).toBe(true);
    await api.setFieldValue('toggle', true);
    expect((await api.validate()).valid).toBe(false);
  });
  it('ignores stale async dependency completion', async () => {
    let release: ((value: { show: boolean }) => void) | undefined;
    const api = mounted({
      schema: [
        { fieldName: 'toggle', component: 'Switch', defaultValue: false },
        {
          fieldName: 'x',
          component: 'Input',
          rules: 'required',
          dependencies: {
            triggerFields: ['toggle'],
            resolve: ({ values }) =>
              values.toggle
                ? { show: false }
                : new Promise((resolve) => {
                    release = resolve;
                  }),
          },
        },
      ],
    });
    await Promise.resolve();
    await api.setFieldValue('toggle', true);
    await Promise.resolve();
    release?.({ show: true });
    expect((await api.validate()).valid).toBe(true);
  });
  it('supports groups, scoped array dependencies, unknown triggers, and nested child updates', async () => {
    const contexts: unknown[] = [];
    const api = mounted({
      schema: [
        {
          type: 'group',
          name: 'main',
          children: [{ fieldName: 'flag', component: 'Input', defaultValue: 'root' }],
        },
        {
          type: 'array',
          fieldName: 'rows',
          defaultValue: [{ name: '' }, { name: 'B' }],
          children: [
            {
              fieldName: 'name',
              component: 'Input',
              rules: 'required',
              dependencies: {
                triggerFields: ['$root.flag', '$row.name'],
                resolve: ({ schema }) => {
                  contexts.push(schema);
                  return {};
                },
              },
            },
          ],
        },
      ],
    });
    expect((await api.validate()).errors['rows[0].name']).toBeTruthy();
    expect(contexts).toContainEqual(
      expect.objectContaining({
        rowIndex: 0,
        rowPath: 'rows[0]',
        arrayField: 'rows',
        originalFieldName: 'name',
        row: { name: '' },
      }),
    );
    await api.form.removeFieldValue('rows', 0);
    expect((await api.validate()).valid).toBe(true);
    api.form.pushFieldValue('rows', { name: '' });
    expect((await api.validate()).valid).toBe(false);
    api.updateSchema([{ fieldName: 'rows.name', rules: z.string().optional() }]);
    expect((await api.validate()).valid).toBe(true);
    await api.removeSchemaByFields(['flag']);
    expect((await api.getValues()).flag).toBeUndefined();
  });
  it('updates reactive selectors and supports manual errors for unknown fields', async () => {
    const api = mounted({ schema: [{ fieldName: 'x', component: 'Input', defaultValue: 1 }] });
    const selected = api.form.useFieldValue('x');
    const meta = api.form.useSelector((state) => state.meta.valid);
    expect(selected.value).toBe(1);
    await api.setFieldValue('x', 2);
    expect(selected.value).toBe(2);
    await api.setFieldError('server', 'Rejected');
    expect(meta.value).toBe(false);
    expect(await api.validate()).toEqual({ valid: false, errors: { server: 'Rejected' } });
    await api.clearValidation();
    expect(meta.value).toBe(true);
  });
  it('debounces automatic submission and cancels it on unmount', async () => {
    vi.useFakeTimers();
    const submit = vi.fn();
    const api = mounted({
      schema: [{ fieldName: 'x', component: 'Input' }],
      submitOnChange: true,
      changeDebouncedTime: 10,
      handleSubmit: submit,
    });
    await api.setFieldValue('x', 1);
    await api.setFieldValue('x', 2);
    await vi.advanceTimersByTimeAsync(11);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]?.[0]).toEqual({ x: 2 });
    await api.setFieldValue('x', 3);
    api.unmount();
    await vi.advanceTimersByTimeAsync(11);
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it('merges form results in declaration order without invoking submission callbacks', async () => {
    const submit = vi.fn();
    const a = mounted({
      schema: [{ fieldName: 'a', component: 'Input', defaultValue: 1 }],
      handleSubmit: submit,
    });
    const b = mounted({ schema: [{ fieldName: 'b', component: 'Input', defaultValue: 2 }] });
    expect(await a.merge(b).submitAllForm()).toEqual({ a: 1, b: 2 });
    expect(submit).not.toHaveBeenCalled();
  });
});
