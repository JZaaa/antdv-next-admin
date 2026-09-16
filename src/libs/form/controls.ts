import type { BuiltinControl } from './types';
import type { Component } from 'vue';

import {
  AutoComplete,
  Button,
  Checkbox,
  CheckboxGroup,
  Input,
  InputNumber,
  InputPassword,
  InputOTP,
  Divider,
  Mentions,
  Radio,
  RadioGroup,
  Rate,
  Select,
  Slider,
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
  Rate,
  Slider,
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
  AutoComplete,
  Divider,
  Mentions,
  Space,
  VbenInput: Input,
  VbenInputPassword: InputPassword,
  VbenPinInput: InputOTP,
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
