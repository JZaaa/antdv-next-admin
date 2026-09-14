import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import postcss, { type Root, type Rule } from 'postcss';
import tailwindcss from 'tailwindcss';
import { beforeAll, describe, expect, it } from 'vitest';

const cssPath = fileURLToPath(new URL('../../src/assets/styles/tailwind.css', import.meta.url));
const configPath = fileURLToPath(new URL('../../tailwind.config.js', import.meta.url));
let output: Root;

beforeAll(async () => {
  const result = await postcss([tailwindcss(configPath)]).process(readFileSync(cssPath, 'utf8'), {
    from: cssPath,
  });
  output = result.root;
});

function findRule(selector: string): Rule {
  let found: Rule | undefined;
  output.walkRules(selector, (rule) => {
    found = rule;
  });
  if (!found) throw new Error(`Missing generated utility: ${selector}`);
  return found;
}

function containingLayers(rule: Rule): string[] {
  const layers: string[] = [];
  let parent = rule.parent;
  while (parent && parent.type !== 'root') {
    if (parent.type === 'atrule' && parent.name === 'layer') layers.push(parent.params);
    parent = parent.parent;
  }
  return layers;
}

describe('Tailwind migration compatibility', () => {
  it('keeps card shadows as actual box shadows in normal and hover states', () => {
    for (const [selector, token] of [
      ['.shadow-card', 'var(--shadow-card)'],
      ['.hover\\:shadow-card-hover:hover', 'var(--shadow-card-hover)'],
    ]) {
      const rule = findRule(selector);
      const declarations = new Map<string, string>();
      rule.walkDecls((decl) => {
        declarations.set(decl.prop, decl.value);
      });
      expect(declarations.get('--tw-shadow')).toBe(token);
      expect(declarations.get('box-shadow')).toContain('var(--tw-shadow)');
    }
  });

  it('keeps hover, structural and responsive variants inside the utility layer', () => {
    for (const selector of [
      '.shadow-card',
      '.hover\\:shadow-card-hover:hover',
      '.last\\:border-b-0:last-child',
      '.md\\:min-h-\\[150px\\]',
    ]) {
      expect(containingLayers(findRule(selector))).toEqual(['tailwind-utilities']);
    }
  });

  it('keeps global element resets below Antd without demoting explicit application utilities', () => {
    const globalCss = postcss.parse(
      readFileSync(new URL('../../src/assets/styles/global.css', import.meta.url), 'utf8'),
    );
    globalCss.walkRules((rule) => {
      if (rule.selectors.some((selector) => ['*', '*::before', 'a'].includes(selector))) {
        expect(containingLayers(rule)).toEqual(['app-base']);
      }
      if (rule.selector === '.text-primary') expect(containingLayers(rule)).toEqual([]);
    });
    const layerOrder = output.nodes.find((node) => node.type === 'atrule' && node.name === 'layer');
    expect(layerOrder?.toString()).toContain(
      'reset, tailwind-base, app-base, antd, tailwind-components, tailwind-utilities',
    );
  });
});
