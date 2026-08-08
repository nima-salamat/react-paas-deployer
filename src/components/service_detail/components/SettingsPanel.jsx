import React, { useState, useMemo, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  TextField,
  Chip,
  Alert,
  CircularProgress,
  MenuItem,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Radio,
  Collapse,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
} from "@mui/material";
import HubIcon from "@mui/icons-material/Hub";
import StorageIcon from "@mui/icons-material/Storage";
import SpeedIcon from "@mui/icons-material/Speed";
import AddIcon from "@mui/icons-material/Add";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import LinkIcon from "@mui/icons-material/Link";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import MemoryIcon from "@mui/icons-material/Memory";
import SdStorageIcon from "@mui/icons-material/SdStorage";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import EditIcon from "@mui/icons-material/Edit";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle, action }) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 1,
        flexWrap: "wrap",
        mb: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            display: "grid",
            placeItems: "center",
            bgcolor: (t) =>
              t.palette.mode === "dark"
                ? "rgba(59,130,246,0.15)"
                : "rgba(59,130,246,0.1)",
            color: "primary.main",
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
        </Box>
      </Box>
      {action}
    </Box>
  );
}

function StorageQuotaBar({ storage }) {
  if (!storage) return null;
  const quota = Number(storage.quota_mb) || 0;
  const used = Number(storage.used_mb) || 0;
  const remaining = Number(storage.remaining_mb) || 0;
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const color = pct >= 95 ? "error" : pct >= 80 ? "warning" : "primary";

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2, borderColor: "divider" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Plan storage quota
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {used.toLocaleString()} / {quota.toLocaleString()} MB
          {quota ? ` (${pct}%)` : ""}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={pct}
        color={color}
        sx={{ height: 8, borderRadius: 1, mb: 0.75 }}
      />
      <Typography variant="caption" color="text.secondary">
        Remaining: <strong>{remaining.toLocaleString()} MB</strong>
        {storage.quota_gb != null ? ` · Plan limit ${storage.quota_gb} GB` : ""}
        {" · Volumes are exclusive to this service."}
      </Typography>
    </Paper>
  );
}

function PlanCard({ plan, selected, isCurrent, onSelect, onClearSelection }) {
  const handleClick = () => {
    if (isCurrent) { onClearSelection?.(); return; }
    onSelect?.(plan);
  };
  return (
    <Paper
      elevation={0}
      onClick={handleClick}
      sx={{
        p: 2, borderRadius: 2, border: "2px solid", cursor: "pointer",
        borderColor: isCurrent ? "success.main" : selected ? "primary.main" : "divider",
        bgcolor: (t) =>
          isCurrent
            ? t.palette.mode === "dark" ? "rgba(34,197,94,0.08)" : "rgba(34,197,94,0.06)"
            : selected
            ? t.palette.mode === "dark" ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.05)"
            : t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "#fff",
        transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s",
        "&:hover": {
          borderColor: isCurrent ? "success.main" : selected ? "primary.main" : "primary.light",
          boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
        },
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{plan.name || "Plan"}</Typography>
        {isCurrent ? (
          <Chip icon={<CheckCircleIcon sx={{ fontSize: 16 }} />} label="Current" color="success" size="small" sx={{ fontWeight: 700, height: 24 }} />
        ) : (
          <Radio checked={selected && !isCurrent} size="small" color="primary" sx={{ p: 0 }} />
        )}
      </Box>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1.25 }}>
        {plan.platform && <Chip label={plan.platform} size="small" variant="outlined" sx={{ height: 22, fontSize: 11 }} />}
        {plan.plan_type && <Chip label={plan.plan_type} size="small" variant="outlined" sx={{ height: 22, fontSize: 11 }} />}
        {plan.storage_type && <Chip label={plan.storage_type} size="small" variant="outlined" sx={{ height: 22, fontSize: 11 }} />}
      </Stack>
      <Stack spacing={0.5}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <MemoryIcon sx={{ fontSize: 16, color: "text.secondary" }} />
          <Typography variant="body2" color="text.secondary">
            CPU <strong>{plan.max_cpu ?? "—"}</strong>{" · "}RAM <strong>{plan.max_ram ?? "—"}</strong>
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <SdStorageIcon sx={{ fontSize: 16, color: "text.secondary" }} />
          <Typography variant="body2" color="text.secondary">
            Storage <strong>{plan.max_storage ?? "—"} GB</strong>
          </Typography>
        </Box>
      </Stack>
      {plan.price_per_hour != null && (
        <Typography variant="body2" sx={{ mt: 1.25, fontWeight: 800, color: "primary.main" }}>
          {plan.price_per_hour} / hour
        </Typography>
      )}
    </Paper>
  );
}

function NetworkCard({ network, isAttached, onAttach, onDetach, loading }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5, borderRadius: 2,
        borderColor: isAttached ? "info.main" : "divider",
        bgcolor: (t) => isAttached
          ? t.palette.mode === "dark" ? "rgba(6,182,212,0.08)" : "rgba(6,182,212,0.05)"
          : "transparent",
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap",
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{network.name || network.id}</Typography>
          {isAttached && <Chip label="Attached" size="small" color="info" sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />}
        </Stack>
        {network.description && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
            {network.description}
          </Typography>
        )}
      </Box>
      {isAttached ? (
        <Button size="small" color="warning" variant="outlined" startIcon={<LinkOffIcon />} disabled={loading} onClick={onDetach} sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 600 }}>
          Detach
        </Button>
      ) : (
        <Button size="small" variant="contained" startIcon={<LinkIcon />} disabled={loading} onClick={() => onAttach(network)} sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700 }}>
          Attach
        </Button>
      )}
    </Paper>
  );
}

// ─── Enhanced VolumeCard ───────────────────────────────────────────────────

