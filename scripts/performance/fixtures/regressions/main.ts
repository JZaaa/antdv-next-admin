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
      const searchHeight = ref(60);
      const [Fill, fill] = useVxeGrid({
        formOptions: {},
        gridOptions: {
          height: 'auto',
          columns: [{ field: 'name', title: 'Name' }],
          data: Array.from({ length: 80 }, (_, index) => ({ name: 'row ' + index })),
        },
      });
      const fillRect = (selector: string): DOMRect => {
        const element = document.querySelector<HTMLElement>('#height-regression ' + selector);
        if (!element) throw new Error('Height fixture missing: ' + selector);
        return element.getBoundingClientRect();
      };
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
        [...document.querySelectorAll('.regression-grid .vxe-table--body')].map(
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
          assert(
            resized[2] === initial[2],
            'autoResize:false must not observe internal resizes: ' +
              JSON.stringify({ initial, resized }),
          );
          await optimized.grid?.recalculate(true);
          assert(widths()[1] === resized[1], 'Automatic layout differs from explicit recalculate');
          asideWidth.value = 50;
          await nextTick();
          await sleep(800);
          assert(widths()[1] === initial[1], 'Table did not grow back after the aside shrank');

          assert(Math.abs(fillRect('.schema-grid').height - 500) < 1, 'auto must fill the parent');
          const initialTableHeight = fillRect('.vxe-table').height;
          searchHeight.value = 120;
          await nextTick();
          await sleep(700);
          assert(
            Math.abs(initialTableHeight - fillRect('.vxe-table').height - 60) < 2,
            'Search height changes must resize only the table viewport',
          );
          fill.toggleSearchForm(false);
          await sleep(700);
          assert(
            fillRect('.vxe-table').height > initialTableHeight,
            'Hidden search must release height',
          );
          fill.toggleSearchForm(true);
          searchHeight.value = 60;
          await sleep(700);
          assert(
            Math.abs(fillRect('.vxe-table').height - initialTableHeight) < 2,
            'Search height must restore',
          );
          fill.setGridOptions({ height: '100%' });
          await sleep(700);
          assert(Math.abs(fillRect('.schema-grid').height - 500) < 1, '100% must fill the parent');
          fill.setGridOptions({ height: 260 });
          await sleep(700);
          assert(fillRect('.schema-grid').height < 500, 'Fixed height must leave fill mode');
          assert(fillRect('.vxe-table').height > 0, 'Fixed-height table must remain visible');
          fill.setGridOptions({ height: 'auto' });
          await sleep(700);
          assert(
            Math.abs(fillRect('.schema-grid').height - 500) < 1,
            'Dynamic auto height must restore',
          );

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
              'auto-and-percent-height',
              'search-height-and-visibility',
              'fixed-height-and-restore',
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
          h('div', { id: 'height-regression', style: { height: '500px', width: '700px' } }, [
            h(
              Fill,
              {},
              { form: () => h('div', { style: { height: searchHeight.value + 'px' } }, 'Search') },
            ),
          ]),
          showForm.value ? h(Form) : null,
          h('style', '.regression-grid {height:550px;width:400px;box-sizing:border-box;}'),
        ]);
    },
  }),
).mount('#app');
