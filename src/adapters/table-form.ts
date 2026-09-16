import type { FormApi, FormValues, SchemaFormProps } from '@/libs/form';
import type { TableSearchBridge } from '@/libs/table';
import type { Component } from 'vue';

import { computed, watch } from 'vue';

import { enUS, jaJP, koKR, useSchemaForm, zhCN } from '@/libs/form';
import { tableLocale, tableMessages } from '@/libs/table';

/** Host composition uses only the Form's public API. */
export function createTableSearch<T extends object = FormValues, S extends object = T>(
  options: SchemaFormProps<string, Record<never, never>, T, S>,
  reload: (params?: object) => Promise<void>,
): TableSearchBridge<
  SchemaFormProps<string, Record<never, never>, T, S>,
  FormApi<T, string, Record<never, never>, S>
> {
  const locales = { 'zh-CN': zhCN, 'en-US': enUS, 'ja-JP': jaJP, 'ko-KR': koKR };
  const defaults: SchemaFormProps<string, Record<never, never>, T, S> = {
    compact: true,
    showCollapseButton: true,
    collapseTriggerResize: true,
    wrapperClass: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    submitButtonOptions: { content: computed(() => tableMessages[tableLocale.value].search) },
    handleSubmit: async (values) => {
      api.setLatestSubmissionValues(values);
      await reload(values);
    },
    handleReset: async () => {
      // Disable change submission while reset settles; it also cancels a pending debounce.
      const submitOnChange = api.state.submitOnChange;
      api.setState({ submitOnChange: false });
      try {
        await api.reset();
        const values = await api.getValues();
        api.setLatestSubmissionValues(values);
        await reload(values);
      } finally {
        api.setState({ submitOnChange });
      }
    },
  };
  const [Form, api] = useSchemaForm<T, string, Record<never, never>, S>({
    ...defaults,
    ...options,
  });
  // Locale updates are a public config update, never a form remount.
  const locale = computed(() => ({ ...locales[tableLocale.value], ...options.locale }));
  // Register in the search component's scope; useSchemaForm disposes on that scope too.
  watch(locale, (value) => api.setState({ locale: value }), { immediate: true });
  return {
    component: Form as Component,
    api,
    getLatest: api.getLatestSubmissionValues,
    async initialize() {
      api.setLatestSubmissionValues(await api.getValues());
    },
    update(value) {
      api.setState({ ...value, locale: { ...locales[tableLocale.value], ...value.locale } });
    },
    dispose: api.dispose,
  };
}