function VolumeCard({
  volume,
  isAttached,
  onAttach,
  onDetach,
  onDelete,
  onEdit,
  onViewFiles,
  onDownload,
  loading,
  remainingMb,
  canMutate,
  mutateReason,
}) {
  const size = Number(volume.size_mb) || 0;
  const exceeds = !isAttached && remainingMb != null && size > remainingMb;
  const bind = volume.bind || volume.default_bind || "—";
  const mode = volume.mode || volume.default_mode || "rw";
  const blocked = !canMutate;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.75,
        borderRadius: 2,
        borderColor: isAttached ? "success.main" : exceeds ? "error.light" : "divider",
        bgcolor: (t) =>
          isAttached
            ? t.palette.mode === "dark"
              ? "rgba(34,197,94,0.08)"
              : "rgba(34,197,94,0.05)"
            : "transparent",
        opacity: blocked ? 0.8 : 1,
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {volume.name}
            </Typography>
            {isAttached ? (
              <Chip label="Attached" size="small" color="success" sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
            ) : (
              <Chip label="Available" size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
            )}
            {exceeds && (
              <Chip label="Exceeds quota" size="small" color="error" sx={{ height: 20, fontSize: 11 }} />
            )}
          </Stack>
          <Stack direction="row" spacing={1.5} sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
            {volume.size_mb != null && (
              <Typography variant="caption" color="text.secondary">
                <strong>{volume.size_mb} MB</strong>
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
              {bind}
            </Typography>
            <Chip label={mode} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
          </Stack>
          <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>
            Edit is allowed only if this volume is not yet provisioned in Docker.
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.5} alignItems="center" flexShrink={0} flexWrap="wrap" useFlexGap>
          <Tooltip title={blocked ? mutateReason || "Cannot edit now" : "Edit volume metadata"}>
            <span>
              <IconButton
                size="small"
                color="primary"
                disabled={loading || blocked}
                onClick={() => onEdit?.(volume)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          {onViewFiles && (
            <Tooltip title="View files">
              <span>
                <IconButton size="small" onClick={() => onViewFiles?.(volume)} disabled={loading}>
                  <FolderOpenIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {onDownload && (
            <Tooltip title="Download archive">
              <span>
                <IconButton size="small" onClick={() => onDownload?.(volume)} disabled={loading}>
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}

          {isAttached ? (
            <Tooltip title={blocked ? mutateReason || "Service busy — detach may fail" : "Detach"}>
              <span>
                <Button
                  size="small"
                  color="warning"
                  variant="outlined"
                  disabled={loading}
                  onClick={() => onDetach?.(volume.id ?? volume.pk, volume)}
                  startIcon={<LinkOffIcon fontSize="small" />}
                  sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700 }}
                >
                  Detach
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Tooltip
              title={
                blocked
                  ? mutateReason || "Cannot attach now"
                  : exceeds
                  ? "Exceeds plan storage"
                  : "Attach"
              }
            >
              <span>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<LinkIcon />}
                  disabled={loading || exceeds || blocked}
                  onClick={() => onAttach(volume)}
                  sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700 }}
                >
                  Attach
                </Button>
              </span>
            </Tooltip>
          )}

          <Tooltip
            title={
              isAttached
                ? blocked
                  ? mutateReason || "Stop service & remove runtime, or detach first"
                  : "Delete mounted volume (service must be idle)"
                : "Delete volume permanently"
            }
          >
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={loading || (isAttached && blocked)}
                onClick={() => onDelete?.(volume)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Box>
    </Paper>
  );
}


function formatBytes(n) {
  const size = Number(n) || 0;
  if (size <= 0) return "0 B";
  if (size >= 1024 * 1024 * 1024) return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

function parseRawListingLine(line) {
  const raw = String(line ?? "").trim();
  if (!raw) return null;

  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      const obj = JSON.parse(raw);
      const path = String(obj.path || "").replace(/^\/+/, "").replace(/\\/g, "/");
      if (!path) return null;
      let type = String(obj.type || "file").toLowerCase();
      type = type.startsWith("d") ? "directory" : "file";
      const size = type === "directory" ? 0 : Math.max(0, Number(obj.size) || 0);
      return { path, type, size };
    } catch {
      /* fall through */
    }
  }

  if (raw.includes("|") && raw.split("|").length >= 3) {
    const [a, b, ...rest] = raw.split("|");
    const path = rest.join("|").replace(/^\/+/, "").replace(/\\/g, "/");
    if (!path) return null;
    const type = String(a).toLowerCase().startsWith("d") ? "directory" : "file";
    const size = type === "directory" ? 0 : Math.max(0, Number(b) || 0);
    return { path, type, size };
  }

  const normalized = raw.includes("\t") ? raw : raw.replace(/\/t/g, "\t");
  if (normalized.includes("\t")) {
    const parts = normalized.split("\t").filter((x) => x !== "");
    if (parts.length >= 4) {
      const [y, sizeS, , ...pathParts] = parts;
      const path = pathParts.join("\t").replace(/^\/+/, "").replace(/\\/g, "/");
      if (!path) return null;
      let type = "file";
      if (String(y).toLowerCase().startsWith("d") || String(y).trim() === "0") type = "directory";
      const size = type === "directory" ? 0 : Math.max(0, Number(sizeS) || 0);
      return { path, type, size };
    }
    if (parts.length === 3) {
      const [y, sizeS, p0] = parts;
      const path = String(p0 || "").replace(/^\/+/, "").replace(/\\/g, "/");
      if (!path) return null;
      let type = "file";
      if (String(y).toLowerCase().startsWith("d") || String(y).trim() === "0") type = "directory";
      const size = type === "directory" ? 0 : Math.max(0, Number(sizeS) || 0);
      return { path, type, size };
    }
    return null;
  }

  if (raw.includes("/") || /^[\w.-]+$/.test(raw)) {
    return { path: raw.replace(/^\/+/, ""), type: "file", size: 0 };
  }
  return null;
}

