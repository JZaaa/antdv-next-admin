import type {
  ClassType,
  CustomRenderType,
  FormGroupSchema,
  FormSchemaContext,
  SchemaFormFieldArrayProps,
} from '../types';
import type { FormApi } from './api';
import type { RuntimeRecord } from './runtime';
import type { Component, Slots, VNodeChild } from 'vue';

import { Button, Tooltip } from 'antdv-next';
import {
  computed,
  defineComponent,
  h,
  isVNode,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  unref,
  watch,
} from 'vue';

import { formSetup } from '../config';
import { modelProp, resolveControl } from '../controls';
import { arrayChildren, fields, getValue, scopeName, setValue } from './helpers';
import { baseRule, requiredRule, visible } from './runtime';
import './style.css';
import './grid.css';

export function renderContent(content: CustomRenderType | undefined): VNodeChild {
  const value = typeof content === 'function' ? content() : content;
  return value && typeof value === 'object' && !isVNode(value) && !Array.isArray(value)
    ? h(value as Component)
    : (value as VNodeChild);
}
function classes(value: ClassType | undefined): ClassType | undefined {
  return value;
}
function eventValue(value: unknown, key: string): unknown {
  if (
    value &&
    typeof value === 'object' &&
    'target' in value &&
    'stopPropagation' in value &&
    value.target &&
    typeof value.target === 'object'
  )
    return Reflect.get(value.target, key) ?? value;
  return value;
}
function contentText(value: unknown, fallback: string): unknown {
  return typeof value === 'function' ? value() : (unref(value) ?? fallback);
}
function safeName(name: string, component?: Component, binding?: string): boolean {
  if (binding === 'name' || typeof document === 'undefined') return true;
  const props: unknown =
    component && typeof component === 'object' && 'props' in component
      ? component.props
      : undefined;
  if (
    (Array.isArray(props) && props.includes('name')) ||
    (props && typeof props === 'object' && Object.hasOwn(props, 'name'))
  )
    return true;
  return Reflect.get(document.createElement('form'), name) === undefined;
}
export function createFormRenderer<
  T extends object,
  C extends string,
  P extends object,
  S extends object,
