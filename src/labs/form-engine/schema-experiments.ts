import type { FormApi, SchemaFormProps } from '../../libs/form';
/* eslint-disable no-await-in-loop -- Browser conditions are polled between animation frames. */
import type { ExperimentReport, ExperimentResult } from './experiments';
import type { Slots } from 'vue';

import { ConfigProvider, theme } from 'antdv-next';
import { createApp, defineComponent, h, nextTick, onMounted, onUnmounted } from 'vue';

import { setupSchemaForm, useSchemaForm, z } from '../../libs/form';
import { runControlExperiments } from './control-experiments';
import { delay } from './experiments';

declare const FORM_LAB_VERSIONS: Record<string, string>;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
async function until(check: () => boolean): Promise<void> {
  const start = performance.now();
  while (!check()) {
    if (performance.now() - start > 4000) throw new Error('Browser condition timed out');
    await delay(5);
  }
}
export async function runSchemaExperiments(
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
    await nextTick();
    dispose = () => {
      app.unmount();
      element.remove();
    };
    function node(name: string): HTMLElement {
      const match = [...element.querySelectorAll<HTMLElement>('[data-vben-field]')].find(
        (candidate) => candidate.dataset.vbenField === name,
      );
      assert(match, `Missing field ${name}`);
      return match;
    }
    async function input(name: string, value: string): Promise<void> {
      const control = node(name).querySelector('input,textarea');
      assert(
        control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement,
        'Expected input',
      );
      control.value = value;
      control.dispatchEvent(new Event('input', { bubbles: true }));
      await nextTick();
    }
    return { api, element, node, input };
  }
  async function check(id: string, title: string, run: () => Promise<unknown>): Promise<void> {
    let result: ExperimentResult;
    try {
      result = {
        id: `vben-${id}`,
        title,
        status: 'pass',
        expected: '现代 Vben 契约断言全部通过',
        observed: await run(),
      };
    } catch (error) {
      result = {
        id: `vben-${id}`,
        title,
        status: 'error',
        expected: '现代 Vben 契约断言全部通过',
        observed: error instanceof Error ? error.message : String(error),
      };
    } finally {
      dispose?.();
      dispose = undefined;
      setupSchemaForm({});
    }
    results.push(result);
    onResult(result);
  }
  await check('submit', '真实输入、命名/Zod 校验、原生提交和 rawValues', async () => {
    const submissions: unknown[] = [];
    const f = await mount({
      schema: [
        {
          fieldName: 'name',
          component: 'Input',
          rules: z.string().min(3, '至少三个字'),
          label: '姓名',
        },
      ],
      handleSubmit: (value, raw) => {
        submissions.push([value, raw]);
      },
    });
    f.element
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await until(() => !!f.api.form.errors.name);
    assert(submissions.length === 0, 'Invalid native submit blocked');
    assert(f.node('name').textContent?.includes('至少三个字'), 'Error rendered');
    await f.input('name', 'Alice');
    assert(f.api.form.getFieldValue('name') === 'Alice', 'Input model binding');
    await f.api.submit();
    assert(Number(submissions.length) === 1, 'Valid submit once');
    return submissions;
  });
  await check('visibility', 'hide/if 卸载，show 保留控件，隐藏免校验并保值', async () => {
    let mounts = 0;
    let unmounts = 0;
    const Control = defineComponent({
      setup() {
        onMounted(() => mounts++);
        onUnmounted(() => unmounts++);
        return () => h('input');
      },
    });
    const f = await mount({
      schema: [
        { fieldName: 'toggle', component: 'Switch', defaultValue: true },
        {
          fieldName: 'a',
          component: Control,
          defaultValue: 'kept',
          dependencies: {
            triggerFields: ['toggle'],
            resolve: ({ values }) => ({ show: !!values.toggle }),
          },
        },
        {
          fieldName: 'b',
          component: Control,
          rules: 'required',
          dependencies: {
            triggerFields: ['toggle'],
            resolve: ({ values }) => ({ if: !!values.toggle }),
          },
        },
      ],
    });
    assert(mounts === 2, 'Mounted controls');
    await f.api.setFieldValue('toggle', false);
    await f.api.runtime.settle();
    await nextTick();
    assert(unmounts === 1, 'if unmounts only its control');
    assert(getComputedStyle(f.node('a')).display === 'none', 'show uses CSS');
    assert((await f.api.submit())?.a === 'kept', 'Hidden values submitted');
    f.api.updateSchema([{ fieldName: 'a', hide: true }]);
    await nextTick();
    assert(Number(unmounts) === 2, 'hide unmounts');
    return { mounts, unmounts };
  });
  await check('slots', '字段名插槽、组件绑定、完整上下文、帮助与控件子插槽', async () => {
    const seen: unknown[] = [];
    const WithSlot = defineComponent({
      setup(_, { slots }) {
        return () => h('div', [slots.default?.()]);
      },
    });
    const f = await mount(
      {
        commonConfig: {
          componentProps: () => ({ placeholder: 'common', title: 'base' }),
          hideRequiredMark: true,
        },
        schema: [
          {
            fieldName: 'x',
            component: 'Input',
            label: () => h('strong', 'Label'),
            help: () => 'Help',
            description: () => 'Description',
            suffix: () => 'Suffix',
            rules: 'required',
            componentProps: () => ({ placeholder: 'field' }),
          },
          {
            fieldName: 'content',
            component: WithSlot,
            renderComponentContent: () => ({ default: () => 'Inner content' }),
          },
        ],
      },
      {
        x: (scope) => {
          seen.push(scope);
          return [
            h('input', {
              ...scope.componentProps,
              onInput: (event: Event) =>
                scope.componentField['onUpdate:modelValue'](
                  (event.target as HTMLInputElement).value,
                ),
            }),
          ];
        },
        'submit-before': (scope) => [
          h('span', { 'data-action-slot': '' }, scope.formApi ? 'Before submit' : 'missing'),
        ],
      },
    );
    await f.input('x', 'text');
    assert(f.api.form.getFieldValue('x') === 'text', 'Slot updates values');
    const scope = seen[seen.length - 1] as Record<string, unknown>;
    assert(
      [
        'field',
        'componentField',
        'componentProps',
        'disabled',
        'isInValid',
        'modelValue',
        'name',
        'values',
        'formApi',
      ].every((key) => key in scope),
      'Complete slot contract',
    );
    assert(f.node('x').querySelector('input')?.placeholder === 'field', 'Field props win');
    assert(f.node('x').querySelector('input')?.title === 'base', 'Common function props preserved');
    assert(
      f.element.textContent?.includes('Inner content') &&
        f.element.textContent.includes('Before submit') &&
        f.element.textContent.includes('Suffix'),
      'Render content and action slots',
    );
    assert(!f.node('x').querySelector('.vben-required'), 'hideRequiredMark is visual only');
    assert((await f.api.validate()).valid, 'Valid field');
    return { slots: true, props: true, content: true };
  });
  await check('registry', '自定义组件注册、emptyStateValue 与 change 事件回退', async () => {
    const ChangeOnly = defineComponent({
      props: { value: { default: null } },
      emits: ['change'],
      setup(props, { emit }) {
        return () =>
          h('input', { value: props.value, onInput: (event: Event) => emit('change', event) });
      },
    });
    setupSchemaForm({
      components: { ChangeOnly },
      config: { baseModelPropName: 'value', changeEventFallback: true, emptyStateValue: null },
    });
    const f = await mount({ schema: [{ fieldName: 'x', component: 'ChangeOnly' }] });
    await f.input('x', 'new');
    assert(f.api.form.getFieldValue('x') === 'new', 'Change fallback reads event target');
    await f.api.reset();
    assert(f.node('x').querySelector('input')?.value === '', 'Empty reset value displays empty');
    return { change: true, reset: true };
  });
  await check('array', '数组增删、默认行、行内必填错误和嵌套路径', async () => {
    const f = await mount({
      schema: [
        {
          fieldName: 'rows',
          type: 'array',
          label: 'Rows',
          defaultValue: [{ name: 'A' }],
          children: [{ fieldName: 'name', component: 'Input', label: 'Name', rules: 'required' }],
          arrayProps: { min: 1, max: 2 },
        },
      ],
    });
    const add = [...f.element.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('添加一行'),
    );
    assert(add, 'Add button');
    add.click();
    await nextTick();
    await f.api.runtime.settle();
    await nextTick();
    assert(
      Array.isArray(f.api.form.values.rows) && f.api.form.values.rows.length === 2,
      'Array grows',
    );
    assert(add.disabled, 'max disables add');
    assert(!(await f.api.validate()).valid, 'New row validates');
    await f.input('rows[1].name', 'B');
    assert((await f.api.validate()).valid, 'Row input bound');
    f.element.querySelector<HTMLButtonElement>('[aria-label="删除第 1 行"]')?.click();
    await f.api.runtime.settle();
    await nextTick();
    assert(f.node('rows[0].name').querySelector('input')?.value === 'B', 'Value shifts with row');
    assert(
      f.element.querySelector<HTMLButtonElement>('[aria-label="删除第 1 行"]')?.disabled,
      'min disables remove',
    );
    return await f.api.getRawValues();
  });
  await check('group', '分组折叠保留校验，错误自动展开，隐藏分组免校验', async () => {
    const f = await mount({
      schema: [
        {
          type: 'group',
          name: 'g',
          title: 'Group',
          defaultCollapsed: true,
          extra: () => 'Extra',
          children: [{ fieldName: 'x', component: 'Input', label: 'X', rules: 'required' }],
        },
      ],
    });
    const trigger = f.element.querySelector('[data-vben-group] button');
    assert(trigger?.getAttribute('aria-expanded') === 'false', 'Group starts collapsed');
    assert(!(await f.api.validate()).valid, 'Folded field validates');
    await nextTick();
    assert(trigger?.getAttribute('aria-expanded') === 'true', 'Error opens group');
    const schema = f.api.state.schema?.[0];
    assert(schema && 'type' in schema && schema.type === 'group', 'Group schema');
    f.api.setState({ schema: [{ ...schema, hide: true }] });
    await nextTick();
    assert((await f.api.validate()).valid, 'Hidden group skips rules');
    return { group: true };
  });
  await check('actions', '按钮反转、默认插槽 shapes、重置接管和 Enter 默认值', async () => {
    let resetValue: unknown;
    let submissions = 0;
    const f = await mount({
      actionButtonsReverse: true,
      schema: [{ fieldName: 'x', component: 'Input', defaultValue: 'A' }],
      handleReset: (values) => {
        resetValue = values;
      },
      handleSubmit: () => {
        submissions++;
      },
    });
    const buttons = [...f.element.querySelectorAll('.vben-form-actions button')];
    assert(buttons[0]?.textContent?.replace(/\s/g, '').includes('提交'), 'Submit first');
    await f.input('x', 'B');
    buttons
      .find((button) => button.textContent?.replace(/\s/g, '').includes('重置'))
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await delay(10);
    assert(
      (resetValue as Record<string, unknown>).x === 'B' && f.api.form.values.x === 'B',
      'Custom reset replaces default',
    );
    const input = f.node('x').querySelector('input');
    input?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await delay(10);
    assert(submissions === 0, 'Enter disabled by default');
    f.api.setState({ submitOnEnter: true });
    input?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await until(() => submissions === 1);
    let shapes: unknown;
    await mount(
      { schema: [{ fieldName: 'x', component: 'Input', rules: z.string().default('default') }] },
      {
        default: (scope) => {
          shapes = scope.shapes;
          return [h('span', 'Custom actions')];
        },
      },
    );
    assert(
      Array.isArray(shapes) && shapes[0]?.default === 'default' && shapes[0]?.fieldName === 'x',
      'Default slot receives shapes',
    );
    return { reset: true, enter: true, shapes: true };
  });
  await check('focus', '组件引用、焦点字段和原生 form 属性冲突', async () => {
    const f = await mount({
      schema: [
        { fieldName: 'nodeName', component: 'Input', defaultValue: 'safe' },
        { fieldName: 'x', component: 'Input', componentProps: { autofocus: true } },
      ],
    });
    await until(() => !!f.api.getFieldComponentRef('x'));
    f.node('x').querySelector('input')?.focus();
    assert(f.api.getFocusedField() === 'x', 'Focused field');
    assert(f.element.querySelector('form')?.nodeName === 'FORM', 'Form nodeName not shadowed');
    f.api.updateSchema([{ fieldName: 'x', hide: true }]);
    await nextTick();
    assert(!f.api.getFieldComponentRef('x'), 'Unmount clears ref');
    return { refs: true, safeName: true };
  });
  await check('theme', '水平/垂直/inline 布局、标签自动宽度及暗色控件', async () => {
    const f = await mount(
      {
        commonConfig: { labelWidth: 'auto', colon: true },
        schema: [
          { fieldName: 'x', component: 'Input', label: 'Short' },
          { fieldName: 'y', component: 'Input', label: 'A much longer label' },
        ],
      },
      {},
      true,
    );
    await delay(30);
    const labels = [...f.element.querySelectorAll('.vben-form-label')];
    assert(labels.length === 2, 'Labels exist');
    assert(
      labels[0]?.getBoundingClientRect().width === labels[1]?.getBoundingClientRect().width,
      'Auto width aligns',
    );
    f.api.setState({ layout: 'vertical' });
    await nextTick();
    assert(f.node('x').classList.contains('vben-field-vertical'), 'Vertical layout');
    f.api.setState({ layout: 'inline' });
    await nextTick();
    assert(
      getComputedStyle(f.element.querySelector('.vben-form-grid')!).display === 'flex',
      'Inline layout',
    );
    return { labels: true, layouts: true, dark: true };
  });
  await check('fold-layout', '跨列栅格按真实行折叠，隐藏字段不占位', async () => {
    const f = await mount({
      wrapperClass: 'grid-cols-2',
      showCollapseButton: true,
      collapsed: true,
      collapsedRows: 1,
      schema: [
        { fieldName: 'hidden', component: 'Input', hide: true },
        { fieldName: 'a', component: 'Input', formItemClass: 'col-span-2' },
        { fieldName: 'b', component: 'Input', rules: 'required' },
        { fieldName: 'c', component: 'Input' },
      ],
    });
    await delay(30);
    assert(
      f.node('a').offsetParent !== null && f.node('b').offsetParent === null,
      'One spanning row remains',
    );
    assert(!(await f.api.validate()).valid, 'Query fold retains validation');
    f.api.setState({ collapsed: false });
    await nextTick();
    await delay(20);
    assert(
      f.node('b').offsetParent !== null && f.node('c').offsetParent !== null,
      'Expand restores rows',
    );
    const a = f.node('a').getBoundingClientRect();
    const b = f.node('b').getBoundingClientRect();
    assert(a.width > b.width * 1.8, 'Field formItemClass participates in parent grid');
    return { measuredRows: true, spanning: true, hidden: true };
  });
  await check('field-component', '公开 fieldComponent 与上下文自定义字段参与提交校验', async () => {
    const f = await mount(
      {},
      {
        default: (scope) => [
          h(
            scope.formApi.form.fieldComponent,
            {
              name: 'custom',
              validators: {
                onSubmitAsync: ({ value }: { value: unknown }) =>
                  value ? undefined : 'Custom required',
              },
            },
            {
              default: ({
                field,
              }: {
                field: { state: { value: unknown }; handleChange: (value: unknown) => void };
              }) =>
                h('input', {
                  'data-custom-input': '',
                  value: field.state.value,
                  onInput: (event: Event) =>
                    field.handleChange((event.target as HTMLInputElement).value),
                }),
            },
          ),
        ],
      },
    );
    assert(
      !(await f.api.validate()).valid && f.api.form.errors.custom === 'Custom required',
      'Custom field error collected',
    );
    const input = f.element.querySelector<HTMLInputElement>('[data-custom-input]');
    assert(input, 'Custom field mounted');
    input.value = 'valid';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    assert((await f.api.submit())?.custom === 'valid', 'Custom field submitted');
    return { context: true, validation: true };
  });
  await check('feedback-layout', '紧凑控件不拉伸，异步校验期间提示和行高稳定', async () => {
    const f = await mount({
      schema: [
        { fieldName: 'toggle', component: 'Switch', label: '高级设置', defaultValue: false },
        { fieldName: 'check', component: 'Checkbox', defaultValue: false },
        { fieldName: 'radio', component: 'Radio', defaultValue: false },
        { fieldName: 'rate', component: 'Rate', defaultValue: 0 },
        { fieldName: 'button', component: 'DefaultButton' },
        {
          fieldName: 'email',
          component: 'Input',
          defaultValue: '',
          rules: z.string().refine(async (value) => {
            await delay(60);
            return value.includes('@');
          }, 'Invalid email'),
        },
      ],
    });
    for (const name of ['toggle', 'check', 'radio', 'rate', 'button']) {
      const control = f
        .node(name)
        .querySelector<HTMLElement>('.vben-control-wrapper > :first-child');
      assert(
        control && getComputedStyle(control).flexGrow === '0',
        'Compact control stretched: ' + name,
      );
    }
    const baseline = f.node('email').getBoundingClientRect().height;
    await f.input('email', 'bad');
    await until(() => !!f.node('email').querySelector('.vben-field-error'));
    assert(
      Math.abs(f.node('email').getBoundingClientRect().height - baseline) < 1,
      'Error adds field height',
    );
    await f.input('email', 'still-bad');
    await delay(15);
    assert(
      f.node('email').querySelector('.vben-field-error')?.textContent === 'Invalid email',
      'Previous error disappears during validation',
    );
    await f.input('email', 'alice@example.com');
    await until(() => !f.node('email').querySelector('.vben-field-error'));
    assert(
      Math.abs(f.node('email').getBoundingClientRect().height - baseline) < 1,
      'Valid state changes field height',
    );
    return { compactControls: 5, fieldHeight: baseline, stablePendingError: true };
  });
  await check('subscriptions', '100 字段输入只重绘相关控件', async () => {
    const renders: Record<string, number> = {};
    const Control = defineComponent({
      inheritAttrs: false,
      props: ['value', 'fieldId'],
      emits: ['update:value'],
      setup(props, { emit }) {
        return () => {
          const name = String(props.fieldId);
          renders[name] = (renders[name] ?? 0) + 1;
          return h('input', {
            value: props.value,
            onInput: (event: Event) =>
              emit('update:value', (event.target as HTMLInputElement).value),
          });
        };
      },
    });
    const f = await mount({
      showDefaultActions: false,
      schema: Array.from({ length: 100 }, (_, index) => ({
        fieldName: `f${index}`,
        component: Control,
        modelPropName: 'value',
        defaultValue: '',
        componentProps: { fieldId: `f${index}` },
      })),
    });
    await nextTick();
    Object.keys(renders).forEach((key) => {
      renders[key] = 0;
    });
    const start = performance.now();
    await f.input('f0', 'typed');
    await delay(20);
    const unrelated = Object.entries(renders)
      .filter(([name]) => name !== 'f0')
      .reduce((total, [, count]) => total + count, 0);
    assert(unrelated === 0, `Unrelated controls rerendered: ${unrelated}`);
    return {
      unrelatedRenders: unrelated,
      editedFieldRenders: renders.f0,
      observedMs: performance.now() - start,
      fields: 100,
    };
  });
  const controls = await runControlExperiments(host, onResult);
  results.push(...controls.results);
  return {
    generatedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    versions: FORM_LAB_VERSIONS,
    mode: 'Vben modern compatibility',
    results,
  };
}
