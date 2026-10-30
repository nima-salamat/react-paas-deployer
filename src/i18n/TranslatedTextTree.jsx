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
  "description",
  "tooltip",
  "emptyLabel",
  "noOptionsText",
  "buttonText",
  "aria-label",
  "alt",
  "typeLabel",
  "platformLabel",
  "kindLabel",
  "statusLabel",
]);

function translateTextNode(value, t) {
  if (typeof value !== "string" || !value.trim()) return value;
  const leading = value.match(/^\s*/)?.[0] || "";
  const trailing = value.match(/\s*$/)?.[0] || "";
  const text = value.trim();
  return leading + t(text) + trailing;
}

function translateTree(node, t) {
  if (Array.isArray(node)) {
    return node.map((child) => translateTree(child, t));
  }
  if (typeof node === "string") {
    return translateTextNode(node, t);
  }
  if (!isValidElement(node)) return node;

  const nextProps = {};
  for (const [key, value] of Object.entries(node.props || {})) {
    if (key === "children") {
      nextProps.children = translateTree(value, t);
    } else if (TRANSLATABLE_PROPS.has(key)) {
      nextProps[key] = translateTree(value, t);
    } else {
      nextProps[key] = value;
    }
  }
  return cloneElement(node, nextProps);
}

/**
 * Applies the active locale to literal UI text and common text-bearing props
 * in an already-rendered JSX subtree. Unknown values (including user data and
 * product names) pass through unchanged.
 */
export default function TranslatedTextTree({ children }) {
  const { t } = useLocale();
  return <>{translateTree(children, t)}</>;
}
