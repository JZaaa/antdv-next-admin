import type {
  FormContextApi,
  FormFieldName,
  FormFieldSchema,
  FormFieldValue,
  FormResetOptions,
  FormResetState,
  FormSchema,
  FormValidationResult,
  FormValuePatch,
  FormValues,
  FormValueSnapshot,
  SchemaFormProps,
} from '../types';
import type { ComponentPublicInstance, Ref } from 'vue';

import { Store } from '@tanstack/store';
import { computed, isRef, shallowRef } from 'vue';

import { FormCancelledError } from '../internal/errors';
import {
  childUpdateName,
  clone,
  defaults,
  deleteValue,
  fields,
  isPlain,
  mergeValues,
  segments,
} from './helpers';
import { createFormRuntime } from './runtime';

export class FormApi<
  T extends object = FormValues,
  C extends string = string,
  P extends object = Record<never, never>,
  S extends object = T,
> {
  private readonly stateRef;
  readonly store: Store<SchemaFormProps<C, P, T, S>>;
  private readonly stateSubscription;
  readonly runtime;
  readonly form: FormContextApi<T>;
  readonly componentRefMap = new Map<string, unknown>();
  private waiters: { resolve: () => void; reject: (error: Error) => void }[] = [];
  private latest: Partial<S> = {};
  private disposed = false;
  private generation = 0;
  private flight?: Promise<S | undefined>;
  private host?: HTMLElement;
  isMounted = false;

  constructor(options: SchemaFormProps<C, P, T, S> = {}) {
    this.stateRef = shallowRef<SchemaFormProps<C, P, T, S>>({
      actionWrapperClass: '',
      collapsed: false,
      collapsedRows: 1,
      collapseTriggerResize: false,
      commonConfig: {},
      layout: 'horizontal',
      resetButtonOptions: {},
      schema: [],
      scrollToFirstError: false,
      showCollapseButton: false,
      showDefaultActions: true,
      submitButtonOptions: {},
      submitOnChange: false,
      submitOnEnter: false,
      wrapperClass: 'grid-cols-1',
      ...options,
    });
    // Runtime erases only the component-name/props discrimination; value types are preserved.
    const runtimeState = computed(
      () => this.stateRef.value as unknown as SchemaFormProps<string, Record<never, never>, T, S>,
    );
    this.runtime = createFormRuntime(
      runtimeState,
      () => this as unknown as FormApi<T, string, Record<never, never>, S>,
    );
    this.form = this.runtime.form;
    this.store = new Store(this.stateRef.value);
    this.stateSubscription = this.store.subscribe((state) => this.applyState(state));
  }
  get state(): SchemaFormProps<C, P, T, S> {
    return this.stateRef.value;
  }
  getState = (): SchemaFormProps<C, P, T, S> => this.state;
  useStore<R = SchemaFormProps<C, P, T, S>>(
    selector?: (state: SchemaFormProps<C, P, T, S>) => R,
  ): Readonly<Ref<R>> {
    return computed(() => (selector ? selector(this.stateRef.value) : (this.stateRef.value as R)));
  }
  private ready = async (): Promise<void> => {
    if (this.disposed) throw new Error('SchemaForm has been disposed');
    if (!this.isMounted)
      await new Promise<void>((resolve, reject) => this.waiters.push({ resolve, reject }));
    if (!this.isMounted || this.disposed) throw new FormCancelledError();
  };
  mount = (element?: HTMLElement): void => {
    if (this.isMounted) throw new Error('One SchemaForm API can only mount one form at a time');
    if (this.disposed) throw new Error('SchemaForm has been disposed');
    this.host = element;
    this.isMounted = true;
    this.runtime.attach();
    try {
      this.latest = this.formatValues(clone(this.form.values));
    } catch (error) {
      console.warn('SchemaForm failed to encode initial values; using raw values', error);
      this.latest = clone(this.form.values) as unknown as Partial<S>;
    }
    this.waiters.splice(0).forEach(({ resolve }) => resolve());
  };
  unmount = (): void => {
    if (!this.isMounted) return;
    this.generation++;
    this.isMounted = false;
    this.host = undefined;
    this.flight = undefined;
    this.runtime.submitting.value = false;
    this.latest = {};
    this.componentRefMap.clear();
    this.runtime.detach();
  };
  dispose = (): void => {
    if (this.disposed) return;
    this.unmount();
    this.disposed = true;
    this.waiters.splice(0).forEach(({ reject }) => reject(new FormCancelledError()));
    this.runtime.dispose();
    this.stateSubscription.unsubscribe();
  };
  formatValues = (rawValues: Readonly<T>): S => {
    const input = clone(rawValues);
    for (const record of this.runtime.records.value) {
      if (
        record.schema.submitWhenHidden === false &&
        (record.hidden ||
          record.schema.hide ||
          record.dynamic.if === false ||
          record.dynamic.show === false)
      )
        deleteValue(input as Record<string, unknown>, record.name);
    }
    return this.state.codec ? clone(this.state.codec.encode(input)) : (input as S);
  };
  getRawValues = async (): Promise<T> => {
    await this.ready();
    return clone(this.form.values);
  };
  getValues = async (): Promise<S> => {
    await this.ready();
    return this.formatValues(this.form.values);
  };
  getValueSnapshot = async (): Promise<FormValueSnapshot<T, S>> => {
    const rawValues = await this.getRawValues();
    return { rawValues, values: this.formatValues(rawValues) };
  };
  getLatestSubmissionValues = (): Partial<S> => clone(this.latest);
  setLatestSubmissionValues = (value: null | Partial<S>): void => {
    this.latest = clone(value ?? {});
  };
  getFieldComponentRef = <R = ComponentPublicInstance>(name: string): R | undefined => {
    let target = this.componentRefMap.get(name);
    const internal: unknown =
      target && typeof target === 'object' ? Reflect.get(target, '$') : undefined;
    if (internal && typeof internal === 'object') {
      const type: unknown = Reflect.get(internal, 'type');
      const tree: unknown = Reflect.get(internal, 'subTree');
      if (
        type &&
        typeof type === 'object' &&
        Reflect.get(type, 'name') === 'AsyncComponentWrapper' &&
        tree &&
        typeof tree === 'object'
      ) {
        const refs: unknown = Reflect.get(tree, 'ref');
        const first: unknown = Array.isArray(refs) ? refs[0] : refs;
        const reference: unknown =
          first && typeof first === 'object' ? Reflect.get(first, 'r') : undefined;
        if (isRef(reference)) target = reference.value;
      }
    }
    return target as R | undefined;
  };
  getFocusedField = (): string | undefined => {
    if (typeof document === 'undefined') return;
    for (const [name, value] of this.componentRefMap) {
      const element = this.element(value);
      if (
        element &&
        (element === document.activeElement || element.contains(document.activeElement))
      )
        return name;
    }
    return undefined;
  };
  private element(value: unknown): HTMLElement | undefined {
    if (typeof HTMLElement === 'undefined') return;
    if (value instanceof HTMLElement) return value;
    if (value && typeof value === 'object' && '$el' in value && value.$el instanceof HTMLElement)
      return value.$el;
    return undefined;
  }
  scrollToFirstError = (errors: Record<string, unknown> | string): void => {
    const name = typeof errors === 'string' ? errors : Object.keys(errors)[0];
    if (!name) return;
    const element =
      this.element(this.componentRefMap.get(name)) ??
      [...(this.host?.querySelectorAll<HTMLElement>('[data-vben-field]') ?? [])].find(
        (node) => node.dataset.vbenField === name,
      );
    element?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  };
  setState = (
    update:
      | Partial<SchemaFormProps<C, P, T, S>>
      | ((previous: SchemaFormProps<C, P, T, S>) => Partial<SchemaFormProps<C, P, T, S>>),
  ): void => {
    const previous = this.state;
    const patch = typeof update === 'function' ? update(previous) : update;
    this.store.setState(() => defaults(patch, previous));
  };
  private applyState = (next: SchemaFormProps<C, P, T, S>): void => {
    const previous = this.state;
    this.stateRef.value = next;
    const oldFields = fields(previous.schema ?? []);
    const newFields = fields(this.state.schema ?? []);
    if (newFields.length < oldFields.length) {
      const names = new Set(newFields.map((item) => item.fieldName));
      for (const field of oldFields)
        if (!names.has(field.fieldName))
          void this.form.setFieldValue(field.fieldName, undefined as FormFieldValue<T, string>);
    }
    this.runtime.sync();
  };
  setFieldValue = async <K extends FormFieldName<T>>(
    name: K,
    value: FormFieldValue<T, NoInfer<K>>,
    shouldValidate = false,
  ): Promise<void> => {
    await this.ready();
    await this.form.setFieldValue(name, value, shouldValidate);
  };
  setFieldError = async (name: FormFieldName<T>, error?: string): Promise<void> => {
    await this.ready();
    this.form.setFieldError(name, error);
  };
  clearValidation = async (names?: FormFieldName<T> | FormFieldName<T>[]): Promise<void> => {
    await this.ready();
    this.form.clearValidation(names);
  };
  isFieldValid = async (name: FormFieldName<T>): Promise<boolean> => {
    await this.ready();
    return this.form.isFieldValid(name);
  };
  setValues = async (
    patch: FormValuePatch<T>,
    filterFields = true,
    shouldValidate = false,
  ): Promise<void> => {
    await this.ready();
    if (!filterFields) {
      void this.form
        .setValues(clone(patch) as Partial<T>, shouldValidate)
        .catch(this.runtime.report);
      return;
    }
    const current = this.form.values as Record<string, unknown>;
    const merged = Object.fromEntries(
      Object.entries(patch).map(([key, value]) => [key, mergeValues(current[key], value)]),
    );
    const paths = fields(this.state.schema ?? []).map((field) => segments(field.fieldName));
    const filter = (value: unknown, prefix: string[] = []): unknown => {
      if (!isPlain(value)) return value;
      const result: Record<string, unknown> = {};
      for (const [key, next] of Object.entries(value)) {
        const path = [...prefix, key];
        const matches = paths.filter(
          (schemaPath) =>
            schemaPath.length >= path.length &&
            path.every((part, index) => schemaPath[index] === part),
        );
        if (matches.length)
          result[key] = matches.some((match) => match.length === path.length)
            ? next
            : filter(next, path);
      }
      return result;
    };
    void this.form
      .setValues(filter(merged) as Partial<T>, shouldValidate)
      .catch(this.runtime.report);
  };
  setSubmitValues = async (
    payload: S,
    filterFields = true,
    shouldValidate = false,
  ): Promise<void> => {
    if (!this.state.codec) throw new Error('setSubmitValues requires a form codec');
    await this.setValues(
      this.state.codec.decode(clone(payload)) as FormValuePatch<T>,
      filterFields,
      shouldValidate,
    );
  };
  reset = async (state?: FormResetState<T>, options?: FormResetOptions): Promise<void> => {
    await this.ready();
    this.generation++;
    await this.form.reset(state, options);
    await this.runtime.settle();
  };
  resetByButton = async (): Promise<void> => {
    const values = await this.getValues();
    if (this.state.handleReset) await this.state.handleReset(values);
    else await this.reset();
  };
  validate = async (): Promise<FormValidationResult> => {
    await this.ready();
    const result = await this.form.validate();
    if (!result.valid && this.state.scrollToFirstError) this.scrollToFirstError(result.errors);
    return result;
  };
  validateField = async (name: FormFieldName<T>): Promise<FormValidationResult> => {
    await this.ready();
    const result = await this.form.validateField(name);
    if (!result.valid && this.state.scrollToFirstError) this.scrollToFirstError(name);
    return result;
  };
  submit = (event?: Event): Promise<S | undefined> => {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.flight) return this.flight;
    const generation = this.generation;
    const task = (async () => {
      await this.ready();
      this.runtime.submitting.value = true;
      if (!(await this.validate()).valid) return;
      if (generation !== this.generation) throw new FormCancelledError();
      const { rawValues, values } = await this.getValueSnapshot();
      this.latest = clone(values);
      await this.state.handleSubmit?.(values, rawValues);
      if (generation !== this.generation) throw new FormCancelledError();
      return values;
    })().finally(() => {
      if (this.flight === task) {
        this.flight = undefined;
        this.runtime.submitting.value = false;
      }
    });
    this.flight = task;
    return task;
  };
  validateAndSubmit = (): Promise<S | undefined> => this.submit();
  updateSchema = (patches: (Partial<FormFieldSchema<C, P, T>> & { fieldName: string })[]): void => {
    if (patches.some((patch) => !patch.fieldName))
      throw new TypeError('Schema updates require fieldName');
    const update = (
      schema: FormSchema<C, P, T>[],
      changes: typeof patches,
    ): FormSchema<C, P, T>[] =>
      schema.map((item) => {
        if ('type' in item && item.type === 'group')
          return {
            ...item,
            children: update(item.children, changes) as FormFieldSchema<C, P, T>[],
          };
        const exact = changes.find((patch) => patch.fieldName === item.fieldName);
        if (exact) return defaults(exact, item) as FormFieldSchema<C, P, T>;
        const componentProps = item.componentProps;
        const children =
          'children' in item
            ? item.children
            : isPlain(componentProps) && Array.isArray(componentProps.schema)
              ? (componentProps.schema as FormFieldSchema<C, P, T>[])
              : [];
        if (children.length) {
          const scoped = changes.flatMap((patch) => {
            const name = childUpdateName(item.fieldName, patch.fieldName);
            return name ? [{ ...patch, fieldName: name }] : [];
          });
          const nextChildren = update(children, scoped) as FormFieldSchema<C, P, T>[];
          return 'children' in item
            ? { ...item, children: nextChildren }
            : ({
                ...item,
                componentProps: {
                  ...(isPlain(componentProps) ? componentProps : {}),
                  schema: nextChildren,
                },
              } as FormFieldSchema<C, P, T>);
        }
        return item;
      });
    this.setState({ schema: update(this.state.schema ?? [], patches) });
  };
  removeSchemaByFields = async (names: string[]): Promise<void> => {
    this.setState({
      schema: (this.state.schema ?? []).flatMap<FormSchema<C, P, T>>((item) =>
        'type' in item && item.type === 'group'
          ? [
              {
                ...item,
                children: item.children.filter((field) => !names.includes(field.fieldName)),
              },
            ]
          : names.includes(item.fieldName)
            ? []
            : [item],
      ),
    });
  };
  merge = <U extends object, D extends string, Q extends object, V extends object>(
    other: FormApi<U, D, Q, V>,
  ) => {
    const chain: {
      validate: () => Promise<FormValidationResult>;
      getValues: () => Promise<object>;
    }[] = [this, other];
    const submitAllForm = async (needMerge = true): Promise<object | (object | undefined)[]> => {
      const results = await Promise.all(
        chain.map(async (api) => ((await api.validate()).valid ? api.getValues() : undefined)),
      );
      return needMerge ? (Object.assign({}, ...results) as object) : results;
    };
    return Object.assign(Object.create(other) as FormApi<U, D, Q, V>, {
      submitAllForm,
      merge(next: {
        validate: () => Promise<FormValidationResult>;
        getValues: () => Promise<object>;
      }) {
        chain.push(next);
        return this;
      },
    });
  };
}
export type ExtendedFormApi<
  T extends object = FormValues,
  C extends string = string,
  P extends object = Record<never, never>,
  S extends object = T,
> = FormApi<T, C, P, S>;
