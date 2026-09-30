import type { Component, PropType } from 'vue';
import type { VxeUI } from 'vxe-pc-ui';

import { Button, Image, Input, InputNumber, Select, Switch } from 'antdv-next';
import { defineAsyncComponent, defineComponent, h } from 'vue';

interface OperationConfig {
  attrs?: { onClick?: (params: { code: unknown; row: Record<string, unknown> }) => void };
  options?: (string | Record<string, unknown>)[];
  props?: Record<string, unknown>;
}
// Stable props keep table resize/loading updates out of unchanged action buttons.
const OperationCell = defineComponent({
  props: {
    row: { type: Object as PropType<Record<string, unknown>>, required: true },
    config: { type: Object as PropType<OperationConfig>, required: true },
  },
  setup(cell) {
    return () => {
      const { attrs, options, props } = cell.config;
      const row = cell.row;
      return (options ?? ['edit', 'detail', 'delete']).map((operation) => {
        const raw =
          typeof operation === 'string' ? { code: operation, text: operation } : operation;
        const value = Object.fromEntries(
          Object.entries(raw).map(([key, item]) => [
            key,
            typeof item === 'function' ? item(row) : item,
          ]),
        );
        if (value.show === false) return '';
        return h(
          Button,
          {
            size: 'small',
            type: 'link',
            ...props,
            ...value,
            onClick: () => attrs?.onClick?.({ code: value.code, row }),
          },
          { default: () => String(value.text ?? value.code) },
        );
      });
    };
  },
});

export function registerTableRenderers(ui: typeof VxeUI): void {
  ui.renderer.add('CellImage', {
    renderTableDefault({ props }, { row, column }) {
      return h(Image, { src: row[column.field], ...props });
    },
  });
  ui.renderer.add('CellLink', {
    renderTableDefault({ props }) {
      return h(Button, { size: 'small', type: 'link' }, { default: () => props?.text });
    },
  });
  ui.renderer.add('CellOperation', {
    renderTableDefault(config, { row }) {
      return h(OperationCell, { config, row });
    },
  });
  const controls: Record<string, Component> = {
    AntInput: Input,
    AntNumber: InputNumber,
    AntSelect: Select,
    AntDate: defineAsyncComponent(() =>
      import('antdv-next/dist/date-picker/index').then((module) => module.default),
    ),
    AntSwitch: Switch,
  };
  for (const [name, control] of Object.entries(controls)) {
    ui.renderer.add(name, {
      autofocus: name === 'AntInput' || name === 'AntNumber' ? 'input' : undefined,
      renderTableEdit({ props }, params) {
        const { row, column, $table } = params;
        const model = name === 'AntSwitch' ? 'checked' : 'value';
        return h(control, {
          ...props,
          [model]: row[column.field],
          [`onUpdate:${model}`]: (value: unknown) => {
            row[column.field] = value;
            void $table.updateStatus(params);
          },
        });
      },
    });
  }
  ui.interceptor.add('event.clearEdit', ({ $event }) => {
    const target = $event.target;
    if (
      target instanceof Element &&
      target.closest('.ant-select-dropdown, .ant-picker-dropdown, .ant-cascader-dropdown')
    )
      return false;
  });
}
