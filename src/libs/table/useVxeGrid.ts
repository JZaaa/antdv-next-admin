import type {
  TableComponent,
  TableProps,
  TableRow,
  TableSearchFactory,
  VxeTableGridOptions,
} from './types';
import type { Component, VNodeChild } from 'vue';
import type { VxeGridInstance, VxeGridProps, VxeGridDefines } from 'vxe-table';

import { Empty, Spin, Tooltip } from 'antdv-next';
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  unref,
  watch,
} from 'vue';
import { VxeGrid } from 'vxe-table';

import { VxeGridApi } from './core/api';
import { initVxeTable, tableLocale, tableMessages, VxeUI } from './core/init';
import { mergeConfig } from './core/merge';
import { wrapProxy } from './core/proxy';
import { createViewedRows } from './viewed-row/viewed';

const ACTION_SLOTS = ['reset-before', 'submit-before', 'expand-before', 'expand-after'];
type RenderSlots = Record<string, ((scope: Record<string, unknown>) => VNodeChild) | undefined>;
export function useVxeGrid<T = TableRow, F = unknown, A = unknown>(
  options: TableProps<T, F> = {},
  factory?: TableSearchFactory<F, A>,
): readonly [TableComponent<T, F>, VxeGridApi<T, F, A>] {
  initVxeTable();
  const api = new VxeGridApi<T, F, A>(options);
  const Grid = defineComponent({
    name: 'SchemaVxeGrid',
    inheritAttrs: false,
    setup(_, { attrs, slots, expose }) {
      if (api.grid) throw new Error('One VxeGrid API can only mount one grid at a time');
      let alive = true;
      const grid = shallowRef<VxeGridInstance<T>>();
      const media =
        typeof window === 'undefined' ? undefined : window.matchMedia('(max-width: 767px)');
      const mobile = shallowRef(media?.matches ?? false);
      const updateMobile = (): void => {
        mobile.value = media?.matches ?? false;
      };
      media?.addEventListener('change', updateMobile);
      const formReady = shallowRef<Promise<void>>(Promise.resolve());
      // Explicit component attrs replace each wrapper property; store is the fallback.
      const state = computed(() => {
        const result = { ...api.state };
        for (const [key, value] of Object.entries(attrs)) {
          if (value != null)
            Object.assign(result, {
              [key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())]: value,
            });
        }
        return result;
      });
      const base = computed(() =>
        mergeConfig(
          state.value.gridOptions ?? {},
          (VxeUI.getConfig().grid ?? {}) as VxeTableGridOptions<T>,
        ),
      );
      const viewed = shallowRef(api.viewed);
      watch(
        () => state.value.viewedRowOptions,
        (config) => {
          if (!config || viewed.value) return;
          viewed.value = createViewedRows(
            typeof config === 'boolean' ? {} : config,
            base.value.rowConfig?.keyField,
          );
          api.viewed = viewed.value;
        },
        { immediate: true },
      );
      watch(
        () => {
          const config = state.value.viewedRowOptions;
          return config && typeof config !== 'boolean' ? unref(config.viewedKeys) : undefined;
        },
        (keys) => {
          if (keys) viewed.value?.mark(keys);
        },
        { immediate: true, deep: true },
      );
      const Search = defineComponent({
        name: 'GridSearchBridge',
        setup() {
          const configuration = state.value.formOptions;
          if (!configuration || !factory) return () => null;
          const bridge = factory(configuration, api.reload);
          api.search = bridge;
          watch(
            () => state.value.formOptions,
            (value) => {
              if (value) bridge.update(value);
            },
          );
          onMounted(() => {
            formReady.value = bridge.initialize();
          });
          onBeforeUnmount(() => {
            bridge.dispose();
            if (api.search === bridge) api.search = undefined;
          });
          return () => {
            const delegated: RenderSlots = {};
            Object.keys(slots)
              .filter((key) => key.startsWith('form-'))
              .forEach((key) => {
                delegated[key.slice(5)] = slots[key];
              });
            // Explicit action slots take precedence, including an absent action slot (reference behavior).
            ACTION_SLOTS.forEach((key) => {
              delegated[key] = slots[key];
            });
            return h(bridge.component, null, delegated);
          };
        },
      });
      const wrappedProxy = computed(() =>
        wrapProxy(
          base.value.proxyConfig,
          () => api.search?.getLatest() ?? {},
          () => alive,
        ),
      );
      const sourceColumns = computed(() => base.value.columns);
      const viewedCodes = computed(() => {
        const config = state.value.viewedRowOptions;
        return config && typeof config !== 'boolean' ? config.actionCodes : undefined;
      });
      const columns = computed(() => {
        const action = viewedCodes.value;
        if (!action || !viewed.value || !sourceColumns.value) return sourceColumns.value;
        const codes = Array.isArray(action) ? action : [action];
        const helper = viewed.value;
        const wrap = (values: NonNullable<VxeTableGridOptions<T>['columns']>): typeof values =>
          values.map((column) => {
            const result = { ...column };
            if (column.children) result.children = wrap(column.children);
            if (column.cellRender?.name === 'CellOperation') {
              const original = column.cellRender.attrs?.onClick as
                | ((params: { code: string; row: T }) => unknown)
                | undefined;
              result.cellRender = {
                ...column.cellRender,
                attrs: {
                  ...column.cellRender.attrs,
                  onClick: (params: { code: string; row: T }) => {
                    original?.(params);
                    if (codes.includes(params.code)) helper.markRow(params.row);
                  },
                },
              };
            }
            return result;
          });
        return wrap(sourceColumns.value);
      });
      const resolved = computed<VxeGridProps<T>>(() => {
        const value: VxeTableGridOptions<T> = {
          ...base.value,
          columns: columns.value,
          proxyConfig: wrappedProxy.value,
          formConfig: { enabled: false },
        };
        if (state.value.tableData !== undefined) value.data = state.value.tableData;
        if (value.pagerConfig)
          value.pagerConfig = mergeConfig<NonNullable<VxeGridProps<T>['pagerConfig']>>(
            value.pagerConfig,
            {
              pageSize: 20,
              pageSizes: [10, 20, 30, 50, 100, 200],
              background: true,
              size: 'mini',
              layouts: mobile.value
                ? ['PrevJump', 'PrevPage', 'Number', 'NextPage', 'NextJump']
                : [
                    'Total',
                    'Sizes',
                    'Home',
                    'PrevJump',
                    'PrevPage',
                    'Number',
                    'NextPage',
                    'NextJump',
                    'End',
                  ],
            },
          );
        if (state.value.gridOptions?.pagerConfig && value.pagerConfig) {
          value.pagerConfig.enabled = state.value.gridOptions.pagerConfig.enabled !== false;
        }
        const toolbar = value.toolbarConfig;
        const hasTitle = !!(
          state.value.tableTitle ||
          slots['table-title'] ||
          slots['toolbar-actions']
        );
        const requestedToolbar = state.value.gridOptions?.toolbarConfig;
        const hasNativeToolbar = !!(
          toolbar?.tools?.length ||
          toolbar?.buttons?.length ||
          toolbar?.refresh ||
          toolbar?.custom ||
          toolbar?.export ||
          toolbar?.import ||
          toolbar?.print ||
          toolbar?.zoom
        );
        if (requestedToolbar || hasNativeToolbar || hasTitle || slots['toolbar-tools']) {
          value.toolbarConfig = {
            ...toolbar,
            slots: {
              ...toolbar?.slots,
              ...(hasTitle ? { buttons: 'toolbar-actions' } : {}),
              ...(slots['toolbar-tools'] ? { tools: 'toolbar-tools' } : {}),
            },
          };
          if (toolbar?.search && state.value.formOptions)
            value.toolbarConfig.tools = [
              ...(toolbar.tools ?? []).filter((tool) => tool.code !== 'search'),
              {
                code: 'search',
                icon: 'vxe-icon-search',
                circle: true,
                status: state.value.showSearchForm === false ? undefined : 'primary',
                title:
                  tableMessages[tableLocale.value][
                    state.value.showSearchForm === false ? 'show' : 'hide'
                  ],
              },
            ];
        } else value.toolbarConfig = { enabled: false };
        const config = state.value.viewedRowOptions;
        if (config && viewed.value) {
          const helper = viewed.value;
          const custom = typeof config === 'boolean' ? {} : config;
          const originalClass = value.rowClassName;
          const originalStyle = value.rowStyle;
          value.rowClassName = (params) => {
            const original =
              typeof originalClass === 'function' ? originalClass(params) : originalClass;
            const extra = helper.has(params.row)
              ? typeof custom.rowClassName === 'function'
                ? custom.rowClassName(params)
                : (custom.rowClassName ?? 'vxe-row--viewed')
              : '';
            return [original, extra].filter(Boolean).join(' ');
          };
          value.rowStyle = (params) => ({
            ...(typeof originalStyle === 'function' ? originalStyle(params) : originalStyle),
            ...(helper.has(params.row)
              ? typeof custom.rowStyle === 'function'
                ? custom.rowStyle(params)
                : custom.rowStyle
              : {}),
          });
        }
        return value;
      });
      watch(
        () => state.value.showSearchForm,
        async () => {
          await nextTick();
          if (alive) await grid.value?.recalculate();
        },
      );
      onActivated(() => {
        void grid.value?.recalculate();
      });
      onMounted(async () => {
        api.grid = grid.value;
        try {
          await nextTick();
          await formReady.value;
          if (!alive) return;
          if (state.value.gridOptions?.formConfig?.enabled)
            console.warn('[VxeGrid] Use formOptions instead of native formConfig');
          if (resolved.value.proxyConfig?.enabled && base.value.proxyConfig?.autoLoad !== false) {
            await grid.value?.commitProxy('initial', api.search?.getLatest() ?? {});
          }
        } catch (error) {
          console.error('[VxeGrid initialization]', error);
        }
      });
      onBeforeUnmount(() => {
        alive = false;
        media?.removeEventListener('change', updateMobile);
        api.unmount();
      });
      expose(api);
      return () => {
        const current = state.value;
        const nativeSlots: RenderSlots = {};
        for (const [name, slot] of Object.entries(slots)) {
          if (!name.startsWith('form-') && !ACTION_SLOTS.includes(name) && name !== 'table-title')
            nativeSlots[name] = slot;
        }
        if (current.tableTitle || slots['table-title'] || slots['toolbar-actions'])
          nativeSlots['toolbar-actions'] = (scope) => [
            slots['table-title']?.() ??
              h('span', { class: 'schema-grid__title' }, [
                current.tableTitle,
                current.tableTitleHelp
                  ? h(
                      Tooltip,
                      { title: current.tableTitleHelp },
                      {
                        default: () => h('span', { class: 'schema-grid__help', tabindex: 0 }, '?'),
                      },
                    )
                  : null,
              ]),
            slots['toolbar-actions']?.(scope),
          ];
        if (current.formOptions)
          nativeSlots.form = () =>
            h(
              'div',
              {
                class: 'schema-grid__search',
                style: current.showSearchForm === false ? { display: 'none' } : undefined,
              },
              [
                slots.form ? slots.form({ formApi: api.formApi }) : h(Search),
                current.separator !== false &&
                (typeof current.separator !== 'object' || current.separator.show !== false)
                  ? h('div', {
                      class: 'schema-grid__separator',
                      style:
                        typeof current.separator === 'object'
                          ? { backgroundColor: current.separator.backgroundColor }
                          : undefined,
                    })
                  : null,
              ],
            );
        if (
          !slots.empty &&
          resolved.value.emptyText === undefined &&
          resolved.value.emptyRender === undefined
        ) {
          nativeSlots.empty = () =>
            h(Empty, {
              description: tableMessages[tableLocale.value].empty,
              image: Empty.PRESENTED_IMAGE_SIMPLE,
            });
        }
        if (!slots.loading)
          nativeSlots.loading = () => h('div', { class: 'schema-grid__loading' }, [h(Spin)]);
        const listeners: Record<string, unknown> = {};
        for (const [event, handler] of Object.entries(current.gridEvents ?? {}))
          listeners[`on${event[0]!.toUpperCase()}${event.slice(1)}`] = handler;
        listeners.onToolbarToolClick = (event: VxeGridDefines.ToolbarToolClickEventParams<T>) => {
          if (event.code === 'search') api.toggleSearchForm();
          current.gridEvents?.toolbarToolClick?.(event);
        };
        return h('div', { class: ['schema-grid', current.class] }, [
          h(
            VxeGrid as Component,
            { ...resolved.value, ...listeners, class: current.gridClass, ref: grid },
            nativeSlots,
          ),
        ]);
      };
    },
  });
  return [Grid as unknown as TableComponent<T, F>, api];
}
