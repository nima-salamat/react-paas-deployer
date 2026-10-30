import React from "react";
import { useLocale } from "./LocaleProvider.jsx";

export function LocalizedText({ value }) {
  const { t } = useLocale();
  return <>{t(value)}</>;
}

export default LocalizedText;
