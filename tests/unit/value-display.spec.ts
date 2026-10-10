import type { ValueDisplayProps } from '@/components/ValueDisplay/types';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRenderer, defineComponent, h, nextTick, reactive } from 'vue';

import ProDescriptions from '@/components/Pro/ProDescriptions/index.vue';
import ValueDisplay from '@/components/ValueDisplay/index.vue';

const { copy, success, error } = vi.hoisted(() => ({
  copy: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@/locales', () => ({ $t: (key: string) => key }));
vi.mock('@/utils/helpers', () => ({ copyToClipboard: copy }));
vi.mock('@antdv-next/icons', () => ({ CopyOutlined: 'copy-icon' }));
vi.mock('antdv-next', () => ({
  Avatar: 'avatar',
  Badge: 'badge',
  Image: 'image',
  Progress: 'progress',
  Tag: 'tag',
  message: { success, error },
}));

interface TestNode {
  type: string;
  text: string;
  parent: TestNode | null;
  children: TestNode[];
  props: Record<string, unknown>;
}
function node(type: string, text = ''): TestNode {
  return { type, text, parent: null, children: [], props: {} };
}
const renderer = createRenderer<TestNode, TestNode>({
  createElement: node,
  createText: (text) => node('#text', text),
  createComment: () => node('#comment'),
  setText: (el, text) => {
    el.text = text;
  },
  setElementText: (el, text) => {
    el.text = text;
    el.children = [];
  },
  parentNode: (el) => el.parent,
  nextSibling: (el) => el.parent?.children[el.parent.children.indexOf(el) + 1] ?? null,
  patchProp: (el, key, _previous, value) => {
    el.props[key] = value;
  },
  insert: (el, parent, anchor) => {
    if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1);
    el.parent = parent;
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    if (index < 0) parent.children.push(el);
    else parent.children.splice(index, 0, el);
  },
  remove: (el) => {
    if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1);
    el.parent = null;
  },
});
function find(root: TestNode, type: string): TestNode | undefined {
  if (root.type === type) return root;
  for (const child of root.children) {
    const match = find(child, type);
    if (match) return match;
  }
  return undefined;
}
function text(root: TestNode): string {
  return root.text + root.children.map(text).join('');
}
const cleanup: (() => void)[] = [];
function mount(props: ValueDisplayProps) {
  const state = reactive(props);
  const onCopy = vi.fn();
  const onCopyError = vi.fn();
  const app = renderer.createApp({
    render: () => h(ValueDisplay, { ...state, onCopy, onCopyError }),
  });
  const root = node('root');
  app.mount(root);
  cleanup.push(() => app.unmount());
  return { root, state, onCopy, onCopyError };
}
async function click(root: TestNode): Promise<void> {
  const handler = find(root, 'button')?.props.onClick;
  if (typeof handler !== 'function') throw new Error('Copy button not rendered');
  await handler({ stopPropagation: vi.fn() });
  await nextTick();
}
beforeEach(() => {
  vi.clearAllMocks();
  copy.mockResolvedValue(true);
});
afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose());
});

describe('ValueDisplay component', () => {
  it.each([0, false])('copies %s and exposes an accessible button', async (value) => {
    const { root, onCopy } = mount({ value, copyable: true });
    expect(text(root)).toBe(String(value));
    expect(find(root, 'button')?.props['aria-label']).toBe('common.copy');
    await click(root);
    expect(copy).toHaveBeenCalledExactlyOnceWith(String(value));
    expect(onCopy).toHaveBeenCalledExactlyOnceWith(String(value));
    expect(success).toHaveBeenCalledOnce();
  });

  it('updates display and copy mode reactively, and omits copy for missing values', async () => {
    const { root, state } = mount({
      value: 1234.5,
      type: 'money',
      copyable: true,
      copyMode: 'display',
    });
    expect(text(root)).toBe('¥1,234.50');
    await click(root);
    expect(copy).toHaveBeenLastCalledWith('¥1,234.50');
    state.copyMode = 'raw';
    state.value = 0;
    await nextTick();
    await click(root);
    expect(copy).toHaveBeenLastCalledWith('0');
    state.value = null;
    state.emptyText = 'N/A';
    await nextTick();
    expect(text(root)).toBe('N/A');
    expect(find(root, 'button')).toBeUndefined();
  });

  it.each(['false', 'reject'])('reports %s copy failures and allows retry', async (mode) => {
    if (mode === 'reject') copy.mockRejectedValueOnce(new Error('Clipboard denied'));
    else copy.mockResolvedValueOnce(false);
    const { root, onCopy, onCopyError } = mount({ value: 'hello', copyable: true });
    await click(root);
    expect(error).toHaveBeenCalledExactlyOnceWith('common.copyFailed');
    expect(success).not.toHaveBeenCalled();
    expect(onCopyError).toHaveBeenCalledOnce();
    expect(find(root, 'button')?.props.disabled).toBe(false);
    await click(root);
    expect(onCopy).toHaveBeenCalledExactlyOnceWith('hello');
  });

  it('suppresses duplicate copies while the clipboard is pending', async () => {
    let finish!: (value: boolean) => void;
    copy.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const { root } = mount({ value: 0, copyable: true });
    const pending = click(root);
    await nextTick();
    expect(find(root, 'button')?.props.disabled).toBe(true);
    await click(root);
    expect(copy).toHaveBeenCalledOnce();
    finish(true);
    await pending;
    expect(find(root, 'button')?.props.disabled).toBe(false);
  });

  it('renders badges, bounded progress, and safe external links', async () => {
    const { root, state } = mount({
      value: false,
      type: 'badge',
      valueEnum: { false: { text: 'Disabled', status: 'default' } },
    });
    expect(find(root, 'badge')?.props).toMatchObject({ text: 'Disabled', status: 'default' });
    state.type = 'progress';
    state.value = 120;
    await nextTick();
    expect(find(root, 'progress')?.props).toMatchObject({ percent: 100, status: 'success' });
    state.type = 'link';
    state.value = 'https://example.com';
    await nextTick();
    expect(find(root, 'a')?.props).toMatchObject({
      href: 'https://example.com',
      rel: 'noopener noreferrer',
    });
    state.value = 'javascript:alert(1)';
    await nextTick();
    expect(find(root, 'a')).toBeUndefined();
  });

  it('preserves ProDescriptions nested fields, custom render priority, and plain-field copy', async () => {
    const app = renderer.createApp({
      render: () =>
        h(ProDescriptions, {
          data: { detail: { amount: 0 }, enabled: false },
          columns: [
            { label: 'Amount', dataIndex: 'detail.amount', valueType: 'money' },
            { label: 'Enabled', dataIndex: 'enabled', copyable: true },
            { label: 'Missing', dataIndex: 'detail.missing' },
            {
              label: 'Custom',
              dataIndex: 'enabled',
              valueType: 'text',
              render: () => h('strong', 'Custom output'),
            },
          ],
        }),
    });
    const container = defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h('section', slots.default?.()),
    });
    app.component('ADescriptions', container);
    app.component('ADescriptionsItem', container);
    const root = node('root');
    app.mount(root);
    cleanup.push(() => app.unmount());
    expect(text(root)).toBe('¥0.00false—Custom output');
    await click(root);
    expect(copy).toHaveBeenCalledExactlyOnceWith('false');
  });
});
