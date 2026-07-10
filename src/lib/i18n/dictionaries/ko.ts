import type { MessageKey } from "./en";

// Korean translations. Filled in full once the en key set is final —
// temporarily aliased to en during development so missing keys can't ship.
import { en } from "./en";

export const ko: Record<MessageKey, string> = { ...en };
