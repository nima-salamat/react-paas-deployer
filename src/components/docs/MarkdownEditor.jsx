import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, InputAdornment, Paper, Stack, Tab, Tabs, TextField,
  Tooltip, Typography, alpha, Snackbar,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import CollectionsRoundedIcon from "@mui/icons-material/CollectionsRounded";
import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import AudioFileRoundedIcon from "@mui/icons-material/AudioFileRounded";
import VideoFileRoundedIcon from "@mui/icons-material/VideoFileRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import { renderMarkdown } from "./markdown";
import MarkdownPreview from "./MarkdownPreview";
import { fetchDocsAssetBlob, hostBase, publicDocsAssetSrc } from "../admin/adminUtils";
import {
  DOCS_HELP_ITEMS,
  buildItemCopyText,
  buildAiPromptWithUserText,
  AI_WRITER_GUIDE,
} from "./docsHelp";

const kindIcon = {
  image: <ImageRoundedIcon fontSize="small" />,
  audio: <AudioFileRoundedIcon fontSize="small" />,
  video: <VideoFileRoundedIcon fontSize="small" />,
  file: <InsertDriveFileRoundedIcon fontSize="small" />,
};

const resolveDocsUrl = (url, privateAssetUrls = {}) => {
  if (!url || url === "#") return url;
  const raw = String(url).trim();
  if (!raw) return "#";

  // Private draft assets are represented by the same canonical API path as
  // public assets. Check both the original value and its normalized absolute
  // form BEFORE returning absolute URLs; otherwise an absolute asset.url from
  // the backend bypasses the authenticated blob preview and hits the public
  // endpoint, which correctly returns 404 for drafts.
  const absolute = publicDocsAssetSrc(raw);
  let path = raw;
  try {
    const parsed = new URL(raw, hostBase());
    path = parsed.pathname + parsed.search + parsed.hash;
  } catch {
    // Keep the raw value for non-URL values.
  }
  const privateSrc = privateAssetUrls[raw] || privateAssetUrls[absolute] || privateAssetUrls[path];
  if (privateSrc) return privateSrc;

  if (raw.startsWith("#") || /^https?:\/\//i.test(raw) || raw.startsWith("mailto:") || raw.startsWith("tel:")) {
    return raw;
  }
  return absolute;
};

// Backward-compatible alias for existing Markdown render/preview call sites.
// Docs public assets use resolveDocsUrl; private admin assets are resolved separately.
const resolveAdminUrl = resolveDocsUrl;

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch { /* fallthrough */ }
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  try {
    return document.execCommand("copy");
  } finally {
    ta.remove();
  }
}

function MiniPreview({ snippet }) {
  const html = useMemo(
    () => renderMarkdown(snippet || "", { resolveUrl: (url) => resolveDocsUrl(url) }),
    [snippet]
  );
  return (
    <Box
      sx={{
        mt: 1,
        p: 1,
        borderRadius: 0.5,
        border: 1,
        borderColor: "divider",
        bgcolor: (t) => alpha(t.palette.background.default, 0.6),
        maxHeight: 160,
        overflow: "auto",
      }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ display: "block", mb: 0.5 }}>
        LIVE RENDER
      </Typography>
      <MarkdownPreview className="docs-markdown-preview" html={html} />
    </Box>
  );
}

function AssetThumbnail({ asset }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let live = true;
    let objectUrl = null;

    if (!asset?.id || asset?.kind !== "image") {
      setSrc("");
      return undefined;
    }

    // Published assets are public and can be loaded directly. Draft/library
    // assets must use the authenticated admin preview endpoint, which returns
    // a Blob so the JWT never appears in the image URL.
    if (asset.document_status === "published" && asset.url) {
      setSrc(publicDocsAssetSrc(asset.url));
      return undefined;
    }

    setSrc("");
    fetchDocsAssetBlob(asset.id)
      .then((blob) => {
        if (!live) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (live) setSrc("");
      });

    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset?.id, asset?.kind, asset?.url, asset?.document_status]);

  if (!src) return <ImageRoundedIcon fontSize="small" />;
  return <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
}

