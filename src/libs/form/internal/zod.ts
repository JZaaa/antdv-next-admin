import { toRaw } from 'vue';
import { z } from 'zod';
import { getDefaultsForSchema } from 'zod-defaults';

/** zod-defaults 0.2.3 does not recognise native string formats or newer schema types. */
function defaultsSchema(schema: z.core.$ZodType): z.ZodType {
  const rule = toRaw(schema);
  if (rule instanceof z.ZodStringFormat) return z.string();
  if (rule instanceof z.ZodObject) {
    const shape: Record<string, z.ZodType> = rule.shape;
    return z.object(
      Object.fromEntries(Object.entries(shape).map(([key, value]) => [key, defaultsSchema(value)])),
    );
  }
  if (rule instanceof z.ZodIntersection)
    return defaultsSchema(rule.def.left).and(defaultsSchema(rule.def.right));
  // Initial values are inputs: extracting defaults must not run the output transformation.
  if (rule instanceof z.ZodPipe) return defaultsSchema(rule.in);
  if (rule instanceof z.ZodUnion) return z.union(rule.options.map(defaultsSchema));
  if (rule instanceof z.ZodTuple) {
    const [first, ...rest] = rule.def.items.map(defaultsSchema);
    return first ? z.tuple([first, ...rest]) : z.tuple([]);
  }
  if (rule instanceof z.ZodNumberFormat) return z.number();
  if (
    rule instanceof z.ZodDefault ||
    rule instanceof z.ZodOptional ||
    rule instanceof z.ZodString ||
    rule instanceof z.ZodNumber ||
    rule instanceof z.ZodBoolean ||
    rule instanceof z.ZodArray ||
    rule instanceof z.ZodRecord
  )
    return rule;
  // Nullable/enum/lazy/custom etc. have no inferred default in the reference helper.
  // Use an optional placeholder to avoid its warning; validation still uses the original schema.
  return z.unknown().optional();
}

export function zodDefaultValue(rules: z.ZodType): unknown {
  return getDefaultsForSchema(z.object({ value: defaultsSchema(rules) })).value;
}
