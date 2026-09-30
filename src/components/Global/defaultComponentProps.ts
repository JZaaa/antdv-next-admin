import type { App, Component } from 'vue';

import { defineAsyncComponent, defineComponent, h } from 'vue';

import { appDefaultSettings } from '@/settings';

type AttrMap = Record<string, unknown>;

const withAllowClearDefault = (
  name: string,
  component: Component,
  getDefaultAllowClear: () => boolean,
) => {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => {
        const props = attrs as AttrMap;
        const allowClear = props.allowClear ?? getDefaultAllowClear();

        return h(component, { ...props, allowClear }, slots);
      };
    },
  });
};

const SelectWithDefaults = withAllowClearDefault(
  'ASelectWithDefaults',
  defineAsyncComponent(() =>
    import('antdv-next/dist/select/index').then((module) => module.default),
  ),
  () => appDefaultSettings.select.allowClear,
);

const DatePickerWithDefaults = withAllowClearDefault(
  'ADatePickerWithDefaults',
  defineAsyncComponent(() =>
    import('antdv-next/dist/date-picker/index').then((module) => module.default),
  ),
  () => appDefaultSettings.datePicker.allowClear,
);

const RangePickerWithDefaults = withAllowClearDefault(
  'ARangePickerWithDefaults',
  defineAsyncComponent(() =>
    import('antdv-next/dist/date-picker/index').then((module) => module.DateRangePicker),
  ),
  () => appDefaultSettings.datePicker.allowClear,
);

export const registerDefaultComponentProps = (app: App) => {
  app.component('ASelect', SelectWithDefaults);
  app.component('ADatePicker', DatePickerWithDefaults);
  app.component('ARangePicker', RangePickerWithDefaults);
};
