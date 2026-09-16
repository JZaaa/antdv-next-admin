import type { EngineField } from '../internal/engine';
/* eslint-disable no-await-in-loop -- Dependency waves must settle before submission validation. */
import type {
  FormCommonConfig,
  FormContextApi,
  FormDependenciesResolvedState,
  FormFieldName,
  FormFieldValue,
  FormFieldSchema,
  FormResetOptions,
  FormResetState,
  FormSchema,
  FormSchemaContext,
  FormValidationResult,
  FormValues,
  SchemaFormProps,
} from '../types';
import type { FormApi } from './api';
import type { CustomRuntimeField } from './runtime-field';
import type { ShallowRef } from 'vue';
import type { ZodType } from 'zod';

import { batch } from '@tanstack/store';
import { computed, readonly, shallowRef, toRaw } from 'vue';
import { ZodArray, ZodPipe } from 'zod';

import { getFormRule } from '../config';
import { createEngine, createEngineField } from '../internal/engine';
import { abortable, FormCancelledError, waitDelay } from '../internal/errors';
import { zodDefaultValue } from '../internal/zod';
import {
  arrayChildren,
  clone,
  defaults,
  equal,
  fields,
  getValue,
  isPlain,
  scopeName,
  segments,
  setValue,
} from './helpers';
import { createRuntimeFieldComponent } from './runtime-field';

