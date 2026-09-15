import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRenderer, nextTick } from 'vue';

import Login from '@/views/login/index.vue';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  replace: vi.fn(),
  resolve: vi.fn(),
  error: vi.fn(),
  route: { query: {} as Record<string, string | string[]> },
}));
vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: mocks.replace, resolve: mocks.resolve }),
  useRoute: () => mocks.route,
}));
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ login: mocks.login }) }));
vi.mock('@/stores/settings', () => ({ useSettingsStore: () => ({ showLanguageSwitch: false }) }));
vi.mock('@/utils/session', () => ({ clearSessionState: vi.fn() }));
vi.mock('@/locales', () => ({ $t: (key: string) => key }));
vi.mock('antdv-next', () => ({ message: { error: mocks.error } }));
vi.mock('@antdv-next/icons', () => ({
  CheckCircleOutlined: {},
  LockOutlined: {},
  UserOutlined: {},
}));
vi.mock('@/components/Layout/LanguageSwitch.vue', () => ({ default: {} }));
vi.mock('@/components/Layout/ThemeToggle.vue', () => ({ default: {} }));
vi.mock('@/components/Captcha', () => ({
  SliderCaptcha: { template: '<captcha-control />', methods: { reset() {} } },
}));

interface TestNode {
  type: string;
  text: string;
  parent: TestNode | null;
  children: TestNode[];
  props: Record<string, unknown>;
}
const node = (type: string): TestNode => ({
  type,
  text: '',
  parent: null,
  children: [],
  props: {},
});
const renderer = createRenderer<TestNode, TestNode>({
  insertStaticContent: (html, parent, anchor) => {
    const element = { ...node('#static'), text: html, parent };
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    if (index < 0) parent.children.push(element);
    else parent.children.splice(index, 0, element);
    return [element, element];
  },
  createElement: node,
  createText: (text) => ({ ...node('#text'), text }),
  createComment: () => node('#comment'),
  setText: (element, text) => {
    element.text = text;
  },
  setElementText: (element, text) => {
    element.text = text;
    element.children = [];
  },
  parentNode: (element) => element.parent,
  nextSibling: (element) =>
    element.parent?.children[element.parent.children.indexOf(element) + 1] ?? null,
  patchProp: (element, key, _previous, value) => {
    element.props[key] = value;
  },
  insert: (element, parent, anchor) => {
    element.parent = parent;
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    if (index < 0) parent.children.push(element);
    else parent.children.splice(index, 0, element);
  },
  remove: (element) => {
    if (element.parent) element.parent.children.splice(element.parent.children.indexOf(element), 1);
    element.parent = null;
  },
});
function find(root: TestNode, type: string): TestNode | undefined {
  if (root.type === type) return root;
  for (const child of root.children) {
    const found = find(child, type);
    if (found) return found;
  }
}
function content(root: TestNode): string {
  return root.text + root.children.map(content).join(' ');
}
function fire(root: TestNode, type: string, event: string): unknown {
  const handler = find(root, type)?.props[event];
  if (typeof handler !== 'function') throw new Error(`Missing ${type}.${event}`);
  return handler();
}
function mountLogin() {
  const root = node('root');
  const app = renderer.createApp(Login);
  app.config.globalProperties.$t = (key: string) => key;
  app.config.warnHandler = () => {};
  app.mount(root);
  return { root, app };
}
afterEach(() => {
  mocks.route.query = {};
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe('login navigation feedback', () => {
  it('returns to the requested internal page with its query and hash after login', async () => {
    const target = '/examples/form?mode=edit#details';
    mocks.route.query.redirect = target;
    mocks.resolve.mockReturnValue({ name: 'ExamplesForm' });
    const { root, app } = mountLogin();
    try {
      fire(root, 'captcha-control', 'onSuccess');
      await fire(root, 'a-form', 'onFinish');
      expect(mocks.replace).toHaveBeenCalledWith(target);
    } finally {
      app.unmount();
    }
  });

  it.each([
    { redirect: 'https://example.com' },
    { redirect: '//example.com' },
    { redirect: '/\\example.com' },
    { redirect: '/login' },
    { redirect: ['/dashboard'] },
  ])(
    'falls back to the homepage for an invalid or login redirect $redirect',
    async ({ redirect }) => {
      mocks.route.query.redirect = redirect;
      mocks.resolve.mockReturnValue({ name: 'Login' });
      const { root, app } = mountLogin();
      try {
        fire(root, 'captcha-control', 'onSuccess');
        await fire(root, 'a-form', 'onFinish');
        expect(mocks.replace).toHaveBeenCalledWith('/');
      } finally {
        app.unmount();
      }
    },
  );

  it.each(['admin', 'user'])(
    'keeps success feedback visible while %s navigation is pending',
    async (username) => {
      let finish!: () => void;
      mocks.replace.mockReturnValue(
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      );
      const { root, app } = mountLogin();
      try {
        const accounts = find(root, 'a-form')?.props.model;
        if (typeof accounts !== 'object' || accounts === null)
          throw new Error('Missing form model');
        Object.assign(accounts, { username });
        fire(root, 'captcha-control', 'onSuccess');
        const submission = fire(root, 'a-form', 'onFinish');
        await nextTick();
        await nextTick();
        expect(mocks.login).toHaveBeenCalledWith(username, '123456');
        expect(content(root)).toContain('login.loginSuccess');
        expect(content(root)).toContain('login.entering');
        expect(find(root, 'a-form')).toBeUndefined();
        expect(find(root, 'a-spin')).toBeDefined();
        finish();
        await submission;
      } finally {
        app.unmount();
      }
    },
  );

  it.each(['reject', 'abort'])(
    'allows retry without authenticating again after navigation %s',
    async (failure) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      if (failure === 'reject') mocks.replace.mockRejectedValueOnce(new Error('Chunk unavailable'));
      else mocks.replace.mockResolvedValueOnce(new Error('Navigation aborted'));
      const { root, app } = mountLogin();
      try {
        fire(root, 'captcha-control', 'onSuccess');
        await fire(root, 'a-form', 'onFinish');
        await nextTick();
        expect(content(root)).toContain('login.enterFailed');
        expect(find(root, 'a-form')).toBeUndefined();
        await fire(root, 'a-button', 'onClick');
        await nextTick();
        expect(mocks.login).toHaveBeenCalledTimes(1);
        expect(mocks.replace).toHaveBeenCalledTimes(2);
        expect(content(root)).toContain('login.entering');
      } finally {
        app.unmount();
      }
    },
  );

  it('keeps the form available when authentication fails', async () => {
    mocks.login.mockRejectedValueOnce(new Error('Invalid credentials'));
    const { root, app } = mountLogin();
    try {
      fire(root, 'captcha-control', 'onSuccess');
      await fire(root, 'a-form', 'onFinish');
      await nextTick();
      expect(find(root, 'a-form')).toBeDefined();
      expect(find(root, 'a-button')?.props.loading).toBe(false);
      expect(mocks.replace).not.toHaveBeenCalled();
      expect(mocks.error).toHaveBeenCalledWith('Invalid credentials');
    } finally {
      app.unmount();
    }
  });
});
