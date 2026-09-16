/** Shared by the Node build pipeline and browser icon loader. */
export interface IconsJson {
  prefix: string;
  icons: Record<string, unknown>;
  aliases?: Record<string, unknown>;
  [key: string]: unknown;
}
