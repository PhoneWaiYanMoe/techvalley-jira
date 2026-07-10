import type { Locale } from "../config";
import { en, type MessageKey } from "./en";
import { ko } from "./ko";
import { vi } from "./vi";

export const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, ko, vi };
export type { MessageKey };
