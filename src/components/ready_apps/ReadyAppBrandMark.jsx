import React, { useState } from "react";
import { Box } from "@mui/material";
import PlatformIcon from "../plans/PlatformIcon.jsx";
import wordpressMark from "../../assets/home/ready-app-wordpress.svg";
import n8nMark from "../../assets/home/ready-app-n8n.svg";
import mattermostMark from "../../assets/home/ready-app-mattermost.svg";
import synapseMark from "../../assets/home/ready-app-synapse.svg";
import uptimeKumaMark from "../../assets/home/ready-app-uptime-kuma.svg";
import forgejoMark from "../../assets/home/ready-app-forgejo.svg";

const LOCAL_BRAND_MARKS = {
  wordpress: wordpressMark,
  n8n: n8nMark,
  n8nwithpostgresandworker: n8nMark,
  mattermost: mattermostMark,
  synapse: synapseMark,
  matrix: synapseMark,
  matrixsynapse: synapseMark,
  uptimekuma: uptimeKumaMark,
  forgejo: forgejoMark,
  forgejowithpostgresql: forgejoMark,
};

const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Shared brand mark for the Ready App catalog, details, install flow and
 * deployed installations. Known apps use local branded SVGs; newly added
 * apps can use their catalog logo or the shared Simple Icons platform map.
 */
export default function ReadyAppBrandMark({ app, size = 32 }) {
  const [remoteFailed, setRemoteFailed] = useState(false);
  const keys = [app?.id, app?.catalog_id, app?.slug, app?.name].map(normalize);
  const localMark = keys.map((key) => LOCAL_BRAND_MARKS[key]).find(Boolean);
  const logo = String(app?.logo || "");
  const hasRemoteLogo = /^https?:\/\//i.test(logo) || /^\//.test(logo);
  const brandKey = app?.id || app?.catalog_id || app?.slug || app?.name || "";
  const brandLabel = app?.name || app?.catalog_id || app?.id || "Application";

  if (localMark) {
    return <Box component="img" src={localMark} alt={brandLabel} sx={{ width: size, height: size, display: "block", objectFit: "contain", flexShrink: 0 }} />;
  }

  if (hasRemoteLogo && !remoteFailed) {
    return <Box component="img" src={logo} alt={brandLabel} onError={() => setRemoteFailed(true)} sx={{ width: size, height: size, display: "block", objectFit: "contain", flexShrink: 0 }} />;
  }

  return <PlatformIcon platformKey={brandKey} label={brandLabel} size={Math.max(16, size * 0.68)} />;
}
