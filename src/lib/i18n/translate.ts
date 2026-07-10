import { DEFAULT_LOCALE, type Locale } from "./config";
import { dictionaries } from "./dictionaries";
import type { MessageKey } from "./dictionaries/en";

export type TFunction = (key: MessageKey, vars?: Record<string, string | number>) => string;

// Isomorphic lookup shared by the client hook and the server helper.
export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  let message = dictionaries[locale][key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      message = message.replaceAll(`{${name}}`, String(value));
    }
  }
  return message;
}
