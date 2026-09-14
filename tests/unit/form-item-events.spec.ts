import type { ProFormItem } from '@/types/pro';

import { describe, expect, it, vi } from 'vitest';
import { createRenderer, defineComponent, h, nextTick, ref } from 'vue';

import FormItemRender from '@/components/Pro/ProForm/FormItemRender.vue';

vi.mock('@/locales', () => ({ $t: (key: string) => key }));
vi.mock('antdv-next', () => ({ TreeSelect: {} }));
vi.mock('@/components/Pro/ProUpload/index.vue', () => ({ default: {} }));

interface TestNode {
  type: string;
  parent: TestNode | null;
  children: TestNode[];
  props: Record<string, unknown>;
}

function createNode(type: string): TestNode {
  return { type, parent: null, children: [], props: {} };
}

// Exercise Vue's real prop merging and reactive updates without requiring a browser DOM.
const renderer = createRenderer<TestNode, TestNode>({
  createElement: createNode,
  createText: () => createNode('#text'),
  createComment: () => createNode('#comment'),
  setText: () => {},
  setElementText: () => {},
  parentNode: (node) => node.parent,
  nextSibling: (node) => node.parent?.children[node.parent.children.indexOf(node) + 1] ?? null,
  patchProp: (node, key, _previous, value) => {
    node.props[key] = value;
  },
  insert: (node, parent, anchor) => {
    node.parent = parent;
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    if (index < 0) parent.children.push(node);
    else parent.children.splice(index, 0, node);
  },
  remove: (node) => {
    if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1);
    node.parent = null;
  },
});

const Control = defineComponent({
  inheritAttrs: false,
  props: {
    value: null,
    checked: null,
    'onUpdate:value': Function,
    'onUpdate:checked': Function,
  },
  setup(props) {
    return () => h('control', { ...props });
  },
});

describe('ProForm control update events', () => {
  it.each(['checkbox', 'input', 'switch'] as const)(
    '%s receives a single callback and emits once without echoing parent resets',
    async (type) => {
      const externalUpdate = vi.fn();
      const onUpdate = vi.fn();
      const onChange = vi.fn();
      const warn = vi.fn();
      const parentValue = ref<unknown>(undefined);
      const event = type === 'switch' ? 'onUpdate:checked' : 'onUpdate:value';
      const valueProp = type === 'switch' ? 'checked' : 'value';
      const initial = type === 'checkbox' ? [] : type === 'switch' ? false : '';
      const updated = type === 'checkbox' ? ['a'] : type === 'switch' ? true : 'hello';
      const item: ProFormItem = {
        name: 'field',
        type,
        initialValue: initial,
        props: { [event]: externalUpdate },
      };
      const app = renderer.createApp({
        setup: () => () =>
          h(FormItemRender, {
            item,
            value: parentValue.value,
            'onUpdate:value': onUpdate,
            onChange,
          }),
      });
      for (const name of ['ACheckboxGroup', 'AInput', 'ASwitch']) app.component(name, Control);
      app.config.warnHandler = warn;
      const root = createNode('root');
      app.mount(root);
      try {
        const control = root.children[0].children.find((node) => node.type === 'control');
        if (!control) throw new Error('Control did not render');
        expect(control.props[valueProp]).toEqual(initial);
        const handler = control.props[event];
        expect(typeof handler).toBe('function');
        if (typeof handler !== 'function') throw new Error('Update callback must be a function');
        handler(updated);
        await nextTick();
        expect(control.props[valueProp]).toEqual(updated);
        expect(onUpdate).toHaveBeenCalledExactlyOnceWith(updated);
        expect(onChange).toHaveBeenCalledExactlyOnceWith(updated);
        expect(externalUpdate).toHaveBeenCalledExactlyOnceWith(updated);

        parentValue.value = initial;
        await nextTick();
        expect(control.props[valueProp]).toEqual(initial);
        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(externalUpdate).toHaveBeenCalledTimes(1);
        expect(
          warn.mock.calls.filter(([message]) => String(message).includes('Invalid prop')),
        ).toEqual([]);
      } finally {
        app.unmount();
      }
    },
  );
});
