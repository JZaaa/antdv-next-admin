import { createApp, defineComponent, h, nextTick, ref } from 'vue';

import { useSchemaForm } from '../../../../src/libs/form/useSchemaForm';
import { useVxeGrid } from '../../../../src/libs/table/useVxeGrid';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

createApp(
  defineComponent({
    setup() {
      const asideWidth = ref(50);
      const showForm = ref(true);
      let resetCalls = 0;
      const makeGrid = (resizeDelayMs: number, autoResize = true) =>
        useVxeGrid({
          resizeDelayMs,
          gridOptions: {
            autoResize,
            height: 'auto',
            columns: [{ field: 'name', title: 'Name' }],
            data: Array.from({ length: 80 }, (_, index) => ({ name: `row ${index}` })),
          },
        });
      const [Native] = makeGrid(0);
      const [Optimized, optimized] = makeGrid(100);
      const [Disabled] = makeGrid(100, false);
      const [Form, api] = useSchemaForm({
        schema: [{ fieldName: 'name', component: 'Input', defaultValue: 'default' }],
        handleReset: async () => {
          resetCalls++;
          await api.reset();
        },
      });
      const slots = {
        left: () => h('div', { style: { width: `${asideWidth.value}px` } }, 'Aside'),
      };
      const widths = (): number[] =>
        [...document.querySelectorAll('.vxe-table--body')].map(
          (element) => element.getBoundingClientRect().width,
        );
      const resetButton = (): HTMLButtonElement => {
        const button = document.querySelector<HTMLButtonElement>('.vben-form button[type=button]');
        if (!button) throw new Error('Reset button missing');
        return button;
      };
      Object.assign(window, {
        async runRegressions() {
          await sleep(700);
          const initial = widths();
          asideWidth.value = 180;
          await nextTick();
          await sleep(800);
          const resized = widths();
          assert(initial.length === 3 && resized[0]! < initial[0]!, 'Native resize control failed');
          assert(resized[1] === resized[0], 'Coalesced observer missed an internal table resize');
          assert(resized[2] === initial[2], 'autoResize:false must not observe internal resizes');
          await optimized.grid?.recalculate(true);
          assert(widths()[1] === resized[1], 'Automatic layout differs from explicit recalculate');
          asideWidth.value = 50;
          await nextTick();
          await sleep(800);
          assert(widths()[1] === initial[1], 'Table did not grow back after the aside shrank');

          // Both slow reopening and reopening before feedback finishes must discard
          // the old click while preserving newly populated form values.
          for (const reopenDelay of [180, 0]) {
            resetButton().click();
            showForm.value = false;
            await nextTick();
            if (reopenDelay) await sleep(reopenDelay);
            showForm.value = true;
            await nextTick();
            await api.setFieldValue('name', 'new record');
            await sleep(180);
            assert(resetCalls === 0, `Old reset ran after reopening (${reopenDelay}ms)`);
            assert((await api.getValues()).name === 'new record', 'Old reset cleared new record');
          }
          resetButton().click();
          resetButton().click();
          await sleep(180);
          assert(resetCalls === 1, 'Normal reset must run exactly once despite repeated clicks');
          assert(
            (await api.getValues()).name === 'default',
            'Normal reset did not restore defaults',
          );
          return {
            success: true,
            initialWidths: initial,
            resizedWidths: resized,
            checks: [
              'internal-resize',
              'resize-disabled',
              'resize-restored',
              'slow-remount',
              'fast-remount',
              'reset-single-flight',
              'normal-reset',
            ],
          };
        },
      });
      return () =>
        h('div', [
          h('div', { style: { display: 'flex', gap: '12px' } }, [
            h(Native, { class: 'regression-grid' }, slots),
            h(Optimized, { class: 'regression-grid' }, slots),
            h(Disabled, { class: 'regression-grid' }, slots),
          ]),
          showForm.value ? h(Form) : null,
          h('style', '.regression-grid {height:550px;width:400px;box-sizing:border-box;}'),
        ]);
    },
  }),
).mount('#app');
