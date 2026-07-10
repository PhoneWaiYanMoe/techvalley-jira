import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { translate, type TFunction } from "./translate";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

// t() bound to the request's locale, for Server Components.
export async function getT(): Promise<TFunction> {
  const locale = await getLocale();
  return (key, vars) => translate(locale, key, vars);
}
