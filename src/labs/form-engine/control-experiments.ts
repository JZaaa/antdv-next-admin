import type { BuiltinControl, FormFieldSchema, SchemaFormProps, FormApi } from '../../libs/form';
import type { ExperimentReport, ExperimentResult } from './experiments';
import type { Component, Slots } from 'vue';

import { ConfigProvider, Input, theme } from 'antdv-next';
import dayjs from 'dayjs';
/* eslint-disable no-await-in-loop -- Browser interactions run sequentially for deterministic evidence. */
import { createApp, defineComponent, h, nextTick } from 'vue';

import { useSchemaForm, enUS } from '../../libs/form';
import { delay } from './experiments';

declare const FORM_LAB_VERSIONS: Record<string, string>;
const field = (
  fieldName: string,
  extra: Partial<Extract<FormFieldSchema, { type?: undefined }>> = {},
): Extract<FormFieldSchema, { type?: undefined }> => ({
  fieldName,
  component: 'Input',
  label: fieldName,
  ...extra,
});
async function until(check: () => boolean): Promise<void> {
  const start = performance.now();
  while (!check()) {
    if (performance.now() - start > 3000) throw new Error('Browser condition timed out');
    await delay(5);
  }
}
export async function runControlExperiments(
  host: HTMLElement,
  onResult: (result: ExperimentResult) => void,
): Promise<ExperimentReport> {
  const results: ExperimentResult[] = [];
  let dispose: (() => void) | undefined;
  async function mount(options: SchemaFormProps, slots: Slots = {}, dark = false) {
    dispose?.();
    const element = document.createElement('section');
    host.append(element);
    let api!: FormApi;
    const app = createApp(
      defineComponent({
        setup() {
          const [Form, formApi] = useSchemaForm(options);
          api = formApi;
          return () =>
            h(
              ConfigProvider,
              { theme: { algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm } },
              { default: () => h(Form, {}, slots) },
            );
        },
      }),
    );
    app.mount(element);
    await nextTick();
    await api.runtime.settle();
    await until(
      () =>
        element.querySelectorAll('[data-vben-field]').length > 0 &&
        [...element.querySelectorAll('[data-vben-field]')].every((control) =>
          control.querySelector(
            'input,textarea,button,[role=slider],.ant-radio-group,.ant-checkbox-group,.ant-rate',
          ),
        ),
    );
    dispose = () => {
      app.unmount();
      element.remove();
    };
    function node(name: string): HTMLElement {
      const result = element.querySelector<HTMLElement>(`[data-vben-field="${name}"]`);
      if (!result) throw new Error(`Missing field DOM: ${name}`);
      return result;
    }
    async function input(name: string, value: string): Promise<void> {
      const control = node(name).querySelector('input,textarea');
      if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement))
        throw new Error('Expected an input');
      control.value = value;
      control.dispatchEvent(new Event('input', { bubbles: true }));
      await nextTick();
    }
    return { api, element, node, input };
  }
  async function check(id: string, title: string, run: () => Promise<unknown>): Promise<void> {
    let result: ExperimentResult;
    try {
      const observed = await run();
      result = {
        id: `schema-${id}`,
        title,
        expected: '正式组件断言全部通过',
        status: 'pass',
        observed,
      };
    } catch (error) {
      result = {
        id: `schema-${id}`,
        title,
        expected: '正式组件断言全部通过',
        status: 'error',
        observed: error instanceof Error ? error.message : String(error),
      };
    } finally {
      dispose?.();
      dispose = undefined;
    }
    results.push(result);
    onResult(result);
  }
  function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
  }
  for (const layout of ['horizontal', 'vertical'] as const) {
    await check(
      `selection-width-${layout}`,
      '选择器加载、聚焦、赋值、清空与失焦时宽度稳定',
      async () => {
        const f = await mount({
          wrapperClass: 'grid-cols-3',
          layout,
          schema: [
            field('select', {
              component: 'Select',
              componentProps: {
                allowClear: true,
                options: [
                  { label: '一段很长的选项内容用于验证控件不会随内容改变宽度', value: 'long' },
                ],
              },
            }),
            field('tree', {
              component: 'TreeSelect',
              componentProps: {
                allowClear: true,
                treeData: [{ title: '一段很长的树节点内容用于验证宽度', value: 'long' }],
              },
            }),
            field('cascader', {
              component: 'Cascader',
              componentProps: {
                allowClear: true,
                options: [
                  {
                    label: '很长的父级节点',
                    value: 'parent',
                    children: [{ label: '很长的子级节点', value: 'long' }],
                  },
                ],
              },
            }),
          ],
        });
        f.element.style.width = '900px';
        const samples: Record<string, number[]> = { select: [], tree: [], cascader: [] };
        async function sample(): Promise<void> {
          for (let frame = 0; frame < 30; frame++) {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            for (const name of Object.keys(samples))
              samples[name]!.push(
                f.node(name).querySelector('.ant-select')!.getBoundingClientRect().width,
              );
          }
        }
        await sample();
        for (const name of Object.keys(samples)) {
          const input = f.node(name).querySelector('input')!;
          input.focus();
          await f.api.setFieldValue(name, name === 'cascader' ? ['parent', 'long'] : 'long');
          await sample();
          const clear = f.node(name).querySelector<HTMLElement>('.ant-select-clear');
          assert(clear, `Missing clear button: ${name}`);
          clear.click();
          await sample();
          assert(
            !f.node(name).querySelector('.ant-select-content-value')?.textContent,
            `Clear failed: ${name}`,
          );
          input.blur();
          await sample();
        }
        const widths = Object.fromEntries(
          Object.entries(samples).map(([name, values]) => [
            name,
            { min: Math.min(...values), max: Math.max(...values) },
          ]),
        );
        assert(
          Object.values(widths).every((value) => value.max - value.min < 1),
          'Unstable selector width: ' + JSON.stringify(widths),
        );
        for (const name of Object.keys(samples)) {
          const available = f
            .node(name)
            .querySelector('.vben-control-wrapper')!
            .getBoundingClientRect().width;
          assert(
            Math.abs(widths[name]!.min - available) < 1,
            `Selector does not fill field: ${name}`,
          );
        }
        return widths;
      },
    );
  }
  await check('controls', '18 种常用控件挂载与初值', async () => {
    const controls: BuiltinControl[] = [
      'Input',
      'InputPassword',
      'Textarea',
      'InputNumber',
      'Select',
      'Checkbox',
      'CheckboxGroup',
      'Radio',
      'RadioGroup',
      'Switch',
      'DatePicker',
      'RangePicker',
      'TimePicker',
      'TreeSelect',
      'Cascader',
      'Rate',
      'Slider',
      'Upload',
    ];
    const f = await mount({
      schema: controls.map((component) =>
        field(component, {
          component,
          componentProps: component === 'Upload' ? { beforeUpload: () => false } : undefined,
        }),
      ),
      wrapperClass: 'grid-cols-3',
    });
    await f.api.setValues({
      Input: 'text',
      InputPassword: 'secret',
      Textarea: 'long text',
      InputNumber: 0,
      DatePicker: dayjs('2026-09-15'),
      RangePicker: [dayjs('2026-09-15'), dayjs('2026-09-16')],
      TimePicker: dayjs('2026-09-15T12:00:00'),
      Rate: 3,
      Slider: 30,
    });
    await nextTick();
    assert(
      f.element.querySelectorAll('[data-vben-field]').length === controls.length,
      'Missing controls',
    );
    await until(
      () =>
        f.node('DatePicker').querySelector('input') !== null &&
        f.node('Upload').querySelector('input') !== null,
    );
    assert(f.node('Input').querySelector('input')?.value === 'text', 'Input initial value');
    assert(
      f.node('DatePicker').querySelector('input')?.value === '2026-09-15',
      'Dayjs date rendering',
    );
    assert(f.api.form.getFieldValue('Checkbox') === undefined, 'Checked binding default');
    return {
      controls,
      fields: controls.length,
      date: f.node('DatePicker').querySelector('input')?.value,
    };
  });
  await check('input-events', 'Input 更新回调仅一次，reset 不回响', async () => {
    let events = 0;
    const f = await mount({
      schema: [
        field('name', {
          componentProps: {
            onChange: () => {
              events++;
            },
          },
        }),
      ],
    });
    await f.input('name', 'new');
    assert(
      f.api.form.getFieldValue('name') === 'new' && events === 1,
      'Duplicate/missing input event',
    );
    await f.api.reset();
    await nextTick();
    assert(
      events === 1 && f.node('name').querySelector('input')?.value === '',
      'Reset emitted user change',
    );
    return { events };
  });
  await check('checked-number', 'Switch、Checkbox、InputNumber 真实事件', async () => {
    const f = await mount({
      schema: [
        field('switch', { component: 'Switch' }),
        field('check', { component: 'Checkbox' }),
        field('number', { component: 'InputNumber' }),
      ],
    });
    f.node('switch').querySelector('button')!.click();
    f.node('check').querySelector('input')!.click();
    await f.input('number', '12');
    assert(
      f.api.form.getFieldValue('switch') === true && f.api.form.getFieldValue('check') === true,
      'Checked events failed',
    );
    assert(f.api.form.getFieldValue('number') === 12, 'Numeric input type/value failed');
    return f.api.getRawValues();
  });
  await check('groups', 'RadioGroup 与 CheckboxGroup 模型', async () => {
    const options = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
    ];
    const f = await mount({
      schema: [
        field('radio', { component: 'RadioGroup', componentProps: { options } }),
        field('checks', { component: 'CheckboxGroup', componentProps: { options } }),
      ],
    });
    f.node('radio').querySelectorAll<HTMLInputElement>('input')[1]!.click();
    f.node('checks').querySelectorAll<HTMLInputElement>('input')[0]!.click();
    await nextTick();
    assert(f.api.form.getFieldValue('radio') === 'b', 'RadioGroup value event');
    assert(
      JSON.stringify(f.api.form.getFieldValue('checks')) === '["a"]',
      'CheckboxGroup value event',
    );
    return f.api.getRawValues();
  });
  await check('select-popup', 'Select 浮层与选项选择', async () => {
    const f = await mount({
      schema: [
        field('choice', {
          component: 'Select',
          componentProps: {
            options: [
              { label: 'Alpha', value: 'a' },
              { label: 'Beta', value: 'b' },
            ],
          },
        }),
      ],
    });
    f.node('choice')
      .querySelector('input')!
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await until(() => document.querySelector('.ant-select-item-option') !== null);
    const option = Array.from(
      document.querySelectorAll<HTMLElement>('.ant-select-item-option'),
    ).find((node) => node.textContent?.includes('Beta'));
    assert(option, 'Missing Select option');
    option.click();
    await nextTick();
    assert(f.api.form.getFieldValue('choice') === 'b', 'Select did not commit choice');
    return f.api.getRawValues();
  });
  for (const component of [
    'DatePicker',
    'RangePicker',
    'TimePicker',
    'TreeSelect',
    'Cascader',
  ] as const) {
    await check(`popup-${component}`, `${component} 真实浮层`, async () => {
      const f = await mount({
        schema: [
          field('control', {
            component,
            componentProps: {
              ...(component === 'TreeSelect'
                ? { treeData: [{ title: 'Node', value: 'node' }] }
                : {}),
              ...(component === 'Cascader'
                ? {
                    options: [
                      {
                        label: 'Parent',
                        value: 'parent',
                        children: [{ label: 'Child', value: 'child' }],
                      },
                    ],
                  }
                : {}),
            },
          }),
        ],
      });
      const input = f.node('control').querySelector('input')!;
      input.focus();
      input.click();
      input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await until(
        () =>
          document.querySelector(
            '.ant-picker-dropdown,.ant-select-dropdown,.ant-cascader-dropdown',
          ) !== null,
      );
      const popup = document.querySelector<HTMLElement>(
        '.ant-picker-dropdown,.ant-select-dropdown,.ant-cascader-dropdown',
      );
      assert(popup && popup.getBoundingClientRect().height > 0, 'Popup is not visible');
      return { component, popupHeight: popup.getBoundingClientRect().height };
    });
  }
  await check('upload', 'Upload 本地文件选择与重置', async () => {
    const f = await mount({
      schema: [
        field('file', {
          defaultValue: [],
          component: 'Upload',
          componentProps: { beforeUpload: () => false },
        }),
      ],
    });
    const input = f.node('file').querySelector<HTMLInputElement>('input[type=file]')!;
    const transfer = new DataTransfer();
    transfer.items.add(new File(['hello'], 'example.txt', { type: 'text/plain' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await until(
      () =>
        Array.isArray(f.api.form.getFieldValue('file')) &&
        (f.api.form.getFieldValue('file') as unknown[]).length === 1,
    );
    assert(f.node('file').textContent?.includes('example.txt'), 'Upload list is not rendered');
    await f.api.reset();
    await nextTick();
    assert(JSON.stringify(f.api.form.getFieldValue('file')) === '[]', 'Upload reset failed');
    return { selected: 'example.txt', reset: f.api.form.getFieldValue('file') };
  });
  await check('custom-slot', '自定义 modelValue 控件与字段/操作插槽', async () => {
    const Custom = defineComponent({
      props: ['modelValue'],
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            value: props.modelValue,
            onInput: (event: Event) => {
              if (event.target instanceof HTMLInputElement)
                emit('update:modelValue', event.target.value);
            },
          });
      },
    });
    const f = await mount(
      { schema: [field('custom', { component: Custom }), field('slot')] },
      {
        slot: (props) => [h(Input, props.componentProps)],
        'submit-before': () => [
          h('button', { type: 'button', 'data-custom-actions': '' }, 'Custom actions'),
        ],
      },
    );
    await f.input('custom', 'custom value');
    await f.input('slot', 'slot value');
    assert(
      f.api.form.getFieldValue('custom') === 'custom value' &&
        f.api.form.getFieldValue('slot') === 'slot value',
      'Custom/slot bindings failed',
    );
    assert(f.element.querySelector('[data-custom-actions]'), 'Actions slot missing');
    return f.api.getRawValues();
  });
  await check('required', '字段错误展示、aria 与聚焦', async () => {
    const f = await mount({ schema: [field('name', { rules: 'required' })] });
    f.element.querySelector<HTMLButtonElement>('button.ant-btn-primary')!.click();
    await until(() => !!f.api.form.getFieldError('name'));
    await nextTick();
    const input = f.node('name').querySelector('input')!;
    assert(input.getAttribute('aria-invalid') === 'true', 'aria-invalid missing');
    assert(f.node('name').querySelector('[role=alert]'), 'Accessible error text missing');
    f.api.getFieldComponentRef<{ focus: () => void }>('name')?.focus();
    assert(document.activeElement === input, 'focus failed');
    await f.input('name', 'ok');
    await f.api.validate();
    return { errorsCleared: !f.api.form.getFieldError('name') };
  });
  await check('schema-focus', '局部 schema 更新保持焦点及节点', async () => {
    const f = await mount({ schema: [field('name'), field('other')] });
    const input = f.node('name').querySelector('input')!;
    input.focus();
    await f.api.updateSchema([{ fieldName: 'name', label: 'New label' }]);
    await nextTick();
    assert(
      document.activeElement === input && f.node('name').querySelector('input') === input,
      'Schema patch remounted input',
    );
    f.api.setState((previous) => ({ schema: [...(previous.schema ?? []), field('added')] }));
    await nextTick();
    assert(f.element.querySelectorAll('[data-vben-field]').length === 3, 'Append did not render');
    await f.api.removeSchemaByFields(['added']);
    await nextTick();
    assert(f.element.querySelectorAll('[data-vben-field]').length === 2, 'Remove did not unmount');
    return { focusRetained: true };
  });
  await check('enter-ime', 'Enter、textarea 和输入法组合输入', async () => {
    let calls = 0;
    const f = await mount({
      schema: [field('name'), field('text', { component: 'Textarea' })],
      submitOnEnter: true,
      handleSubmit: () => {
        calls++;
      },
    });
    const input = f.node('name').querySelector('input')!;
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    f.node('text')
      .querySelector('textarea')!
      .dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
    await delay(10);
    assert(calls === 0, 'IME/textarea should not submit');
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await until(() => calls === 1);
    return { submissions: calls };
  });
  await check('theme-locale', '暗色主题、英文文案与独立样式', async () => {
    const f = await mount(
      { schema: [field('name', { rules: 'required' })], locale: enUS },
      {},
      true,
    );
    assert(
      f.element.textContent?.includes('Submit') && f.element.textContent?.includes('Reset'),
      'English actions not applied',
    );
    await f.api.validate().catch(() => {});
    await nextTick();
    assert(
      f.node('name').textContent?.includes('name is required'),
      'English required message not applied',
    );
    const background = getComputedStyle(f.node('name').querySelector('input')!).backgroundColor;
    assert(
      background !== 'rgb(255, 255, 255)',
      'Dark input background did not follow ConfigProvider',
    );
    return { background };
  });
  await check('native-submit-slot', '操作插槽中的原生 submit 按钮', async () => {
    let calls = 0;
    const f = await mount(
      {
        schema: [field('name')],
        handleSubmit: () => {
          calls++;
        },
      },
      {
        'submit-before': () => [
          h('button', { type: 'submit', 'data-native-submit': '' }, 'Submit'),
        ],
      },
    );
    f.element.querySelector<HTMLButtonElement>('[data-native-submit]')!.click();
    await until(() => calls === 1);
    return { submissions: calls };
  });
  await check('render-isolation', '100 字段单字段更新不渲染无关控件', async () => {
    const renders: Record<string, number> = {};
    const Control = defineComponent({
      props: ['modelValue', 'tag'],
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        return () => {
          const tag = String(props.tag);
          renders[tag] = (renders[tag] ?? 0) + 1;
          return h('input', {
            value: props.modelValue,
            onInput: (event: Event) => {
              if (event.target instanceof HTMLInputElement)
                emit('update:modelValue', event.target.value);
            },
          });
        };
      },
    });
    const f = await mount({
      schema: Array.from({ length: 100 }, (_, i) =>
        field(`field${i}`, {
          component: Control as Component,
          componentProps: { tag: `field${i}` },
        }),
      ),
    });
    await f.input('field0', 'warmup');
    await delay(10);
    Object.keys(renders).forEach((key) => {
      renders[key] = 0;
    });
    for (let i = 0; i < 30; i++) await f.input('field0', String(i));
    const unrelated = Object.entries(renders)
      .filter(([key]) => key !== 'field0')
      .reduce((sum, [, count]) => sum + count, 0);
    assert(
      unrelated === 0 && (renders.field0 ?? 0) >= 30 && f.api.form.getFieldValue('field0') === '29',
      `Unexpected renders: own=${renders.field0}, other=${unrelated}`,
    );
    return { fields: 100, inputs: 30, ownRenders: renders.field0, unrelatedRenders: unrelated };
  });
  return {
    generatedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    versions: FORM_LAB_VERSIONS,
    mode: import.meta.env.MODE,
    results,
  };
}