>(api: FormApi<T, C, P, S>, slots: Slots) {
  const runtime = api.runtime;
  const Field = defineComponent({
    name: 'VbenSchemaField',
    props: { name: { type: String, required: true }, forceHideLabel: Boolean },
    setup(props) {
      const collapsed = ref(false);
      let initialized = false;
      const element = ref<HTMLElement>();
      const fieldValue = api.form.useFieldValue(props.name);
      const currentError = api.form.useFieldError(props.name);
      // Keep the last completed result visible while TanStack clears its sync error slot
      // and awaits the next async result. Public validation state remains unchanged.
      const fieldError = computed<string | undefined>((previous) => {
        void runtime.version.value;
        const error = currentError.value;
        return runtime.map.get(props.name)?.validating ? previous : error;
      });
      const fieldMeta = api.form.useSelector(() => runtime.map.get(props.name)?.field.state.meta);
      const reference = (value: unknown): void => {
        if (value) api.componentRefMap.set(props.name, value);
        else api.componentRefMap.delete(props.name);
      };
      onBeforeUnmount(() => api.componentRefMap.delete(props.name));
      watch(
        () => {
          void runtime.records.value;
          const record = runtime.map.get(props.name);
          if (!record) return false;
          void record.revision.value;
          const config = record.common.componentProps;
          return typeof config === 'function'
            ? config(runtime.context(record)).autofocus
            : config?.autofocus;
        },
        async (autofocus) => {
          if (autofocus === true) {
            await nextTick();
            element.value?.querySelector<HTMLElement>('input,textarea,button,[tabindex]')?.focus();
          }
        },
        { immediate: true },
      );
      return () => {
        void runtime.records.value;
        const record = runtime.map.get(props.name);
        if (!record) return null;
        void record.revision.value;
        void fieldMeta.value;
        const config = record.common;
        if (!initialized) {
          collapsed.value = !!config.defaultCollapsed;
          initialized = true;
        }
        if (record.hidden || record.schema.hide || record.dynamic.if === false) return null;
        const context = runtime.context(record);
        const schema = record.schema;
        const globalConfig = formSetup.value.config;
        const fallback = record.fallback?.componentProps;
        const commonProps = typeof fallback === 'function' ? fallback(context) : fallback;
        const computedProps =
          typeof schema.componentProps === 'function'
            ? schema.componentProps(context)
            : schema.componentProps;
        const componentProps: Record<string, unknown> = {
          ...('arrayProps' in schema ? schema.arrayProps : {}),
          ...commonProps,
          ...computedProps,
          ...record.dynamic.componentProps,
        };
        const disabled = !!(config.disabled || record.dynamic.disabled || componentProps.disabled);
        const error = fieldError.value;
        const value = fieldValue.value;
        const update = (next: unknown): void => runtime.change(props.name, next);
        const blur = (): void => runtime.blur(props.name);
        const componentField = {
          ...(safeName(props.name) ? { name: props.name } : {}),
          modelValue: value,
          onBlur: blur,
          onChange: update,
          onInput: update,
          'onUpdate:modelValue': update,
        };
        const component =
          schema.component === 'VbenFormFieldArray' || ('type' in schema && schema.type === 'array')
            ? undefined
            : resolveControl({ component: schema.component, fieldName: props.name });
        const model =
          config.modelPropName ??
          (typeof schema.component === 'string'
            ? globalConfig.modelPropNameMap?.[schema.component]
            : undefined) ??
          modelProp({ component: schema.component, fieldName: props.name });
        const binds: Record<string, unknown> = {
          ...componentProps,
          ...(safeName(props.name, component, model) ? { name: props.name } : {}),
          onBlur: blur,
          [model]:
            value === undefined
              ? Object.hasOwn(config, 'emptyStateValue')
                ? config.emptyStateValue
                : globalConfig.emptyStateValue
              : value,
          [`onUpdate:${model}`]: update,
          onChange:
            (config.changeEventFallback ?? globalConfig.changeEventFallback)
              ? (event: unknown) => update(eventValue(event, model))
              : undefined,
          onInput: undefined,
          disabled,
          ...(Object.hasOwn(componentProps, 'onChange')
            ? { onChange: componentProps.onChange }
            : {}),
          ...(Object.hasOwn(componentProps, 'onInput') ? { onInput: componentProps.onInput } : {}),
        };
        if (!safeName(String(binds.name), component, model)) delete binds.name;
        const scope = {
          formApi: api,
          values: slots[props.name] ? api.form.values : runtime.engine.state.values,
          componentField,
          componentProps: binds,
          disabled,
          field: {
            name: props.name,
            state: record.field.state,
            handleChange: update,
            handleBlur: blur,
          },
          isInValid: !!error,
          modelValue: value,
          name: props.name,
        };
        const custom = Object.hasOwn(record.dynamic, 'renderComponentContent')
          ? record.dynamic.renderComponentContent
          : schema.renderComponentContent?.(context);
        const controlSlots = Object.fromEntries(
          Object.entries(custom ?? {}).map(([key, content]) => [
            key,
            (slotProps: Record<string, unknown>) =>
              typeof content === 'function'
                ? (content as (props: Record<string, unknown>) => VNodeChild)({
                    ...slotProps,
                    formContext: scope,
                  })
                : content,
          ]),
        );
        const array =
          ('type' in schema && schema.type === 'array') ||
          schema.component === 'VbenFormFieldArray' ||
          arrayChildren(schema).length > 0;
        const body =
          slots[props.name]?.(scope) ??
          (array
            ? renderArray(record, disabled, componentProps)
            : component
              ? h(
                  component,
                  {
                    ...binds,
                    ref: reference,
                    class: [config.controlClass, componentProps.class],
                    'aria-invalid': error ? 'true' : undefined,
                  },
                  controlSlots,
                )
              : null);
        const help = Object.hasOwn(record.dynamic, 'help') ? record.dynamic.help : schema.help;
        const helpContent = renderContent(typeof help === 'function' ? () => help(context) : help);
        const label = renderContent(schema.label);
        const fieldClass =
          typeof config.formItemClass === 'function'
            ? config.formItemClass(context)
            : config.formItemClass;
        const labelWidth = config.labelWidth ?? 100;
        return h(
          'div',
          {
            ref: element,
            class: [
              'vben-form-field',
              fieldClass,
              {
                'form-valid-error': !!error,
                'form-is-required': requiredRule(record),
                'vben-field-vertical': api.state.layout === 'vertical',
              },
            ],
            style: record.dynamic.show === false ? { display: 'none' } : undefined,
            'data-vben-field': props.name,
          },
          [
            !config.hideLabel && !props.forceHideLabel
              ? h(
                  'label',
                  {
                    class: ['vben-form-label', config.labelClass],
                    style:
                      api.state.layout === 'vertical' ||
                      String(config.labelClass ?? '').includes('w-')
                        ? undefined
                        : {
                            width:
                              labelWidth === 'auto'
                                ? 'var(--vben-label-width, auto)'
                                : typeof labelWidth === 'number'
                                  ? `${labelWidth}px`
                                  : labelWidth,
                          },
                  },
                  [
                    requiredRule(record) && !config.hideRequiredMark
                      ? h('span', { class: 'vben-required', 'aria-hidden': 'true' }, '*')
                      : null,
                    label,
                    helpContent
                      ? h(
                          Tooltip,
                          {},
                          {
                            title: () => helpContent,
                            default: () =>
                              h(
                                'span',
                                { class: 'vben-help', tabindex: 0, 'aria-label': '帮助' },
                                '?',
                              ),
                          },
                        )
                      : null,
                    config.colon && label ? '：' : null,
                    config.collapsible
                      ? h(
                          Button,
                          {
                            type: 'text',
                            size: 'small',
                            htmlType: 'button',
                            'aria-expanded': !collapsed.value,
                            onClick: () => {
                              collapsed.value = !collapsed.value;
                            },
                          },
                          () =>
                            collapsed.value
                              ? (api.state.locale?.expand ?? '展开')
                              : (api.state.locale?.collapse ?? '收起'),
                        )
                      : null,
                  ],
                )
              : null,
            h('div', { class: 'vben-field-body' }, [
              h(
                'div',
                {
                  class: ['vben-control-wrapper', config.wrapperClass],
                  style: collapsed.value ? { display: 'none' } : undefined,
                },
                [
                  body,
                  schema.suffix
                    ? h('span', { class: 'vben-field-suffix' }, [renderContent(schema.suffix)])
                    : null,
                ],
              ),
              schema.description
                ? h('div', { class: 'vben-field-description' }, [renderContent(schema.description)])
                : null,
              h('div', { class: 'vben-field-feedback' }, [
                error
                  ? h('div', { class: 'vben-field-error', role: 'alert', title: error }, error)
                  : null,
              ]),
            ]),
          ],
        );
      };
    },
  });
  const Group = defineComponent({
    name: 'SchemaFormGroup',
    props: { groupIndex: { type: Number, required: true } },
    setup(props) {
      const collapsed = ref(false);
      let initialized = false;
      watch(
        () => {
          const schema = api.state.schema?.[props.groupIndex];
          if (!schema || !('type' in schema) || schema.type !== 'group') return false;
          return schema.children.some((field) =>
            Object.keys(api.form.errors).some(
              (name) =>
                name === field.fieldName ||
                name.startsWith(`${field.fieldName}.`) ||
                name.startsWith(`${field.fieldName}[`),
            ),
          );
        },
        (invalid) => {
          if (invalid) collapsed.value = false;
        },
      );
      return () => {
        const schema = api.state.schema?.[props.groupIndex];
        if (!schema || !('type' in schema) || schema.type !== 'group' || schema.hide) return null;
        if (!initialized) {
          collapsed.value = schema.collapsible !== false && !!schema.defaultCollapsed;
          initialized = true;
        }
        const group = schema as unknown as FormGroupSchema<string, Record<never, never>, T>;
        const context: FormSchemaContext<T> = { fieldName: '', rootValues: api.form.values };
        return h(
          'section',
          {
            class: [
              'vben-form-group',
              typeof group.formItemClass === 'function'
                ? group.formItemClass(context)
                : group.formItemClass,
            ],
            'data-vben-group': group.name ?? props.groupIndex,
          },
          [
            h('div', { class: 'vben-group-heading' }, [
              group.collapsible !== false
                ? h(
                    Button,
                    {
                      type: 'text',
                      htmlType: 'button',
                      'aria-expanded': !collapsed.value,
                      onClick: () => {
                        collapsed.value = !collapsed.value;
                      },
                    },
                    () => [collapsed.value ? '▸ ' : '▾ ', renderContent(group.title)],
                  )
                : renderContent(group.title),
              renderContent(group.extra),
            ]),
            h(
              'div',
              {
                class: ['vben-form-grid', classes(group.wrapperClass ?? api.state.wrapperClass)],
                style: collapsed.value ? { display: 'none' } : undefined,
              },
              group.children.map((field) =>
                h(Field, { key: field.fieldName, name: field.fieldName }),
              ),
            ),
          ],
        );
      };
    },
  });
  function renderArray(
    record: RuntimeRecord<T>,
    disabled: boolean,
    componentProps: Record<string, unknown>,
  ): VNodeChild {
    const schema = record.schema;
    const options = {
      ...('arrayProps' in schema ? schema.arrayProps : {}),
      ...componentProps,
    } as SchemaFormFieldArrayProps<string, Record<never, never>, T>;
    const children = arrayChildren(schema, componentProps);
    const value = getValue(api.form.values, record.name);
    const rows: unknown[] = Array.isArray(value) ? value : [];
    const showIndex = options.showIndex !== false;
    const grid = {
      gridTemplateColumns: `${showIndex ? '3rem ' : ''}${children.map(() => 'minmax(0, 1fr)').join(' ')} 4rem`,
    };
    function add(): void {
      if (disabled || rows.length >= (options.max ?? Infinity)) return;
      const row: Record<string, unknown> = options.createRow ? options.createRow() : {};
      if (!options.createRow)
        for (const child of children)
          setValue(
            row,
            child.fieldName,
            child.defaultValue !== undefined
              ? child.defaultValue
              : 'type' in child && child.type === 'array'
                ? []
                : null,
          );
      api.form.pushFieldValue(record.name, row);
    }
    return h('div', { class: 'vben-field-array', 'data-vben-array': record.name }, [
      h('div', { class: 'vben-array-header', style: grid }, [
        showIndex ? h('span', '#') : null,
        ...children.map((child) =>
          h('span', { key: child.fieldName }, [renderContent(child.label)]),
        ),
        h('span', options.actionText ?? '操作'),
      ]),
      ...rows.map((_, index) =>
        h('div', { class: 'vben-array-row', style: grid, key: `${record.name}-${index}` }, [
          showIndex ? h('span', String(index + 1)) : null,
          ...children.map((child) => {
            const name = scopeName(`${record.name}[${index}]`, child.fieldName);
            return h('div', { key: name, class: 'vben-array-cell' }, [
              h('div', { class: 'vben-array-mobile-label' }, [renderContent(child.label)]),
              h(Field, { name, forceHideLabel: true }),
            ]);
          }),
          h(
            Button,
            {
              htmlType: 'button',
              type: 'text',
              'aria-label': `删除第 ${index + 1} 行`,
              disabled: disabled || rows.length <= (options.min ?? 0),
              onClick: () => {
                void api.form.removeFieldValue(record.name, index).catch(runtime.report);
              },
            },
            () => '×',
          ),
        ]),
      ),
      !rows.length
        ? h('div', { class: 'vben-array-empty' }, options.emptyText ?? '暂无数据')
        : null,
      h(
        Button,
        {
          htmlType: 'button',
          block: true,
          disabled: disabled || rows.length >= (options.max ?? Infinity),
          onClick: add,
        },
        () => options.addButtonText ?? '添加一行',
      ),
    ]);
  }
  function actions(): VNodeChild {
    const state = api.state;
    const scope = { formApi: api, values: api.form.values };
    if (slots.default)
      return slots.default({
        ...scope,
        shapes: fields(state.schema ?? []).map((field) => {
          const rules = field.rules;
          let initial: unknown;
          if (rules && typeof rules !== 'string') {
            try {
              const result = rules.safeParse(undefined);
              if (result.success) initial = result.data;
            } catch {
              /* Async rules have no synchronous default. */
            }
          }
          return {
            fieldName: field.fieldName,
            default: initial,
            required: !!rules && typeof rules !== 'string' && !rules.isOptional(),
            rules: rules && typeof rules !== 'string' ? baseRule(rules) : null,
          };
        }),
      });
    if (state.showDefaultActions === false) return null;
    const submitOptions = state.submitButtonOptions ?? {};
    const resetOptions = state.resetButtonOptions ?? {};
    const submit = [
      slots['submit-before']?.(scope),
      submitOptions.show !== false
        ? h(
            Button,
            {
              type: 'primary',
              ...submitOptions,
              htmlType: 'submit',
              loading: runtime.submitting.value,
            },
            () => contentText(submitOptions.content, state.locale?.submit ?? '提交') as VNodeChild,
          )
        : null,
    ];
    const reset = [
      slots['reset-before']?.(scope),
      resetOptions.show !== false
        ? h(
            Button,
            {
              ...resetOptions,
              htmlType: 'button',
              onClick: () => {
                void api.resetByButton().catch(runtime.report);
              },
            },
            () => contentText(resetOptions.content, state.locale?.reset ?? '重置') as VNodeChild,
          )
        : null,
    ];
    return h(
      'div',
      {
        class: [
          'vben-form-actions',
          state.actionWrapperClass,
          `vben-actions-${state.actionLayout ?? 'rowEnd'}`,
        ],
        style: {
          justifyContent: { left: 'flex-start', center: 'center', right: 'flex-end' }[
            state.actionPosition ?? 'right'
          ],
        },
      },
      [
        ...(state.actionButtonsReverse ? [...submit, ...reset] : [...reset, ...submit]),
        slots['expand-before']?.(scope),
        state.showCollapseButton
          ? h(
              Button,
              {
                htmlType: 'button',
                type: 'link',
                'aria-expanded': !state.collapsed,
                onClick: () => {
                  const collapsed = !api.state.collapsed;
                  api.setState({ collapsed });
                  api.state.handleCollapsedChange?.(collapsed);
                  if (api.state.collapseTriggerResize && typeof window !== 'undefined')
                    void nextTick(() => window.dispatchEvent(new Event('resize')));
                },
              },
              () =>
                state.collapsed
                  ? (state.locale?.expand ?? '展开')
                  : (state.locale?.collapse ?? '收起'),
            )
          : null,
        slots['expand-after']?.(scope),
      ],
    );
  }
  const host = ref<HTMLElement>();
  let observer: ResizeObserver | undefined;
  let foldScheduled = false;
  function measure(): void {
    if (!host.value) return;
    const labels = [...host.value.querySelectorAll<HTMLElement>('.vben-form-label')].filter(
      (label) => label.offsetParent !== null,
    );
    if (labels.length) {
      const width = Math.max(
        ...labels.map((label) => {
          const range = document.createRange();
          range.selectNodeContents(label);
          return range.getBoundingClientRect().width;
        }),
      );
      host.value.style.setProperty('--vben-label-width', `${Math.ceil(width + 8)}px`);
    }
    const root = host.value.querySelector<HTMLElement>('.vben-form-grid');
    if (!root) return;
    const children = [...root.children].filter(
      (node): node is HTMLElement =>
        node instanceof HTMLElement && node.hasAttribute('data-vben-item'),
    );
    children.forEach((node) => {
      node.classList.remove('vben-query-folded');
    });
    if (!api.state.showCollapseButton || !api.state.collapsed) return;
    const rows: number[] = [];
    children.forEach((node) => {
      if (node.offsetParent === null) return;
      const top = node.offsetTop;
      if (!rows.includes(top)) rows.push(top);
      if (rows.indexOf(top) >= (api.state.collapsedRows ?? 1))
        node.classList.add('vben-query-folded');
    });
  }
  function scheduleMeasure(): void {
    if (!foldScheduled) {
      foldScheduled = true;
      void nextTick(() => {
        foldScheduled = false;
        measure();
      });
    }
  }
  onMounted(() => {
    api.mount(host.value);
    if (typeof ResizeObserver !== 'undefined' && host.value) {
      observer = new ResizeObserver(scheduleMeasure);
      observer.observe(host.value);
    }
    scheduleMeasure();
  });
  onBeforeUnmount(() => {
    observer?.disconnect();
    api.unmount();
  });
  watch(() => [api.state, runtime.layoutVersion.value], scheduleMeasure);
  return () => {
    void runtime.layoutVersion.value;
    return h(
      'form',
      {
        ref: host,
        class: ['vben-form', { 'vben-form-compact': api.state.compact }],
        novalidate: true,
        onSubmit: (event: Event) => {
          void api.submit(event).catch(runtime.report);
        },
        onKeydown: (event: KeyboardEvent) => {
          if (
            event.key !== 'Enter' ||
            event.isComposing ||
            event.target instanceof HTMLTextAreaElement
          )
            return;
          if (!api.state.submitOnEnter) {
            if (!(event.target instanceof HTMLButtonElement)) event.preventDefault();
            return;
          }
          event.preventDefault();
          void api.validateAndSubmit().catch(runtime.report);
        },
      },
      [
        h(
          'div',
          {
            class: [
              'vben-form-grid',
              { 'vben-form-inline': api.state.layout === 'inline' },
              classes(api.state.wrapperClass),
            ],
          },
          [
            ...(api.state.schema ?? []).map((schema, index) => {
              if ('type' in schema && schema.type === 'group')
                return schema.hide || !schema.children.length
                  ? null
                  : h(
                      'div',
                      {
                        key: schema.name ?? `group-${index}`,
                        'data-vben-item': '',
                        class: ['vben-group-cell', schema.formItemClass],
                      },
                      [h(Group, { groupIndex: index })],
                    );
              const record = runtime.map.get(schema.fieldName);
              const itemClass = record?.common.formItemClass;
              return h(
                'div',
                {
                  key: schema.fieldName,
                  'data-vben-item': '',
                  class:
                    typeof itemClass === 'function' && record
                      ? itemClass(runtime.context(record))
                      : itemClass,
                  style: record && !visible(record) ? { display: 'none' } : undefined,
                },
                [h(Field, { name: schema.fieldName })],
              );
            }),
            actions(),
          ],
        ),
        runtime.operationError.value
          ? h('div', { role: 'alert', class: 'vben-field-error' }, '表单操作失败，请重试')
          : null,
      ],
    );
  };
}
