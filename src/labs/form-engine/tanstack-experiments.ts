import type { ExperimentReport, ExperimentResult } from './experiments';

import { FieldApi, useField, useForm, useSelector } from '@tanstack/vue-form';
import { Form, FormItem, Input } from 'antdv-next';
/* eslint-disable no-await-in-loop -- Fixtures and deferred validations run in a controlled order. */
import { createApp, defineComponent, h, nextTick, onMounted, onUnmounted, ref } from 'vue';

import { inspectComplexValues } from './complex-values';
import { delay } from './experiments';
import { snapshotFormValue } from './snapshot';

declare const FORM_LAB_VERSIONS: Record<string, string>;
type Values = Record<string, string>;
type Validator = (name: string, value: string, signal: AbortSignal) => Promise<string | undefined>;
interface Options {
  values?: Values;
  validate?: Validator;
  submitOnly?: boolean;
  debounce?: number;
  dependency?: boolean;
  guarded?: boolean;
  minimalSelector?: boolean;
  onSubmit?: (value: Values) => Promise<void>;
}
interface FieldBridge {
  errors: () => unknown[];
  validating: () => boolean;
  validate: () => Promise<unknown>;
  clear: () => void;
  touch: () => void;
  replaceRule: (validator: Validator) => void;
}
interface Fixture {
  input: (name: string, value: string) => Promise<void>;
  set: (name: string, value: string) => void;
  values: () => Values;
  reset: (values?: Values) => void;
  submit: () => Promise<void>;
  submitting: () => boolean;
  field: (name: string) => FieldBridge;
  hide: () => Promise<void>;
  show: () => Promise<void>;
  dispose: () => void;
  renders: Record<string, number>;
  calls: Record<string, number>;
  submits: Values[];
  nativeValidations: () => number;
  element: HTMLElement;
}
async function until(check: () => boolean, description: string): Promise<void> {
  const started = performance.now();
  while (!check()) {
    if (performance.now() - started > 4000) throw new Error(`等待超时：${description}`);
    await delay(5);
  }
}
async function flush(): Promise<void> {
  await delay(0);
  await nextTick();
}
function deferred(): {
  validate: Validator;
  calls: { name: string; value: string; signal: AbortSignal; finish: (error?: string) => void }[];
} {
  const calls: {
    name: string;
    value: string;
    signal: AbortSignal;
    finish: (error?: string) => void;
  }[] = [];
  return {
    calls,
    // Ignore cancellation, like a remote service that cannot cancel its work.
    validate: (name, value, signal) =>
      new Promise((resolve) => {
        calls.push({ name, value, signal, finish: resolve });
      }),
  };
}
async function fixture(host: HTMLElement, options: Options = {}): Promise<Fixture> {
  const element = document.createElement('section');
  host.append(element);
  const visible = ref(true);
  const fields = new Map<string, FieldBridge>();
  const renders: Record<string, number> = {};
  const calls: Record<string, number> = {};
  const submits: Values[] = [];
  let revision = 0;
  let submitRevision = -1;
  let submitSnapshot: Values = {};
  let inFlight: Promise<void> | undefined;
  const cancellations = new Map<string, Set<() => void>>();
  const paused = new Set<string>();
  const rules = new Map<string, Validator>();
  function resumeChange(name: string): void {
    paused.delete(name);
    if (options.guarded && options.dependency && name === 'password') {
      paused.delete('confirm');
      // Source edits actively revalidate declared dependents, including after reset.
      fields.get('confirm')?.touch();
    }
  }
  function invalidate(name?: string): void {
    revision++;
    if (!options.guarded) return;
    for (const [fieldName, callbacks] of cancellations) {
      if (name !== undefined && name !== fieldName) continue;
      paused.add(fieldName);
      for (const cancel of [...callbacks]) cancel();
    }
  }
  function runValidation(
    name: string,
    value: string,
    signal: AbortSignal,
  ): Promise<string | undefined> {
    const validator = rules.get(name) ?? options.validate;
    if (!validator || (options.guarded && paused.has(name))) return Promise.resolve(undefined);
    if (!options.guarded) return validator(name, value, signal);
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const callbacks = cancellations.get(name)!;
      let finished = false;
      function cleanup(): void {
        finished = true;
        callbacks.delete(cancel);
        signal.removeEventListener('abort', cancel);
      }
      function cancel(): void {
        if (finished) return;
        cleanup();
        controller.abort();
        resolve(undefined);
      }
      callbacks.add(cancel);
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) {
        cancel();
        return;
      }
      Promise.resolve()
        .then(() => (finished ? undefined : validator(name, value, controller.signal)))
        .then(
          (result) => {
            if (!finished) {
              cleanup();
              resolve(result);
            }
          },
          (error: unknown) => {
            if (!finished) {
              cleanup();
              reject(error);
            }
          },
        );
    });
  }
  let nativeValidations = 0;
  let api: Pick<Fixture, 'set' | 'values' | 'reset' | 'submit' | 'submitting'> | undefined;
  const app = createApp(
    defineComponent({
      setup() {
        const form = useForm({
          defaultValues: options.values ?? { field: 'initial' },
          onSubmit: async ({ value }): Promise<void> => {
            if (options.guarded && revision !== submitRevision) throw new Error('stale submission');
            const payload = options.guarded ? submitSnapshot : value;
            submits.push(snapshotFormValue(payload));
            try {
              await options.onSubmit?.(payload);
            } catch (error) {
              if (options.guarded && revision !== submitRevision)
                throw new Error('stale submission', { cause: error });
              throw error;
            }
            // Cannot undo a sent business request; prevent its completion from appearing current.
            if (options.guarded && revision !== submitRevision) throw new Error('stale submission');
          },
        });
        api = {
          set: (name, value) => {
            revision++;
            resumeChange(name);
            form.setFieldValue(name, value);
          },
          values: () => ({ ...form.state.values }),
          reset: (values) => {
            invalidate();
            form.reset(values);
          },
          submit: () => {
            if (!options.guarded) return form.handleSubmit();
            if (inFlight) return inFlight;
            submitRevision = revision;
            submitSnapshot = snapshotFormValue(form.state.values);
            paused.clear();
            inFlight = form.handleSubmit().finally(() => {
              inFlight = undefined;
            });
            return inFlight;
          },
          submitting: () => form.state.isSubmitting,
        };
        const fieldComponents = Object.keys(form.state.values).map((name) =>
          defineComponent({
            name: 'TanStackLabField',
            setup() {
              cancellations.set(name, new Set());
              paused.delete(name);
              onUnmounted(() => {
                if (options.guarded) invalidate(name);
              });
              const validate = options.validate
                ? async ({
                    value,
                    signal,
                  }: {
                    value: string;
                    signal: AbortSignal;
                  }): Promise<string | undefined> => {
                    calls[name] = (calls[name] ?? 0) + 1;
                    return runValidation(name, value, signal);
                  }
                : undefined;
              const fieldOptions = {
                form,
                name,
                validators: {
                  onChangeAsync: options.submitOnly ? undefined : validate,
                  onChangeAsyncDebounceMs: options.debounce ?? 0,
                  onSubmitAsync: options.submitOnly ? validate : undefined,
                  onChangeListenTo:
                    options.dependency && name === 'confirm' ? ['password'] : undefined,
                  onChange:
                    options.dependency && !options.validate
                      ? ({ value }: { value: string }) => {
                          calls[name] = (calls[name] ?? 0) + 1;
                          return name === 'confirm' && value !== form.getFieldValue('password')
                            ? 'password mismatch'
                            : undefined;
                        }
                      : undefined,
                },
              };
              const field =
                options.minimalSelector || options.guarded
                  ? (() => {
                      const fieldApi = new FieldApi(fieldOptions);
                      let cleanup: (() => void) | undefined;
                      onMounted(() => {
                        cleanup = fieldApi.mount();
                      });
                      onUnmounted(() => {
                        cleanup?.();
                      });
                      const state = useSelector(
                        fieldApi.store,
                        (value) => ({
                          value: value.value,
                          meta: {
                            errors: value.meta.errors,
                            isValidating: value.meta.isValidating,
                          },
                        }),
                        {
                          compare: (a, b) =>
                            a.value === b.value &&
                            a.meta.errors === b.meta.errors &&
                            a.meta.isValidating === b.meta.isValidating,
                        },
                      );
                      return {
                        api: fieldApi,
                        get state() {
                          return state.value;
                        },
                      };
                    })()
                  : useField(fieldOptions);
              fields.set(name, {
                touch: () => field.api.setMeta((previous) => ({ ...previous, isTouched: true })),
                errors: () => [...field.state.meta.errors],
                validating: () => field.state.meta.isValidating,
                validate: async () => {
                  paused.delete(name);
                  field.api.setMeta((previous) => ({ ...previous, isTouched: true }));
                  return field.api.validate('change');
                },
                clear: () => {
                  invalidate(name);
                  field.api.setMeta((previous) => ({ ...previous, errorMap: {} }));
                },
                replaceRule: (validator) => {
                  invalidate(name);
                  rules.set(name, validator);
                  paused.delete(name);
                  field.api.setMeta((previous) => ({ ...previous, errorMap: {} }));
                },
              });
              return () => {
                renders[name] = (renders[name] ?? 0) + 1;
                const error = field.state.meta.errors.map(String).join('; ');
                return h(
                  FormItem,
                  {
                    label: name,
                    // No name/rules: antdv-next only presents TanStack's state.
                    validateStatus: error
                      ? 'error'
                      : field.state.meta.isValidating
                        ? 'validating'
                        : undefined,
                    help: error || undefined,
                  },
                  {
                    default: () =>
                      h(Input, {
                        value: field.state.value,
                        'data-field': name,
                        'onUpdate:value': (value: string) => {
                          revision++;
                          resumeChange(name);
                          field.api.handleChange(value);
                        },
                        onBlur: () => field.api.handleBlur(),
                      }),
                  },
                );
              };
            },
          }),
        );
        return () =>
          h(
            Form,
            {
              layout: 'vertical',
              validateTrigger: false,
              onValidate: () => {
                nativeValidations++;
              },
            },
            {
              default: () =>
                visible.value
                  ? fieldComponents.map((component, index) => h(component, { key: index }))
                  : [],
            },
          );
      },
    }),
  );
  app.mount(element);
  await nextTick();
  if (!api) throw new Error('TanStack fixture failed to mount');
  let mounted = true;
  return {
    ...api,
    element,
    renders,
    calls,
    submits,
    nativeValidations: () => nativeValidations,
    field: (name) => {
      const field = fields.get(name);
      if (!field) throw new Error(`Unknown fixture field: ${name}`);
      return field;
    },
    input: async (name, value) => {
      const input = Array.from(element.querySelectorAll('input')).find(
        (node) => node.dataset.field === name,
      );
      if (!input) throw new Error(`Input not mounted: ${name}`);
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await nextTick();
    },
    hide: async () => {
      visible.value = false;
      await nextTick();
    },
    show: async () => {
      visible.value = true;
      await nextTick();
    },
    dispose: () => {
      if (mounted) app.unmount();
      mounted = false;
      element.remove();
    },
  };
}

