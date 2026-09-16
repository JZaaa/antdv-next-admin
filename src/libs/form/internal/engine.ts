import { FieldApi, FormApi } from '@tanstack/vue-form';

export function createEngine(defaultValues: Record<string, unknown> = {}) {
  return new FormApi({ defaultValues });
}
export type Engine = ReturnType<typeof createEngine>;
export function createEngineField(
  form: Engine,
  name: string,
  validate: () => Promise<string[] | undefined>,
) {
  return new FieldApi({ form, name, validators: { onChangeAsync: validate } });
}
export type EngineField = ReturnType<typeof createEngineField>;
