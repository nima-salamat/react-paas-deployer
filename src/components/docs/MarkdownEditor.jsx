import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, InputAdornment, Paper, Stack, Tab, Tabs, TextField,
  Tooltip, Typography, alpha,
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
import { MARKDOWN_CHEATSHEET, renderMarkdown } from "./markdown";
import MarkdownPreview from "./MarkdownPreview";
import { authMediaSrc } from "../admin/adminUtils";

const kindIcon = { image: <ImageRoundedIcon fontSize="small" />, audio: <AudioFileRoundedIcon fontSize="small" />, video: <VideoFileRoundedIcon fontSize="small" />, file: <InsertDriveFileRoundedIcon fontSize="small" /> };

const resolveAdminUrl = (url) => authMediaSrc(url);

export default function MarkdownEditor({ value = "", onChange, assets = [], onUpload, uploadState = null }) {
  const editorRef = useRef(null);
  const [helperOpen, setHelperOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const preview = useMemo(() => renderMarkdown(value, { resolveUrl: resolveAdminUrl }), [value]);

  const insert = (snippet) => {
    const el = editorRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const prefix = start > 0 && !/\n$/.test(value.slice(0, start)) && !/^\n/.test(snippet) ? "\n" : "";
    const next = value.slice(0, start) + prefix + snippet + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      const cursor = start + prefix.length + snippet.length;
      el?.setSelectionRange(cursor, cursor);
    });
  };

  const filtered = assets.filter((asset) => {
    const q = search.trim().toLowerCase();
    return !q || `${asset.name} ${asset.kind} ${asset.mime_type || ""}`.toLowerCase().includes(q);
  });

  const runHelper = (item) => {
    if (item.action?.startsWith("library-")) {
      const requested = item.action.replace("library-", "");
      setTab({ image: 1, audio: 2, video: 3, file: 4 }[requested] || 0);
      setLibraryOpen(true);
      setHelperOpen(false);
      return;
    }
    if (item.snippet) {
      insert(item.snippet);
      setHelperOpen(false);
    }
  };

  const insertAsset = (asset) => {
    const url = asset.url;
    const snippet = asset.kind === "image"
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
      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
        <Stack direction={{ xs: "column", lg: "row" }} alignItems={{ xs: "stretch", lg: "center" }} justifyContent="space-between" gap={1} sx={{ p: 1, bgcolor: (t) => alpha(t.palette.primary.main, 0.035) }}>
          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
            <Tooltip title="Markdown helper (Ctrl/Cmd + K)"><IconButton onClick={() => setHelperOpen((x) => !x)} size="small"><HelpOutlineRoundedIcon /></IconButton></Tooltip>
            <Button size="small" variant="outlined" startIcon={<CollectionsRoundedIcon />} onClick={() => setLibraryOpen(true)}>Media library</Button>
            {onUpload && <Button size="small" variant="contained" component="label" startIcon={<UploadFileRoundedIcon />} disabled={uploadState?.uploading}>{uploadState?.uploading ? "Uploading…" : "Upload file"}<input hidden type="file" onChange={(e) => { onUpload(e.target.files?.[0]); e.target.value = ""; }} /></Button>}
            <Chip size="small" icon={<CodeRoundedIcon />} label="Ctrl/Cmd+Enter = library" variant="outlined" />
          </Stack>
          {uploadState?.error && <Alert severity="error" sx={{ py: 0 }}>{uploadState.error}</Alert>}
        </Stack>
        
        <Divider />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) minmax(0, 1fr)" }, minHeight: 720 }}>
          <Box sx={{ minWidth: 0, p: { xs: 1.25, md: 2 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="caption" fontWeight={800} color="text.secondary">MARKDOWN SOURCE</Typography>
              <Typography variant="caption" color="text.secondary">{value.length.toLocaleString()} chars</Typography>
            </Stack>
            <Box
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => { e.preventDefault(); setDragActive(false); const file = e.dataTransfer.files?.[0]; if (file && onUpload) onUpload(file); }}
              sx={{ position: "relative", borderRadius: 2.5, outline: dragActive ? "2px dashed" : "none", outlineColor: "primary.main" }}
            >
              <TextField
                inputRef={editorRef}
                multiline
                fullWidth
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                spellCheck={false}
                minRows={28}
                placeholder="# Documentation\n\nWrite clean Markdown here...\n\nTip: drag a file here to upload it."
                sx={{ "& .MuiInputBase-root": { alignItems: "flex-start", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 13, lineHeight: 1.7, borderRadius: 2.5 }, "& textarea": { tabSize: 2 } }}
              />
              {dragActive && <Paper elevation={8} sx={{ position: "absolute", inset: 12, display: "grid", placeItems: "center", zIndex: 3, bgcolor: (t) => alpha(t.palette.background.paper, .94), border: "2px dashed", borderColor: "primary.main", pointerEvents: "none", borderRadius: 2 }}><Typography fontWeight={900}>Drop file to upload and insert</Typography></Paper>}
            </Box>
          </Box>
          <Box sx={{ minWidth: 0, borderLeft: { xl: 1 }, borderColor: "divider", bgcolor: (t) => alpha(t.palette.background.paper, 0.55), p: { xs: 1.25, md: 2 } }}>
            <Typography variant="caption" fontWeight={800} color="text.secondary">LIVE PREVIEW</Typography>
            <MarkdownPreview className="docs-markdown-preview docs-preview-surface" html={preview} />
          </Box>
        </Box>
      </Paper>

      <Dialog open={helperOpen} onClose={() => setHelperOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ pb: 1 }}>Markdown helper</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Choose a command and it will be inserted at the current cursor position. Shortcut: Ctrl/Cmd + K.</Typography>
          <Stack spacing={1.25}>
            {Array.from(new Set(MARKDOWN_CHEATSHEET.map((x) => x.group))).map((group) => (
              <Box key={group}>
                <Typography variant="caption" color="text.secondary" fontWeight={800}>{group}</Typography>
                <Stack direction="row" flexWrap="wrap" gap={0.75} mt={0.5}>
                  {MARKDOWN_CHEATSHEET.filter((x) => x.group === group).map((item) => (
                    <Button key={item.label} size="small" variant="outlined" onClick={() => runHelper(item)} sx={{ textTransform: "none" }}>{item.icon}&nbsp; {item.label}</Button>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setHelperOpen(false)}>Close</Button></DialogActions>
      </Dialog>
      <Dialog open={libraryOpen} onClose={() => setLibraryOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ pb: 1 }}>Media library</DialogTitle>
        <DialogContent dividers>
          <TextField fullWidth size="small" placeholder="Search images, audio, videos and files" value={search} onChange={(e) => setSearch(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> }} />
          <Tabs value={tab} onChange={(_, next) => setTab(next)} sx={{ mt: 1 }} variant="scrollable"><Tab label="All"/><Tab label="Images"/><Tab label="Audio"/><Tab label="Video"/><Tab label="Files"/></Tabs>
          <Stack spacing={1} sx={{ mt: 1.5, maxHeight: 460, overflow: "auto" }}>
            {filtered.filter((asset) => tab === 0 || ["image", "audio", "video", "file"][tab - 1] === asset.kind).map((asset) => (
              <Paper key={asset.id} variant="outlined" sx={{ p: 1, borderRadius: 2.5 }}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Box sx={{ width: 64, height: 48, borderRadius: 1.5, overflow: "hidden", bgcolor: "action.hover", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    {asset.kind === "image" ? <img src={resolveAdminUrl(asset.url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : kindIcon[asset.kind]}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}><Typography fontWeight={700} noWrap>{asset.name}</Typography><Typography variant="caption" color="text.secondary">{asset.kind} · {Math.max(1, Math.round((asset.size_bytes || 0) / 1024))} KB</Typography></Box>
                  <Button size="small" variant="contained" onClick={() => insertAsset(asset)}>Insert</Button>
                </Stack>
              </Paper>
            ))}
            {!filtered.length && <Alert severity="info">No uploaded files match this search.</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setLibraryOpen(false)}>Close</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