export interface RuntimeRecord<T extends object = FormValues> {
  name: string;
  schema: FormFieldSchema<string, Record<never, never>, T>;
  common: FormCommonConfig<T>;
  fallback?: FormCommonConfig<T>;
  revision: ShallowRef<number>;
  arrayLength?: number;
  context: FormSchemaContext<T>;
  dynamic: FormDependenciesResolvedState<T>;
  hidden: boolean;
  field: EngineField;
  cleanup: () => void;
  dependencyVersion: number;
  previousTriggers?: unknown[];
  dependency?: Promise<void>;
  failure?: unknown;
  validationFailure?: unknown;
  validating?: boolean;
  controller?: AbortController;
  tail: Promise<void>;
  message?: string;
}
export function requiredRule<T extends object>(record: RuntimeRecord<T>): boolean {
  const rule = Object.hasOwn(record.dynamic, 'rules') ? record.dynamic.rules : record.schema.rules;
  if (
    record.hidden ||
    record.schema.hide ||
    record.dynamic.if === false ||
    record.dynamic.show === false
  )
    return false;
  if (record.dynamic.required) return true;
  if (typeof rule === 'string') return rule === 'required' || rule === 'selectRequired';
  return !!rule && !toRaw(rule).isOptional();
}
export function baseRule(schema: ZodType): ZodType {
  const raw = toRaw(schema);
  if (raw instanceof ZodPipe) return baseRule(raw.in as ZodType);
  if (raw instanceof ZodArray) return raw;
  if ('unwrap' in raw && typeof raw.unwrap === 'function') {
    const inner: unknown = raw.unwrap();
    if (inner && typeof inner === 'object' && 'safeParseAsync' in inner && inner !== raw)
      return baseRule(inner as ZodType);
  }
  return raw;
}
export function visible<T extends object>(record: RuntimeRecord<T>): boolean {
  return (
    !record.hidden &&
    !record.schema.hide &&
    record.dynamic.if !== false &&
    record.dynamic.show !== false
  );
}
export function initialValues<T extends object>(
  schema: FormSchema<string, Record<never, never>, T>[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const ruleDefaults: Record<string, unknown> = {};
  for (const field of fields(schema)) {
    if (Object.hasOwn(field, 'defaultValue'))
      setValue(result, field.fieldName, clone(field.defaultValue));
    else if (field.rules && typeof field.rules !== 'string')
      setValue(ruleDefaults, field.fieldName, zodDefaultValue(field.rules));
  }
  return defaults(result, ruleDefaults);
}
export function createFormRuntime<T extends object, S extends object>(
  state: ShallowRef<SchemaFormProps<string, Record<never, never>, T, S>>,
  getController: () => FormApi<T, string, Record<never, never>, S>,
) {
  const engine = createEngine();
  const stopEngine = engine.mount();
  const version = shallowRef(0);
  const layoutVersion = shallowRef(0);
  const records = shallowRef<RuntimeRecord<T>[]>([]);
  const map = new Map<string, RuntimeRecord<T>>();
  const customFields = new Map<string, CustomRuntimeField>();
  const manualErrors = shallowRef<Record<string, string>>({});
  const submitting = shallowRef(false);
  const operationError = shallowRef<unknown>();
  let attached = false;
  let syncing = false;
  let lastValues = engine.state.values;
  let changesQueued = false;
  let destroyed = false;
  let epoch = 0;
  let changeTimer: ReturnType<typeof setTimeout> | undefined;
  let notifyValues = clone(lastValues);
  let defaultsValues = clone(lastValues);
  const pending = new Set<Promise<void>>();
  let dependentRecords: RuntimeRecord<T>[] = [];
  let arrayRecords: RuntimeRecord<T>[] = [];

  function report(error: unknown): void {
    if (error instanceof FormCancelledError) return;
    operationError.value = error;
    console.error('SchemaForm operation failed', error);
  }
  function observe(task: Promise<void>): void {
    void task.catch(report);
  }
  function values(): T {
    void version.value;
    return engine.state.values as T;
  }
  function errors(): Record<string, string> {
    void version.value;
    const result: Record<string, string> = {};
    for (const record of map.values()) {
      const error = record.field.state.meta.errors.flat()[0];
      if (error !== undefined && error !== null && error !== '')
        result[record.name] = String(error);
    }
    for (const [name, field] of customFields) {
      const error = field.error();
      if (error) result[name] = error;
    }
    return { ...result, ...manualErrors.value };
  }
  function fieldError(name: string): string | undefined {
    void version.value;
    if (manualErrors.value[name]) return manualErrors.value[name];
    if (customFields.has(name)) return customFields.get(name)?.error();
    const message = map.get(name)?.field.state.meta.errors.flat()[0];
    return message === undefined || message === null || message === ''
      ? undefined
      : String(message);
  }
  function context(record: RuntimeRecord<T>): FormSchemaContext<T> {
    const raw = engine.state.values as T;
    const row = record.context.rowPath ? getValue(raw, record.context.rowPath) : undefined;
    return {
      ...record.context,
      rootValues: readonly(raw) as Readonly<T>,
      row: isPlain(row) ? row : undefined,
    };
  }
  function componentProps(record: RuntimeRecord<T>): Record<string, unknown> {
    const scope = context(record);
    const common = record.fallback?.componentProps;
    const field = record.schema.componentProps;
    return {
      ...('arrayProps' in record.schema ? record.schema.arrayProps : {}),
      ...(typeof common === 'function' ? common(scope) : common),
      ...(typeof field === 'function' ? field(scope) : field),
      ...record.dynamic.componentProps,
    };
  }
  function invalidate(record: RuntimeRecord<T>): void {
    record.controller?.abort();
    record.controller = undefined;
    if (record.validating) {
      record.validating = false;
      version.value++;
    }
  }
  function clear(names?: string | string[]): void {
    const selected =
      names === undefined
        ? new Set([...map.keys(), ...customFields.keys(), ...Object.keys(manualErrors.value)])
        : new Set(typeof names === 'string' ? [names] : names);
    const next = { ...manualErrors.value };
    batch(() => {
      for (const name of selected) {
        delete next[name];
        customFields.get(name)?.clear();
        const record = map.get(name);
        if (record) {
          invalidate(record);
          record.field.setMeta((meta) => ({ ...meta, errorMap: {} }));
        }
      }
    });
    manualErrors.value = next;
  }
  function clearRule(record: RuntimeRecord<T>): void {
    invalidate(record);
    record.field.setMeta((meta) => ({ ...meta, errorMap: {} }));
  }
  async function ruleMessage(
    record: RuntimeRecord<T>,
    signal: AbortSignal,
  ): Promise<string | undefined> {
    if (!visible(record)) return;
    let rule = Object.hasOwn(record.dynamic, 'rules') ? record.dynamic.rules : record.schema.rules;
    if (!rule && record.dynamic.required) rule = 'required';
    if (!rule) return;
    const value = clone(getValue(values(), record.name));
    if (typeof rule === 'string') {
      const validator = getFormRule(rule);
      if (!validator) {
        console.warn(`Form rule ${rule} is not registered`);
        return;
      }
      const label = typeof record.schema.label === 'string' ? record.schema.label : undefined;
      const result = await abortable(
        Promise.resolve(
          validator(value, [], {
            field: { label, name: record.name },
            label,
            name: record.name,
            locale: state.value.locale,
          }),
        ),
        signal,
      );
      return result === true ? undefined : String(result);
    }
    const active = requiredRule(record) ? baseRule(rule) : toRaw(rule);
    const result = await abortable(active.safeParseAsync(value), signal);
    return result.success ? undefined : result.error.issues[0]?.message;
  }
  function validateRecord(record: RuntimeRecord<T>, debounce = false): Promise<void> {
    invalidate(record);
    const controller = new AbortController();
    record.controller = controller;
    record.validating = true;
    version.value++;
    const task = record.tail
      .then(async () => {
        if (controller.signal.aborted) throw new FormCancelledError();
        if (debounce && record.common.formFieldProps?.asyncDebounceMs)
          await waitDelay(record.common.formFieldProps.asyncDebounceMs, controller.signal);
        record.validationFailure = undefined;
        record.field.setMeta((meta) => ({ ...meta, isTouched: true }));
        await record.field.validate('change', {
          skipFormValidation: true,
          skipGroupValidation: true,
        });
        if (controller.signal.aborted) throw new FormCancelledError();
        if (record.validationFailure !== undefined) throw record.validationFailure;
      })
      .finally(() => {
        if (record.controller === controller) {
          record.validating = false;
          version.value++;
        }
      });
    record.tail = task.catch(() => {});
    return task;
  }
  function refresh(record: RuntimeRecord<T>, force = false): void {
    const dependencies = record.schema.dependencies;
    if (!attached || !dependencies?.triggerFields.length) {
      record.dependencyVersion++;
      record.dynamic = {};
      record.previousTriggers = undefined;
      return;
    }
    const triggers = dependencies.triggerFields.map((name) =>
      getValue(values(), scopeName(record.context.rowPath, name)),
    );
    if (!force && record.previousTriggers && equal(triggers, record.previousTriggers)) return;
    record.previousTriggers = clone(triggers);
    if (record.dependency) pending.delete(record.dependency);
    const run = ++record.dependencyVersion;
    record.failure = undefined;
    const task = Promise.resolve()
      .then(() =>
        dependencies.resolve({
          actions: form,
          controller: getController() as unknown as FormApi<T>,
          schema: context(record),
          values: readonly(values()) as Readonly<T>,
        }),
      )
      .then((patch) => {
        if (!attached || run !== record.dependencyVersion || !map.has(record.name)) return;
        invalidate(record);
        record.dynamic = patch ?? {};
        record.revision.value++;
        layoutVersion.value++;
        if (!visible(record)) clearRule(record);
        version.value++;
        sync();
      })
      .catch((error: unknown) => {
        if (run !== record.dependencyVersion || !attached) return;
        record.failure = error;
        report(error);
      })
      .finally(() => pending.delete(task));
    record.dependency = task;
    pending.add(task);
  }
  function sync(): void {
    if (syncing || destroyed) return;
    syncing = true;
    try {
      const names = new Set<string>();
      const next: RuntimeRecord<T>[] = [];
      const visit = (
        items: FormSchema<string, Record<never, never>, T>[],
        common: FormCommonConfig<T>,
        parent?: RuntimeRecord<T>,
        rowIndex?: number,
        groupHidden = false,
      ): void => {
        for (const schema of items) {
          if ('type' in schema && schema.type === 'group') {
            visit(schema.children, common, parent, rowIndex, groupHidden || !!schema.hide);
            continue;
          }
          const rowPath = parent ? `${parent.name}[${rowIndex}]` : undefined;
          const name = scopeName(rowPath, schema.fieldName);
          segments(name);
          // Register overlapping parent/child paths intentionally; native TanStack stores nested values.
          if (names.has(name)) throw new TypeError(`Duplicate form field: ${name}`);
          names.add(name);
          let record = map.get(name);
          const changed = !!record && record.schema !== schema;
          if (!record) {
            const field = createEngineField(engine, name, async () => {
              if (!record?.controller) return undefined;
              try {
                const message = await ruleMessage(record, record.controller.signal);
                return message ? [message] : undefined;
              } catch (error) {
                if (error instanceof FormCancelledError) return undefined;
                record.validationFailure = error;
                return ['表单校验执行失败'];
              }
            });
            record = {
              name,
              schema,
              common: {},
              revision: shallowRef(0),
              context: { fieldName: name },
              dynamic: {},
              hidden: false,
              field,
              cleanup: field.mount(),
              dependencyVersion: 0,
              tail: Promise.resolve(),
            };
            map.set(name, record);
          }
          const commonChanged = record.fallback !== common;
          const wasVisible = visible(record);
          record.schema = schema;
          record.fallback = common;
          record.common = defaults<FormCommonConfig<T>>(schema, common);
          if (parent) {
            const resolvedParentProps = componentProps(parent);
            record.common = {
              ...record.common,
              disabled:
                !!record.common.disabled ||
                !!parent.common.disabled ||
                !!parent.dynamic.disabled ||
                !!(parent.dynamic.componentProps?.disabled ?? resolvedParentProps?.disabled),
            };
          }
          record.context = {
            fieldName: name,
            originalFieldName: schema.fieldName,
            rowPath,
            rowIndex,
            arrayField: parent?.name,
          };
          record.hidden = groupHidden || (!!parent && !visible(parent));
          if (wasVisible && !visible(record)) clearRule(record);
          if (changed || commonChanged) record.revision.value++;
          next.push(record);
          if (changed) {
            invalidate(record);
            record.previousTriggers = undefined;
          }
          refresh(record, changed);
          const resolvedProps = componentProps(record);
          const children = arrayChildren(schema, resolvedProps);
          if (children.length) {
            const entries = getValue(values(), name);
            record.arrayLength = Array.isArray(entries) ? entries.length : 0;
            const childCommon = isPlain(resolvedProps.commonConfig)
              ? (resolvedProps.commonConfig as FormCommonConfig<T>)
              : {};
            const childGlobal = isPlain(resolvedProps.globalCommonConfig)
              ? (resolvedProps.globalCommonConfig as FormCommonConfig<T>)
              : common;
            if (Array.isArray(entries))
              entries.forEach((_, index) =>
                visit(children, defaults(childCommon, childGlobal), record, index, groupHidden),
              );
          }
        }
      };
      visit(state.value.schema ?? [], state.value.commonConfig ?? {});
      for (const [name, record] of map)
        if (!names.has(name)) {
          invalidate(record);
          record.dependencyVersion++;
          if (record.dependency) pending.delete(record.dependency);
          record.cleanup();
          map.delete(name);
        }
      dependentRecords = next.filter((record) => record.schema.dependencies?.triggerFields.length);
      arrayRecords = next.filter((record) => record.arrayLength !== undefined);
      if (
        next.length !== records.value.length ||
        next.some((record, index) => record !== records.value[index])
      )
        records.value = next;
      layoutVersion.value++;
      version.value++;
    } finally {
      syncing = false;
    }
  }
  function valueChanged(): void {
    if (changesQueued || !attached) return;
    changesQueued = true;
    queueMicrotask(() => {
      changesQueued = false;
      if (!attached) return;
      const arrayChanged = arrayRecords.some((record) => {
        const value = getValue(engine.state.values, record.name);
        return (Array.isArray(value) ? value.length : 0) !== record.arrayLength;
      });
      if (arrayChanged) sync();
      else dependentRecords.forEach((record) => refresh(record));
      if (!state.value.handleValuesChange && !state.value.submitOnChange) return;
      const current = engine.state.values;
      const changedFields = fields(state.value.schema ?? [])
        .map((field) => field.fieldName)
        .filter((name) => !equal(getValue(current, name), getValue(notifyValues, name)));
      notifyValues = current;
      if (!changedFields.length) return;
      try {
        state.value.handleValuesChange?.(readonly(current) as Readonly<T>, changedFields, () =>
          getController().formatValues(current as T),
        );
      } catch (error) {
        report(error);
      }
      if (state.value.submitOnChange) {
        clearTimeout(changeTimer);
        changeTimer = setTimeout(() => {
          if (attached)
            observe(
              getController()
                .validateAndSubmit()
                .then(() => {}),
            );
        }, state.value.changeDebouncedTime ?? 300);
      }
    });
  }
  const stopStore = engine.store.subscribe(() => {
    version.value++;
    if (lastValues !== engine.state.values) {
      lastValues = engine.state.values;
      epoch++;
      valueChanged();
    }
  });
  function write(name: string, value: unknown): void {
    segments(name);
    const copy = clone(value);
    const record = map.get(name);
    if (record) invalidate(record);
    // A bracket-wrapped name is a literal object key, independent of TanStack's path grammar.
    if (name.startsWith('[') && name.endsWith(']')) {
      const next = { ...engine.state.values };
      setValue(next, name, copy);
      engine.baseStore.setState((previous) => ({ ...previous, values: next }));
    } else engine.setFieldValue(name, copy, { dontValidate: true });
    if (record) record.field.setMeta((meta) => ({ ...meta, isTouched: true, isDirty: true }));
  }
  async function settle(): Promise<void> {
    await Promise.resolve();
    while (hasPendingWork()) {
      await Promise.all([...pending]);
      await Promise.resolve();
    }
  }
  function hasPendingWork(): boolean {
    return pending.size > 0 || changesQueued;
  }
  async function validate(names?: string[]): Promise<FormValidationResult> {
    await settle();
    const start = epoch;
    const selected = names
      ? names.flatMap((name) => (map.get(name) ? [map.get(name)!] : []))
      : [...map.values()];
    const failure = selected.find((record) => record.failure !== undefined);
    if (failure) throw failure.failure;
    await Promise.all(selected.map((record) => validateRecord(record)));
    await Promise.all(
      [...customFields]
        .filter(([name]) => !names || names.includes(name))
        .map(([, field]) => field.validate()),
    );
    if (start !== epoch || !attached) throw new FormCancelledError();
    const all = errors();
    const result = names
      ? Object.fromEntries(Object.entries(all).filter(([name]) => names.includes(name)))
      : all;
    return { errors: result, valid: Object.keys(result).length === 0 };
  }
  function reset(resetState?: FormResetState<T>, options?: FormResetOptions): void {
    epoch++;
    clearTimeout(changeTimer);
    map.forEach(invalidate);
    customFields.forEach((field) => field.clear());
    manualErrors.value = {};
    const input = resetState?.values;
    const next =
      input === undefined
        ? clone(defaultsValues)
        : options?.force
          ? clone(input)
          : clone(defaults<unknown>(input, defaultsValues));
    engine.reset(next as Record<string, unknown>, {
      keepDefaultValues: options?.keepDefaultValues,
    });
    if (!options?.keepDefaultValues && input !== undefined)
      defaultsValues = clone(next) as Record<string, unknown>;
    operationError.value = undefined;
    sync();
  }
  function change(name: string, value: unknown): void {
    if (equal(getValue(engine.state.values, name), value)) return;
    if (manualErrors.value[name]) {
      const next = { ...manualErrors.value };
      delete next[name];
      manualErrors.value = next;
    }
    write(name, value);
    const record = map.get(name);
    if (
      record &&
      (record.common.formFieldProps?.validateOn ?? ['change', 'blur']).includes('change')
    )
      observe(validateRecord(record, true));
  }
  function blur(name: string): void {
    const record = map.get(name);
    if (!record) return;
    record.field.setMeta((meta) => ({ ...meta, isTouched: true, isBlurred: true }));
    if ((record.common.formFieldProps?.validateOn ?? ['change', 'blur']).includes('blur'))
      observe(validateRecord(record, true));
  }
  const fieldComponent = createRuntimeFieldComponent(engine, (name, field) => {
    if (field) customFields.set(name, field);
    else customFields.delete(name);
    version.value++;
  });
  const form: FormContextApi<T> = {
    get values() {
      return values();
    },
    get errors() {
      return errors();
    },
    get meta() {
      void version.value;
      return {
        dirty: engine.state.isDirty,
        submitting: submitting.value,
        validating: records.value.some((record) => record.validating) || engine.state.isValidating,
        valid: Object.keys(errors()).length === 0,
      };
    },
    fieldComponent,
    clearValidation: clear,
    getFieldError: fieldError,
    getFieldValue: <K extends FormFieldName<T>>(name: K) =>
      getValue(values(), name) as FormFieldValue<T, K>,
    handleSubmit: (callback) => async (event) => {
      event?.preventDefault();
      event?.stopPropagation();
      if ((await validate()).valid) await callback?.(clone(values()));
    },
    isFieldValid: (name) => !fieldError(name),
    pushFieldValue: (name, value) => {
      const current = getValue(values(), name);
      write(name, [...(Array.isArray(current) ? current : []), clone(value)]);
      sync();
    },
    removeFieldValue: async (name, index) => {
      const current = getValue(values(), name);
      if (!Array.isArray(current) || index < 0 || index >= current.length) return;
      for (const record of map.values())
        if (record.name.startsWith(`${name}[`) || record.name.startsWith(`${name}.`))
          invalidate(record);
      await engine.removeFieldValue(name as never, index);
      sync();
      await settle();
    },
    reset: async (resetState, options) => {
      reset(resetState, options);
    },
    setFieldError: (name, error) => {
      clear(name);
      if (error) manualErrors.value = { ...manualErrors.value, [name]: error };
    },
    setFieldValue: async (name, value, shouldValidate = false) => {
      write(name, value);
      if (shouldValidate) await validate([name]);
    },
    setValues: async (next, shouldValidate = false) => {
      batch(() =>
        Object.entries(next).forEach(([name, value]) =>
          write(name.includes('.') ? `[${name}]` : name, value),
        ),
      );
      if (shouldValidate) await validate();
    },
    submit: async () => {
      await validate();
    },
    useFieldError: (name) => computed(() => fieldError(name)),
    useFieldValue: <K extends FormFieldName<T>>(name: K) =>
      computed(() => getValue(values(), name) as FormFieldValue<T, K>),
    useFieldValues: <K extends FormFieldName<T>>(names: readonly K[]) =>
      computed<FormFieldValue<T, K>[]>((previous) => {
        const next = names.map((name) => getValue(values(), name) as FormFieldValue<T, K>);
        return previous && equal(previous, next) ? previous : next;
      }),
    useValues: () => computed(values),
    useSelector: (selector) =>
      computed(() => {
        void version.value;
        return selector({
          get values() {
            return values();
          },
          get errors() {
            return errors();
          },
          get meta() {
            return form.meta;
          },
        });
      }),
    validate: () => validate(),
    validateField: (name) => validate([name]),
  };
  sync();
  return {
    form,
    engine,
    version,
    layoutVersion,
    records,
    map,
    submitting,
    operationError,
    change,
    blur,
    sync,
    context,
    report,
    settle,
    attach() {
      defaultsValues = initialValues(state.value.schema ?? []);
      engine.reset(clone(defaultsValues));
      attached = true;
      notifyValues = engine.state.values;
      sync();
    },
    detach() {
      attached = false;
      epoch++;
      clearTimeout(changeTimer);
      pending.clear();
      map.forEach((record) => {
        invalidate(record);
        record.dependencyVersion++;
      });
      reset();
    },
    dispose() {
      destroyed = true;
      attached = false;
      clearTimeout(changeTimer);
      map.forEach((record) => {
        invalidate(record);
        record.dependencyVersion++;
        record.cleanup();
      });
      stopStore.unsubscribe();
      stopEngine();
    },
  };
}
export type VbenRuntime<T extends object = FormValues, S extends object = T> = ReturnType<
  typeof createFormRuntime<T, S>
>;