function normalizeVolumeFiles(input) {
  const items = Array.isArray(input) ? input : [];
  const map = new Map();

  const upsert = (entry) => {
    if (!entry?.path) return;
    const path = String(entry.path).replace(/^\.\//, "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!path || path === ".") return;
    let type = String(entry.type || "file").toLowerCase();
    type = type.startsWith("d") ? "directory" : "file";
    let size = type === "directory" ? 0 : Math.max(0, Number(entry.size) || 0);

    // If path itself embeds a protocol line, re-parse
    if (path.includes("\t") || /\/t/.test(path) || (path.includes("|") && /^(directory|file|d|f)[|]/i.test(path))) {
      const parsed = parseRawListingLine(path);
      if (parsed) {
        upsert(parsed);
        return;
      }
    }

    const prev = map.get(path);
    if (!prev) {
      map.set(path, { path, type, size });
    } else {
      // prefer richer data
      if (prev.type === "file" && type === "directory") prev.type = "directory";
      if ((prev.size || 0) === 0 && size > 0) prev.size = size;
    }
  };

  for (const raw of items) {
    if (raw == null) continue;
    if (typeof raw === "string") {
      const parsed = parseRawListingLine(raw);
      if (parsed) upsert(parsed);
      continue;
    }
    if (typeof raw === "object") {
      // Backend may accidentally put the whole protocol into path
      const pathField = raw.path ?? raw.name ?? raw.file ?? "";
      if (typeof pathField === "string" && (pathField.includes("\t") || /\/t/.test(pathField) || pathField.startsWith("f\t") || pathField.startsWith("d\t") || pathField.startsWith("f/t") || pathField.startsWith("d/t"))) {
        const parsed = parseRawListingLine(pathField);
        if (parsed) {
          // merge size from object if better
          if (parsed.size === 0 && Number(raw.size) > 0) parsed.size = Number(raw.size);
          upsert(parsed);
          continue;
        }
      }
      upsert({
        path: pathField,
        type: raw.type,
        size: raw.size,
      });
    }
  }

  // Ensure parent directories exist so the tree can expand
  const paths = [...map.keys()];
  for (const p of paths) {
    const segs = p.split("/").filter(Boolean);
    let acc = "";
    for (let i = 0; i < segs.length - 1; i += 1) {
      acc = acc ? `${acc}/${segs[i]}` : segs[i];
      if (!map.has(acc)) map.set(acc, { path: acc, type: "directory", size: 0 });
      else map.get(acc).type = "directory";
    }
  }

  return [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function buildFileTree(entries) {
  const root = { name: "", path: "", type: "directory", size: 0, children: [] };
  const nodeMap = new Map([["", root]]);

  const ensureDir = (dirPath) => {
    if (nodeMap.has(dirPath)) return nodeMap.get(dirPath);
    const parts = dirPath.split("/").filter(Boolean);
    const name = parts[parts.length - 1] || "";
    const parentPath = parts.slice(0, -1).join("/");
    const parent = ensureDir(parentPath);
    const node = { name, path: dirPath, type: "directory", size: 0, children: [] };
    parent.children.push(node);
    nodeMap.set(dirPath, node);
    return node;
  };

  for (const entry of entries) {
    const parts = entry.path.split("/").filter(Boolean);
    if (!parts.length) continue;
    const name = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join("/");
    const parent = ensureDir(parentPath);
    if (entry.type === "directory") {
      const existing = nodeMap.get(entry.path);
      if (existing) {
        existing.size = entry.size || 0;
      } else {
        const node = { name, path: entry.path, type: "directory", size: 0, children: [] };
        parent.children.push(node);
        nodeMap.set(entry.path, node);
      }
    } else {
      parent.children.push({
        name,
        path: entry.path,
        type: "file",
        size: entry.size || 0,
        children: [],
      });
    }
  }

  const sortRec = (node) => {
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortRec);
  };
  sortRec(root);
  return root.children;
}

function TreeRow({ node, depth, expanded, onToggle }) {
  const isDir = node.type === "directory";
  const isOpen = Boolean(expanded[node.path]);
  const hasKids = isDir && node.children && node.children.length > 0;

  return (
    <>
      <Box
        onClick={() => {
          if (isDir) onToggle(node.path);
        }}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          py: 0.65,
          pr: 1.5,
          pl: 1 + depth * 1.5,
          cursor: isDir ? "pointer" : "default",
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: isDir
            ? (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)")
            : "transparent",
          "&:hover": {
            bgcolor: (t) =>
              t.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
          },
        }}
      >
        <Box sx={{ width: 22, flexShrink: 0, display: "flex", justifyContent: "center" }}>
          {isDir ? (
            hasKids ? (
              isOpen ? (
                <ExpandMoreIcon sx={{ fontSize: 18, color: "text.secondary" }} />
              ) : (
                <ExpandLessIcon
                  sx={{ fontSize: 18, color: "text.secondary", transform: "rotate(90deg)" }}
                />
              )
            ) : (
              <Box sx={{ width: 18 }} />
            )
          ) : (
            <Box sx={{ width: 18 }} />
          )}
        </Box>

        {isDir ? (
          <FolderOpenIcon sx={{ fontSize: 18, color: "warning.main", flexShrink: 0 }} />
        ) : (
          <InsertDriveFileIcon sx={{ fontSize: 18, color: "text.secondary", flexShrink: 0 }} />
        )}

        <Typography
          variant="body2"
          sx={{
            flex: 1,
            minWidth: 0,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 13,
            fontWeight: isDir ? 700 : 400,
            wordBreak: "break-all",
          }}
        >
          {node.name || node.path}
        </Typography>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flexShrink: 0, fontVariantNumeric: "tabular-nums", minWidth: 64, textAlign: "right" }}
        >
          {isDir ? "—" : formatBytes(node.size)}
        </Typography>
      </Box>

      {isDir && isOpen
        ? (node.children || []).map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))
        : null}
    </>
  );
}

