import type { FormRuleValidator } from './types';
import type { Component } from 'vue';

import { shallowRef } from 'vue';

import { zhCN } from './locales';

export interface SchemaFormAdapterOptions<T extends string = string> {
  /** Single antdv-next host registry; no cross-UI global state. */
  components?: Partial<Record<T, Component>>;
  config?: {
    baseModelPropName?: string;
    modelPropNameMap?: Partial<Record<T, string>>;
    changeEventFallback?: boolean;
    emptyStateValue?: null | undefined;
  };
  rules?: Partial<Record<string, FormRuleValidator>>;
}

const rules = new Map<string, FormRuleValidator>([
  [
    'required',
    (value, _params, context) =>
      value === undefined ||
      value === null ||
      ((typeof value === 'string' || Array.isArray(value)) && value.length === 0)
        ? (context.locale?.required ?? zhCN.required)(context.label ?? context.name)
        : true,
  ],
  [
    'selectRequired',
    (value, _params, context) =>
      value === undefined || value === null
        ? (context.locale?.selectRequired ?? zhCN.selectRequired!)(context.label ?? context.name)
        : true,
  ],
]);
export const formSetup = shallowRef<
  Required<Pick<SchemaFormAdapterOptions, 'components' | 'config'>>
>({
  components: {},
  config: {
    baseModelPropName: 'modelValue',
    changeEventFallback: false,
    emptyStateValue: undefined,
  },
});

export function getFormRule(name: string): FormRuleValidator | undefined {
  return rules.get(name);
}

export function registerFormRules(next: Partial<Record<string, FormRuleValidator>>): void {
  for (const [name, rule] of Object.entries(next)) if (rule) rules.set(name, rule);
}

export function setupSchemaForm<T extends string = string>(
  options: SchemaFormAdapterOptions<T>,
): void {
  if (options.rules) registerFormRules(options.rules);
  // Reinitialisation replaces host controls and bindings, while registered rules accumulate as in Vben.
  formSetup.value = {
    components: { ...options.components },
    config: {
      baseModelPropName: 'modelValue',
      changeEventFallback: false,
      emptyStateValue: undefined,
      ...options.config,
      modelPropNameMap: { ...options.config?.modelPropNameMap },
    },
  };
}
