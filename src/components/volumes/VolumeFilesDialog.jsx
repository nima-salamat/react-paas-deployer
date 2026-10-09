import React from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";

// Shared file tree, normalization and dialog UI for Volume lists and Service Settings.
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

export default function VolumeFilesDialog({ open, onClose, volumeName, files, loading, error }) {
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
