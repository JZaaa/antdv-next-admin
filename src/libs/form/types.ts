import type { FormApi } from './core/api';
import type { DeepKeys, DeepValue } from '@tanstack/vue-form';
import type { Component, Ref, VNodeChild } from 'vue';
import type { ZodType } from 'zod';

export type FormValues = Record<string, unknown>;
export type BaseFormComponentType = string;
export type FormFieldName<T extends object = FormValues> = (DeepKeys<T> & string) | (string & {});
export type FormFieldValue<T extends object, K extends string> =
  K extends DeepKeys<T> ? DeepValue<T, K> : unknown;
export type FormValuePatch<T> = T extends
  | Date
  | readonly unknown[]
  | ((...args: never[]) => unknown)
  ? T
  : T extends object
    ? { [K in keyof T]?: FormValuePatch<T[K]> }
    : T;
export type CustomRenderType = VNodeChild | (() => VNodeChild | Component);
export type FormLayout = 'horizontal' | 'inline' | 'vertical';
export type WrapperClassType = string;
export type FormItemClassType = string;
export type FormValidationTrigger = 'blur' | 'change';
export interface FormFieldOptions {
  validateOn?: readonly FormValidationTrigger[];
  asyncDebounceMs?: number;
}
export interface FormShape {
  default?: unknown;
  fieldName: string;
  required?: boolean;
  rules?: ZodType | null;
}
export type ClassType = string | Record<string, boolean> | ClassType[];
export interface FormSchemaContext<T extends object = FormValues> {
  arrayField?: string;
  fieldName: string;
  originalFieldName?: string;
  rootValues?: Readonly<T>;
  row?: Record<string, unknown>;
  rowIndex?: number;
  rowPath?: string;
}
export type ComponentProps<T extends object = FormValues> =
  | Record<string, unknown>
  | ((context: FormSchemaContext<T>) => Record<string, unknown>);
export type CustomParamsRenderType<T extends object = FormValues> =
  | VNodeChild
  | ((context: FormSchemaContext<T>) => VNodeChild | Component);
export type FormSchemaRuleType = ZodType | string | null;
export interface FormDependenciesResolvedState<T extends object = FormValues> {
  componentProps?: Record<string, unknown>;
  disabled?: boolean;
  help?: CustomParamsRenderType<T>;
  if?: boolean;
  renderComponentContent?: Record<string, CustomRenderType>;
  required?: boolean;
  rules?: FormSchemaRuleType;
  show?: boolean;
}
export interface FormDependenciesResolveContext<T extends object = FormValues> {
  actions: FormContextApi<T>;
  controller: FormApi<T>;
  schema: FormSchemaContext<T>;
  values: Readonly<T>;
}
export interface FormItemDependencies<T extends object = FormValues> {
  triggerFields: string[];
  resolve: (
    context: FormDependenciesResolveContext<T>,
  ) =>
    | FormDependenciesResolvedState<T>
    | undefined
    | PromiseLike<FormDependenciesResolvedState<T> | undefined>;
}
export interface FormCommonConfig<T extends object = FormValues> {
  changeEventFallback?: boolean;
  collapsible?: boolean;
  colon?: boolean;
  componentProps?: ComponentProps<T>;
  controlClass?: ClassType;
  defaultCollapsed?: boolean;
  disabled?: boolean;
  emptyStateValue?: null | undefined;
  formFieldProps?: FormFieldOptions;
  formItemClass?: string | ((context: FormSchemaContext<T>) => string);
  hideLabel?: boolean;
  hideRequiredMark?: boolean;
  labelClass?: ClassType;
  labelWidth?: string | number;
  modelPropName?: string;
  wrapperClass?: ClassType;
}
interface FieldBody<T extends object> extends FormCommonConfig<T> {
  defaultValue?: unknown;
  dependencies?: FormItemDependencies<T>;
  description?: CustomRenderType;
  fieldName: string;
  help?: CustomParamsRenderType<T>;
  hide?: boolean;
  label?: CustomRenderType;
  renderComponentContent?: (context: FormSchemaContext<T>) => Record<string, CustomRenderType>;
  rules?: FormSchemaRuleType;
  suffix?: CustomRenderType;
  /** Explicit extension: hidden values otherwise remain in the payload. */
  submitWhenHidden?: boolean;
}
type MappedField<C extends string, P extends object, T extends object> = {
  [K in Extract<keyof P, C>]: Omit<FieldBody<T>, 'componentProps'> & {
    component: K;
    componentProps?: P[K] | ((context: FormSchemaContext<T>) => P[K]);
  };
}[Extract<keyof P, C>];
export type FormFieldSchema<
  C extends string = string,
  P extends object = Record<never, never>,
  T extends object = FormValues,
