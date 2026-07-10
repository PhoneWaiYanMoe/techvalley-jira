"use client";

import { useI18n } from "@/lib/i18n/client";
import { LOCALES, LOCALE_LABELS, isLocale } from "@/lib/i18n/config";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <select
      value={locale}
      aria-label={t("common.language")}
      data-testid="language-switcher"
      onChange={(e) => {
        if (isLocale(e.target.value)) setLocale(e.target.value);
      }}
      className={`cursor-pointer rounded-lg border border-neutral-200 bg-transparent px-1.5 py-1 text-[11px] font-semibold text-neutral-500 outline-none hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:[&>option]:bg-neutral-900 ${className}`}
    >
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {LOCALE_LABELS[l]}
        </option>
      ))}
    </select>
  );
}
