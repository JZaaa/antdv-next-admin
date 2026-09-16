import type { FormApi } from '../../libs/form';
import type { ExperimentReport, ExperimentResult } from './experiments';

import { Form, FormItem, Input } from 'antdv-next';
/* eslint-disable no-await-in-loop -- Alternate production fixtures and event samples sequentially. */
import { createApp, defineComponent, h, nextTick, reactive } from 'vue';

import { useSchemaForm } from '../../libs/form';

declare const FORM_LAB_VERSIONS: Record<string, string>;
function frame(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}
function percentile(samples: number[], fraction: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}
export async function runSchemaPerformance(
  host: HTMLElement,
  onResult: (result: ExperimentResult) => void,
): Promise<ExperimentReport> {
  const results: ExperimentResult[] = [];
  for (const count of [100, 300]) {
    for (let round = 0; round < 3; round++) {
      for (const kind of round % 2 ? ['schema', 'native'] : ['native', 'schema']) {
        const element = document.createElement('section');
        host.append(element);
        let api: FormApi<Record<string, unknown>> | undefined;
        const values = reactive<Record<string, string>>(
          Object.fromEntries(Array.from({ length: count }, (_, i) => [`field${i}`, ''])),
        );
        const app = createApp(
          defineComponent({
            setup() {
              if (kind === 'schema') {
                const [Component, formApi] = useSchemaForm<Record<string, unknown>>({
                  schema: Object.keys(values).map((fieldName) => ({
                    fieldName,
                    label: fieldName,
                    component: 'Input',
                    defaultValue: '',
                  })),
                  showDefaultActions: false,
                });
                api = formApi;
                return () => h(Component);
              }
              const fields = Object.keys(values).map((name) =>
                defineComponent({
                  setup() {
                    return () =>
                      h('div', { class: 'schema-form-field' }, [
                        h(
                          FormItem,
                          { name, label: name },
                          {
                            default: () =>
                              h(Input, {
                                value: values[name],
                                'onUpdate:value': (value: string) => {
                                  values[name] = value;
                                },
                              }),
                          },
                        ),
                      ]);
                  },
                }),
              );
              return () =>
                h('div', { class: 'schema-form' }, [
                  h(
                    Form,
                    { model: values, layout: 'vertical' },
                    {
                      default: () =>
                        h(
                          'div',
                          { class: 'schema-form-grid' },
                          fields.map((component, key) => h(component, { key })),
                        ),
                    },
                  ),
                ]);
            },
          }),
        );
        const start = performance.now();
        app.mount(element);
        await nextTick();
        const mountMs = performance.now() - start;
        host.scrollIntoView({ block: 'start' });
        host.scrollTop = 0;
        const input = element.querySelector('input')!;
        async function update(value: string): Promise<void> {
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          await nextTick();
        }
        try {
          for (let i = 0; i < 5; i++) await update(`warmup-${i}`);
          await frame();
          const tickSamples: number[] = [];
          const frameSamples: number[] = [];
          for (let i = 0; i < 30; i++) {
            const before = performance.now();
            await update(`sample-${i}`);
            tickSamples.push(performance.now() - before);
            await frame();
            frameSamples.push(performance.now() - before);
          }
          const patch = Object.fromEntries(Object.keys(values).map((name) => [name, 'bulk']));
          const bulkStart = performance.now();
          if (api) await api.setValues(patch);
          else Object.assign(values, patch);
          await nextTick();
          const bulkMs = performance.now() - bulkStart;
          const resetStart = performance.now();
          if (api) await api.reset();
          else
            Object.assign(
              values,
              Object.fromEntries(Object.keys(values).map((name) => [name, ''])),
            );
          await nextTick();
          const resetMs = performance.now() - resetStart;
          const result: ExperimentResult = {
            id: `schema-performance-${kind}-${count}-${round + 1}`,
            title: `${kind} / ${count} 字段 / 第 ${round + 1} 轮`,
            expected: '同一 Chrome、同一 Input/布局、无规则、5 次预热 + 30 次输入；三轮交错采样',
            status: 'pass',
            observed: {
              kind,
              fields: count,
              round: round + 1,
              samples: tickSamples.length,
              mountMs,
              bulkMs,
              resetMs,
              dispatchToNextTickMs: {
                p50: percentile(tickSamples, 0.5),
                p95: percentile(tickSamples, 0.95),
              },
              dispatchToTwoAnimationFramesMs: {
                p50: percentile(frameSamples, 0.5),
                p95: percentile(frameSamples, 0.95),
              },
              tickSamples,
              frameSamples,
              domNodes: element.querySelectorAll('*').length,
              scope:
                'Headless production; two animation frames is a rendering opportunity bound, not physical display latency. Bulk/reset contracts differ (SchemaForm also isolates snapshots and cancels sessions).',
            },
          };
          results.push(result);
          onResult(result);
        } finally {
          app.unmount();
          element.remove();
        }
      }
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    versions: FORM_LAB_VERSIONS,
    mode: import.meta.env.MODE,
    results,
  };
}
