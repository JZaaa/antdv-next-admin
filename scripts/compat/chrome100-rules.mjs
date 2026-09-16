import postcss from 'postcss';
import ts from 'typescript';
import { parse } from 'vue/compiler-sfc';

// Deliberately bounded rules, not a complete browser capability database.
const METHODS = new Set([
  'toSorted',
  'toReversed',
  'toSpliced',
  'isWellFormed',
  'toWellFormed',
  'union',
  'intersection',
  'difference',
  'symmetricDifference',
  'isSubsetOf',
  'isSupersetOf',
  'isDisjointFrom',
]);
const STATIC_APIS = new Set([
  'Object.groupBy',
  'Map.groupBy',
  'Promise.withResolvers',
  'Promise.try',
  'Array.fromAsync',
  'RegExp.escape',
  'URL.canParse',
  'URL.parse',
]);
const MODERN_COLOR = /\b(?:color-mix|oklch|oklab|light-dark)\s*\(/i;
const VIEWPORT = /\b\d*\.?\d+(?:d|s|l)v(?:h|w|i|b|min|max)\b/i;

function issue(file, source, offset, rule, code) {
  return { file, line: source.slice(0, offset).split('\n').length, rule, code };
}

export function checkJavaScript(source, file = 'source.ts', original = source, offset = 0) {
  const result = [];
  const kind = /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  function visit(node) {
    let name;
    let receiver;
    if (ts.isPropertyAccessExpression(node)) {
      name = node.name.text;
      receiver = node.expression.getText(ast);
    } else if (
      ts.isElementAccessExpression(node) &&
      node.argumentExpression &&
      ts.isStringLiteralLike(node.argumentExpression)
    ) {
      name = node.argumentExpression.text;
      receiver = node.expression.getText(ast);
    }
    if (name && (METHODS.has(name) || STATIC_APIS.has(`${receiver}.${name}`))) {
      result.push(issue(file, original, offset + node.getStart(ast), 'js-api', node.getText(ast)));
    }
    // This also catches CSS-in-JS values maintained by the application.
    if (
      (ts.isStringLiteralLike(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)) &&
      MODERN_COLOR.test(node.text)
    ) {
      result.push(
        issue(file, original, offset + node.getStart(ast), 'js-color', node.getText(ast)),
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return result;
}

export function checkVue(source, file) {
  const { descriptor, errors } = parse(source, { filename: file });
  if (errors.length) throw new Error(`${file}: ${errors.join(', ')}`);
  const result = [];
  for (const block of [descriptor.script, descriptor.scriptSetup]) {
    if (block) result.push(...checkJavaScript(block.content, file, source, block.loc.start.offset));
  }
  function visit(node) {
    // SFC template AST locations refer to the original .vue source.
    if (node.type === 4 && !node.isStatic) {
      result.push(...checkJavaScript(node.content, file, source, node.loc.start.offset));
    }
    for (const child of node.children ?? []) visit(child);
    for (const prop of node.props ?? []) {
      if (prop.exp) visit(prop.exp);
      if (prop.arg) visit(prop.arg);
    }
    if (node.type === 5) visit(node.content);
  }
  if (descriptor.template?.ast) visit(descriptor.template.ast);
  return result;
}

export function checkCss(source, file = 'style.css') {
  const result = [];
  const root = postcss.parse(source, { from: file });
  function report(node, rule) {
    result.push({ file, line: node.source.start.line, rule, code: node.toString() });
  }
  root.walkRules((rule) => {
    if (/:has\s*\(/i.test(rule.selector)) report(rule, 'css-has');
  });
  root.walkAtRules((rule) => {
    if (rule.name === 'container') {
      // Vite lowers media ranges for Chrome 100 but retains range syntax in container queries.
      const normalize = (value) =>
        value
          .replace(/\s+/g, '')
          .toLowerCase()
          .replace(/\(max-(width|height):([^()]+)\)/g, '($1<=$2)')
          .replace(/\(min-(width|height):([^()]+)\)/g, '($1>=$2)');
      const guard = rule.parent;
      const hasFallback =
        guard.type === 'atrule' &&
        guard.name === 'supports' &&
        normalize(guard.params) === '(container-type:inline-size)' &&
        guard.parent.nodes.some(
          (sibling) =>
            sibling.type === 'atrule' &&
            sibling.name === 'supports' &&
            normalize(sibling.params) === 'not(container-type:inline-size)' &&
            sibling.nodes.some(
              (media) =>
                media.type === 'atrule' &&
                media.name === 'media' &&
                normalize(media.params) === normalize(rule.params) &&
                media.nodes.map((node) => node.toString()).join('') ===
                  rule.nodes.map((node) => node.toString()).join(''),
            ),
        );
      if (!hasFallback) report(rule, 'css-at-rule');
    } else if (rule.name === 'starting-style') report(rule, 'css-at-rule');
  });
  root.walkDecls((decl) => {
    const modernColor = MODERN_COLOR.test(decl.value);
    const modernViewport = VIEWPORT.test(decl.value);
    if (!modernColor && !modernViewport) return;
    // Custom properties accept unknown functions/units, so an earlier value is NOT a fallback.
    // For ordinary properties require a prior compatible declaration with matching importance.
    const fallback =
      !decl.prop.startsWith('--') &&
      decl.parent.nodes
        .slice(0, decl.parent.index(decl))
        .some(
          (previous) =>
            previous.type === 'decl' &&
            previous.prop === decl.prop &&
            !!previous.important === !!decl.important &&
            !MODERN_COLOR.test(previous.value) &&
            !VIEWPORT.test(previous.value) &&
            !/\bvar\s*\(/.test(previous.value),
        );
    if (!fallback) report(decl, modernColor ? 'css-color' : 'css-viewport');
  });
  return result;
}

export function applyExceptions(issues, exceptions) {
  const unused = new Set(exceptions);
  for (const entry of exceptions) {
    if (!entry.file || !entry.rule || !entry.code || !entry.reason?.trim()) {
      throw new Error('Compatibility exceptions require file, rule, exact code and reason.');
    }
  }
  const remaining = issues.filter((item) => {
    const match = exceptions.find(
      (entry) => entry.file === item.file && entry.rule === item.rule && entry.code === item.code,
    );
    if (!match) return true;
    unused.delete(match);
    return false;
  });
  for (const entry of unused) remaining.push({ ...entry, line: 1, rule: 'unused-exception' });
  return remaining;
}
