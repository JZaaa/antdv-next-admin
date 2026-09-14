/** CSS channels shared by runtime HEX colors and the Sass compatibility helpers. */
export function isHexColor(value: string): boolean {
  return /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value);
}

export function hexColorVariables(name: string, value: string): Record<string, string> {
  if (!isHexColor(value)) throw new TypeError(`Invalid HEX color: ${value}`);
  const hex =
    value.length <= 5
      ? [...value.slice(1)].map((channel) => channel.repeat(2)).join('')
      : value.slice(1);
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;

  return {
    [`--${name}`]: value,
    [`--${name}-r`]: String(red),
    [`--${name}-g`]: String(green),
    [`--${name}-b`]: String(blue),
    [`--${name}-rgb`]: `${red}, ${green}, ${blue}`,
    [`--${name}-alpha`]: String(alpha),
  };
}
