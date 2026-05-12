import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Locale metadata with display information
export const SUPPORTED_LOCALES = {
  bg: {
    code: "bg",
    emoji: "🇧🇬",
    name: "Bulgarian",
    nativeName: "Български",
    dir: "ltr",
  },
  en: {
    code: "en",
    emoji: "🇺🇸",
    name: "English",
    nativeName: "English",
    dir: "ltr",
  },
} as const;

// Define default locale
export const DEFAULT_LOCALE: keyof typeof SUPPORTED_LOCALES = "bg";

// Derive constants from metadata (single source of truth)
export const SUPPORTED_LOCALES_ARRAY = Object.keys(SUPPORTED_LOCALES) as Array<
  keyof typeof SUPPORTED_LOCALES
>;
export type SupportedLocale = keyof typeof SUPPORTED_LOCALES;

// Check if a locale code is supported
export function isSupportedLocale(
  locale: string | undefined,
): locale is SupportedLocale {
  return (
    !!locale && SUPPORTED_LOCALES_ARRAY.includes(locale as SupportedLocale)
  );
}

// Saved locale from localStorage (computed once at module load)
export const SAVED_LOCALE =
  typeof window !== "undefined"
    ? (() => {
        try {
          const stored = localStorage.getItem("locale");
          return stored && isSupportedLocale(stored) ? stored : null;
        } catch {
          // localStorage might be disabled (private browsing, etc.)
          return null;
        }
      })()
    : null;

// Saved locale or default locale
export const SAVED_OR_DEFAULT_LOCALE: SupportedLocale =
  SAVED_LOCALE ?? DEFAULT_LOCALE;

// Set locale in path - handles all locale routing logic
export function setLocaleInPath(
  locale: string,
  pathname: string,
  search: string = "",
  hash: string = "",
): string {
  // Use saved/default locale if provided locale is invalid
  const targetLocale = isSupportedLocale(locale)
    ? locale
    : SAVED_OR_DEFAULT_LOCALE;

  // Handle root path
  if (pathname === "/") {
    return `/${targetLocale}${search}${hash}`;
  }

  // Split pathname into segments
  const segments = pathname.split("/").filter(Boolean);
  const firstSegment = segments[0];
  const firstSegmentLowercase = firstSegment?.toLowerCase();

  // If first segment is a valid locale (case-insensitive), replace it
  if (firstSegmentLowercase && isSupportedLocale(firstSegmentLowercase)) {
    segments[0] = targetLocale;
    return `/${segments.join("/")}${search}${hash}`;
  }

  // Otherwise, prepend the locale
  return `/${targetLocale}${pathname}${search}${hash}`;
}

// Utility function to change locale and update document attributes
export async function changeLocale(lng: SupportedLocale) {
  try {
    await i18n.changeLanguage(lng);
    const localeMetadata = SUPPORTED_LOCALES[lng];
    document.documentElement.lang = lng;
    document.documentElement.dir = localeMetadata.dir ?? "ltr";

    try {
      localStorage.setItem("locale", lng);
    } catch {
      // localStorage might be disabled - fail silently
    }
  } catch (error) {
    console.error("Failed to change locale:", error);
    throw error;
  }
}

// Eagerly import all translation files - bundled at build time for instant access
const translationModules = import.meta.glob<{
  default: Record<string, string>;
}>("./locales/*/*.json", { eager: true });

// Build resources object for i18next from imported modules
const resources: Record<string, Record<string, Record<string, string>>> = {};

for (const [path, module] of Object.entries(translationModules)) {
  // Extract locale and namespace from path: ./locales/en/common.json -> en, common
  const match = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/);
  if (match) {
    const [, lng, ns] = match;
    if (!resources[lng]) {
      resources[lng] = {};
    }
    resources[lng][ns] = module.default;
  }
}

i18n.use(initReactI18next).init({
  resources,
  lng: SAVED_OR_DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: SUPPORTED_LOCALES_ARRAY,
  defaultNS: "common",
  interpolation: { escapeValue: false }, // React already escapes values
  react: { useSuspense: true },
});

export default i18n;
