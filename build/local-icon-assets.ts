import type { IconsJson } from '../src/types/icon.ts';
import type { Plugin, ResolvedConfig } from 'vite';

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';

import iconConfig, { type IconBuildConfig } from '../icon.config.ts';
import { getIconShard, ICON_SHARD_COUNT } from '../src/utils/iconShard.ts';
import {
  findIconNames,
  getAliasRoots,
  selectIcons,
  splitIconCollection,
} from './icon-collections.ts';

const MODULE_ID = 'virtual:local-icon-assets';
const RESOLVED_ID = `\0${MODULE_ID}`;
const ANTD_GROUP_ID = 'virtual:antd-icon-group/';
const PREFIXES = ['ri', 'mdi', 'ion'] as const;

export function scanIconUsage(root: string, safelist: string[]): Map<string, string> {
  const usage = new Map<string, string>();
  function scan(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) scan(path);
      else if (/\.(vue|tsx?|jsx?)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        for (const name of findIconNames(readFileSync(path, 'utf8'))) {
          usage.set(name, relative(root, path));
        }
      }
    }
  }
  for (const directory of ['src', 'mock']) scan(resolve(root, directory));
  for (const name of safelist) usage.set(name.replace(/^iconify:/, ''), 'icon.config.ts safelist');
  return usage;
}

export interface IconBuildData {
  assets: Map<string, (string | null)[]>;
  aliases: Record<string, Record<string, string>>;
  antdNames: string[];
}

export function createIconBuildData(
  root: string,
  settings: IconBuildConfig,
  usage: ReadonlyMap<string, string>,
): IconBuildData {
  const assets = new Map<string, (string | null)[]>();
  const aliases: Record<string, Record<string, string>> = {};
  for (const prefix of PREFIXES) {
    const mode = settings.collections[prefix];
    const used = [...usage].filter(([name]) => name.startsWith(`${prefix}:`));
    if (mode === 'off') {
      if (used.length)
        throw new Error(
          `Icon collection ${prefix} is off but ${used[0]![0]} is referenced in ${used[0]![1]}`,
        );
      continue;
    }
    if (mode === 'used' && !used.length) continue;
    const path = resolve(root, `node_modules/@iconify-json/${prefix}/icons.json`);
    const collection: IconsJson = JSON.parse(readFileSync(path, 'utf8'));
    const selected =
      mode === 'all'
        ? collection
        : selectIcons(
            collection,
            used.map(([name]) => name.slice(prefix.length + 1)),
          );
    aliases[prefix] = getAliasRoots(selected);
    assets.set(
      prefix,
      splitIconCollection(selected).map((shard) =>
        Object.keys(shard.icons).length ? JSON.stringify(shard) : null,
      ),
    );
  }
  const usedAntd = [...usage].filter(([name]) => /(?:Outlined|Filled|TwoTone)$/.test(name));
  if (settings.antd === 'off' && usedAntd.length) {
    throw new Error(
      `Dynamic Antdv icons are off but ${usedAntd[0]![0]} is referenced in ${usedAntd[0]![1]}`,
    );
  }
  let antdNames: string[] = [];
  if (settings.antd !== 'off') {
    const available = readdirSync(resolve(root, 'node_modules/@antdv-next/icons/dist/icons'))
      .filter((name) => /(Outlined|Filled|TwoTone)\.js$/.test(name))
      .map((name) => name.slice(0, -3));
    antdNames =
      settings.antd === 'all'
        ? available
        : [...new Set(usedAntd.map(([name]) => name.replace(/^(antdv-next|antd):/, '')))];
    for (const name of antdNames) {
      if (!available.includes(name)) throw new Error(`Unknown Antdv icon: ${name}`);
    }
    antdNames.sort();
  }
  return { assets, aliases, antdNames };
}

/**
 * 提供本地图标资源；开发时复用图标库预构建入口，生产时按分组引入图标。
 * @param settings 图标集合、白名单与在线访问配置。
 * @returns 本地图标资源的 Vite 插件。
 */
export function localIconAssetsPlugin(settings: IconBuildConfig = iconConfig): Plugin {
  let config: ResolvedConfig;
  let data: ReturnType<typeof createIconBuildData>;
  function refresh(): void {
    data = createIconBuildData(
      config.root,
      settings,
      scanIconUsage(config.root, settings.safelist),
    );
  }

  return {
    name: 'local-icon-assets',
    /**
     * 保存最终配置并准备本地图标数据。
     * @param resolvedConfig Vite 已解析的配置。
     * @returns void。
     * @throws 图标资源无法读取或配置引用未知图标时抛出错误。
     */
    configResolved(resolvedConfig) {
      config = resolvedConfig;
      refresh();
    },
    resolveId(id) {
      if (id === MODULE_ID) return RESOLVED_ID;
      if (id.startsWith(ANTD_GROUP_ID)) return `\0${id}`;
    },
    /**
     * 生成图标清单或图标分组模块，开发分组复用已预构建的总入口。
     * @param id 已解析的模块标识。
     * @returns 虚拟模块源码；非本插件模块返回 undefined。
     */
    load(id) {
      if (id.startsWith(`\0${ANTD_GROUP_ID}`)) {
        const index = Number(id.slice(ANTD_GROUP_ID.length + 1));
        const names = data.antdNames.filter((name) => getIconShard(name) === index);
        // 开发时总入口与全部子入口并存会将图标拆成数百个静态依赖请求。
        const imports =
          config.command === 'serve'
            ? `import {${names.join(',')}} from '@antdv-next/icons';`
            : names
                .map((name) => `import ${name} from '@antdv-next/icons/icons/${name}';`)
                .join('\n');
        return `${imports}\nexport default {${names.join(',')}};`;
      }
      if (id !== RESOLVED_ID) return;
      const entries = [...data.assets].map(([prefix, shards]) => {
        const urls = shards.map((source, index) => {
          if (!source) return 'null';
          if (config.command === 'build') {
            const reference = this.emitFile({
              type: 'asset',
              name: `icons-${prefix}-${index}.json`,
              source,
            });
            return `import.meta.ROLLUP_FILE_URL_${reference}`;
          }
          return JSON.stringify(`${config.base}__local-icons/${prefix}-${index}.json`);
        });
        return `${JSON.stringify(prefix)}: [${urls.join(',')}]`;
      });
      const groups = Array.from(
        { length: data.antdNames.length ? ICON_SHARD_COUNT : 0 },
        (_, index) =>
          data.antdNames.some((name) => getIconShard(name) === index)
            ? `() => import(${JSON.stringify(`${ANTD_GROUP_ID}${index}`)})`
            : '() => Promise.resolve({default:{}})',
      );
      return `export const localIconAssets = {${entries.join(',')}};
        export const localIconAliases = ${JSON.stringify(data.aliases)};
        export const iconBuildSettings = ${JSON.stringify(settings)};
        export const antdIconNames = ${JSON.stringify(data.antdNames)};
        export const antdIconGroups = [${groups.join(',')}];`;
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split('?')[0] ?? '';
        const match = pathname.match(/\/__local-icons\/(ri|mdi|ion)-(\d+)\.json$/);
        if (!match) return next();
        const source = data.assets.get(match[1]!)?.[Number(match[2])];
        if (!source) return next();
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-cache');
        response.end(source);
      });
    },
    handleHotUpdate(context) {
      if (!Object.values(settings.collections).includes('used') && settings.antd !== 'used') return;
      if (!/\.(vue|tsx?|jsx?)$/.test(context.file)) return;
      refresh();
      context.server.moduleGraph.invalidateAll();
      context.server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}