export default function MarkdownEditor({ value = "", onChange, assets = [], onUpload, uploadState = null }) {
  const editorRef = useRef(null);
  const [helperOpen, setHelperOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [helperQuery, setHelperQuery] = useState("");
  const [helperTab, setHelperTab] = useState(0);
  const [toast, setToast] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [privateAssetUrls, setPrivateAssetUrls] = useState({});

  const safeValue = typeof value === "string" ? value : String(value || "");

  useEffect(() => {
    let cancelled = false;
    const objectUrls = [];
    const assetMatches = new Map();
    const re = /(?:https?:\/\/[^\s)\]}"'>]+)?\/api\/docs\/assets\/([0-9a-f-]{36})\//gi;
    let match;
    while ((match = re.exec(safeValue))) {
      const full = match[0];
      const uuid = match[1];
      let originalPath = full;
      try {
        const parsed = new URL(full, hostBase());
        originalPath = parsed.pathname + parsed.search + parsed.hash;
      } catch {
        // Relative path is already usable.
      }
      assetMatches.set(uuid, originalPath);
    }
    if (!assetMatches.size) {
      setPrivateAssetUrls({});
      return undefined;
    }

    (async () => {
      const next = {};
      await Promise.all(Array.from(assetMatches.entries()).map(async ([assetId, originalPath]) => {
        try {
          const blob = await fetchDocsAssetBlob(assetId);
          if (cancelled) return;
          const objectUrl = URL.createObjectURL(blob);
          objectUrls.push(objectUrl);
          next[originalPath] = objectUrl;
          next[`${hostBase()}${originalPath}`] = objectUrl;
        } catch {
          // Published assets do not need an authenticated preview; their public
          // URL remains the fallback when the admin endpoint is not necessary.
        }
      }));
      if (!cancelled) setPrivateAssetUrls(next);
    })();

    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [safeValue]);

  const preview = useMemo(
    () => renderMarkdown(safeValue, { resolveUrl: (url) => resolveDocsUrl(url, privateAssetUrls) }),
    [safeValue, privateAssetUrls]
  );

  const notify = (msg) => setToast(msg);

  const insert = (snippet) => {
    const el = editorRef.current;
    const start = el?.selectionStart ?? safeValue.length;
    const end = el?.selectionEnd ?? safeValue.length;
    const prefix = start > 0 && !/\n$/.test(safeValue.slice(0, start)) && !/^\n/.test(snippet) ? "\n" : "";
    const next = safeValue.slice(0, start) + prefix + snippet + safeValue.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      const cursor = start + prefix.length + snippet.length;
      el?.setSelectionRange(cursor, cursor);
    });
  };

  const filteredAssets = assets.filter((asset) => {
    const q = search.trim().toLowerCase();
    return !q || `${asset.name} ${asset.kind} ${asset.mime_type || ""}`.toLowerCase().includes(q);
  });

  const helpItems = useMemo(() => {
    const q = helperQuery.trim().toLowerCase();
    if (!q) return DOCS_HELP_ITEMS;
    return DOCS_HELP_ITEMS.filter((x) =>
      `${x.label} ${x.group} ${x.help} ${x.syntax} ${x.aiHint || ""}`.toLowerCase().includes(q)
    );
  }, [helperQuery]);

  const groups = useMemo(() => {
    const map = {};
    helpItems.forEach((item) => {
      (map[item.group] ||= []).push(item);
    });
    return map;
  }, [helpItems]);

  const runInsert = (item) => {
    if (item.snippet) {
      insert(item.snippet);
      setHelperOpen(false);
      notify(`Inserted: ${item.label}`);
    }
  };

  const copyItem = async (item) => {
    notify((await copyToClipboard(buildItemCopyText(item))) ? `Copied help: ${item.label}` : "Copy failed");
  };

  const copySyntax = async (item) => {
    notify((await copyToClipboard(item.snippet || item.syntax)) ? `Copied syntax: ${item.label}` : "Copy failed");
  };

  const copyAiGuideOnly = async () => {
    notify((await copyToClipboard(AI_WRITER_GUIDE)) ? "AI guide copied — paste into ChatGPT/Claude" : "Copy failed");
  };

  const copyAiGuideWithEditor = async () => {
    notify(
      (await copyToClipboard(buildAiPromptWithUserText(safeValue)))
        ? "AI guide + editor text copied"
        : "Copy failed"
    );
  };

  const copyAllOptionsCatalog = async () => {
    const catalog = [
      AI_WRITER_GUIDE,
      "",
      "=== FULL COMPONENT CATALOG ===",
      "",
      ...DOCS_HELP_ITEMS.map(
        (item) =>
          `## ${item.group} / ${item.label}\n${item.help}\n\nSyntax:\n${item.syntax}\n\nSnippet:\n${(item.snippet || "").trim()}\n`
      ),
    ].join("\n");
    notify((await copyToClipboard(catalog)) ? "Full options catalog copied for AI" : "Copy failed");
  };

  const insertAsset = (asset) => {
    const url = asset.url;
    const snippet =
      asset.kind === "image"
        ? `![${asset.alt || asset.name}](${url})\n`
        : asset.kind === "audio"
          ? `::audio[${asset.name}](${url})\n`
          : asset.kind === "video"
            ? `::video[${asset.name}](${url})\n`
            : `[${asset.name}](${url})\n`;
    insert(snippet);
    setLibraryOpen(false);
  };

  const onKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      setLibraryOpen(true);
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      setHelperOpen(true);
    }
    if (event.key === "Tab" && editorRef.current) {
      event.preventDefault();
      insert("  ");
    }
  };

  return (
    <Stack spacing={1.5}>
      <Paper
        variant="outlined"
        sx={{
          borderRadius: 0.5,
          overflow: "hidden",
          border: 1,
          borderColor: "divider",
          boxShadow: (t) =>
            `inset 0 1px 0 ${t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.8)"}`,
        }}
      >
        <Stack
          direction={{ xs: "column", lg: "row" }}
          alignItems={{ xs: "stretch", lg: "center" }}
          justifyContent="space-between"
          gap={1}
          sx={{ p: 1, bgcolor: (t) => alpha(t.palette.primary.main, 0.05) }}
        >
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
            <Button
              size="small"
              variant="contained"
              startIcon={<HelpOutlineRoundedIcon />}
              onClick={() => { setHelperOpen(true); setHelperTab(0); }}
              sx={{ borderRadius: 0.5, textTransform: "none", fontWeight: 800 }}
            >
              Markdown helper
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="secondary"
              startIcon={<AutoAwesomeRoundedIcon />}
              onClick={() => { setHelperOpen(true); setHelperTab(1); }}
              sx={{ borderRadius: 0.5, textTransform: "none", fontWeight: 700 }}
            >
              AI guide (copy)
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<CollectionsRoundedIcon />}
              onClick={() => setLibraryOpen(true)}
              sx={{ borderRadius: 0.5, textTransform: "none" }}
            >
              Media library
            </Button>
            {onUpload && (
              <Button
                size="small"
                variant="contained"
                component="label"
                startIcon={<UploadFileRoundedIcon />}
                disabled={uploadState?.uploading}
                sx={{ borderRadius: 0.5, textTransform: "none" }}
              >
                {uploadState?.uploading ? "Uploading…" : "Upload"}
                <input
                  hidden
                  type="file"
                  onChange={(e) => {
                    onUpload(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </Button>
            )}
            <Chip size="small" icon={<CodeRoundedIcon />} label="Ctrl/Cmd+K" variant="outlined" />
          </Stack>
          {uploadState?.error && <Alert severity="error" sx={{ py: 0 }}>{uploadState.error}</Alert>}
        </Stack>

        <Divider />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) minmax(0, 1fr)" },
            minHeight: 720,
          }}
        >
          <Box sx={{ minWidth: 0, p: { xs: 1.25, md: 2 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="caption" fontWeight={800} color="text.secondary">
                MARKDOWN SOURCE
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {safeValue.length.toLocaleString()} chars
              </Typography>
            </Stack>
            <Box
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                const file = e.dataTransfer.files?.[0];
                if (file && onUpload) onUpload(file);
              }}
              sx={{
                position: "relative",
                borderRadius: 0.5,
                outline: dragActive ? "2px dashed" : "none",
                outlineColor: "primary.main",
              }}
            >
              <TextField
                inputRef={editorRef}
                multiline
                fullWidth
                value={safeValue}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                spellCheck={false}
                minRows={28}
                placeholder={"# Title\n\nWrite markdown…\n\nUse Markdown helper for tabs, api, callouts, …"}
                sx={{
                  "& .MuiInputBase-root": {
                    alignItems: "flex-start",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                    fontSize: 13,
                    lineHeight: 1.7,
                    borderRadius: 0.5,
                  },
                  "& textarea": { tabSize: 2 },
                }}
              />
              {dragActive && (
                <Paper
                  elevation={8}
                  sx={{
                    position: "absolute",
                    inset: 12,
                    display: "grid",
                    placeItems: "center",
                    zIndex: 3,
                    bgcolor: (t) => alpha(t.palette.background.paper, 0.94),
                    border: "2px dashed",
                    borderColor: "primary.main",
                    pointerEvents: "none",
                    borderRadius: 0.5,
                  }}
                >
                  <Typography fontWeight={900}>Drop file to upload</Typography>
                </Paper>
              )}
            </Box>
          </Box>
          <Box
            sx={{
              minWidth: 0,
              borderLeft: { xl: 1 },
              borderColor: "divider",
              bgcolor: (t) => alpha(t.palette.background.paper, 0.55),
              p: { xs: 1.25, md: 2 },
            }}
          >
            <Typography variant="caption" fontWeight={800} color="text.secondary">
              LIVE PREVIEW (same renderer as public /docs)
            </Typography>
            <MarkdownPreview className="docs-markdown-preview docs-preview-surface" html={preview} />
          </Box>
        </Box>
      </Paper>

      {/* Helper dialog */}
      <Dialog
        open={helperOpen}
        onClose={() => setHelperOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { borderRadius: 0.5 } }}
      >
        <DialogTitle sx={{ pb: 0, borderBottom: 1, borderColor: "divider" }}>
          <Typography fontWeight={900}>Markdown helper</Typography>
          <Typography variant="body2" color="text.secondary">
            Same renderer as public /docs — live preview per component + copy for AI
          </Typography>
          <Tabs value={helperTab} onChange={(_, v) => setHelperTab(v)} sx={{ mt: 1 }}>
            <Tab label={`Components (${DOCS_HELP_ITEMS.length})`} sx={{ textTransform: "none" }} />
            <Tab label="AI writer guide" sx={{ textTransform: "none" }} />
          </Tabs>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: (t) => alpha(t.palette.background.default, 0.35) }}>
          {helperTab === 0 && (
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Search components…"
                  value={helperQuery}
                  onChange={(e) => setHelperQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRoundedIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
                <Button
                  variant="outlined"
                  startIcon={<ContentCopyRoundedIcon />}
                  onClick={copyAllOptionsCatalog}
                  sx={{ borderRadius: 0.5, textTransform: "none", whiteSpace: "nowrap" }}
                >
                  Copy all for AI
                </Button>
              </Stack>

              {Object.entries(groups).map(([group, items]) => (
                <Box key={group}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={900}
                    sx={{ letterSpacing: 0.7 }}
                  >
                    {group}
                  </Typography>
                  <Stack spacing={1} mt={0.75}>
                    {items.map((item) => {
                      const open = expandedId === item.id;
                      return (
                        <Paper key={item.id} variant="outlined" sx={{ p: 1.25, borderRadius: 0.5 }}>
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1}
                            justifyContent="space-between"
                            alignItems={{ sm: "flex-start" }}
                          >
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Stack direction="row" spacing={0.75} alignItems="center" mb={0.35}>
                                <Chip size="small" label={item.icon} sx={{ height: 22, borderRadius: 0.5, fontWeight: 800 }} />
                                <Typography fontWeight={800} fontSize={14}>
                                  {item.label}
                                </Typography>
                              </Stack>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                                {item.help}
                              </Typography>
                              <Box
                                component="pre"
                                sx={{
                                  m: 0,
                                  p: 1,
                                  borderRadius: 0.5,
                                  fontSize: 11.5,
                                  lineHeight: 1.5,
                                  overflow: "auto",
                                  bgcolor: (t) => (t.palette.mode === "dark" ? "#0b1220" : "#0f172a"),
                                  color: "#e2e8f0",
                                  fontFamily: "ui-monospace, monospace",
                                  border: "1px solid",
                                  borderColor: "divider",
                                }}
                              >
                                {item.syntax}
                              </Box>
                              {open && item.snippet && <MiniPreview snippet={item.snippet} />}
                            </Box>
                            <Stack direction={{ xs: "row", sm: "column" }} spacing={0.5} sx={{ flexShrink: 0 }}>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => runInsert(item)}
                                sx={{ borderRadius: 0.5, textTransform: "none" }}
                              >
                                Insert
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => setExpandedId(open ? null : item.id)}
                                sx={{ borderRadius: 0.5, textTransform: "none" }}
                              >
                                {open ? "Hide preview" : "Preview"}
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                                onClick={() => copySyntax(item)}
                                sx={{ borderRadius: 0.5, textTransform: "none" }}
                              >
                                Copy syntax
                              </Button>
                              <Button
                                size="small"
                                variant="text"
                                onClick={() => copyItem(item)}
                                sx={{ borderRadius: 0.5, textTransform: "none" }}
                              >
                                Copy help
                              </Button>
                            </Stack>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                </Box>
              ))}
              {!helpItems.length && <Alert severity="info">Nothing matched.</Alert>}
            </Stack>
          )}

          {helperTab === 1 && (
            <Stack spacing={2}>
              <Alert severity="info" sx={{ borderRadius: 0.5 }}>
                Paste this into an AI with your rough notes. Put the returned Markdown back into the editor.
              </Alert>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap">
                <Button
                  variant="contained"
                  startIcon={<ContentCopyRoundedIcon />}
                  onClick={copyAiGuideOnly}
                  sx={{ borderRadius: 0.5, textTransform: "none" }}
                >
                  Copy AI guide only
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<AutoAwesomeRoundedIcon />}
                  onClick={copyAiGuideWithEditor}
                  sx={{ borderRadius: 0.5, textTransform: "none" }}
                >
                  Copy guide + current editor text
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ContentCopyRoundedIcon />}
                  onClick={copyAllOptionsCatalog}
                  sx={{ borderRadius: 0.5, textTransform: "none" }}
                >
                  Copy guide + full catalog
                </Button>
              </Stack>
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 0.5, maxHeight: 420, overflow: "auto" }}>
                <Typography
                  component="pre"
                  sx={{
                    m: 0,
                    whiteSpace: "pre-wrap",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 12,
                    lineHeight: 1.55,
                  }}
                >
                  {AI_WRITER_GUIDE}
                </Typography>
              </Paper>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelperOpen(false)} sx={{ textTransform: "none" }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { borderRadius: 0.5 } }}
      >
        <DialogTitle>Media library</DialogTitle>
        <DialogContent dividers>
          <TextField
            fullWidth
            size="small"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon />
                </InputAdornment>
              ),
            }}
          />
          <Tabs value={tab} onChange={(_, next) => setTab(next)} sx={{ mt: 1 }} variant="scrollable">
            <Tab label="All" />
            <Tab label="Images" />
            <Tab label="Audio" />
            <Tab label="Video" />
            <Tab label="Files" />
          </Tabs>
          <Stack spacing={1} sx={{ mt: 1.5, maxHeight: 460, overflow: "auto" }}>
            {filteredAssets
              .filter((asset) => tab === 0 || ["image", "audio", "video", "file"][tab - 1] === asset.kind)
              .map((asset) => (
                <Paper key={asset.id} variant="outlined" sx={{ p: 1, borderRadius: 0.5 }}>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Box
                      sx={{
                        width: 64,
                        height: 48,
                        borderRadius: 0.5,
                        overflow: "hidden",
                        bgcolor: "action.hover",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      {asset.kind === "image" ? (
                        <AssetThumbnail asset={asset} />
                      ) : (
                        kindIcon[asset.kind]
                      )}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={700} noWrap>
                        {asset.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {asset.kind}
                      </Typography>
                    </Box>
                    <Button size="small" variant="contained" onClick={() => insertAsset(asset)} sx={{ borderRadius: 0.5 }}>
                      Insert
                    </Button>
                  </Stack>
                </Paper>
              ))}
            {!filteredAssets.length && <Alert severity="info">No files.</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLibraryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={2200}
        onClose={() => setToast("")}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Stack>
  );
}
