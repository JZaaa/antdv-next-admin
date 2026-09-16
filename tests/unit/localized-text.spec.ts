import { describe, expect, it } from 'vitest';

import { resolveLocalizedText } from '@/utils/localizedText';

describe('resolveLocalizedText', () => {
  const localizedName = {
    'zh-CN': '角色管理',
    'en-US': 'Role Management',
  };

  it('returns plain strings without modification', () => {
    expect(resolveLocalizedText('Dashboard', 'zh-CN')).toBe('Dashboard');
  });

  it('selects the current locale and never stringifies the object', () => {
    const label = `${resolveLocalizedText(localizedName, 'en-US')} (system.role.view)`;

    expect(label).toBe('Role Management (system.role.view)');
    expect(label).not.toContain('[object Object]');
  });

  it('falls back to Chinese, English, and then the first available value', () => {
    expect(resolveLocalizedText(localizedName, 'unknown-locale')).toBe('角色管理');
    expect(resolveLocalizedText({ 'en-US': 'Role Management' }, 'unknown-locale')).toBe(
      'Role Management',
    );
    expect(resolveLocalizedText({ custom: 'Custom role' }, 'unknown-locale')).toBe('Custom role');
  });

  it('returns an empty string for empty values', () => {
    expect(resolveLocalizedText(undefined, 'zh-CN')).toBe('');
    expect(resolveLocalizedText(null, 'zh-CN')).toBe('');
    expect(resolveLocalizedText({}, 'zh-CN')).toBe('');
  });
});
