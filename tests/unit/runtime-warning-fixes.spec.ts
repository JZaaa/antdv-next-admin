import {
  useFormItemContext,
  useFormItemInputContext,
  useFormItemInputContextProvider,
  useFormItemProvider,
} from 'antdv-next/dist/form/context';
import { describe, expect, it, vi } from 'vitest';
import { createRenderer, defineComponent, h, KeepAlive, nextTick, ref } from 'vue';
import { createI18n } from 'vue-i18n';

import FormItemRest from '@/components/IconPicker/FormItemRest.vue';
import en from '@/locales/en-US';
import ja from '@/locales/ja-JP';
import ko from '@/locales/ko-KR';
import zh from '@/locales/zh-CN';
import CachePanel from '@/views/examples/scaffold/state-cache/CachePanel.vue';

interface TestNode {
  type: string;
  parent: TestNode | null;
  children: TestNode[];
  props: Record<string, unknown>;
}

function node(type: string): TestNode {
  return { type, parent: null, children: [], props: {} };
}

function detach(child: TestNode): void {
  if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
  child.parent = null;
}

const renderer = createRenderer<TestNode, TestNode>({
  createElement: node,
  createText: () => node('#text'),
  createComment: () => node('#comment'),
  setText: () => {},
  setElementText: () => {},
  parentNode: (child) => child.parent,
  nextSibling: (child) => child.parent?.children[child.parent.children.indexOf(child) + 1] ?? null,
  patchProp: (child, key, _previous, value) => {
    child.props[key] = value;
  },
  insert: (child, parent, anchor) => {
    detach(child);
    child.parent = parent;
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, child);
  },
  remove: detach,
});

function find(root: TestNode, type: string): TestNode {
  if (root.type === type) return root;
  for (const child of root.children) {
    try {
      return find(child, type);
    } catch {
      /* Search the remaining siblings. */
    }
  }
  throw new Error(`Missing ${type}`);
}

function update(control: TestNode, prop: string, value: unknown): void {
  const handler = control.props[`onUpdate:${prop}`];
  if (typeof handler !== 'function') throw new Error(`Missing update handler for ${prop}`);
  handler(value);
}

describe('runtime warning fixes', () => {
  it('keeps panel A and panel B state independently without runtime template compilation', async () => {
    const active = ref<'panelA' | 'panelB'>('panelA');
    const app = renderer.createApp({
      setup: () => () =>
        h(KeepAlive, null, {
          default: () => h(CachePanel, { key: active.value, panel: active.value }),
        }),
    });
    for (const name of ['AInput', 'AButton', 'ASpace', 'ASwitch', 'ATextarea']) {
      app.component(
        name,
        defineComponent({
          setup:
            (_props, { attrs, slots }) =>
            () =>
              h(name, attrs, slots.default?.()),
        }),
      );
    }
    const warn = vi.fn();
    app.config.warnHandler = warn;
    app.use(createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zh } }));
    const root = node('root');
    app.mount(root);
    try {
      update(find(root, 'AInput'), 'value', 'panel A value');
      await nextTick();
      active.value = 'panelB';
      await nextTick();
      update(find(root, 'ATextarea'), 'value', 'panel B value');
      update(find(root, 'ASwitch'), 'checked', true);
      await nextTick();
      active.value = 'panelA';
      await nextTick();
      expect(find(root, 'AInput').props.value).toBe('panel A value');
      active.value = 'panelB';
      await nextTick();
      expect(find(root, 'ATextarea').props.value).toBe('panel B value');
      expect(find(root, 'ASwitch').props.checked).toBe(true);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      app.unmount();
    }
  });

  it('isolates picker controls while preserving the enclosing field context for siblings', () => {
    const triggerChange = vi.fn();
    const triggerBlur = vi.fn();
    const contexts: Array<ReturnType<typeof useFormItemContext>> = [];
    const statuses: Array<ReturnType<typeof useFormItemInputContext>['value']> = [];
    const Probe = defineComponent({
      setup() {
        const context = useFormItemContext();
        contexts.push(context);
        statuses.push(useFormItemInputContext().value);
        context?.triggerChange();
        context?.triggerBlur();
        return () => null;
      },
    });
    const app = renderer.createApp({
      setup() {
        useFormItemProvider({
          fieldId: ref('icon'),
          triggerChange,
          triggerBlur,
          triggerFocus: vi.fn(),
          clearValidate: vi.fn(),
        });
        useFormItemInputContextProvider(ref({ status: 'error', isFormItemInput: true }));
        return () => h('div', [h(FormItemRest, null, { default: () => h(Probe) }), h(Probe)]);
      },
    });
    const warn = vi.fn();
    app.config.warnHandler = warn;
    app.mount(node('root'));
    try {
      expect(contexts[0]?.fieldId.value).toBeUndefined();
      expect(statuses[0]?.status).toBeUndefined();
      expect(contexts[1]?.fieldId.value).toBe('icon');
      expect(statuses[1]?.status).toBe('error');
      expect(triggerChange).toHaveBeenCalledTimes(1);
      expect(triggerBlur).toHaveBeenCalledTimes(1);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      app.unmount();
    }
  });

  it.each([
    ['zh-CN', zh],
    ['en-US', en],
    ['ja-JP', ja],
    ['ko-KR', ko],
  ] as const)(
    'renders the SVG example as interpolated text without HTML message warnings in %s',
    (locale, messages) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const i18n = createI18n({ legacy: false, locale, messages: { [locale]: messages } });
        expect(
          i18n.global.t('exampleIcon.guideStepSvg1', { symbol: '<symbol id="...">' }),
        ).toContain('<symbol id="...">');
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    },
  );
});