> =
  | (FieldBody<T> & { component: Exclude<C, keyof P> | Component; type?: undefined })
  | MappedField<C, P, T>
  | (FieldBody<T> & {
      type: 'array';
      component?: C | Component;
      children: FormFieldSchema<C, P, T>[];
      arrayProps?: SchemaFormFieldArrayProps<C, P, T>;
    });
export interface FormGroupSchema<
  C extends string = string,
  P extends object = Record<never, never>,
  T extends object = FormValues,
> {
  type: 'group';
  children: FormFieldSchema<C, P, T>[];
  collapsible?: boolean;
  component?: never;
  defaultCollapsed?: boolean;
  extra?: CustomRenderType;
  fieldName?: never;
  formItemClass?: string | ((context: FormSchemaContext<T>) => string);
  hide?: boolean;
  name?: string;
  title?: CustomRenderType;
  wrapperClass?: ClassType;
}
export type FormSchema<
  C extends string = string,
  P extends object = Record<never, never>,
  T extends object = FormValues,
> = FormFieldSchema<C, P, T> | FormGroupSchema<C, P, T>;
export interface SchemaFormFieldArrayProps<
  C extends string = string,
  P extends object = Record<never, never>,
  T extends object = FormValues,
> {
  actionText?: string;
  addButtonText?: string;
  commonConfig?: FormCommonConfig<T>;
  createRow?: () => Record<string, unknown>;
  disabled?: boolean;
  emptyText?: string;
  globalCommonConfig?: FormCommonConfig<T>;
  max?: number;
  min?: number;
  name?: string;
  schema?: FormFieldSchema<C, P, T>[];
  showIndex?: boolean;
}
export interface ActionButtonOptions extends Record<string, unknown> {
  content?: string | Ref<string> | (() => string);
  show?: boolean;
}
export interface FormCodec<T extends object = FormValues, S extends object = T> {
  encode: (values: Readonly<T>) => S;
  decode: (values: Readonly<S>) => T;
}
export interface SchemaFormProps<
  C extends string = string,
  P extends object = Record<never, never>,
  T extends object = FormValues,
  S extends object = T,
> {
  locale?: Partial<FormLocale>;
  actionButtonsReverse?: boolean;
  actionLayout?: 'inline' | 'newLine' | 'rowEnd';
  actionPosition?: 'center' | 'left' | 'right';
  actionWrapperClass?: ClassType;
  changeDebouncedTime?: number;
  codec?: FormCodec<T, S>;
  collapsed?: boolean;
  collapsedRows?: number;
  collapseTriggerResize?: boolean;
  commonConfig?: FormCommonConfig<T>;
  compact?: boolean;
  handleCollapsedChange?: (collapsed: boolean) => void;
  handleReset?: (values: S) => void | Promise<void>;
  handleSubmit?: (values: S, rawValues: Readonly<T>) => void | Promise<void>;
  handleValuesChange?: (
    values: Readonly<T>,
    fieldsChanged: string[],
    getFormattedValues: () => S,
  ) => void;
  layout?: FormLayout;
  resetButtonOptions?: ActionButtonOptions;
  schema?: FormSchema<C, P, T>[];
  scrollToFirstError?: boolean;
  showCollapseButton?: boolean;
  showDefaultActions?: boolean;
  submitButtonOptions?: ActionButtonOptions;
  submitOnChange?: boolean;
  submitOnEnter?: boolean;
  wrapperClass?: ClassType;
}
export interface FormMeta {
  dirty: boolean;
  submitting: boolean;
  valid: boolean;
  validating: boolean;
}
export interface FormValidationResult {
  errors: Record<string, string>;
  valid: boolean;
}
export interface FormResetOptions {
  force?: boolean;
  keepDefaultValues?: boolean;
}
export interface FormResetState<T extends object = FormValues> {
  values?: FormValuePatch<T>;
}
export interface FormValueSnapshot<T extends object = FormValues, S extends object = T> {
  rawValues: Readonly<T>;
  values: S;
}
export interface FormRuntimeField<T = unknown> {
  name: string;
  state: {
    value: T;
    meta: {
      isDirty: boolean;
      isTouched: boolean;
      isValid: boolean;
      isValidating: boolean;
      errors: unknown[];
    };
  };
  handleChange: (value: T) => void;
  handleBlur: () => void;
}
export interface FormContextApi<T extends object = FormValues> {
  readonly errors: Record<string, string>;
  readonly meta: FormMeta;
  readonly values: T;
  fieldComponent: Component;
  clearValidation: (names?: string | string[]) => void;
  getFieldError: (name: string) => string | undefined;
  getFieldValue: <K extends FormFieldName<T>>(name: K) => FormFieldValue<T, K>;
  handleSubmit: (
    callback?: (values: T) => unknown | Promise<unknown>,
  ) => (event?: Event) => Promise<void>;
  isFieldValid: (name: string) => boolean;
  pushFieldValue: (name: string, value: unknown) => void;
  removeFieldValue: (name: string, index: number) => Promise<void>;
  reset: (state?: FormResetState<T>, options?: FormResetOptions) => Promise<void>;
  setFieldError: (name: string, error?: string) => void;
  setFieldValue: <K extends FormFieldName<T>>(
    name: K,
    value: FormFieldValue<T, NoInfer<K>>,
    shouldValidate?: boolean,
  ) => Promise<void>;
  setValues: (values: Partial<T>, shouldValidate?: boolean) => Promise<void>;
  submit: () => Promise<void>;
  useFieldError: (name: string) => Readonly<Ref<string | undefined>>;
  useFieldValue: <K extends FormFieldName<T>>(name: K) => Readonly<Ref<FormFieldValue<T, K>>>;
  useFieldValues: <K extends FormFieldName<T>>(
    names: readonly K[],
  ) => Readonly<Ref<FormFieldValue<T, K>[]>>;
  useValues: () => Readonly<Ref<T>>;
  useSelector: <R>(
    selector: (state: { values: T; errors: Record<string, string>; meta: FormMeta }) => R,
  ) => Readonly<Ref<R>>;
  validate: () => Promise<FormValidationResult>;
  validateField: (name: string) => Promise<FormValidationResult>;
}
export interface FormComponentField<V = unknown, K extends string = string> {
  modelValue: V;
  name: K;
  onBlur: () => void;
  onChange: (value: V) => void;
  onInput: (value: V) => void;
  'onUpdate:modelValue': (value: V) => void;
}
export interface SchemaFormActionSlotProps<
  T extends object = FormValues,
  C extends string = string,
  P extends object = Record<never, never>,
  S extends object = T,
