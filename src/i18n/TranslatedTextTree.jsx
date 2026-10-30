import React, { cloneElement, isValidElement } from "react";
import { useLocale } from "./LocaleProvider.jsx";

const TRANSLATABLE_PROPS = new Set([
  "label",
  "title",
  "placeholder",
  "helperText",
  "message",
  "confirmLabel",
  "cancelLabel",
  "primary",
  "secondary",
  "tooltip",
  "emptyLabel",
  "noOptionsText",
  "buttonText",
  "aria-label",
  "typeLabel",
  "platformLabel",
  "kindLabel",
  "statusLabel",
]);

function translateUiProp(value, t) {
  // Only translate declared UI props. Raw rendered child strings may be service names, usernames, ticket subjects, documentation or other data.
  if (typeof value === "string") return value.trim() ? t(value) : value;
  if (Array.isArray(value)) return value.map((item) => translateUiProp(item, t));
  if (!isValidElement(value)) return value;

  const nextProps = {};
  let changed = false;
  for (const [key, child] of Object.entries(value.props || {})) {
    if (key === "children") {
      nextProps.children = child;
    } else if (TRANSLATABLE_PROPS.has(key)) {
      nextProps[key] = translateUiProp(child, t);
      if (nextProps[key] !== child) changed = true;
    } else {
      nextProps[key] = child;
    }
  }
  return changed ? cloneElement(value, nextProps) : value;
}

function translateUiTree(node, t) {
  if (Array.isArray(node)) {
    let changed = false;
    const next = node.map((child, index) => {
      const translated = translateUiTree(child, t);
      if (translated !== child) changed = true;
      return translated;
    });
    return changed ? next : node;
  }
  if (!isValidElement(node)) return node;

  const nextProps = {};
  let changed = false;
  for (const [key, value] of Object.entries(node.props || {})) {
    if (key === "children") {
      const translated = translateUiTree(value, t);
      nextProps.children = translated;
      if (translated !== value) changed = true;
    } else if (TRANSLATABLE_PROPS.has(key)) {
      const translated = translateUiProp(value, t);
      nextProps[key] = translated;
      if (translated !== value) changed = true;
    } else {
      nextProps[key] = value;
    }
  }
  return changed ? cloneElement(node, nextProps) : node;
}

/**
 * Translates known, text-bearing UI props inside a rendered JSX subtree.
 * It deliberately leaves all children values untouched: those may contain
 * user data or backend content and are handled explicitly by their screens.
 */
export default function TranslatedTextTree({ children }) {
  const { t } = useLocale();
  return <>{translateUiTree(children, t)}</>;
}
