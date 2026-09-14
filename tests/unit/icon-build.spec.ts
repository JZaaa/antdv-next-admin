import type { IconBuildConfig } from '../../icon.config';
import type { IconsJson } from '@/utils/iconify';

import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';

import { getIconShard } from '@/utils/iconShard';

import {
  findIconNames,
  getAliasRoots,
  selectIcons,
  splitIconCollection,
} from '../../build/icon-collections';
import {
  createIconBuildData,
  localIconAssetsPlugin,
  scanIconUsage,
} from '../../build/local-icon-assets';

const root = process.cwd();
const usedConfig: IconBuildConfig = {
  collections: { ri: 'off', mdi: 'used', ion: 'off' },
  antd: 'off',
  safelist: [],
  online: false,
};

describe('icon build policy', () => {
  it.each(['used', 'all'] as const)(
    'emits the expected assets through Vite in %s mode',
    async (mode) => {
      const fixture = mkdtempSync(resolve(tmpdir(), 'icon-build-'));
      try {
        mkdirSync(resolve(fixture, 'src'));
        mkdirSync(resolve(fixture, 'mock'));
        const packagePath = resolve(fixture, 'node_modules/@iconify-json/mdi');
        mkdirSync(packagePath, { recursive: true });
        writeFileSync(
          resolve(packagePath, 'icons.json'),
          JSON.stringify({
            prefix: 'mdi',
            icons: { account: { body: '<path/>' }, unused: { body: '<circle/>' } },
          }),
        );
        writeFileSync(
          resolve(fixture, 'src/main.js'),
          "import {localIconAssets} from 'virtual:local-icon-assets'; console.log('mdi:account', localIconAssets);",
        );
        const result = await build({
          root: fixture,
          configFile: false,
          logLevel: 'silent',
          base: '/intranet/',
          plugins: [
            localIconAssetsPlugin({
              ...usedConfig,
              collections: { ...usedConfig.collections, mdi: mode },
            }),
          ],
          build: {
            write: false,
            minify: false,
            rolldownOptions: { input: resolve(fixture, 'src/main.js') },
          },
        });
        const outputs = Array.isArray(result) ? result : [result];
        const files = outputs.flatMap((output) => ('output' in output ? output.output : []));
        const assets = files.filter((file) => file.type === 'asset');
        expect(assets.every((file) => file.fileName.includes('icons-mdi-'))).toBe(true);
        const names = assets.flatMap((file) => Object.keys(JSON.parse(String(file.source)).icons));
        expect(names.sort()).toEqual(mode === 'used' ? ['account'] : ['account', 'unused']);
        const code = files
          .filter((file) => file.type === 'chunk')
          .map((file) => file.code)
          .join('\n');
        expect(code).not.toContain('ROLLUP_FILE_URL');
        expect(code).toContain('icons-mdi-');
      } finally {
        // The exact temporary directory was allocated above, outside the project and user data.
        rmSync(fixture, { recursive: true, force: true });
      }
    },
  );

  it('omits off collections entirely and includes only requested icons in used mode', () => {
    const data = createIconBuildData(root, usedConfig, new Map([['mdi:account', 'src/demo.vue']]));
    expect([...data.assets.keys()]).toEqual(['mdi']);
    expect(data.antdNames).toEqual([]);
    const icons = data.assets
      .get('mdi')!
      .flatMap((source) => (source ? Object.keys(JSON.parse(source).icons) : []));
    expect(icons).toEqual(['account']);
  });

  it('reports the source location when a disabled collection is still referenced', () => {
    expect(() =>
      createIconBuildData(root, usedConfig, new Map([['ri:home-line', 'src/demo.vue']])),
    ).toThrow('ri:home-line is referenced in src/demo.vue');
  });

  it('merges a full picker collection and ordinary icon usage without duplicate SVG bodies', () => {
    const settings: IconBuildConfig = {
      ...usedConfig,
      collections: { ...usedConfig.collections, mdi: 'all' },
    };
    const data = createIconBuildData(root, settings, new Map([['mdi:account', 'src/demo.vue']]));
    const original: IconsJson = JSON.parse(
      readFileSync(resolve(root, 'node_modules/@iconify-json/mdi/icons.json'), 'utf8'),
    );
    const names = data.assets
      .get('mdi')!
      .flatMap((source) => (source ? Object.keys(JSON.parse(source).icons) : []));
    expect(names.length).toBe(Object.keys(original.icons).length);
    expect(new Set(names).size).toBe(names.length);
    expect(names.filter((name) => name === 'account')).toHaveLength(1);
  });

  it('includes safelisted dynamic names and scans complete literals only', () => {
    expect(scanIconUsage(root, ['mdi:account']).get('mdi:account')).toBe('icon.config.ts safelist');
    expect(
      findIconNames(
        `icon="mdi:account"; icon: 'iconify:ri:home-line'; icon: 'EditOutlined'; text: 'use mdi:other here'`,
      ),
    ).toEqual(['mdi:account', 'ri:home-line', 'EditOutlined']);
  });

  it('bundles only selected dynamic Antdv components in used mode', () => {
    const data = createIconBuildData(
      root,
      { ...usedConfig, antd: 'used' },
      new Map([
        ['EditOutlined', 'src/a.vue'],
        ['antdv-next:EditOutlined', 'src/b.vue'],
      ]),
    );
    expect(data.antdNames).toEqual(['EditOutlined']);
    expect(data.assets.size).toBe(0);
  });

  it('keeps alias chains with their original icon without duplicating the body', () => {
    const collection: IconsJson = {
      prefix: 'mdi',
      width: 24,
      height: 24,
      icons: { edit: { body: '<path/>' }, unused: { body: '<circle/>' } },
      aliases: { pencil: { parent: 'edit' }, pen: { parent: 'pencil', hFlip: true } },
    };
    const selected = selectIcons(collection, ['edit', 'pen', 'edit']);
    expect(Object.keys(selected.icons)).toEqual(['edit']);
    const shards = splitIconCollection(selected);
    expect(shards.flatMap((shard) => Object.keys(shard.icons))).toEqual(['edit']);
    expect(shards[getIconShard('edit')]!.aliases).toEqual(collection.aliases);
    expect(getAliasRoots(selected)).toEqual({ pencil: 'edit', pen: 'edit' });
  });

  it.each(['ri', 'mdi', 'ion'])(
    'preserves every icon and alias in %s across independent shards',
    (prefix) => {
      const original: IconsJson = JSON.parse(
        readFileSync(resolve(root, `node_modules/@iconify-json/${prefix}/icons.json`), 'utf8'),
      );
      const icons: IconsJson['icons'] = {};
      const aliases: NonNullable<IconsJson['aliases']> = {};
      for (const shard of splitIconCollection(original)) {
        expect(Object.keys(shard.icons).some((name) => Object.hasOwn(icons, name))).toBe(false);
        Object.assign(icons, shard.icons);
        Object.assign(aliases, shard.aliases);
        for (const target of Object.values(getAliasRoots(shard)))
          expect(shard.icons[target]).toBeDefined();
      }
      expect(icons).toEqual(original.icons);
      expect(aliases).toEqual(original.aliases ?? {});
    },
  );
});
