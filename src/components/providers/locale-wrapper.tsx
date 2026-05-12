import {
  changeLocale,
  isSupportedLocale,
  SAVED_OR_DEFAULT_LOCALE,
  setLocaleInPath,
} from "@/i18n";
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useParams } from "react-router-dom";

export default function LocaleWrapper({ children }: { children: ReactNode }) {
  const { lng } = useParams<{ lng: string }>();
  const { i18n } = useTranslation();
  const location = useLocation();

  // This is the ONLY place changeLocale is called
  useEffect(() => {
    if (lng && isSupportedLocale(lng) && i18n.language !== lng) {
      void changeLocale(lng);
    }
  }, [lng, i18n]);

  // Redirect uppercase/mixed-case locale codes to lowercase
  if (lng && lng !== lng.toLowerCase()) {
    const redirectPath = setLocaleInPath(
      lng.toLowerCase(),
      location.pathname,
      location.search,
      location.hash,
    );
    return <Navigate to={redirectPath} replace />;
  }

  // If locale is invalid, redirect with saved/default locale
  if (!lng || !isSupportedLocale(lng)) {
    const redirectPath = setLocaleInPath(
      SAVED_OR_DEFAULT_LOCALE,
      location.pathname,
      location.search,
      location.hash,
    );
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}
