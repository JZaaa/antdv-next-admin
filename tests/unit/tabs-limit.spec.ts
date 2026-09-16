import { createPinia, disposePinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRenderer, defineComponent, h, KeepAlive, nextTick, onUnmounted } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { DEFAULT_MAX_TAB_COUNT, useSettingsStore } from '@/stores/settings';
import { useTabsStore } from '@/stores/tabs';
import { getStorageKey } from '@/utils/cache';

vi.mock('@/router', () => ({ default: { replace: vi.fn() } }));

const routes = [
  { path: '/home', name: 'Home', meta: { affix: true } },
  ...['a', 'b', 'c', 'd'].map((name) => ({ path: `/${name}`, name, meta: {} })),
].map((route) => ({ ...route, component: { render: () => null } }));
const router = createRouter({ history: createMemoryHistory(), routes });
let pinia: ReturnType<typeof createPinia>;
let values: Map<string, string>;

beforeEach(() => {
  values = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  pinia = createPinia();
  setActivePinia(pinia);
});

afterEach(() => {
  disposePinia(pinia);
  vi.unstubAllGlobals();
});

function open(path: string): void {
  useTabsStore().addTab(router.resolve(path));
}

function paths(): string[] {
  return useTabsStore().tabs.map((tab) => tab.path);
}

interface TestNode {
  parent: TestNode | null;
  children: TestNode[];
}

function node(): TestNode {
  return { parent: null, children: [] };
}

function detach(child: TestNode): void {
  if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
  child.parent = null;
}

const renderer = createRenderer<TestNode, TestNode>({
  createElement: node,
  createText: node,
  createComment: node,
  setText: () => {},
  setElementText: () => {},
  patchProp: () => {},
  parentNode: (child) => child.parent,
  nextSibling: (child) => child.parent?.children[child.parent.children.indexOf(child) + 1] ?? null,
  insert: (child, parent, anchor) => {
    detach(child);
    child.parent = parent;
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, child);
  },
  remove: detach,
});

describe('tab limit settings', () => {
  it('defaults to ten and loads the saved limit before router restoration', () => {
    expect(useSettingsStore().maxTabCount).toBe(DEFAULT_MAX_TAB_COUNT);
    useSettingsStore().setMaxTabCount(3);
    expect(values.get(getStorageKey('app-max-tab-count'))).toBe('3');
    disposePinia(pinia);
    pinia = createPinia();
    setActivePinia(pinia);
    expect(useSettingsStore().maxTabCount).toBe(3);
  });

  it.each([
    ['invalid', 10],
    ['', 10],
    ['0', 1],
    ['-3', 1],
    ['5.9', 5],
    ['999', 50],
    ['Infinity', 10],
  ])('normalizes persisted value %s to %s', (saved, expected) => {
    values.set(getStorageKey('app-max-tab-count'), saved);
    expect(useSettingsStore().maxTabCount).toBe(expected);
  });

  it('ignores a temporarily empty number input', () => {
    const settings = useSettingsStore();
    settings.setMaxTabCount(5);
    settings.setMaxTabCount(null);
    expect(settings.maxTabCount).toBe(5);
  });
});

