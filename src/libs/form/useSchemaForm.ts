import type { FormContextApi, FormValues, SchemaFormComponent, SchemaFormProps } from './types';
import type { InjectionKey } from 'vue';

import {
  defineComponent,
  getCurrentScope,
  inject,
  isReactive,
  onScopeDispose,
  provide,
  watch,
} from 'vue';

import { FormApi } from './core/api';
import { createFormRenderer } from './core/render';

const formContextKey: InjectionKey<unknown> = Symbol('SchemaFormContext');
export function useFormContext<T extends object = FormValues>(): FormContextApi<T> {
  const form = inject(formContextKey);
  if (!form) throw new Error('useFormContext must be called inside a SchemaForm');
  return form as FormContextApi<T>;
}
export function useSchemaForm<C extends string = string, P extends object = Record<never, never>>(
  options: SchemaFormProps<C, P>,
): readonly [SchemaFormComponent<FormValues, C, P>, FormApi<FormValues, C, P>];
export function useSchemaForm<
  T extends object,
  C extends string = string,
  P extends object = Record<never, never>,
  S extends object = T,
>(
  options: SchemaFormProps<C, P, T, S>,
): readonly [SchemaFormComponent<T, C, P, S>, FormApi<T, C, P, S>];
export function useSchemaForm<
  T extends object,
  C extends string = string,
  P extends object = Record<never, never>,
  S extends object = T,
>(
  options: SchemaFormProps<C, P, T, S>,
): readonly [SchemaFormComponent<T, C, P, S>, FormApi<T, C, P, S>] {
  const api = new FormApi<T, C, P, S>(options);
  const Form = defineComponent({
    name: 'SchemaForm',
    inheritAttrs: false,
    setup(_, { attrs, slots, expose }) {
      provide(formContextKey, api.form);
      watch(
        () => ({ ...attrs }),
        (value) => api.setState(value as Partial<SchemaFormProps<C, P, T, S>>),
        { immediate: true },
      );
      expose(api);
      return createFormRenderer(api, slots);
    },
  });
  if (isReactive(options))
    watch(
      () => options.schema,
      (schema) => api.setState({ schema }),
    );
  if (getCurrentScope()) onScopeDispose(api.dispose);
  return [Form as unknown as SchemaFormComponent<T, C, P, S>, api];
}
