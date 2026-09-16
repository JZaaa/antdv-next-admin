/* eslint-disable no-await-in-loop -- Experiments share a mounted fixture; validation order and input spacing are deliberately sequential. */
import type { FormInstance, FormItemProps, Rule } from 'antdv-next';

import { Form, FormItem, Input } from 'antdv-next';
import { createApp, defineComponent, h, nextTick, reactive, ref, watch } from 'vue';

declare const FORM_LAB_VERSIONS: Record<string, string>;

type Name = NonNullable<FormItemProps['name']>;
type Values = Record<string, unknown>;
type Outcome = { ok: true; values: Values } | { ok: false; error: unknown };

export interface ExperimentResult {
  id: string;
  title: string;
  status: 'pass' | 'gap' | 'error';
  expected: string;
  observed: unknown;
}

export interface ExperimentReport {
  generatedAt: string;
  userAgent: string;
  versions: Record<string, string>;
  mode: string;
  results: ExperimentResult[];
}

interface Field {
  name: Name;
  rules?: Rule[];
  debounce?: number;
}

interface FixtureOptions {
  values?: Values;
  fields?: Field[];
  trigger?: 'change' | false;
  preserve?: boolean;
  clearOnDestroy?: boolean;
  dependency?: boolean;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function until(check: () => boolean, description: string): Promise<void> {
  const start = performance.now();
  while (!check()) {
    if (performance.now() - start > 4000) throw new Error(`等待超时：${description}`);
    await delay(5);
  }
}

function snapshot(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

function outcome(promise: Promise<Values>): Promise<Outcome> {
  return promise.then(
    (values) => ({ ok: true, values }),
    (error: unknown) => ({ ok: false, error }),
  );
}

function gate(): {
  rule: Rule;
  calls: { value: unknown; settle: (error?: string) => void }[];
} {
  const calls: { value: unknown; settle: (error?: string) => void }[] = [];
  return {
    calls,
    rule: {
      validator: (_rule, value: unknown): Promise<void> =>
        new Promise((resolve, reject) => {
          calls.push({
            value: snapshot(value),
            settle: (error) => (error ? reject(new Error(error)) : resolve()),
          });
        }),
    },
  };
}

async function fixture(host: HTMLElement, options: FixtureOptions = {}) {
  const element = document.createElement('section');
  host.append(element);
  const model = reactive<Values>(options.values ?? { field: 'initial' });
  const visible = ref(true);
  const hidden = ref(false);
  const form = ref<FormInstance>();
  const fields = options.fields ?? [{ name: 'field' }];
  const notifications = { events: 0, metadataEntries: 0, valuesEvents: 0, validations: 0 };
  const dependencyJobs: Promise<Outcome>[] = [];
  const get = (name: Name): unknown => {
    const path = Array.isArray(name) ? name : String(name).split('.');
    return path.reduce<unknown>((value, key) => {
      if (value && typeof value === 'object') return Reflect.get(value, key);
      return undefined;
    }, model);
  };
  const app = createApp(
    defineComponent({
      setup() {
        if (options.dependency)
          watch(
            () => model.password,
            () => {
              if (form.value) dependencyJobs.push(outcome(form.value.validateFields(['confirm'])));
            },
          );
        return () =>
          h(
            Form,
            {
              ref: form,
              model,
              layout: 'vertical',
              validateTrigger: options.trigger ?? false,
              preserve: options.preserve,
              clearOnDestroy: options.clearOnDestroy,
              onFieldsChange: (_changed, all) => {
                notifications.events++;
                notifications.metadataEntries += all.length;
              },
              onValuesChange: () => {
                notifications.valuesEvents++;
              },
              onValidate: () => {
                notifications.validations++;
              },
            },
            {
              default: () =>
                visible.value
                  ? fields.map((field) =>
                      h(
                        FormItem,
                        {
                          key: JSON.stringify(field.name),
                          name: field.name,
                          label: JSON.stringify(field.name),
                          rules: field.rules,
                          validateDebounce: field.debounce,
                          hidden: hidden.value,
                        },
                        {
                          default: () =>
                            h(Input, {
                              value: String(get(field.name) ?? ''),
                              'data-field': JSON.stringify(field.name),
                              'onUpdate:value': (value: string) => {
                                // Input scenarios use flat names; path semantics are exercised through Form's API.
                                if (typeof field.name === 'string') model[field.name] = value;
                              },
                            }),
                        },
                      ),
                    )
                  : [],
            },
          );
      },
    }),
  );
  app.mount(element);
  await nextTick();
  const api = form.value;
  if (!api) throw new Error('原生 Form 实例未挂载');
  let mounted = true;
  return {
    api,
    model,
    visible,
    hidden,
    notifications,
    dependencyJobs,
    element,
    input(name: string, value: string): void {
      const input = Array.from(element.querySelectorAll('input')).find(
        (node) => node.dataset.field === JSON.stringify(name),
      );
      if (!input) throw new Error(`未找到输入控件：${name}`);
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    dispose(): void {
      if (mounted) app.unmount();
      mounted = false;
      element.remove();
    },
  };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

export async function runExperiments(
  host: HTMLElement,
  onResult: (result: ExperimentResult) => void,
): Promise<ExperimentReport> {
  const results: ExperimentResult[] = [];
  let current: Fixture | undefined;
  const mount = async (options: FixtureOptions = {}): Promise<Fixture> => {
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
      const data = await run();
      result = {
        id,
        title,
        expected,
        status: data.pass ? 'pass' : 'gap',
        observed: snapshot(data.observed),
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
      oldFails ? 'race-old-error' : 'race-old-success',
      oldFails ? '旧失败晚于新成功' : '旧成功晚于新失败',
      '最终字段错误只属于最新值 B，旧结果不能覆盖',
      async () => {
        const deferred = gate();
        const f = await mount({ fields: [{ name: 'field', rules: [deferred.rule] }] });
        f.model.field = 'A';
        await nextTick();
        const a = outcome(f.api.validateFields());
        await until(() => deferred.calls.length === 1, 'A validator');
        f.model.field = 'B';
        await nextTick();
        const b = outcome(f.api.validateFields());
        await until(() => deferred.calls.length === 2, 'B validator');
        deferred.calls[1]!.settle(oldFails ? undefined : 'B invalid');
        const latest = await b;
        const afterB = [...f.api.getFieldError('field')];
        deferred.calls[0]!.settle(oldFails ? 'A invalid' : undefined);
        const stale = await a;
        const finalErrors = f.api.getFieldError('field');
        return {
          pass: JSON.stringify(finalErrors) === JSON.stringify(oldFails ? [] : ['B invalid']),
          observed: {
            calls: deferred.calls.map((call) => call.value),
            afterB,
            finalErrors,
            latest,
            stale,
          },
        };
      },
    );
  }

  for (const oldFails of [true, false]) {
    await check(
      oldFails ? 'input-race-old-error' : 'input-race-old-success',
      oldFails ? '自动 change 校验：旧失败覆盖新成功' : '自动 change 校验：旧成功覆盖新失败',
      '通过真实 Input 事件触发，最终错误只反映 B',
      async () => {
        const deferred = gate();
        const f = await mount({
          trigger: 'change',
          fields: [{ name: 'field', rules: [deferred.rule] }],
        });
        f.input('field', 'A');
        await until(() => deferred.calls.length === 1, 'input A validator');
        f.input('field', 'B');
        await until(() => deferred.calls.length === 2, 'input B validator');
        deferred.calls[1]!.settle(oldFails ? undefined : 'B invalid');
        await until(() => f.notifications.validations === 1, 'B validation completed');
        const afterB = [...f.api.getFieldError('field')];
        deferred.calls[0]!.settle(oldFails ? 'A invalid' : undefined);
        await until(() => f.notifications.validations === 2, 'A validation completed');
        const finalErrors = f.api.getFieldError('field');
        return {
          pass: JSON.stringify(finalErrors) === JSON.stringify(oldFails ? [] : ['B invalid']),
          observed: { calls: deferred.calls.map((call) => call.value), afterB, finalErrors },
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
      `pending-${operation}`,
      `校验期间 ${operation}`,
      '旧校验完成后不恢复错误、不向已关闭会话发出校验通知',
      async () => {
        const deferred = gate();
        const f = await mount({ fields: [{ name: 'field', rules: [deferred.rule] }] });
        f.model.field = 'old-session';
        await nextTick();
        const pending = outcome(f.api.validateFields());
        await until(() => deferred.calls.length === 1, 'pending validator');
        if (operation === 'clear') f.api.clearValidate();
        if (operation === 'reset') f.api.resetFields();
        if (operation === 'replace-session') {
          f.api.resetFields();
          f.api.setFieldsValue({ field: 'new-session' });
        }
        if (operation === 'unmount-field') f.visible.value = false;
        if (operation === 'unmount-form') f.dispose();
        await nextTick();
        const before = f.notifications.validations;
        deferred.calls[0]!.settle('old-session invalid');
        const settled = await pending;
        const finalErrors = f.api.getFieldError('field');
        const lateEvents = f.notifications.validations - before;
        return {
          pass: finalErrors.length === 0 && lateEvents === 0,
          observed: { model: f.model, finalErrors, lateEvents, settled },
        };
      },
    );
  }

  await check(
    'debounce',
    'validateDebounce=80 连续输入 20 次',
    '输入间隔 5ms，停止后校验次数为 1',
    async () => {
      const calls: unknown[] = [];
      const f = await mount({
        trigger: 'change',
        fields: [
          {
            name: 'field',
            debounce: 80,
            rules: [
              {
                validator: async (_rule, value: unknown): Promise<void> => {
                  calls.push(value);
                },
              },
            ],
          },
        ],
      });
      for (let index = 0; index < 20; index++) {
        f.input('field', `value-${index}`);
        await nextTick();
        await delay(5);
      }
      await delay(160);
      return {
        pass: calls.length === 1 && calls[0] === 'value-19',
        observed: { calls, count: calls.length },
      };
    },
  );

  for (const dependency of [false, true]) {
    await check(
      dependency ? 'dependency-explicit' : 'dependency-native',
      dependency ? '显式依赖订阅：控件输入与 API 回填' : '原生跨字段规则自动联动',
      '密码变化重校验确认密码；无关字段不执行 validator',
      async () => {
        let confirmCalls = 0;
        let unrelatedCalls = 0;
        const values = reactive({ password: 'same', confirm: 'same', unrelated: 'ok' });
        const f = await mount({
          values,
          trigger: 'change',
          dependency,
          fields: [
            { name: 'password' },
            {
              name: 'confirm',
              rules: [
                {
                  validator: async (): Promise<void> => {
                    confirmCalls++;
                    if (values.password !== values.confirm) throw new Error('password mismatch');
                  },
                },
              ],
            },
            {
              name: 'unrelated',
              rules: [
                {
                  validator: async (): Promise<void> => {
                    unrelatedCalls++;
                  },
                },
              ],
            },
          ],
        });
        await f.api.validateFields(['confirm']);
        const before = confirmCalls;
        f.input('password', 'different');
        await nextTick();
        await Promise.all(f.dependencyJobs);
        const inputErrors = [...f.api.getFieldError('confirm')];
        f.api.setFieldsValue({ password: 'same' });
        await nextTick();
        await Promise.all(f.dependencyJobs);
        const apiErrors = [...f.api.getFieldError('confirm')];
        return {
          pass:
            confirmCalls - before === 2 &&
            inputErrors.length === 1 &&
            apiErrors.length === 0 &&
            unrelatedCalls === 0,
          observed: {
            inputErrors,
            apiErrors,
            dependentCalls: confirmCalls - before,
            unrelatedCalls,
          },
        };
      },
    );
  }

  await check(
    'hidden-required',
    'hidden 仅隐藏布局',
    '原生 hidden 字段仍注册、仍参与校验；新 schema 不能直接等同于 hidden',
    async () => {
      const f = await mount({
        values: { field: '' },
        fields: [{ name: 'field', rules: [{ required: true, message: 'required' }] }],
      });
      await outcome(f.api.validateFields());
      f.hidden.value = true;
      await nextTick();
      const validation = await outcome(f.api.validateFields());
      return {
        pass: !validation.ok && f.api.getFieldError('field').length === 1,
        observed: {
          validation,
          model: f.model,
          registeredValues: f.api.getFieldsValue(),
        },
      };
    },
  );

  for (const preserve of [true, false]) {
    await check(
      `preserve-${preserve}`,
      `字段卸载 preserve=${preserve}`,
      preserve ? '外部模型保留值，注册表不包含卸载字段，重新挂载恢复' : '卸载字段从外部模型中删除',
      async () => {
        const f = await mount({ preserve });
        f.visible.value = false;
        await nextTick();
        const afterUnmount = snapshot(f.model);
        const registeredValues = f.api.getFieldsValue(true);
        const deleted = !Object.prototype.hasOwnProperty.call(f.model, 'field');
        f.visible.value = true;
        await nextTick();
        return {
          pass: preserve
            ? !deleted &&
              Object.keys(registeredValues).length === 0 &&
              f.api.getFieldValue('field') === 'initial'
            : deleted,
          observed: { afterUnmount, registeredValues, afterRemount: f.api.getFieldsValue() },
        };
      },
    );
  }

  await check(
    'clear-on-destroy',
    'clearOnDestroy=true 卸载表单',
    '销毁后清除外部模型值',
    async () => {
      const f = await mount({ clearOnDestroy: true });
      f.dispose();
      return { pass: Object.keys(f.model).length === 0, observed: { afterDestroy: f.model } };
    },
  );

  await check(
    'initial-empty-values',
    'null / false / 0 / 空字符串初值和 reset',
    '原生模型和 reset 保留显式空值，不被默认值替换',
    async () => {
      const initial = { nullable: null, enabled: false, amount: 0, text: '' };
      const f = await mount({
        values: { ...initial },
        fields: Object.keys(initial).map((name) => ({ name })),
      });
      const before = f.api.getFieldsValue();
      f.api.setFieldsValue({ nullable: 'changed', enabled: true, amount: 1, text: 'changed' });
      await nextTick();
      f.api.resetFields();
      await nextTick();
      const after = await f.api.validateFields();
      return {
        pass:
          JSON.stringify(before) === JSON.stringify(initial) &&
          JSON.stringify(after) === JSON.stringify(initial),
        observed: { before, after, scope: '模型语义；Checkbox/Number 专用控件绑定未验证' },
      };
    },
  );

  await check(
    'name-paths',
    '点分字符串与字面点号键',
    'a.b 与 [a,b] 访问嵌套值；[a.b] 访问字面键，API 写入不串值',
    async () => {
      const f = await mount({
        values: { a: { b: 'nested' }, 'a.b': 'literal' },
        fields: [{ name: ['a', 'b'] }, { name: ['a.b'] }],
      });
      const before = [
        f.api.getFieldValue('a.b'),
        f.api.getFieldValue(['a', 'b']),
        f.api.getFieldValue(['a.b']),
      ];
      f.api.setFieldValue(['a.b'], 'literal-updated');
      await nextTick();
      const after = f.api.getFieldsValue();
      return {
        pass:
          JSON.stringify(before) === JSON.stringify(['nested', 'nested', 'literal']) &&
          f.api.getFieldValue(['a', 'b']) === 'nested' &&
          f.api.getFieldValue(['a.b']) === 'literal-updated',
        observed: { before, after },
      };
    },
  );

  await check(
    'submit-snapshot',
    '校验期间修改值（显式提交校验）',
    '返回已验证的快照或拒绝过期提交，不返回未验证的新值',
    async () => {
      const deferred = gate();
      const f = await mount({ fields: [{ name: 'field', rules: [deferred.rule] }] });
      f.model.field = 'validated-A';
      await nextTick();
      const pending = outcome(f.api.validateFields());
      await until(() => deferred.calls.length === 1, 'submit validator');
      f.model.field = 'unvalidated-B';
      await nextTick();
      deferred.calls[0]!.settle();
      const result = await pending;
      return {
        pass: !result.ok || result.values.field === 'validated-A',
        observed: { validatorValues: deferred.calls.map((call) => call.value), result },
      };
    },
  );

  await check(
    'validate-only',
    '公开 API validateOnly + setFields 可控错误写入',
    'validateOnly 不写 UI 错误，调用方能通过 setFields 显示错误',
    async () => {
      const f = await mount({
        values: { field: '' },
        fields: [{ name: 'field', rules: [{ required: true, message: 'required' }] }],
      });
      const result = await outcome(f.api.validateFields({ validateOnly: true }));
      const beforeSet = [...f.api.getFieldError('field')];
      f.api.setFields([{ name: 'field', errors: ['controlled-error'], validating: false }]);
      const afterSet = f.api.getFieldError('field');
      return {
        pass: !result.ok && beforeSet.length === 0 && afterSet[0] === 'controlled-error',
        observed: { result, beforeSet, afterSet },
      };
    },
  );

  await check(
    'validate-only-independent-fields',
    'validateOnly 并发校验两个无关字段',
    '两个未改值字段的并发成功校验应各自得到成功结果',
    async () => {
      const first = gate();
      const second = gate();
      const f = await mount({
        values: { first: 'A', second: 'B' },
        fields: [
          { name: 'first', rules: [first.rule] },
          { name: 'second', rules: [second.rule] },
        ],
      });
      const a = outcome(f.api.validateFields(['first'], { validateOnly: true }));
      await until(() => first.calls.length === 1, 'first field');
      const b = outcome(f.api.validateFields(['second'], { validateOnly: true }));
      await until(() => second.calls.length === 1, 'second field');
      second.calls[0]!.settle();
      const secondResult = await b;
      first.calls[0]!.settle();
      const firstResult = await a;
      return { pass: firstResult.ok && secondResult.ok, observed: { firstResult, secondResult } };
    },
  );

  await check(
    'validate-only-warning',
    'validateOnly 的 warningOnly 可观测性',
    '调用方能读取 warningOnly 结果，以支持受控错误/警告写入方案',
    async () => {
      const f = await mount({
        values: { field: '' },
        fields: [
          { name: 'field', rules: [{ required: true, warningOnly: true, message: 'warning' }] },
        ],
      });
      const result = await outcome(f.api.validateFields({ validateOnly: true }));
      const warnings = f.api.getFieldWarning('field');
      return {
        pass: warnings.includes('warning'),
        observed: {
          result,
          warnings,
          limitation: '成功返回仅有 values，没有公开的 warning 结果通道',
        },
      };
    },
  );

  for (const count of [100, 300]) {
    await check(
      `metadata-${count}`,
      `${count} 字段原生通知工作量`,
      '记录单字段输入时全字段元数据枚举量；此项仅核对观测完整性',
      async () => {
        const values = Object.fromEntries(
          Array.from({ length: count }, (_, index) => [`field${index}`, '']),
        );
        const f = await mount({ values, fields: Object.keys(values).map((name) => ({ name })) });
        f.input('field0', 'warmup');
        await nextTick();
        Object.assign(f.notifications, {
          events: 0,
          metadataEntries: 0,
          valuesEvents: 0,
          validations: 0,
        });
        const samples: number[] = [];
        for (let index = 0; index < 30; index++) {
          const start = performance.now();
          f.input('field0', `sample${index}`);
          await nextTick();
          samples.push(performance.now() - start);
        }
        samples.sort((a, b) => a - b);
        return {
          pass: f.notifications.valuesEvents === 30 && samples.length === 30,
          observed: {
            fields: count,
            inputs: 30,
            ...f.notifications,
            domNodes: f.element.querySelectorAll('*').length,
            dispatchToNextTickMs: { p50: samples[14], p95: samples[28] },
            scope: '单轮无头生产构建诊断；包含通知计数，非绘制时间/用户输入延迟/最终性能基准',
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
