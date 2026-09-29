const STATUS_MESSAGES = {
  400: "The request could not be accepted.",
  401: "Your session is no longer valid. Please sign in again.",
  403: "You do not have permission to perform this action.",
  404: "The requested service or resource was not found.",
  409: "This action conflicts with the service's current state.",
  422: "Some of the submitted values are invalid.",
  429: "Too many requests. Please try again shortly.",
  500: "The server failed while processing the request.",
  502: "The runtime gateway is temporarily unavailable.",
  503: "The service backend is temporarily unavailable.",
  504: "The backend timed out while processing the request.",
};

const isObject = (value) => value && typeof value === "object";

function flattenValue(value, prefix = "") {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenValue(item, prefix));
  }
  if (isObject(value)) {
    return Object.entries(value).flatMap(([key, item]) =>
      flattenValue(item, prefix ? `${prefix}.${key}` : key)
    );
  }
  const text = String(value).trim();
  return text ? [{ key: prefix, message: text }] : [];
}

function parseStringPayload(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || (!text.startsWith("{") && !text.startsWith("["))) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function getApiErrorMessage(error, fallback = "Something went wrong.") {
  const response = error?.response;
  const status = response?.status;
  const data = response?.data;

  const parsedData = parseStringPayload(data);
  const source = parsedData ?? data;

  if (typeof source === "string" && source.trim()) return source.trim();

  if (isObject(source)) {
    const fieldSource = source.errors;
    const fields = flattenValue(fieldSource);
    if (fields.length) {
      return fields
        .map(({ key, message }) => (key ? `${key}: ${message}` : message))
        .join(" · ");
    }

    const direct =
      source.detail ??
      source.message ??
      source.error_message ??
      (typeof source.error === "string" ? source.error : null);

    if (direct) return String(direct);

    const genericErrors = flattenValue(source.error);
    if (genericErrors.length) {
      return genericErrors
        .map(({ key, message }) => (key ? `${key}: ${message}` : message))
        .join(" · ");
    }
  }

  if (status && STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  if (error?.message && !/^request failed with status code/i.test(error.message)) {
    return String(error.message);
  }
  return fallback;
}

export function getApiErrorMeta(error, fallback = "Something went wrong.") {
  const status = error?.response?.status ?? error?.status ?? null;
  const data = error?.response?.data;
  const parsed = parseStringPayload(data);
  const source = parsed ?? data;
  const code = isObject(source) ? source.code ?? source.error_code ?? null : null;

  return {
    status,
    code: code ? String(code) : null,
    message: getApiErrorMessage(error, fallback),
    statusMessage: status && STATUS_MESSAGES[status] ? STATUS_MESSAGES[status] : null,
  };
}

export function describeServiceStatus(status) {
  const value = String(status || "").toLowerCase().trim();
  const labels = {
    stopped: "Stopped",
    queued: "Queued",
    deploying: "Deploying",
    running: "Running",
    failed: "Failed",
    stopping: "Stopping",
    succeeded: "Succeeded",
  };
  return labels[value] || (value ? value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Unknown");
}

export function isServiceBusy(status) {
  return ["queued", "deploying", "stopping"].includes(
    String(status || "").toLowerCase().trim()
  );
}