function FilesDialog({ open, onClose, volumeName, files, loading, error }) {
  const entries = React.useMemo(() => normalizeVolumeFiles(files), [files]);
  const tree = React.useMemo(() => buildFileTree(entries), [entries]);

  const fileCount = entries.filter((e) => e.type === "file").length;
  const dirCount = entries.filter((e) => e.type === "directory").length;
  const totalBytes = entries.reduce((s, e) => s + (e.type === "file" ? e.size || 0 : 0), 0);

  // Expand top-level dirs by default
  const [expanded, setExpanded] = React.useState({});
  React.useEffect(() => {
    if (!open) return;
    const init = {};
    tree.forEach((n) => {
      if (n.type === "directory") init[n.path] = true;
    });
    setExpanded(init);
  }, [open, tree]);

  const onToggle = React.useCallback((path) => {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
  }, []);

  const expandAll = () => {
    const all = {};
    const walk = (nodes) => {
      nodes.forEach((n) => {
        if (n.type === "directory") {
          all[n.path] = true;
          walk(n.children || []);
        }
      });
    };
    walk(tree);
    setExpanded(all);
  };

  const collapseAll = () => setExpanded({});

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: 2.5 } }}>
      <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "flex-start", gap: 1, pr: 2 }}>
        <FolderOpenIcon color="primary" sx={{ mt: 0.3 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {volumeName || "volume"}
          </Typography>
          {!loading && !error ? (
            <Typography variant="caption" color="text.secondary">
              {dirCount} folders · {fileCount} files · {formatBytes(totalBytes)}
            </Typography>
          ) : null}
        </Box>
        {!loading && !error && tree.length > 0 ? (
          <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
            <Button size="small" onClick={expandAll} sx={{ textTransform: "none", fontWeight: 600 }}>
              Expand
            </Button>
            <Button size="small" onClick={collapseAll} sx={{ textTransform: "none", fontWeight: 600 }}>
              Collapse
            </Button>
          </Stack>
        ) : null}
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        {loading ? (
          <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={28} />
          </Box>
        ) : error ? (
          <Box sx={{ p: 2 }}>
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {error}
            </Alert>
          </Box>
        ) : tree.length === 0 ? (
          <Box sx={{ py: 5, textAlign: "center" }}>
            <InsertDriveFileIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
            <Typography color="text.secondary">No files in this volume.</Typography>
          </Box>
        ) : (
          <Box sx={{ maxHeight: { xs: "55vh", sm: "62vh" }, overflow: "auto" }}>
            {tree.map((node) => (
              <TreeRow
                key={node.path}
                node={node}
                depth={0}
                expanded={expanded}
                onToggle={onToggle}
              />
            ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", fontWeight: 600 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}


// ─────────────────────────────────────────────
// Main SettingsPanel
// ─────────────────────────────────────────────

export default function SettingsPanel({
  service,
  planDetail,
  networkName,
  networkDetail,
  selectedNetworkId,
  setSelectedNetworkId,
  availableNetworks,
  networkActionLoading,
  onAttachNetwork,
  onDetachNetwork,
  onCreateNetwork,
  attachedVolumes,
  availableVolumes,
  selectedVolumeId,
  setSelectedVolumeId,
  volumeActionLoading,
  onAttachVolume,
  onDetachVolume,
  onCreateVolume,
  onUpdateVolume,
  onDeleteVolume,
  onViewVolumeFiles,
  onDownloadVolume,
  canMutateVolumes = true,
  volumeMutateReason = "",
  onPurgeRuntime,
  purgeRuntimeLoading = false,
  onDeleteService,
  deleteServiceLoading = false,
  availablePlans,
  plansLoading,
  selectedPlanId,
  setSelectedPlanId,
  planActionLoading,
  onApplyPlan,
  error,
  successMessage,
}) {
  // Network dialog
  const [createNetworkOpen, setCreateNetworkOpen] = useState(false);
  const [newNetworkName, setNewNetworkName] = useState("");
  const [newNetworkDesc, setNewNetworkDesc] = useState("");
  const [creatingNetwork, setCreatingNetwork] = useState(false);

  // Volume create dialog
  const [createVolumeOpen, setCreateVolumeOpen] = useState(false);
  const [newVolumeName, setNewVolumeName] = useState("");
  const [newVolumeSize, setNewVolumeSize] = useState("1024");
  const [newVolumeBind, setNewVolumeBind] = useState("/data");
  const [newVolumeMode, setNewVolumeMode] = useState("rw");
  const [creatingVolume, setCreatingVolume] = useState(false);
  const [createVolumeError, setCreateVolumeError] = useState(null);

  // Edit volume dialog
  const [editVolumeOpen, setEditVolumeOpen] = useState(false);
  const [editingVolume, setEditingVolume] = useState(null);
  const [editVolumeForm, setEditVolumeForm] = useState({
    name: "",
    size_mb: "1024",
    default_bind: "/data",
    default_mode: "rw",
  });
  const [editingVolumeSaving, setEditingVolumeSaving] = useState(false);
  const [editVolumeError, setEditVolumeError] = useState(null);

  // Files dialog state
  const [filesDialogOpen, setFilesDialogOpen] = useState(false);
  const [filesDialogTitle, setFilesDialogTitle] = useState("");
  const [filesDialogList, setFilesDialogList] = useState([]);
  const [filesDialogLoading, setFilesDialogLoading] = useState(false);
  const [filesDialogError, setFilesDialogError] = useState(null);

  // Delete confirm dialog
  const [deleteVolumeDialog, setDeleteVolumeDialog] = useState({ open: false, volume: null, loading: false });

  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [deleteServiceConfirmOpen, setDeleteServiceConfirmOpen] = useState(false);

  // Local mount overrides so Detach/Attach UI updates even if parent
  // keeps listing volumes only by service_id (soft-detach keeps ownership).
  // key = volume id string → true=mounted, false=soft-detached
  const [mountOverrides, setMountOverrides] = useState({});

  // UI toggles
  const [applyImmediately, setApplyImmediately] = useState(false);
  const [showAllNetworks, setShowAllNetworks] = useState(false);
  const [showAvailableVolumes, setShowAvailableVolumes] = useState(true);

  // ── Storage quota ──────────────────────────────────────────────────────
  const storage = useMemo(() => {
    return (
      service?.storage ||
      (planDetail?.max_storage != null
        ? {
            quota_mb: Math.round(Number(planDetail.max_storage) * 1024),
            used_mb: (attachedVolumes || []).reduce((s, v) => s + (Number(v.size_mb) || 0), 0),
            remaining_mb: 0,
            quota_gb: Number(planDetail.max_storage),
          }
        : null)
    );
  }, [service, planDetail, attachedVolumes]);

  const storageNormalized = useMemo(() => {
    if (!storage) return null;
    const quota = Number(storage.quota_mb) || 0;
    const used = Number(storage.used_mb) || 0;
    const remaining = storage.remaining_mb != null ? Number(storage.remaining_mb) : Math.max(0, quota - used);
    return { ...storage, remaining_mb: remaining };
  }, [storage]);

  const remainingMb = storageNormalized?.remaining_mb ?? null;

  // Idle service ⇒ UI allows attach/detach; backend still enforces container absence.
  const serviceStatus = String(
    service?.status ??
      service?.deploy_status ??
      service?.state ??
      service?.service_status ??
      ""
  )
    .toLowerCase()
    .trim();
  const statusBusy = ["queued", "deploying", "stopping", "running", "pending", "updating..."].includes(
    serviceStatus
  );
  // When status is stopped/failed/succeeded/empty, enable volume mutations in UI.
  // Parent canMutateVolumes=false is ignored for idle statuses (was blocking detach incorrectly).
  const effectiveCanMutate = !statusBusy;
  const effectiveMutateReason = statusBusy
    ? volumeMutateReason ||
      `Service is "${serviceStatus || "busy"}". Stop it before changing volumes.`
    : volumeMutateReason || "";

  const serviceIdStr = String(
    service?.id ?? service?.pk ?? service?.uuid ?? ""
  );

  const volumeIdOf = (v) => String(v?.id ?? v?.pk ?? "");

  const isVolumeMounted = useCallback(
    (v) => {
      if (!v) return false;
      const id = volumeIdOf(v);
      // 1) Local override after attach/detach (survives parent re-fetch mistakes)
      if (Object.prototype.hasOwnProperty.call(mountOverrides, id)) {
        return !!mountOverrides[id];
      }
      // 2) Explicit API flag (authoritative from backend list)
      if (typeof v.is_mounted === "boolean") return v.is_mounted;
      // 3) service_attachments from API
      if (v.service_attachments != null && typeof v.service_attachments === "object") {
        const atts = v.service_attachments;
        if (Object.keys(atts).length === 0) return false;
        if (serviceIdStr && atts[serviceIdStr]) return true;
        return Object.keys(atts).length > 0;
      }
      // 4) Fallback: parent list membership
      const inAttached = (attachedVolumes || []).some((x) => volumeIdOf(x) === id);
      const inAvailable = (availableVolumes || []).some((x) => volumeIdOf(x) === id);
      if (inAttached && !inAvailable) return true;
      if (inAvailable && !inAttached) return false;
      return inAttached;
    },
    [mountOverrides, serviceIdStr, attachedVolumes, availableVolumes]
  );

  // Merge both lists; split by real mount state (not parent buckets)
  const { mountedList, unmountedList } = useMemo(() => {
    const map = new Map();
    for (const v of [...(attachedVolumes || []), ...(availableVolumes || [])]) {
      const id = volumeIdOf(v);
      if (!id) continue;
      map.set(id, v);
    }
    const all = [...map.values()];
    const mounted = [];
    const unmounted = [];
    for (const v of all) {
      if (isVolumeMounted(v)) mounted.push(v);
      else unmounted.push(v);
    }
    return { mountedList: mounted, unmountedList: unmounted };
  }, [attachedVolumes, availableVolumes, isVolumeMounted]);

  // ── Plan helpers ───────────────────────────────────────────────────────
  const currentPlatform = useMemo(() => {
    const raw = planDetail?.platform ?? service?.plan?.platform ?? service?.plan_detail?.platform ?? "";
    return String(raw || "").toLowerCase().trim();
  }, [planDetail, service]);

  const currentPlanId = useMemo(() => {
    const candidates = [
      planDetail?.id, planDetail?.pk,
      service?.plan?.id, service?.plan?.pk,
      typeof service?.plan === "string" || typeof service?.plan === "number" ? service.plan : null,
    ];
    for (const c of candidates) {
      if (c != null && String(c).trim() !== "") return String(c);
    }
    return "";
  }, [planDetail, service]);

  const samePlatformPlans = useMemo(() => {
    if (!Array.isArray(availablePlans)) return [];
    if (!currentPlatform) return availablePlans;
    return availablePlans.filter((p) => String(p.platform || "").toLowerCase().trim() === currentPlatform);
  }, [availablePlans, currentPlatform]);

  const currentNetworkId = useMemo(() => {
    return String(
      service?.network?.id ?? service?.network?.pk ?? service?.network ??
      networkDetail?.id ?? networkDetail?.pk ?? ""
    );
  }, [service, networkDetail]);

  // ── Network handlers ───────────────────────────────────────────────────
  const handleCreateNetwork = async () => {
    if (!newNetworkName.trim()) return;
    setCreatingNetwork(true);
    try {
      await onCreateNetwork?.({ name: newNetworkName.trim(), description: newNetworkDesc.trim() });
      setCreateNetworkOpen(false);
      setNewNetworkName("");
      setNewNetworkDesc("");
    } finally {
      setCreatingNetwork(false);
    }
  };

  // ── Volume handlers ────────────────────────────────────────────────────
  const handleOpenEditVolume = (volume) => {
    setEditVolumeError(null);
    setEditingVolume(volume);
    setEditVolumeForm({
      name: volume?.name || "",
      size_mb: String(volume?.size_mb ?? 1024),
      default_bind: volume?.default_bind || volume?.bind || "/data",
      default_mode: volume?.default_mode || volume?.mode || "rw",
    });
    setEditVolumeOpen(true);
  };

  const handleSaveEditVolume = async () => {
    if (!editingVolume) return;
    setEditVolumeError(null);
    const n = editVolumeForm.name.trim();
    const bind = editVolumeForm.default_bind.trim();
    const size = Number(editVolumeForm.size_mb);
    if (!n) {
      setEditVolumeError("Name is required.");
      return;
    }
    if (!bind.startsWith("/")) {
      setEditVolumeError("Bind must be an absolute path, e.g. /data");
      return;
    }
    if (!size || size < 1) {
      setEditVolumeError("Valid size (MB) is required.");
      return;
    }
    setEditingVolumeSaving(true);
    try {
      await onUpdateVolume?.(editingVolume, {
        name: n,
        size_mb: size,
        default_bind: bind,
        default_mode: editVolumeForm.default_mode || "rw",
      });
      setEditVolumeOpen(false);
      setEditingVolume(null);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.response?.data?.errors ||
        err?.message ||
        "Unable to update volume. If it exists in Docker, fields are locked.";
      setEditVolumeError(typeof msg === "object" ? JSON.stringify(msg) : String(msg));
    } finally {
      setEditingVolumeSaving(false);
    }
  };

  const handleCreateVolume = async () => {
    setCreateVolumeError(null);
    if (!newVolumeName.trim()) return;
    const size = Number(newVolumeSize);
    if (!Number.isFinite(size) || size <= 0) { setCreateVolumeError("Size must be a positive number (MB)."); return; }
    const bind = String(newVolumeBind || "").trim();
    if (!bind) { setCreateVolumeError("Bind directory is required."); return; }
    if (remainingMb != null && size > remainingMb) {
      setCreateVolumeError(`Not enough storage. Requested ${size} MB, remaining ${remainingMb} MB.`);
      return;
    }
    setCreatingVolume(true);
    try {
      await onCreateVolume?.({
        name: newVolumeName.trim(),
        size_mb: size,
        default_bind: bind,
        default_mode: newVolumeMode || "rw",
        service: service?.id ?? service?.pk ?? undefined,
      });
      setCreateVolumeOpen(false);
      setNewVolumeName(""); setNewVolumeSize("1024"); setNewVolumeBind("/data"); setNewVolumeMode("rw");
    } catch (err) {
      const msg =
        err?.response?.data?.errors?.size_mb ||
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        "Unable to create volume.";
      setCreateVolumeError(typeof msg === "object" ? JSON.stringify(msg) : String(msg));
      throw err;
    } finally {
      setCreatingVolume(false);
    }
  };

  const handleViewFiles = useCallback(async (volume) => {
    setFilesDialogTitle(volume.name || "volume");
    setFilesDialogList([]);
    setFilesDialogError(null);
    setFilesDialogLoading(true);
    setFilesDialogOpen(true);
    try {
      const result = await onViewVolumeFiles?.(volume);
      setFilesDialogList(Array.isArray(result) ? result : []);
    } catch (err) {
      setFilesDialogError(err?.response?.data?.detail || err?.message || "Unable to load files.");
    } finally {
      setFilesDialogLoading(false);
    }
  }, [onViewVolumeFiles]);

  const handleDeleteVolume = useCallback((volume) => {
    setDeleteVolumeDialog({ open: true, volume, loading: false });
  }, []);

  const confirmDeleteVolume = useCallback(async () => {
    const volume = deleteVolumeDialog.volume;
    if (!volume) return;
    setDeleteVolumeDialog((d) => ({ ...d, loading: true }));
    try {
      await onDeleteVolume?.(volume);
    } finally {
      setDeleteVolumeDialog({ open: false, volume: null, loading: false });
    }
  }, [deleteVolumeDialog.volume, onDeleteVolume]);

  const handleConfirmPurgeRuntime = useCallback(async () => {
    try {
      await onPurgeRuntime?.();
    } finally {
      setPurgeConfirmOpen(false);
    }
  }, [onPurgeRuntime]);

  const handleConfirmDeleteService = useCallback(async () => {
    if (!onDeleteService) {
      window.alert(
        "onDeleteService prop is not wired in the parent page. " +
          "Pass onDeleteService={() => api.delete(`/service/${id}/`)} to enable deletion."
      );
      return;
    }
    try {
      await onDeleteService();
      setDeleteServiceConfirmOpen(false);
      if (typeof window !== "undefined") {
        window.location.href = "/service";
      }
    } catch (err) {
      console.error(err);
      window.alert(err?.response?.data?.detail || err?.message || "Delete failed");
    }
  }, [onDeleteService]);


  const handleDetachVolume = useCallback(
    async (id, volume) => {
      const vid = String(id ?? volumeIdOf(volume) ?? "");
      if (!vid || vid === "undefined" || vid === "null") {
        window.alert("Detach failed: volume id is missing");
        return;
      }
      try {
        if (!onDetachVolume) {
          throw new Error(
            "onDetachVolume is not provided by parent. " +
              "Wire: onDetachVolume={(id) => api.post(`/volume/${id}/detach/`)}"
          );
        }
        const result = await onDetachVolume(vid, volume);
        // Mark unmounted locally so UI moves card even if parent list is stale
        setMountOverrides((prev) => ({ ...prev, [vid]: false }));
        // If parent returned payload with is_mounted still true, keep override false
        if (result && result.is_mounted === true) {
          console.warn("Detach API returned is_mounted=true — backend may not have applied detach", result);
        }
        return result;
      } catch (err) {
        console.error("detach error", err);
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.detail ||
          (typeof err?.response?.data === "string" ? err.response.data : null) ||
          err?.message ||
          "Detach failed";
        window.alert(String(msg));
      }
    },
    [onDetachVolume]
  );

  const handleAttachVolume = useCallback(
    async (idOrVolume) => {
      const vid =
        typeof idOrVolume === "object"
          ? volumeIdOf(idOrVolume)
          : String(idOrVolume ?? "");
      try {
        if (onAttachVolume) {
          await onAttachVolume(vid);
        } else {
          throw new Error("onAttachVolume is not provided by parent");
        }
        setMountOverrides((prev) => ({ ...prev, [vid]: true }));
      } catch (err) {
        console.error(err);
        window.alert(
          err?.response?.data?.error ||
            err?.response?.data?.detail ||
            err?.message ||
            "Attach failed"
        );
        throw err;
      }
    },
    [onAttachVolume]
  );

  // ─────────────────────────────────────────────────────────────────────
  return (
    <Stack spacing={2.5} sx={{ maxWidth: 960 }}>
      {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
      {successMessage && <Alert severity="success" sx={{ borderRadius: 2 }}>{successMessage}</Alert>}

      {/* ═══════════════ NETWORK ═══════════════ */}
      <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2.5, border: "1px solid", borderColor: "divider" }}>
        <SectionHeader
          icon={<HubIcon fontSize="small" />}
          title="Network"
          subtitle="One private network can be attached to this service."
          action={
            <Button size="small" startIcon={<AddIcon />} variant="outlined" onClick={() => setCreateNetworkOpen(true)} sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 600 }}>
              New
            </Button>
          }
        />

        {/* Currently attached */}
        <Paper
          variant="outlined"
          sx={{
            p: 1.5, mb: 2, borderRadius: 2,
            borderColor: currentNetworkId ? "info.main" : "divider",
            bgcolor: (t) => currentNetworkId
              ? t.palette.mode === "dark" ? "rgba(6,182,212,0.08)" : "rgba(6,182,212,0.05)"
              : t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "grey.50",
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap spacing={1}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Currently attached</Typography>
              <Typography variant="body1" sx={{ fontWeight: 800 }}>
                {networkName && networkName !== "—" ? networkName : "No network"}
              </Typography>
            </Box>
            {currentNetworkId && (
              <Button size="small" color="warning" variant="outlined" startIcon={<LinkOffIcon />} disabled={networkActionLoading} onClick={onDetachNetwork} sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 600 }}>
                Detach
              </Button>
            )}
          </Stack>
        </Paper>

        <Button
          size="small"
          endIcon={showAllNetworks ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={() => setShowAllNetworks((v) => !v)}
          sx={{ mb: 1, textTransform: "none", fontWeight: 600 }}
        >
          {showAllNetworks ? "Hide networks" : `Show all networks (${(availableNetworks || []).length})`}
        </Button>

        <Collapse in={showAllNetworks}>
          <Stack spacing={1}>
            {(availableNetworks || []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">No networks yet. Create one with the New button.</Typography>
            ) : (
              (availableNetworks || []).map((n) => {
                const nid = String(n.id ?? n.pk ?? "");
                return (
                  <NetworkCard
                    key={nid}
                    network={n}
                    isAttached={nid && nid === currentNetworkId}
                    loading={networkActionLoading}
                    onDetach={onDetachNetwork}
                    onAttach={() => onAttachNetwork?.(nid)}
                  />
                );
              })
            )}
          </Stack>
        </Collapse>
      </Paper>

      {/* ═══════════════ VOLUMES ═══════════════ */}
      <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2.5, border: "1px solid", borderColor: "divider" }}>
        <SectionHeader
          icon={<StorageIcon fontSize="small" />}
          title="Volumes"
          subtitle="Exclusive storage for this service. Volumes are not shareable."
          action={
            <Button
              size="small" startIcon={<AddIcon />} variant="outlined"
              onClick={() => { setCreateVolumeError(null); setCreateVolumeOpen(true); }}
              disabled={(remainingMb != null && remainingMb <= 0) || !effectiveCanMutate}
              sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 600 }}
            >
              New
            </Button>
          }
        />

        <StorageQuotaBar storage={storageNormalized} />

        <Alert
          severity={effectiveCanMutate ? "info" : "warning"}
          sx={{ mb: 2, borderRadius: 2 }}
        >
          <Typography variant="body2" sx={{ lineHeight: 1.45 }}>
            {effectiveCanMutate
              ? "Quota counts every volume owned by this service (attached and soft-detached). Name/size/path lock after Docker provision. Soft-detached volumes can be deleted anytime; mounted ones need an idle runtime."
              : effectiveMutateReason ||
                "Stop the service before changing volumes. If a container still exists, use Danger zone → Remove runtime."}
          </Typography>
        </Alert>

        {/* Attached (mounted) volumes — split by is_mounted, not parent buckets */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Attached ({mountedList.length})
        </Typography>
        {mountedList.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            No volumes mounted on this service.
          </Typography>
        ) : (
          <Stack spacing={1} sx={{ mb: 2 }}>
            {mountedList.map((v) => (
              <VolumeCard
                key={v.id ?? v.pk}
                volume={v}
                isAttached
                loading={volumeActionLoading}
                onDetach={handleDetachVolume}
                onDelete={handleDeleteVolume}
                onEdit={handleOpenEditVolume}
                onViewFiles={handleViewFiles}
                onDownload={onDownloadVolume}
                remainingMb={remainingMb}
                canMutate={effectiveCanMutate}
                mutateReason={effectiveMutateReason}
              />
            ))}
          </Stack>
        )}

        {/* Available / soft-detached volumes */}
        <Button
          size="small"
          endIcon={showAvailableVolumes ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={() => setShowAvailableVolumes((v) => !v)}
          sx={{ mb: 1, textTransform: "none", fontWeight: 600 }}
        >
          {showAvailableVolumes
            ? "Hide available volumes"
            : `Show available volumes (${unmountedList.length})`}
        </Button>

        <Collapse in={showAvailableVolumes}>
          <Stack spacing={1}>
            {unmountedList.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No unmounted volumes. Create one with the New button.
              </Typography>
            ) : (
              unmountedList.map((v) => {
                const vid = String(v.id ?? v.pk ?? "");
                return (
                  <VolumeCard
                    key={vid}
                    volume={v}
                    isAttached={false}
                    loading={volumeActionLoading}
                    onAttach={() => handleAttachVolume(vid)}
                    onDelete={handleDeleteVolume}
                    onEdit={handleOpenEditVolume}
                    onViewFiles={handleViewFiles}
                    onDownload={onDownloadVolume}
                    remainingMb={remainingMb}
                    canMutate={effectiveCanMutate}
                    mutateReason={effectiveMutateReason}
                  />
                );
              })
            )}
          </Stack>
        </Collapse>
      </Paper>

      {/* ═══════════════ PLAN ═══════════════ */}
      <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2.5, border: "1px solid", borderColor: "divider" }}>
        <SectionHeader
          icon={<SpeedIcon fontSize="small" />}
          title="Plan"
          subtitle={
            currentPlatform
              ? `Plans for platform "${currentPlatform}". Current plan cannot be re-selected.`
              : "Choose a plan for this service."
          }
        />

        {plansLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : samePlatformPlans.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No plans available for this platform.</Typography>
        ) : (
          <>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" },
                gap: 1.5, mb: 2,
              }}
            >
              {samePlatformPlans.map((p) => {
                const pid = String(p.id ?? p.pk ?? "");
                const isCurrent = pid === currentPlanId;
                const isSelected = pid === String(selectedPlanId || "") && !isCurrent;
                return (
                  <PlanCard
                    key={pid}
                    plan={p}
                    isCurrent={isCurrent}
                    selected={isSelected}
                    onSelect={(plan) => setSelectedPlanId?.(String(plan.id ?? plan.pk))}
                    onClearSelection={() => setSelectedPlanId?.("")}
                  />
                );
              })}
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between">
              <FormControlLabel
                control={
                  <Switch
                    checked={applyImmediately}
                    onChange={(e) => setApplyImmediately(e.target.checked)}
                    size="small"
                    disabled={!selectedPlanId || String(selectedPlanId) === currentPlanId}
                  />
                }
                label={<Typography variant="body2">Apply immediately (redeploy if a deploy is selected)</Typography>}
              />
              <Button
                variant="contained" size="medium"
                disabled={!selectedPlanId || String(selectedPlanId) === currentPlanId || planActionLoading}
                onClick={() => onApplyPlan?.(selectedPlanId, applyImmediately)}
                sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700, minWidth: 140, px: 3 }}
              >
                {planActionLoading ? "Applying..." : "Apply plan"}
              </Button>
            </Stack>
          </>
        )}
      </Paper>


      {/* ═══════════════ DANGER ZONE ═══════════════ */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: 2.5,
          border: "1px solid",
          borderColor: "error.light",
          bgcolor: (t) =>
            t.palette.mode === "dark" ? "rgba(239,68,68,0.06)" : "rgba(239,68,68,0.03)",
        }}
      >
        <SectionHeader
          icon={<DeleteIcon fontSize="small" color="error" />}
          title="Danger zone"
          subtitle="Destructive actions. Runtime must be removed before volume topology changes."
        />

        <Stack spacing={1.5}>
          <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2, borderColor: "divider" }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Remove container & image
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Force-stop and delete the Docker container and image for this service.
                  Required before attach / detach / edit of volumes while a runtime still exists.
                </Typography>
              </Box>
              <Button
                color="error"
                variant="outlined"
                disabled={!onPurgeRuntime || purgeRuntimeLoading}
                onClick={() => setPurgeConfirmOpen(true)}
                sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}
              >
                {purgeRuntimeLoading ? "Removing…" : "Remove runtime"}
              </Button>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2, borderColor: "error.light" }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "error.main" }}>
                  Delete this service
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {statusBusy
                    ? `Service is currently "${serviceStatus}". Stop it, then delete.`
                    : "Permanently delete this service. Runtime is already idle — you can delete now. You will be redirected to /service."}
                </Typography>
              </Box>
              <Button
                color="error"
                variant="contained"
                disabled={deleteServiceLoading || statusBusy}
                onClick={() => setDeleteServiceConfirmOpen(true)}
                sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0 }}
              >
                {deleteServiceLoading
                  ? "Deleting…"
                  : statusBusy
                  ? "Stop service first"
                  : "Delete service"}
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Paper>

      {/* ═══════════ Create Network Dialog ═══════════ */}
      <Dialog
        open={createNetworkOpen}
        onClose={() => !creatingNetwork && setCreateNetworkOpen(false)}
        fullWidth maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 2.5 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Create network</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <TextField autoFocus fullWidth size="small" label="Name" value={newNetworkName} onChange={(e) => setNewNetworkName(e.target.value)} />
            <TextField fullWidth size="small" label="Description (optional)" value={newNetworkDesc} onChange={(e) => setNewNetworkDesc(e.target.value)} multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateNetworkOpen(false)} disabled={creatingNetwork} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateNetwork} disabled={!newNetworkName.trim() || creatingNetwork} sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1.5 }}>
            {creatingNetwork ? "Creating..." : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══════════ Create Volume Dialog ═══════════ */}
      <Dialog
        open={createVolumeOpen}
        onClose={() => !creatingVolume && setCreateVolumeOpen(false)}
        fullWidth maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 2.5 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Create volume</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            {storageNormalized && (
              <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                Remaining quota: <strong>{storageNormalized.remaining_mb.toLocaleString()} MB</strong>
                {" "}(plan {storageNormalized.quota_gb ?? "—"} GB). This volume will be exclusive to this service.
              </Alert>
            )}
            {createVolumeError && <Alert severity="error" sx={{ borderRadius: 1.5 }}>{createVolumeError}</Alert>}
            <TextField
              autoFocus fullWidth size="small" label="Name" value={newVolumeName}
              onChange={(e) => setNewVolumeName(e.target.value)}
              helperText="Unique volume name"
            />
            <TextField
              fullWidth size="small" label="Size (MB)" type="number" value={newVolumeSize}
              onChange={(e) => setNewVolumeSize(e.target.value)}
              inputProps={{ min: 1, max: remainingMb != null ? remainingMb : undefined }}
              helperText={remainingMb != null ? `Max allowed by quota: ${remainingMb} MB` : undefined}
              error={remainingMb != null && Number(newVolumeSize) > remainingMb}
            />
            <TextField
              fullWidth size="small" label="Bind directory" value={newVolumeBind}
              onChange={(e) => setNewVolumeBind(e.target.value)}
              placeholder="/data"
              helperText="Path inside container (e.g. /data, /var/lib/mysql)"
            />
            <TextField
              select fullWidth size="small" label="Access mode" value={newVolumeMode}
              onChange={(e) => setNewVolumeMode(e.target.value)}
            >
              <MenuItem value="rw">Read-write (rw)</MenuItem>
              <MenuItem value="ro">Read-only (ro)</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateVolumeOpen(false)} disabled={creatingVolume} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained" onClick={handleCreateVolume}
            disabled={
              !newVolumeName.trim() || !String(newVolumeBind || "").trim() || creatingVolume ||
              (remainingMb != null && Number(newVolumeSize) > remainingMb)
            }
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1.5 }}
          >
            {creatingVolume ? "Creating..." : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      
      {/* ═══════════ Edit Volume Dialog ═══════════ */}
      <Dialog
        open={editVolumeOpen}
        onClose={() => !editingVolumeSaving && setEditVolumeOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 2.5 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Edit volume</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <Alert severity="info" sx={{ borderRadius: 1.5 }}>
              Metadata can be changed only while this volume is <strong>not</strong> provisioned in Docker.
              After the first deploy, name/size/path/mode are locked.
            </Alert>
            {editVolumeError && (
              <Alert severity="error" sx={{ borderRadius: 1.5 }}>
                {editVolumeError}
              </Alert>
            )}
            <TextField
              autoFocus
              fullWidth
              size="small"
              label="Name"
              value={editVolumeForm.name}
              onChange={(e) => setEditVolumeForm((p) => ({ ...p, name: e.target.value }))}
            />
            <TextField
              fullWidth
              size="small"
              label="Size (MB)"
              type="number"
              value={editVolumeForm.size_mb}
              onChange={(e) => setEditVolumeForm((p) => ({ ...p, size_mb: e.target.value }))}
              inputProps={{ min: 1 }}
            />
            <TextField
              fullWidth
              size="small"
              label="Bind directory"
              value={editVolumeForm.default_bind}
              onChange={(e) => setEditVolumeForm((p) => ({ ...p, default_bind: e.target.value }))}
              placeholder="/data"
            />
            <TextField
              select
              fullWidth
              size="small"
              label="Access mode"
              value={editVolumeForm.default_mode}
              onChange={(e) => setEditVolumeForm((p) => ({ ...p, default_mode: e.target.value }))}
            >
              <MenuItem value="rw">Read-write (rw)</MenuItem>
              <MenuItem value="ro">Read-only (ro)</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setEditVolumeOpen(false)}
            disabled={editingVolumeSaving}
            sx={{ textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEditVolume}
            disabled={editingVolumeSaving}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1.5 }}
          >
            {editingVolumeSaving ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

{/* ═══════════ Files Dialog ═══════════ */}
      <FilesDialog
        open={filesDialogOpen}
        onClose={() => setFilesDialogOpen(false)}
        volumeName={filesDialogTitle}
        files={filesDialogList}
        loading={filesDialogLoading}
        error={filesDialogError}
      />

      {/* ═══════════ Delete Confirm Dialog ═══════════ */}
      <Dialog open={deleteVolumeDialog.open} onClose={() => !deleteVolumeDialog.loading && setDeleteVolumeDialog({ open: false, volume: null, loading: false })} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2.5 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Delete volume</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>"{deleteVolumeDialog.volume?.name}"</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteVolumeDialog({ open: false, volume: null, loading: false })} disabled={deleteVolumeDialog.loading} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={confirmDeleteVolume} disabled={deleteVolumeDialog.loading} sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1.5 }}>
            {deleteVolumeDialog.loading ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Purge runtime confirm */}
      <Dialog
        open={purgeConfirmOpen}
        onClose={() => !purgeRuntimeLoading && setPurgeConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2.5 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Remove container & image?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            This will force-stop and delete the Docker container and related images for this service.
            Volumes on disk are <strong>not</strong> deleted.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            After removal you can attach, detach, or edit volumes that are not yet provisioned in Docker.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPurgeConfirmOpen(false)} disabled={purgeRuntimeLoading} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmPurgeRuntime}
            disabled={purgeRuntimeLoading}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1.5 }}
          >
            {purgeRuntimeLoading ? "Removing…" : "Yes, remove runtime"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete service confirm */}
      <Dialog
        open={deleteServiceConfirmOpen}
        onClose={() => !deleteServiceLoading && setDeleteServiceConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2.5 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: "error.main" }}>Delete service?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Permanently delete service <strong>"{service?.name || "this service"}"</strong>.
            This cannot be undone.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {statusBusy
              ? "Service is still busy. Stop it before deleting."
              : "Service is idle. After deletion you will be redirected to /service."}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteServiceConfirmOpen(false)} disabled={deleteServiceLoading} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDeleteService}
            disabled={deleteServiceLoading}
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 1.5 }}
          >
            {deleteServiceLoading ? "Deleting…" : "Yes, delete service"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}