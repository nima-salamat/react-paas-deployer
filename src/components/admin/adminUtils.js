
export function hostBase() {
  return `https://${import.meta.env.VITE_API_BASE}`.replace(/\/+$/, "");
}

export function svcApi() {
  return `${hostBase()}/services`;
}

export function deployApi() {
  return `${hostBase()}/deploy`;
}

export const STATUS_COLOR = {
  open: "info", in_progress: "warning", waiting_user: "secondary",
  resolved: "success", closed: "default",
};
