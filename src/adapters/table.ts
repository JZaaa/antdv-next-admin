import type { FormApi, FormValues, SchemaFormProps } from '@/libs/form';
import type { TableComponent, TableProps, VxeGridApi } from '@/libs/table';

import { computed, effectScope } from 'vue';

import { setupVxeTable, useVxeGrid as useCoreGrid } from '@/libs/table';
import i18n from '@/locales';
import { useThemeStore } from '@/stores/theme';

import { createTableSearch } from './table-form';
import { registerTableRenderers } from './table-renderers';

let scope: ReturnType<typeof effectScope> | undefined;
function setupHost(): void {
  if (scope) return;
  scope = effectScope(true);
  scope.run(() => {
    const theme = useThemeStore();
    setupVxeTable({
      locale: computed(() => i18n.global.locale.value),
      theme: computed(() => (theme.isDark ? 'dark' : 'light')),
      configVxeTable(ui) {
        ui.setConfig({
          grid: {
            align: 'center',
            border: false,
            columnConfig: { resizable: true },
            minHeight: 180,
            formConfig: { enabled: false },
            proxyConfig: {
              autoLoad: true,
              response: { result: 'items', total: 'total', list: 'items' },
              showActiveMsg: true,
              showResponseMsg: false,
            },
            round: true,
            showOverflow: true,
            size: 'small',
          },
        });
        registerTableRenderers(ui);
      },
    });
  });
}
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    scope?.stop();
    scope = undefined;
  });

export function useVxeGrid<
  R = Record<string, unknown>,
  T extends object = FormValues,
  S extends object = T,
>(
  options: TableProps<R, SchemaFormProps<string, Record<never, never>, T, S>>,
): readonly [
  TableComponent<R, SchemaFormProps<string, Record<never, never>, T, S>>,
  VxeGridApi<
    R,
    SchemaFormProps<string, Record<never, never>, T, S>,
    FormApi<T, string, Record<never, never>, S>
  >,
] {
  setupHost();
  return useCoreGrid(options, createTableSearch<T, S>);
}
export { setupVxeTable, VxeUI } from '@/libs/table';
export type * from '@/libs/table';
