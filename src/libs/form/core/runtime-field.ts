import type { Engine } from '../internal/engine';
import type { FormRuntimeField } from '../types';
import type { PropType } from 'vue';

import { FieldApi } from '@tanstack/vue-form';
import { defineComponent, onBeforeUnmount, shallowRef, watch } from 'vue';

import { abortable, FormCancelledError } from '../internal/errors';

export type RuntimeValidator = (context: {
  value: unknown;
  fieldApi: FormRuntimeField;
}) => unknown | Promise<unknown>;
export interface RuntimeValidators {
  onChange?: RuntimeValidator;
  onChangeAsync?: RuntimeValidator;
  onBlur?: RuntimeValidator;
  onBlurAsync?: RuntimeValidator;
  onSubmit?: RuntimeValidator;
  onSubmitAsync?: RuntimeValidator;
  onDynamic?: RuntimeValidator;
  onDynamicAsync?: RuntimeValidator;
}
export interface CustomRuntimeField {
  validate: () => Promise<unknown>;
  clear: () => void;
  error: () => string | undefined;
}
export function createRuntimeFieldComponent(
  engine: Engine,
  register: (name: string, field?: CustomRuntimeField) => void,
) {
  return defineComponent({
    name: 'VbenRuntimeField',
    props: {
      name: { type: String, required: true },
      validators: { type: Object as PropType<RuntimeValidators>, default: () => ({}) },
      asyncDebounceMs: Number,
    },
    setup(props, { slots }) {
      const tick = shallowRef(0);
      let version = 0;
      let controller: AbortController | undefined;
      async function validate(
        trigger: 'Change' | 'Blur' | 'Submit' | 'Dynamic',
        value: unknown,
      ): Promise<string | undefined> {
        const current = ++version;
        controller?.abort();
        const token = new AbortController();
        controller = token;
        const context = { value, fieldApi: runtimeField };
        try {
          const syncResult = await abortable(
            Promise.resolve(props.validators[`on${trigger}`]?.(context)),
            token.signal,
          );
          const result =
            syncResult ||
            (await abortable(
              Promise.resolve(props.validators[`on${trigger}Async`]?.(context)),
              token.signal,
            ));
          if (current !== version || result === undefined || result === null || result === '')
            return;
          return typeof result === 'object' && 'message' in result
            ? String(result.message)
            : String(result);
        } catch (error) {
          if (!(error instanceof FormCancelledError)) throw error;
        }
      }
      const field = new FieldApi({
        form: engine,
        name: props.name,
        asyncDebounceMs: props.asyncDebounceMs,
        validators: {
          onChangeAsync: ({ value }) => validate('Change', value),
          onBlurAsync: ({ value }) => validate('Blur', value),
          onSubmitAsync: ({ value }) => validate('Submit', value),
          onDynamicAsync: ({ value }) => validate('Dynamic', value),
        },
      });
      const runtimeField: FormRuntimeField = {
        name: props.name,
        get state() {
          void tick.value;
          return field.state;
        },
        handleChange: (value) => field.handleChange(value),
        handleBlur: () => field.handleBlur(),
      };
      const cleanup = field.mount();
      const subscription = field.store.subscribe(() => tick.value++);
      const publicField: CustomRuntimeField = {
        validate: async () => {
          field.setMeta((meta) => ({ ...meta, isTouched: true }));
          return field.validate('submit');
        },
        clear: () => {
          version++;
          controller?.abort();
          field.setMeta((meta) => ({ ...meta, errorMap: {} }));
        },
        error: () => {
          void tick.value;
          const error = field.state.meta.errors[0];
          return error === undefined || error === null || error === '' ? undefined : String(error);
        },
      };
      register(props.name, publicField);
      watch(
        () => props.asyncDebounceMs,
        (asyncDebounceMs) => field.update({ ...field.options, asyncDebounceMs }),
      );
      onBeforeUnmount(() => {
        version++;
        controller?.abort();
        register(props.name);
        subscription.unsubscribe();
        cleanup();
      });
      return () => {
        void tick.value;
        return slots.default?.({ field: runtimeField });
      };
    },
  });
}
