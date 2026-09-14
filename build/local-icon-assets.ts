import type { IconsJson } from '../src/utils/iconify';
import type { Plugin, ResolvedConfig } from 'vite';

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';

import iconConfig, { type IconBuildConfig } from '../icon.config';
import { getIconShard, ICON_SHARD_COUNT } from '../src/utils/iconShard';
import { findIconNames, getAliasRoots, selectIcons, splitIconCollection } from './icon-collections';

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
    configResolved(resolvedConfig) {
      config = resolvedConfig;
      refresh();
      if (config.command === 'serve') {
        // Virtual lazy groups are invisible to Vite's initial dependency scan.
        // Predeclare their imports to avoid optimizer reloads on first picker open.
        config.optimizeDeps.include = [
          ...new Set([
            ...(config.optimizeDeps.include ?? []),
            ...data.antdNames.map((name) => `@antdv-next/icons/icons/${name}`),
          ]),
        ];
      }
    },
    resolveId(id) {
      if (id === MODULE_ID) return RESOLVED_ID;
      if (id.startsWith(ANTD_GROUP_ID)) return `\0${id}`;
    },
    load(id) {
      if (id.startsWith(`\0${ANTD_GROUP_ID}`)) {
        const index = Number(id.slice(ANTD_GROUP_ID.length + 1));
        const names = data.antdNames.filter((name) => getIconShard(name) === index);
        return (
          names.map((name) => `import ${name} from '@antdv-next/icons/icons/${name}';`).join('\n') +
          `\nexport default {${names.join(',')}};`
        );
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
