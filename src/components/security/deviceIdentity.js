const STORAGE_KEY = "paas_device_id";

function randomDeviceId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    if (globalThis.crypto?.getRandomValues) {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch {
    // Fall through to Math.random for legacy browsers without Web Crypto.
  }
  return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

export function getDeviceId(storage = globalThis.localStorage) {
  if (!storage) return "";
  try {
    const existing = storage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const created = randomDeviceId();
    storage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    return randomDeviceId();
  }
}

function toSafeString(value, max = 128) {
  return String(value ?? "").trim().slice(0, max);
}

export function collectClientMetadata() {
  if (typeof navigator === "undefined") return {};
  const uaData = navigator.userAgentData;
  return {
    locale: toSafeString(navigator.language || "", 64),
    timezone: (() => {
      try {
        return toSafeString(Intl.DateTimeFormat().resolvedOptions().timeZone || "", 128);
      } catch {
        return "";
      }
    })(),
    screen_width: Number.isFinite(globalThis.screen?.width) ? globalThis.screen.width : "",
    screen_height: Number.isFinite(globalThis.screen?.height) ? globalThis.screen.height : "",
    color_depth: Number.isFinite(globalThis.screen?.colorDepth) ? globalThis.screen.colorDepth : "",
    device_memory: navigator.deviceMemory ?? "",
    hardware_concurrency: navigator.hardwareConcurrency ?? "",
    touch_points: navigator.maxTouchPoints ?? 0,
    mobile: Boolean(uaData?.mobile),
    platform_hint: toSafeString(uaData?.platform || navigator.platform || "", 64),
    brands: Array.isArray(uaData?.brands)
      ? uaData.brands.map((item) => `${item.brand}/${item.version}`).join(", ").slice(0, 1000)
      : "",
  };
}

function canonicalClientMaterial(deviceId, metadata) {
  return JSON.stringify({
    device_id: deviceId,
    locale: metadata.locale || "",
    timezone: metadata.timezone || "",
    screen_width: metadata.screen_width || "",
    screen_height: metadata.screen_height || "",
    platform_hint: metadata.platform_hint || "",
    mobile: Boolean(metadata.mobile),
  });
}

async function sha256Hex(value) {
  try {
    if (globalThis.crypto?.subtle) {
      const bytes = new TextEncoder().encode(value);
      const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    // Keep login working when Web Crypto is unavailable.
  }
  return "";
}

export async function getDeviceAuthPayload(storage = globalThis.localStorage) {
  const deviceId = getDeviceId(storage);
  const clientMetadata = collectClientMetadata();
  const clientSignature =
    (await sha256Hex(canonicalClientMaterial(deviceId, clientMetadata))) || deviceId;

  return {
    device_id: deviceId,
    client: "Web browser",
    platform: clientMetadata.platform_hint || "",
    client_signature: clientSignature,
    client_metadata: clientMetadata,
  };
}
