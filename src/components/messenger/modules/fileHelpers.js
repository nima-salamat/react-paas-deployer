/** Keep the pre-edit source so re-opening the editor never stacks crops. */
export function attachMessengerOriginal(file, source) {
  if (!file) return file;
  try {
    const orig = source?.__messengerOriginal || source || file;
    Object.defineProperty(file, "__messengerOriginal", {
      value: orig,
      writable: true,
      configurable: true,
    });
  } catch {
    file.__messengerOriginal = source?.__messengerOriginal || source || file;
  }
  return file;
}

export function messengerOriginalOf(file) {
  return file?.__messengerOriginal || file;
}

export function guessLangFromName(name = "") {
  const n = String(name).toLowerCase();
  const map = {
    js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
    py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
    kt: "kotlin", cs: "csharp", cpp: "cpp", c: "c", php: "php",
    swift: "swift", sql: "sql", html: "html", css: "css", scss: "scss",
    json: "json", yaml: "yaml", yml: "yaml", xml: "xml",
    sh: "bash", bash: "bash", md: "markdown",
  };
  const ext = n.includes(".") ? n.split(".").pop() : "";
  return map[ext] || "";
}
