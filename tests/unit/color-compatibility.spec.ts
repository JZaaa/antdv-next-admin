import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';

import { hexColorVariables } from '@/utils/color';

const stylesPath = fileURLToPath(new URL('../../src/assets/styles', import.meta.url));

// Resolve custom properties as a browser would, then let Sass evaluate numeric CSS math.
function evaluateColor(expression: string, variables: Record<string, string> = {}): number[] {
  const generated = compileString(`@use "color" as compat; .sample { color: ${expression}; }`, {
    loadPaths: [stylesPath],
  }).css;
  const resolved = generated.replace(/var\((--[\w-]+)(?:,\s*([^)]*))?\)/g, (_, name, fallback) => {
    const value = variables[name] ?? fallback;
    if (value === undefined) throw new Error(`Missing color channel: ${name}`);
    return value;
  });
  const computed = compileString(resolved).css;
  let value = '';
  postcss.parse(computed).walkDecls('color', (decl) => {
    value = decl.value;
  });
  const match = value.match(/^rgba?\(([^)]+)\)$/);
  if (!match) throw new Error(`Expected computed RGB, received ${value}`);
  // Sass can serialize fractional RGB channels as percentages (also supported by Chrome 100).
  const channels = match[1].split(',').map((channel, index) => {
    const token = channel.trim();
    return token.endsWith('%')
      ? (Number(token.slice(0, -1)) / 100) * (index < 3 ? 255 : 1)
      : Number(token);
  });
  if (channels.length === 3) channels.push(1);
  return channels;
}

describe('Chrome 100 color expressions', () => {
  it('normalizes short, long, uppercase and alpha HEX colors', () => {
    expect(hexColorVariables('sample', '#AbC')['--sample-rgb']).toBe('170, 187, 204');
    expect(Number(hexColorVariables('sample', '#abcd')['--sample-alpha'])).toBeCloseTo(221 / 255);
    expect(hexColorVariables('sample', '#123456')['--sample-rgb']).toBe('18, 52, 86');
    expect(() => hexColorVariables('sample', '#12')).toThrow(TypeError);
  });

  it('fades without darkening RGB and multiplies existing alpha', () => {
    const value = evaluateColor(
      "compat.fade('sample', 0.2)",
      hexColorVariables('sample', '#ff008080'),
    );
    expect(value.slice(0, 3)).toEqual([255, 0, 128]);
    expect(value[3]).toBeCloseTo((128 / 255) * 0.2);
  });

  it('blends dynamic light and dark surfaces in sRGB', () => {
    for (const background of ['#ffffff', '#1f1f1f']) {
      const variables = {
        ...hexColorVariables('primary', '#1890ff'),
        ...hexColorVariables('surface', background),
      };
      const value = evaluateColor("compat.blend('primary', 'surface', 0.12)", variables);
      const base = background === '#ffffff' ? 255 : 31;
      [24, 144, 255].forEach((channel, index) =>
        expect(value[index]).toBeCloseTo(channel * 0.12 + base * 0.88),
      );
      expect(value[3]).toBe(1);
    }
  });

  it('premultiplies alpha and handles fully transparent colors', () => {
    const value = evaluateColor('compat.blend(rgba(255, 0, 0, 0.5), #0000ff, 0.5)');
    expect(value[0]).toBeCloseTo(85);
    expect(value[2]).toBeCloseTo(170);
    expect(value[3]).toBeCloseTo(0.75);
    expect(evaluateColor('compat.blend(rgba(255, 0, 0, 0), rgba(0, 0, 255, 0), 0.5)')).toEqual([
      0, 0, 0, 0,
    ]);
  });

  it('keeps preset CSS channels synchronized with their palette colors', () => {
    const css = postcss.parse(readFileSync(`${stylesPath}/variables.css`, 'utf8'));
    let palettes = 0;
    css.walkRules((rule) => {
      const declarations: Record<string, string> = {};
      rule.walkDecls((decl) => {
        declarations[decl.prop] = decl.value;
      });
      if (!declarations['--color-primary-rgb']) return;
      palettes++;
      for (const name of ['color-primary', 'color-primary-5']) {
        const value = declarations[`--${name}`].replace(
          /var\(([^)]+)\)/g,
          (_, token) => declarations[token],
        );
        const expected = hexColorVariables(name, value);
        for (const suffix of ['r', 'g', 'b', 'rgb', 'alpha']) {
          expect(declarations[`--${name}-${suffix}`]).toBe(expected[`--${name}-${suffix}`]);
        }
      }
    });
    expect(palettes).toBe(7);
  });
});