describe('bounded tabs and cache inclusion', () => {
  it('replaces the last ordinary tab regardless of visit order', () => {
    useSettingsStore().setMaxTabCount(2);
    open('/a');
    open('/b');
    open('/a?mode=edit');
    open('/b');
    open('/c');
    expect(paths()).toEqual(['/a', '/c']);
    expect(useTabsStore().tabs[0].fullPath).toBe('/a?mode=edit');
    expect(useTabsStore().activeTabPath).toBe('/c');
    expect(useTabsStore().cachedTabs).toEqual(['a', 'c']);
  });

  it('keeps affixed and pinned tabs outside the ordinary tab budget', () => {
    useSettingsStore().setMaxTabCount(1);
    open('/home');
    open('/a');
    useTabsStore().togglePinTab('/a');
    open('/b');
    open('/c');
    expect(paths()).toEqual(['/home', '/a', '/c']);
    expect(useTabsStore().maxCachedTabs).toBe(4);
  });

  it('replaces in place while skipping a pinned tab on the far right', () => {
    useSettingsStore().setMaxTabCount(2);
    open('/a');
    open('/b');
    useTabsStore().togglePinTab('/b');
    useSettingsStore().setMaxTabCount(1);
    open('/c');
    expect(paths()).toEqual(['/c', '/b']);
    expect(useTabsStore().activeTabPath).toBe('/c');
    open('/d');
    expect(paths()).toEqual(['/d', '/b']);
  });

  it('immediately trims on limit reduction while protecting the active tab', () => {
    open('/a');
    open('/b');
    open('/c');
    useTabsStore().setActiveTab('/a');
    useSettingsStore().setMaxTabCount(1);
    expect(paths()).toEqual(['/a']);
    expect(useTabsStore().cachedTabs).toEqual(['a']);
    expect(useTabsStore().activeTabPath).toBe('/a');
  });

  it('enforces the limit when a pinned tab becomes ordinary again', () => {
    useSettingsStore().setMaxTabCount(1);
    open('/a');
    useTabsStore().togglePinTab('/a');
    open('/b');
    useTabsStore().togglePinTab('/a');
    expect(paths()).toEqual(['/b']);
    expect(useTabsStore().maxCachedTabs).toBe(2);
  });

  it('unmounts the replaced cached page without destroying a retained page', async () => {
    useSettingsStore().setMaxTabCount(2);
    const store = useTabsStore();
    const unmounted: string[] = [];
    const pages = Object.fromEntries(
      ['a', 'b', 'c'].map((name) => [
        name,
        defineComponent({
          name,
          setup() {
            onUnmounted(() => unmounted.push(name));
            return () => h('div', name);
          },
        }),
      ]),
    );
    open('/a');
    const app = renderer.createApp({
      setup: () => () =>
        h(
          KeepAlive,
          { include: store.cachedTabs, max: store.maxCachedTabs },
          {
            default: () => h(pages[store.activeTab!.name], { key: store.activeTabPath }),
          },
        ),
    });
    app.mount(node());
    try {
      open('/b');
      await nextTick();
      expect(unmounted).toEqual([]);
      open('/c');
      await nextTick();
      expect(paths()).toEqual(['/a', '/c']);
      expect(unmounted).toEqual(['b']);
      useSettingsStore().setMaxTabCount(1);
      await nextTick();
      expect(unmounted).toEqual(['b', 'a']);
    } finally {
      app.unmount();
    }
  });

  it('trims old persisted sessions from the right and saves only retained tabs', async () => {
    values.set(getStorageKey('app-max-tab-count'), '2');
    values.set(
      getStorageKey('app-tabs-state'),
      JSON.stringify({
        tabs: routes.map((route) => ({
          id: route.path,
          path: route.path,
          fullPath: route.path,
          name: route.name,
          affix: Boolean(route.meta.affix),
          closable: !route.meta.affix,
        })),
        activeTabPath: '/a',
      }),
    );
    const store = useTabsStore();
    store.restoreTabsState(routes);
    expect(paths()).toEqual(['/home', '/a', '/b']);
    expect(store.activeTabPath).toBe('/a');
    expect(store.cachedTabs).toEqual(['Home', 'a', 'b']);
    await nextTick();
    const saved = JSON.parse(values.get(getStorageKey('app-tabs-state'))!);
    expect(saved.tabs.map((tab: { path: string }) => tab.path)).toEqual(paths());
  });

  it('supports legacy saved tabs and continued navigation after reset', () => {
    values.set(getStorageKey('app-max-tab-count'), '1');
    values.set(
      getStorageKey('app-tabs-state'),
      JSON.stringify({
        tabs: ['a', 'b'].map((name) => ({
          id: `/${name}`,
          path: `/${name}`,
          fullPath: `/${name}`,
          name,
          closable: true,
        })),
        activeTabPath: '/a',
      }),
    );
    const store = useTabsStore();
    store.restoreTabsState(routes);
    expect(paths()).toEqual(['/a']);
    store.resetTabs();
    open('/b');
    open('/c');
    expect(paths()).toEqual(['/c']);
  });
});
