"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "./config";
import { translate, type TFunction } from "./translate";

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
} | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
      // Re-render server components (html lang, server-rendered text) too.
      router.refresh();
    },
    [router],
  );

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): { locale: Locale; setLocale: (l: Locale) => void; t: TFunction } {
  const ctx = useContext(LocaleContext);
  // Fall back to the default locale if a component renders outside the provider
  // (shouldn't happen — the provider wraps the root layout).
  const locale = ctx?.locale ?? DEFAULT_LOCALE;
  const setLocale = ctx?.setLocale ?? (() => {});
  const t: TFunction = useCallback((key, vars) => translate(locale, key, vars), [locale]);
  return { locale, setLocale, t };
}
