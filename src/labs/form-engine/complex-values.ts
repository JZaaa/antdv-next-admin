import { FormApi } from '@tanstack/vue-form';
import dayjs from 'dayjs';

import { snapshotFormValue } from './snapshot';

// A model-boundary experiment, not acceptance of DatePicker/Upload controls.
export async function inspectComplexValues(): Promise<{ pass: boolean; observed: unknown }> {
  const file = Object.assign(
    new File(['hello'], 'sample.txt', {
      type: 'text/plain',
      lastModified: 123,
    }),
    { uid: 'upload-1', metadata: { source: 'original' } },
  );
  const initial = {
    rows: [{ label: 'initial', flags: [false, true] }],
    date: new Date('2026-01-01T00:00:00Z'),
    day: dayjs('2026-01-01'),
    upload: { file, status: 'done' },
    nullable: null,
    unset: undefined,
    zero: 0,
  };
  type Values = typeof initial;
  const baseline = snapshotFormValue(initial);
  let submitted: Values | undefined;
  let validated = false;
  const form = new FormApi({
    defaultValues: snapshotFormValue(baseline),
    validators: {
      onSubmitAsync: async ({ value }) => {
        validated =
          value.rows[0]?.label === 'initial' &&
          dayjs.isDayjs(value.day) &&
          value.upload.file instanceof File &&
          value.nullable === null &&
          value.zero === 0 &&
          value.rows[0]?.flags[0] === false;
        return validated ? undefined : 'complex validation failed';
      },
    },
    onSubmit: async ({ value }) => {
      submitted = snapshotFormValue(value);
    },
  });
  const cleanup = form.mount();
  try {
    initial.rows[0]!.label = 'external mutation';
    initial.upload.file.metadata.source = 'external mutation';
    await form.handleSubmit();
    const payload = submitted;
    if (!payload) return { pass: false, observed: { validated, submitted: false } };
    payload.rows[0]!.label = 'consumer mutation';
    payload.date.setUTCFullYear(2030);
    payload.upload.file.metadata.source = 'consumer mutation';
    const isolated =
      form.state.values.rows[0]?.label === 'initial' &&
      form.state.values.date.getUTCFullYear() === 2026 &&
      form.state.values.upload.file.metadata.source === 'original';
    const replacement = snapshotFormValue(baseline);
    replacement.rows[0]!.label = 'replacement';
    form.reset(snapshotFormValue(replacement));
    replacement.rows[0]!.label = 'caller mutation after reset';
    const resetIsolated = form.state.values.rows[0]?.label === 'replacement';
    form.reset(snapshotFormValue(baseline));
    const bytes = await payload.upload.file.text();
    const pass =
      validated &&
      isolated &&
      resetIsolated &&
      bytes === 'hello' &&
      payload.upload.file.uid === 'upload-1' &&
      payload.upload.file.lastModified === 123 &&
      Object.hasOwn(payload, 'unset') &&
      form.state.values.rows[0]?.label === 'initial' &&
      payload.day.format('YYYY-MM-DD') === '2026-01-01';
    return {
      pass,
      observed: {
        validated,
        isolated,
        resetIsolated,
        bytes,
        fileUid: payload.upload.file.uid,
        day: payload.day.format('YYYY-MM-DD'),
        resetLabel: form.state.values.rows[0]?.label,
        scope: 'TanStack model + snapshot boundary; DatePicker/Upload UI not mounted',
      },
    };
  } finally {
    cleanup();
  }
}
