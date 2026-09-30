import type { BuiltinControl } from './types';
import type { Component } from 'vue';

import {
  Button,
  Checkbox,
  CheckboxGroup,
  Input,
  InputNumber,
  InputPassword,
  Divider,
  Radio,
  RadioGroup,
  Select,
  Switch,
  Space,
  TextArea,
} from 'antdv-next';
import { defineAsyncComponent, defineComponent, h, toRaw } from 'vue';

import { formSetup } from './config';

const controls: Record<BuiltinControl, Component> = {
  Input,
  InputPassword,
  Textarea: TextArea,
  InputNumber,
  Select,
  Checkbox,
  CheckboxGroup,
  Radio,
  RadioGroup,
  Switch,
  Rate: defineAsyncComponent(() =>
    import('antdv-next/dist/rate/index').then((module) => module.default),
  ),
  Slider: defineAsyncComponent(() =>
    import('antdv-next/dist/slider/index').then((module) => module.default),
  ),
  DatePicker: defineAsyncComponent(() =>
    import('antdv-next/dist/date-picker/index').then((module) => module.default),
  ),
  RangePicker: defineAsyncComponent(() =>
    import('antdv-next/dist/date-picker/index').then((module) => module.DateRangePicker),
  ),
  TimePicker: defineAsyncComponent(() =>
    import('antdv-next/dist/time-picker/index').then((module) => module.default),
  ),
  TreeSelect: defineAsyncComponent(() =>
    import('antdv-next/dist/tree-select/index').then((module) => module.default),
  ),
  Cascader: defineAsyncComponent(() =>
    import('antdv-next/dist/cascader/index').then((module) => module.default),
  ),
  Upload: defineAsyncComponent(() =>
    import('antdv-next/dist/upload/index').then((module) => module.default),
  ),
};
const aliases: Record<string, Component> = {
  AutoComplete: defineAsyncComponent(() =>
    import('antdv-next/dist/auto-complete/index').then((module) => module.default),
  ),
  Divider,
  Mentions: defineAsyncComponent(() =>
    import('antdv-next/dist/mentions/index').then((module) => module.default),
  ),
  Space,
  VbenInput: Input,
  VbenInputPassword: InputPassword,
  VbenPinInput: defineAsyncComponent(() =>
    import('antdv-next/dist/input/index').then((module) => module.InputOTP),
  ),
  VbenCheckbox: Checkbox,
  VbenSelect: Select,
  DefaultButton: Button,
  PrimaryButton: defineComponent({
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h(Button, { ...attrs, type: 'primary' }, slots);
    },
  }),
};
export function resolveControl(field: {
  fieldName?: string;
  component?: string | Component;
  modelPropName?: string;
}): Component | undefined {
  if (typeof field.component !== 'string') return toRaw(field.component);
  const control =
    formSetup.value.components[field.component] ??
    controls[field.component as BuiltinControl] ??
    aliases[field.component];
  if (!control) throw new Error(`Unknown SchemaForm control: ${field.component}`);
  return control;
}
export function modelProp(field: {
  fieldName?: string;
  component?: string | Component;
  modelPropName?: string;
}): string {
  if (field.modelPropName) return field.modelPropName;
  if (typeof field.component === 'string' && formSetup.value.components[field.component])
    return (
      formSetup.value.config.modelPropNameMap?.[field.component] ??
      formSetup.value.config.baseModelPropName ??
      'modelValue'
    );
  if (['Checkbox', 'VbenCheckbox', 'Radio', 'Switch'].includes(String(field.component)))
    return 'checked';
  if (field.component === 'Upload') return 'fileList';
  return typeof field.component === 'string' ? 'value' : 'modelValue';
}
