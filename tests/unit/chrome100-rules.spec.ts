import { describe, expect, it } from 'vitest';

import {
  applyExceptions,
  checkCss,
  checkJavaScript,
  checkVue,
} from '../../scripts/compat/chrome100-rules.mjs';

describe('Chrome 100 regression checks', () => {
  it('detects unsupported API references, including optional and bracket access', () => {
    expect(checkJavaScript('const list = <string[]>items; list.toSorted();')).toHaveLength(1);
    const issues = checkJavaScript(
      "items?.toSorted(); items['toReversed'](); const group = Object.groupBy; Promise.withResolvers();",
    );
    expect(issues.map((entry) => entry.code)).toEqual([
      'items?.toSorted',
      "items['toReversed']",
      'Object.groupBy',
      'Promise.withResolvers',
    ]);
  });

  it('ignores comments, ordinary strings and APIs available in Chrome 100', () => {
    expect(
      checkJavaScript(
        "// items.toSorted()\nconst text = 'Object.groupBy'; Object.hasOwn(obj, 'a'); items.at(0); items.findLast(fn);",
      ),
    ).toEqual([]);
  });

  it('checks Vue scripts and template expressions without treating text as code', () => {
    const source =
      '<template>items.toSorted() <div :data-items="items.toSorted()">{{ Object.groupBy(items, fn) }}</div></template>\n<script setup>items.toReversed()</script>';
    const issues = checkVue(source, 'src/example.vue');
    expect(issues.map((entry) => entry.code).sort()).toEqual([
      'Object.groupBy',
      'items.toReversed',
      'items.toSorted',
    ]);
    expect(issues.find((entry) => entry.code === 'items.toReversed')?.line).toBe(2);
  });

  it('catches modern color functions generated in JavaScript', () => {
    expect(checkJavaScript('const color = `color-mix(in srgb, red, blue)`;')[0]?.rule).toBe(
      'js-color',
    );
    expect(
      checkJavaScript('const color = `color-mix(in srgb, ${color}, transparent)`;')[0]?.rule,
    ).toBe('js-color');
  });

  it('requires a compatible declaration before modern viewport or color values', () => {
    expect(
      checkCss('.x { height: 100vh; height: 100dvh; color: red; color: oklch(50% .2 20); }'),
    ).toEqual([]);
    expect(checkCss('.x { height: 100dvh; }')[0]?.rule).toBe('css-viewport');
    expect(checkCss('.x { height: 100dvh !important; height: 100vh; }')[0]?.rule).toBe(
      'css-viewport',
    );
  });

  it('does not mistake custom-property reassignments or variable references for fallbacks', () => {
    expect(checkCss('.x { --color: red; --color: color-mix(in srgb, red, blue); }')).toHaveLength(
      1,
    );
    expect(checkCss('.x { height: var(--size); height: 100dvh; }')).toHaveLength(1);
  });

  it('rejects unsupported selectors and container queries without a guarded equivalent fallback', () => {
    expect(checkCss('.x:has(input) { color: red; }')[0]?.rule).toBe('css-has');
    expect(checkCss('@container (max-width: 768px) { .x { display: block; } }')).toHaveLength(1);
    const guarded =
      '@supports (container-type: inline-size) { @container (max-width: 768px) { .x { display: block; } } }';
    const fallback =
      '@supports not (container-type: inline-size) { @media (max-width: 768px) { .x { display: block; } } }';
    expect(checkCss(guarded + fallback)).toEqual([]);
    expect(checkCss(guarded.replace('max-width: 768px', 'width<=768px') + fallback)).toEqual([]);
    expect(checkCss(guarded + fallback.replace('display: block', 'display: flex'))).toHaveLength(1);
  });

  it('requires exact, documented exceptions and rejects stale exceptions', () => {
    const issues = checkJavaScript('items.toSorted()', 'src/demo.ts');
    const exception = {
      file: 'src/demo.ts',
      rule: 'js-api',
      code: 'items.toSorted',
      reason: 'Feature detection with a tested sort fallback.',
    };
    expect(applyExceptions(issues, [exception])).toEqual([]);
    expect(applyExceptions(issues, [{ ...exception, file: 'src/other.ts' }])).toHaveLength(2);
    expect(applyExceptions([], [exception])[0]?.rule).toBe('unused-exception');
    expect(() => applyExceptions(issues, [{ ...exception, reason: '' }])).toThrow('reason');
  });
});