> {
  formApi: FormApi<T, C, P, S>;
  values: T;
}
export interface SchemaFormDefaultSlotProps<
  T extends object = FormValues,
  C extends string = string,
  P extends object = Record<never, never>,
  S extends object = T,
> extends SchemaFormActionSlotProps<T, C, P, S> {
  shapes: FormShape[];
}
export type SchemaFormResolvedComponentProps<V = unknown, K extends string = string> = Record<
  string,
  unknown
> & { disabled: boolean; modelValue?: V; name: K; 'onUpdate:modelValue'?: (value: V) => void };
export interface SchemaFormFieldSlotProps<
  T extends object = FormValues,
  K extends FormFieldName<T> = FormFieldName<T>,
  C extends string = string,
  P extends object = Record<never, never>,
  S extends object = T,
> extends SchemaFormActionSlotProps<T, C, P, S> {
  componentField: FormComponentField<FormFieldValue<T, K>, K>;
  componentProps: SchemaFormResolvedComponentProps<FormFieldValue<T, K>, K>;
  disabled: boolean;
  field: FormRuntimeField<FormFieldValue<T, K>>;
  isInValid: boolean;
  modelValue: FormFieldValue<T, K>;
  name: K;
}
type ActionSlotName = 'expand-after' | 'expand-before' | 'reset-before' | 'submit-before';
export type SchemaFormSlots<
  T extends object = FormValues,
  C extends string = string,
  P extends object = Record<never, never>,
  S extends object = T,
> = {
  [K in Exclude<Extract<keyof T, string>, ActionSlotName | 'default'>]?: (
    props: SchemaFormFieldSlotProps<T, K, C, P, S>,
  ) => VNodeChild;
} & { default?: (props: SchemaFormDefaultSlotProps<T, C, P, S>) => VNodeChild } & {
  [K in ActionSlotName]?: (props: SchemaFormActionSlotProps<T, C, P, S>) => VNodeChild;
};
export type SchemaFormComponent<
  T extends object = FormValues,
  C extends string = string,
  P extends object = Record<never, never>,
  S extends object = T,
> = new () => { $props: SchemaFormProps<C, P, T, S>; $slots: SchemaFormSlots<T, C, P, S> };

export interface FormRuleContext {
  locale?: Partial<FormLocale>;
  field: { label?: string; name: string };
  label?: string;
  name: string;
}
export type FormRuleValidator = (
  value: unknown,
  params: unknown[],
  context: FormRuleContext,
) => boolean | string | Promise<boolean | string>;
export type BuiltinControl =
  | 'Input'
  | 'InputPassword'
  | 'Textarea'
  | 'InputNumber'
  | 'Select'
  | 'Checkbox'
  | 'CheckboxGroup'
  | 'Radio'
  | 'RadioGroup'
  | 'Switch'
  | 'DatePicker'
  | 'RangePicker'
  | 'TimePicker'
  | 'TreeSelect'
  | 'Cascader'
  | 'Rate'
  | 'Slider'
  | 'Upload';
export interface FormLocale {
  submit: string;
  reset: string;
  expand: string;
  collapse: string;
  retry: string;
  required: (label: string) => string;
  selectRequired?: (label: string) => string;
  operationFailed: string;
  remoteFailed: string;
}
