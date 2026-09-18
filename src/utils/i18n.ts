/**
 * 原样返回标题文案，不隐式查找或转换翻译键。
 * @param text 直接文案或调用方通过 $t 显式翻译后的文案。
 * @param fallback 未提供文案时的回退值，空回退值使用短横线。
 * @returns 用于显示的原始文案或回退值。
 */
export function resolveLocaleText(text?: string, fallback = ''): string {
  return text ? String(text) : fallback || '-';
}
