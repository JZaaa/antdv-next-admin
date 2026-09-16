import type {
  FormLocale,
  FormValues,
  FormApi,
  SchemaFormComponent,
  SchemaFormProps,
} from '@/libs/form';

import { watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { enUS, jaJP, koKR, useSchemaForm as useCoreSchemaForm, zhCN } from '@/libs/form';
export { setupSchemaForm, useFormContext, z } from '@/libs/form';
export type {
  FormSchema,
  FormFieldSchema,
  FormGroupSchema,
  FormContextApi,
  SchemaFormProps,
  FormCodec,
  FormValueSnapshot,
  ExtendedFormApi,
} from '@/libs/form';
/** Host-only i18n bridge; all behavior is provided by useSchemaForm. */
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
  const { locale } = useI18n();
  const locales: Record<string, FormLocale> = {
    'zh-CN': zhCN,
    'en-US': enUS,
    'ja-JP': jaJP,
    'ko-KR': koKR,
  };
  const result = useCoreSchemaForm<T, C, P, S>(options);
  watch(
    locale,
    (name) => result[1].setState({ locale: { ...(locales[name] ?? zhCN), ...options.locale } }),
    { immediate: true },
  );
  return result;
}