export async function runTanStackExperiments(
  host: HTMLElement,
  onResult: (result: ExperimentResult) => void,
): Promise<ExperimentReport> {
  const results: ExperimentResult[] = [];
  let current: Fixture | undefined;
  const mount = async (options: Options = {}): Promise<Fixture> => {
    current?.dispose();
    current = await fixture(host, options);
    return current;
  };
  const check = async (
    id: string,
    title: string,
    expected: string,
    run: () => Promise<{ pass: boolean; observed: unknown }>,
  ): Promise<void> => {
    let result: ExperimentResult;
    try {
      const { pass, observed } = await run();
      result = {
        id,
        title,
        expected,
        status: pass ? 'pass' : 'gap',
        observed: JSON.parse(JSON.stringify(observed)),
      };
    } catch (error) {
      result = {
        id,
        title,
        expected,
        status: 'error',
        observed: error instanceof Error ? error.message : String(error),
      };
    } finally {
      current?.dispose();
      current = undefined;
    }
    results.push(result);
    onResult(result);
  };
  for (const oldFails of [true, false]) {
    await check(
      oldFails ? 'ts-race-old-error' : 'ts-race-old-success',
      oldFails ? '旧失败晚于新成功' : '旧成功晚于新失败',
      '错误只反映最新 B，即使旧业务 Promise 忽略 abort',
      async () => {
        const gate = deferred();
        const f = await mount({ validate: gate.validate });
        await f.input('field', 'A');
        await until(() => gate.calls.length === 1, 'A started');
        await f.input('field', 'B');
        await until(() => gate.calls.length === 2, 'B started');
        gate.calls[1]!.finish(oldFails ? undefined : 'B invalid');
        await flush();
        const afterB = f.field('field').errors();
        gate.calls[0]!.finish(oldFails ? 'A invalid' : undefined);
        await until(() => !f.field('field').validating(), 'both finished');
        await flush();
        const finalErrors = f.field('field').errors();
        return {
          pass: JSON.stringify(finalErrors) === JSON.stringify(oldFails ? [] : ['B invalid']),
          observed: {
            afterB,
            finalErrors,
            oldAborted: gate.calls[0]!.signal.aborted,
            nativeValidations: f.nativeValidations(),
          },
        };
      },
    );
  }
  for (const operation of [
    'clear',
    'reset',
    'replace-session',
    'unmount-field',
    'unmount-form',
  ] as const) {
    await check(
      `ts-pending-${operation}`,
      `校验期间 ${operation}`,
      '旧结果不恢复错误或污染后续会话',
      async () => {
        const gate = deferred();
        const f = await mount({ validate: gate.validate });
        await f.input('field', 'old');
        await until(() => gate.calls.length === 1, 'old started');
        if (operation === 'clear') f.field('field').clear();
        if (operation === 'reset') f.reset();
        if (operation === 'replace-session') f.reset({ field: 'new-session' });
        if (operation === 'unmount-field') await f.hide();
        if (operation === 'unmount-form') f.dispose();
        gate.calls[0]!.finish('old invalid');
        await flush();
        const errors = f.field('field').errors();
        return {
          pass: errors.length === 0,
          observed: { errors, values: f.values(), signalAborted: gate.calls[0]!.signal.aborted },
        };
      },
    );
  }
  await check(
    'ts-independent-fields',
    '两个无关字段并发校验',
    '两个成功校验各自完成，不因另一字段启动而过期',
    async () => {
      const gate = deferred();
      const f = await mount({ values: { first: 'A', second: 'B' }, validate: gate.validate });
      const first = f.field('first').validate();
      const second = f.field('second').validate();
      await until(() => gate.calls.length === 2, 'two fields started');
      gate.calls.find((call) => call.name === 'second')!.finish();
      const secondResult = await second;
      gate.calls.find((call) => call.name === 'first')!.finish();
      const firstResult = await first;
      return {
        pass:
          Array.isArray(firstResult) &&
          firstResult.length === 0 &&
          Array.isArray(secondResult) &&
          secondResult.length === 0,
        observed: {
          firstResult,
          secondResult,
          aborted: gate.calls.map((call) => call.signal.aborted),
        },
      };
    },
  );
  await check(
    'ts-debounce',
    'onChangeAsyncDebounceMs=80',
    '20 次连续输入，最终 validator 执行 1 次',
    async () => {
      const values: string[] = [];
      const f = await mount({
        debounce: 80,
        validate: async (_name, value) => {
          values.push(value);
          return undefined;
        },
      });
      for (let index = 0; index < 20; index++) {
        await f.input('field', `value-${index}`);
        await delay(5);
      }
      await delay(180);
      return {
        pass: values.length === 1 && values[0] === 'value-19',
        observed: { count: values.length, values, validating: f.field('field').validating() },
      };
    },
  );
  await check(
    'ts-dependencies',
    '声明依赖：Input 与 setFieldValue',
    'confirm 跟随 password 校验，无关字段不执行规则',
    async () => {
      const f = await mount({
        dependency: true,
        values: { password: 'same', confirm: 'same', unrelated: 'ok' },
      });
      await f.field('confirm').validate();
      Object.keys(f.calls).forEach((key) => {
        f.calls[key] = 0;
      });
      await f.input('password', 'different');
      await flush();
      const afterInput = f.field('confirm').errors();
      f.set('password', 'same');
      await flush();
      const afterApi = f.field('confirm').errors();
      return {
        pass:
          afterInput[0] === 'password mismatch' &&
          afterApi.length === 0 &&
          (f.calls.unrelated ?? 0) === 0,
        observed: { afterInput, afterApi, calls: f.calls },
      };
    },
  );
  await check(
    'ts-submit-snapshot',
    '校验期间修改值',
    '提交已验证快照或拒绝本次提交，不能提交未验证 B',
    async () => {
      const gate = deferred();
      const f = await mount({ submitOnly: true, validate: gate.validate });
      const pending = f.submit();
      await until(() => gate.calls.length === 1, 'submit validation');
      await f.input('field', 'unvalidated-B');
      gate.calls[0]!.finish();
      await pending;
      return {
        pass: f.submits.length === 0 || f.submits[0]?.field === gate.calls[0]!.value,
        observed: { validated: gate.calls[0]!.value, submits: f.submits },
      };
    },
  );
  await check('ts-submit-duplicate', '业务请求期间重复提交', '业务回调最多进入一次', async () => {
    let finish: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const f = await mount({ onSubmit: async () => pending });
    const first = f.submit();
    await until(() => f.submits.length === 1, 'first business submit');
    const second = f.submit();
    await flush();
    const count = f.submits.length;
    finish!();
    await Promise.all([first, second]);
    return { pass: count === 1, observed: { businessCalls: count, submitting: f.submitting() } };
  });
  await check(
    'ts-submit-error',
    '业务提交异常',
    '错误向调用方传播且 isSubmitting 恢复',
    async () => {
      const f = await mount({
        onSubmit: async () => {
          throw new Error('business failure');
        },
      });
      let caught = '';
      try {
        await f.submit();
      } catch (error) {
        caught = error instanceof Error ? error.message : String(error);
      }
      return {
        pass: caught === 'business failure' && !f.submitting(),
        observed: { caught, submitting: f.submitting() },
      };
    },
  );
  await check(
    'ts-display',
    'antdv-next 错误展示与单一引擎',
    '错误显示到 FormItem，原生 validator 执行 0 次',
    async () => {
      const f = await mount({ validate: async () => 'display-error' });
      await f.input('field', 'invalid');
      await until(() => f.field('field').errors().length === 1, 'error rendered');
      await flush();
      return {
        pass:
          f.element.textContent?.includes('display-error') === true && f.nativeValidations() === 0,
        observed: { text: f.element.textContent, nativeValidations: f.nativeValidations() },
      };
    },
  );
  for (const operation of ['clear', 'reset', 'replace-session'] as const) {
    await check(
      `guarded-${operation}`,
      `保护原型：${operation} 后旧请求回写`,
      '旧校验立即结束等待；新错误不能被旧成功/失败覆盖',
      async () => {
        const gate = deferred();
        const f = await mount({ guarded: true, validate: gate.validate });
        await f.input('field', 'old');
        await until(() => gate.calls.length === 1, 'old request');
        if (operation === 'clear') f.field('field').clear();
        else f.reset(operation === 'reset' ? undefined : { field: 'new-session' });
        await flush();
        const pendingAfterReset = f.field('field').validating();
        await f.input('field', 'new-invalid');
        await until(() => gate.calls.length === 2, 'new request');
        gate.calls[1]!.finish('new invalid');
        await flush();
        gate.calls[0]!.finish(operation === 'reset' ? undefined : 'old invalid');
        await flush();
        const errors = f.field('field').errors();
        return {
          pass: !pendingAfterReset && gate.calls[0]!.signal.aborted && errors[0] === 'new invalid',
          observed: {
            pendingAfterReset,
            oldAborted: gate.calls[0]!.signal.aborted,
            errors,
            values: f.values(),
          },
        };
      },
    );
  }
  for (const mutation of ['input', 'reset', 'none'] as const) {
    await check(
      `guarded-submit-${mutation}`,
      `保护原型：提交期间 ${mutation}`,
      '改值/重置拒绝过期提交；不改值则正常提交',
      async () => {
        const gate = deferred();
        const f = await mount({ guarded: true, submitOnly: true, validate: gate.validate });
        let failure = '';
        const pending = f.submit().catch((error: unknown) => {
          failure = error instanceof Error ? error.message : String(error);
        });
        await until(() => gate.calls.length === 1, 'submit validator');
        if (mutation === 'input') await f.input('field', 'new-value');
        if (mutation === 'reset') f.reset({ field: 'new-session' });
        gate.calls[0]!.finish();
        await pending;
        return {
          pass:
            mutation === 'none'
              ? f.submits.length === 1 && f.submits[0]?.field === 'initial'
              : f.submits.length === 0 && failure === 'stale submission',
          observed: { failure, submits: f.submits, submitting: f.submitting() },
        };
      },
    );
  }
  await check(
    'guarded-submit-duplicate',
    '保护原型：合并重复提交',
    '同一在途 Promise，业务请求仅一次；结束后允许重试',
    async () => {
      let finish: (() => void) | undefined;
      const request = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const f = await mount({ guarded: true, onSubmit: async () => request });
      const first = f.submit();
      await until(() => f.submits.length === 1, 'business submit');
      const second = f.submit();
      const samePromise = first === second;
      finish!();
      await Promise.all([first, second]);
      const beforeRetry = f.submits.length;
      await f.submit();
      return {
        pass: samePromise && beforeRetry === 1 && f.submits.length === 2,
        observed: {
          samePromise,
          beforeRetry,
          afterRetry: f.submits.length,
          submitting: f.submitting(),
        },
      };
    },
  );
  await check(
    'guarded-debounce-reset',
    '保护原型：防抖等待期间 reset',
    '重置后不执行旧的业务 validator',
    async () => {
      let calls = 0;
      const f = await mount({
        guarded: true,
        debounce: 80,
        validate: async () => {
          calls++;
          return 'old invalid';
        },
      });
      await f.input('field', 'old');
      f.reset();
      await delay(160);
      return {
        pass:
          calls === 0 && f.field('field').errors().length === 0 && !f.field('field').validating(),
        observed: {
          calls,
          errors: f.field('field').errors(),
          validating: f.field('field').validating(),
        },
      };
    },
  );
  await check(
    'guarded-complex-values',
    '复杂值提交和重置快照',
    '嵌套数组、Date、Dayjs、File 元数据和空值保真；外部修改不串入模型',
    inspectComplexValues,
  );
  for (const operation of ['input', 'api'] as const) {
    await check(
      `guarded-dependency-reset-${operation}`,
      `reset 后异步依赖：${operation}`,
      '恢复依赖字段校验，无关规则为 0，旧结果不覆盖新错误',
      async () => {
        const gate = deferred();
        const f = await mount({
          guarded: true,
          dependency: true,
          values: { password: 'same', confirm: 'same', unrelated: 'ok' },
          validate: gate.validate,
        });
        const old = f.field('confirm').validate();
        await until(() => gate.calls.length === 1, 'old dependency validation');
        f.reset();
        await old;
        if (operation === 'input') await f.input('password', 'different');
        else f.set('password', 'different');
        await until(() => gate.calls.length >= 3, 'source and dependent validation');
        gate.calls
          .filter((_call, index) => index >= 1)
          .forEach((call) => {
            call.finish(call.name === 'confirm' ? 'new mismatch' : undefined);
          });
        await flush();
        gate.calls[0]!.finish('old mismatch');
        await flush();
        const errors = f.field('confirm').errors();
        return {
          pass: errors[0] === 'new mismatch' && (f.calls.unrelated ?? 0) === 0,
          observed: { errors, calls: f.calls, oldAborted: gate.calls[0]!.signal.aborted },
        };
      },
    );
  }
  await check(
    'guarded-rule-replacement',
    '在途校验期间替换规则',
    '旧规则取消，新规则生效，Input 节点和焦点保持',
    async () => {
      const gate = deferred();
      const f = await mount({ guarded: true, validate: gate.validate });
      const input = f.element.querySelector('input')!;
      input.focus();
      await f.input('field', 'value');
      await until(() => gate.calls.length === 1, 'old rule started');
      f.field('field').replaceRule(async () => 'new rule error');
      await f.field('field').validate();
      gate.calls[0]!.finish('old rule error');
      await flush();
      const errors = f.field('field').errors();
      const sameInput = input === f.element.querySelector('input');
      const focused = document.activeElement === input;
      return {
        pass:
          errors[0] === 'new rule error' && sameInput && focused && gate.calls[0]!.signal.aborted,
        observed: { errors, sameInput, focused, oldAborted: gate.calls[0]!.signal.aborted },
      };
    },
  );
  await check(
    'guarded-remount',
    '字段卸载后重新显示',
    '旧请求取消，重新挂载后可产生新错误',
    async () => {
      const gate = deferred();
      const f = await mount({ guarded: true, validate: gate.validate });
      await f.input('field', 'old');
      await until(() => gate.calls.length === 1, 'old mounted validation');
      await f.hide();
      await f.show();
      await f.input('field', 'new');
      await until(() => gate.calls.length === 2, 'remounted validation');
      gate.calls[1]!.finish('new error');
      await flush();
      gate.calls[0]!.finish('old error');
      await flush();
      const errors = f.field('field').errors();
      return {
        pass: errors[0] === 'new error' && gate.calls[0]!.signal.aborted,
        observed: { errors, values: f.values(), oldAborted: gate.calls[0]!.signal.aborted },
      };
    },
  );
  for (const fails of [false, true]) {
    await check(
      `guarded-business-session-${fails ? 'failure' : 'success'}`,
      `业务请求期间换记录，旧请求${fails ? '失败' : '成功'}`,
      '旧 Promise 返回 stale submission，不把旧成功或业务错误当新会话结果',
      async () => {
        let finish: (() => void) | undefined;
        const request = new Promise<void>((resolve, reject) => {
          finish = () => {
            if (fails) reject(new Error('old business failure'));
            else resolve();
          };
        });
        const f = await mount({ guarded: true, onSubmit: async () => request });
        let failure = '';
        const pending = f.submit().catch((error: unknown) => {
          failure = error instanceof Error ? error.message : String(error);
        });
        await until(() => f.submits.length === 1, 'old business request');
        f.reset({ field: 'new-session' });
        finish!();
        await pending;
        return {
          pass:
            failure === 'stale submission' &&
            f.values().field === 'new-session' &&
            !f.submitting() &&
            f.field('field').errors().length === 0,
          observed: {
            failure,
            values: f.values(),
            submitting: f.submitting(),
            scope:
              'Old business side effects cannot be undone; retry waits for old request settlement',
          },
        };
      },
    );
  }
  for (const [count, minimalSelector] of [
    [100, false],
    [300, false],
    [100, true],
    [300, true],
  ] as const) {
    await check(
      `ts-${minimalSelector ? 'minimal-' : ''}subscription-${count}`,
      `${count} 字段${minimalSelector ? '单 selector' : 'useField'}订阅诊断`,
      '30 次单字段输入，无关字段重渲染为 0',
      async () => {
        const values = Object.fromEntries(
          Array.from({ length: count }, (_, index) => [`field${index}`, '']),
        );
        const f = await mount({ values, minimalSelector });
        await f.input('field0', 'warmup');
        Object.keys(f.renders).forEach((key) => {
          f.renders[key] = 0;
        });
        const samples: number[] = [];
        for (let index = 0; index < 30; index++) {
          const start = performance.now();
          await f.input('field0', `sample${index}`);
          samples.push(performance.now() - start);
        }
        samples.sort((a, b) => a - b);
        const unrelatedRenders = Object.entries(f.renders)
          .filter(([name]) => name !== 'field0')
          .reduce((sum, [, renders]) => sum + renders, 0);
        return {
          pass: unrelatedRenders === 0 && f.renders.field0 === 30,
          observed: {
            fields: count,
            inputs: 30,
            changedFieldRenders: f.renders.field0,
            unrelatedRenders,
            dispatchToNextTickMs: { p50: samples[14], p95: samples[28] },
            domNodes: f.element.querySelectorAll('*').length,
            scope: '单轮诊断，不含绘制；不等于整个引擎计算 O(1)，不用于宣称比 Vben 更快',
          },
        };
      },
    );
  }
  return {
    generatedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    versions: FORM_LAB_VERSIONS,
    mode: import.meta.env.MODE,
    results,
  };
}
