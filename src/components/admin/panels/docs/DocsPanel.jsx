import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  alpha,
  Menu,
  Pagination,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import PublishRoundedIcon from "@mui/icons-material/PublishRounded";
import UnpublishedRoundedIcon from "@mui/icons-material/UnpublishedRounded";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import AudioFileRoundedIcon from "@mui/icons-material/AudioFileRounded";
import VideoFileRoundedIcon from "@mui/icons-material/VideoFileRounded";
import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";
import CollectionsRoundedIcon from "@mui/icons-material/CollectionsRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import MenuOpenRoundedIcon from "@mui/icons-material/MenuOpenRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import apiRequest from "../../../customHooks/apiRequest";
import { fetchDocsAssetBlob, hostBase } from "../../adminUtils";
import MarkdownEditor from "../../../docs/MarkdownEditor";

const base = `${hostBase()}/api/docs`;

const kindIcon = {
  image: <ImageRoundedIcon fontSize="small" />,
  audio: <AudioFileRoundedIcon fontSize="small" />,
  video: <VideoFileRoundedIcon fontSize="small" />,
  file: <InsertDriveFileRoundedIcon fontSize="small" />,
};

function formatBytes(n = 0) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function flattenCats(nodes, depth = 0, out = []) {
  (nodes || []).forEach((node) => {
    out.push({ ...node, depth });
    flattenCats(node.children || [], depth + 1, out);
  });
  return out;
}

function CategoryTree({ nodes, selectedId, onSelect, onCategoryAction, depth = 0 }) {
  const [open, setOpen] = useState(() => {
    const initial = {};
    (nodes || []).forEach((n) => { initial[n.id] = true; });
    return initial;
  });
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuNode, setMenuNode] = useState(null);

  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev };
      (nodes || []).forEach((n) => {
        if (next[n.id] === undefined) next[n.id] = true;
      });
      return next;
    });
  }, [nodes]);

  if (!nodes?.length) return null;

  return (
    <List dense disablePadding sx={{ pl: depth ? 1.25 : 0 }}>
      {nodes.map((node) => {
        const expanded = open[node.id] !== false;
        const hasChildren =
          (node.children && node.children.length > 0) ||
          (node.documents && node.documents.length > 0);
        return (
          <React.Fragment key={node.id}>
            <ListItemButton
              sx={{ borderRadius: 0.5, py: 0.55, mb: 0.2, minWidth: 0 }}
              onClick={() => setOpen((x) => ({ ...x, [node.id]: !expanded }))}
            >
              {hasChildren ? (
                expanded ? <ExpandMoreRoundedIcon fontSize="small" sx={{ mr: 0.35 }} />
                  : <ChevronRightRoundedIcon fontSize="small" sx={{ mr: 0.35 }} />
              ) : <Box sx={{ width: 24, mr: 0.35, flexShrink: 0 }} />}
              <FolderRoundedIcon fontSize="small" sx={{ mr: 0.65, color: "warning.main", flexShrink: 0 }} />
              <ListItemText
                primary={node.name}
                secondary={`${(node.documents || []).length} article(s)${node.children?.length ? ` · ${node.children.length} subfolder(s)` : ""}`}
                primaryTypographyProps={{ fontWeight: 750, fontSize: 13, noWrap: true }}
                secondaryTypographyProps={{ fontSize: 10.5, noWrap: true }}
                sx={{ minWidth: 0 }}
              />
              <IconButton
                size="small"
                edge="end"
                aria-label={`Actions for ${node.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuAnchor(e.currentTarget);
                  setMenuNode(node);
                }}
                sx={{ ml: 0.5, flexShrink: 0 }}
              >
                <MoreVertRoundedIcon fontSize="small" />
              </IconButton>
            </ListItemButton>
            <Collapse in={expanded} unmountOnExit>
              {(node.documents || []).map((doc) => (
                <ListItemButton
                  key={doc.id}
                  selected={selectedId === doc.id}
                  onClick={() => onSelect(doc)}
                  sx={{ borderRadius: 0.5, py: 0.45, mb: 0.15, pl: 4.25, minWidth: 0 }}
                >
                  <ListItemIcon sx={{ minWidth: 27 }}><DescriptionRoundedIcon fontSize="small" color="action" /></ListItemIcon>
                  <ListItemText
                    primary={doc.title || "Untitled"}
                    secondary={doc.status}
                    primaryTypographyProps={{ fontSize: 12.5, noWrap: true }}
                    secondaryTypographyProps={{ fontSize: 10.5 }}
                    sx={{ minWidth: 0 }}
                  />
                  <Chip size="small" label={doc.status} color={doc.status === "published" ? "success" : "default"} sx={{ height: 19, fontSize: 9.5, flexShrink: 0 }} />
                </ListItemButton>
              ))}
              <CategoryTree
                nodes={node.children || []}
                selectedId={selectedId}
                onSelect={onSelect}
                onCategoryAction={onCategoryAction}
                depth={depth + 1}
              />
            </Collapse>
          </React.Fragment>
        );
      })}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => { setMenuAnchor(null); setMenuNode(null); }}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { minWidth: 180, zIndex: 1600 } } }}
      >
        <MenuItem onClick={() => { onCategoryAction?.("add-child", menuNode); setMenuAnchor(null); setMenuNode(null); }}>Add subcategory</MenuItem>
        <MenuItem onClick={() => { onCategoryAction?.("edit", menuNode); setMenuAnchor(null); setMenuNode(null); }}>Edit category</MenuItem>
        <MenuItem
          sx={{ color: "error.main" }}
          onClick={() => { onCategoryAction?.("delete", menuNode); setMenuAnchor(null); setMenuNode(null); }}
        >
          Delete category
        </MenuItem>
      </Menu>
    </List>
  );
}

function useAdminAssetSrc(asset) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    const load = async () => {
      if (!asset?.id) {
        setSrc("");
        return;
      }
      if (asset.document_status === "published" && asset.url) {
        setSrc(asset.url);
        return;
      }
      try {
        const blob = await fetchDocsAssetBlob(asset.id);
        objectUrl = URL.createObjectURL(blob);
        if (active) setSrc(objectUrl);
      } catch {
        if (active) setSrc("");
      }
    };
    load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset?.id, asset?.document_status, asset?.url]);
  return src;
}

function AdminAssetPreview({ asset, sx, ...props }) {
  const src = useAdminAssetSrc(asset);
  return <Box component="img" src={src} sx={sx} {...props} />;
}

function AdminAssetMedia({ asset, kind, sx }) {
  const src = useAdminAssetSrc(asset);
  if (kind === "video") return <Box component="video" src={src} controls sx={sx} />;
  if (kind === "audio") return <Box component="audio" src={src} controls sx={sx} />;
  return <Box component="img" src={src} alt={asset?.alt || asset?.name || ""} sx={sx} />;
}

function AdminAssetOpenButton({ asset }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    if (!asset?.id) return;
    if (asset.document_status === "published" && asset.url) {
      window.open(asset.url, "_blank", "noopener,noreferrer");
      return;
    }
    setBusy(true);
    try {
      const blob = await fetchDocsAssetBlob(asset.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = asset.name || "docs-asset";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // Parent panel displays API errors; opening is best-effort.
    } finally {
      setBusy(false);
    }
  };
  return (
    <IconButton size="small" onClick={open} disabled={busy} aria-label="Open file">
      {busy ? <CircularProgress size={16} /> : <OpenInNewRoundedIcon fontSize="small" />}
    </IconButton>
  );
}

function AssetLibrary({
  assets,
  assetsTotal,
  assetPage,
  assetPageCount,
  onAssetPageChange,
  onAssetQueryChange,
  docs,
  onDelete,
  onReassign,
  onUpload,
  uploading,
  onInsert,
}) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [confirmId, setConfirmId] = useState(null);
  const [previewAsset, setPreviewAsset] = useState(null);


  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 0.5,
        overflow: "hidden",
        boxShadow: (t) =>
          `inset 0 1px 0 ${t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.85)"}`,
      }}
    >
      <Box sx={{ p: 1.5 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          gap={1}
        >
          <Box>
            <Typography fontWeight={850}>Media library</Typography>
            <Typography variant="caption" color="text.secondary">
              All uploaded files — insert, reassign or delete independently of the editor.
            </Typography>
          </Box>
          <Button
            component="label"
            variant="contained"
            size="small"
            disabled={uploading}
            startIcon={
              uploading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <CloudUploadRoundedIcon />
              )
            }
            sx={{ borderRadius: 0.5 }}
          >
            {uploading ? "Uploading…" : "Upload"}
            <input
              hidden
              type="file"
              onChange={(e) => {
                onUpload(e.target.files?.[0], null);
                e.target.value = "";
              }}
            />
          </Button>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Search files…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); onAssetQueryChange?.({ search: e.target.value, kind }); }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" color="disabled" />
                </InputAdornment>
              ),
            }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 0.5 } }}
          />
          <FormControl size="small" sx={{ minWidth: 140, "& .MuiOutlinedInput-root": { borderRadius: 0.5 } }}>
            <InputLabel id="asset-kind-label">Type</InputLabel>
            <Select
              labelId="asset-kind-label"
              label="Type"
              value={kind}
              onChange={(e) => { setKind(e.target.value); onAssetQueryChange?.({ search, kind: e.target.value }); }}
            >
              <MenuItem value="all">All types</MenuItem>
              <MenuItem value="image">Images</MenuItem>
              <MenuItem value="video">Videos</MenuItem>
              <MenuItem value="audio">Audio</MenuItem>
              <MenuItem value="file">Files</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Box>
      <Divider />
      <Box sx={{ maxHeight: 360, overflow: "auto", p: 1 }}>
        {!assets?.length && (
          <Alert severity="info" sx={{ m: 1 }}>
            No files match. Upload media or clear filters.
          </Alert>
        )}
        <Stack spacing={0.75}>
          {(assets || []).map((asset) => (
            <Paper
              key={asset.id}
              variant="outlined"
              sx={{
                p: 1.25,
                borderRadius: 0.5,
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "auto 1fr auto",
                },
                gap: 1.25,
                alignItems: "center",
              }}
            >
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 0.5,
                  overflow: "hidden",
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                {asset.kind === "image" ? (
                  <AdminAssetPreview
                    asset={asset}
                    alt={asset.alt || asset.name}
                    sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  kindIcon[asset.kind] || kindIcon.file
                )}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={700} fontSize={13} noWrap>
                  {asset.name || "Untitled"}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {asset.kind} · {formatBytes(asset.size_bytes)} ·{" "}
                  {asset.mime_type || "unknown"}
                </Typography>
                <FormControl size="small" fullWidth sx={{ mt: 0.75, maxWidth: 320 }}>
                  <InputLabel id={`doc-assign-${asset.id}`}>Attached to</InputLabel>
                  <Select
                    labelId={`doc-assign-${asset.id}`}
                    label="Attached to"
                    value={asset.document || ""}
                    onChange={(e) =>
                      onReassign(asset.id, e.target.value || null)
                    }
                    sx={{ fontSize: 13 }}
                  >
                    <MenuItem value="">
                      <em>Library only (unattached)</em>
                    </MenuItem>
                    {(docs || []).map((d) => (
                      <MenuItem key={d.id} value={d.id}>
                        {d.title || d.slug || d.id}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                {onInsert && (
                  <Tooltip title="Insert into current article">
                    <Button size="small" variant="outlined" sx={{ borderRadius: 0.5 }} onClick={() => onInsert(asset)}>
                      Insert
                    </Button>
                  </Tooltip>
                )}
                <Tooltip title="Open file">
<AdminAssetOpenButton asset={asset} />
                </Tooltip>
                <Tooltip title="Delete file">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => setConfirmId(asset.id)}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Box>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} gap={1} sx={{ px: 1.5, py: 1.25, borderTop: 1, borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary">{assetsTotal ?? 0} files</Typography>
        <Pagination count={Math.max(1, assetPageCount || 1)} page={assetPage || 1} onChange={(_, value) => onAssetPageChange?.(value)} size="small" showFirstButton showLastButton />
      </Stack>
      <Dialog open={Boolean(confirmId)} onClose={() => setConfirmId(null)} PaperProps={{ sx: { borderRadius: 0.5 } }}>
        <DialogTitle>Delete file?</DialogTitle>
        <DialogContent>
          <Typography>
            This permanently removes the file from storage. Markdown references will break.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmId(null)} sx={{ borderRadius: 0.5 }}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              onDelete(confirmId);
              setConfirmId(null);
            }}
            sx={{ borderRadius: 0.5 }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(previewAsset)} onClose={() => setPreviewAsset(null)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 0.5 } }}>
        <DialogTitle sx={{ pr: 7 }}>{previewAsset?.name || "Preview"}</DialogTitle>
        <DialogContent dividers sx={{ display: "grid", placeItems: "center", minHeight: 300 }}>
          {previewAsset?.kind === "image" ? (
            <AdminAssetMedia asset={previewAsset} kind="image" sx={{ maxWidth: "100%", maxHeight: "65vh", objectFit: "contain", borderRadius: 0.5 }} />
          ) : previewAsset?.kind === "video" ? (
            <AdminAssetMedia asset={previewAsset} kind="video" sx={{ maxWidth: "100%", maxHeight: "65vh" }} />
          ) : previewAsset?.kind === "audio" ? (
            <AdminAssetMedia asset={previewAsset} kind="audio" sx={{ width: "100%" }} />
          ) : (
            <Stack alignItems="center" spacing={1}>
              {kindIcon[previewAsset?.kind] || kindIcon.file}
              <Typography color="text.secondary">This file is available as a download.</Typography>
              <AdminAssetOpenButton asset={previewAsset} />
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Paper>
  );
}

export default function DocsPanel() {
  const [docs, setDocs] = useState([]);
  const [assets, setAssets] = useState([]);
  const [assetsTotal, setAssetsTotal] = useState(0);
  const [assetPage, setAssetPage] = useState(1);
  const [assetPageCount, setAssetPageCount] = useState(1);
  const [assetQuery, setAssetQuery] = useState({ search: "", kind: "all" });
  const [categories, setCategories] = useState([]);
  const [uncategorized, setUncategorized] = useState([]);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newCat, setNewCat] = useState({ name: "", parent: "" });
  const [mainTab, setMainTab] = useState(0);
  const [docSearch, setDocSearch] = useState("");
  const [treeCollapsed, setTreeCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem("docs-admin-tree-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const toggleTree = () => {
    setTreeCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("docs-admin-tree-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const reload = useCallback(async () => {
    const assetParams = { page: assetPage, page_size: 24 };
    if (assetQuery.kind !== "all") assetParams.kind = assetQuery.kind;
    if (assetQuery.search.trim()) assetParams.search = assetQuery.search.trim();
    const [d, a, c] = await Promise.all([
      apiRequest({ url: `${base}/admin/documents/` }),
      apiRequest({ url: `${base}/admin/assets/`, params: assetParams }),
      apiRequest({ url: `${base}/admin/categories/tree/` }),
    ]);
    const docList = d?.data?.results || d?.data || [];
    setDocs(Array.isArray(docList) ? docList : []);
    const assetPayload = a?.data || {};
    setAssets(assetPayload.results || []);
    setAssetsTotal(Number(assetPayload.count || 0));
    setAssetPageCount(Number(assetPayload.pages || Math.ceil(Number(assetPayload.count || 0) / 24) || 1));

    const treePayload = c?.data || {};
    // Support both old (array) and new ({categories, uncategorized}) shapes
    if (Array.isArray(treePayload)) {
      setCategories(treePayload);
      setUncategorized([]);
    } else {
      setCategories(treePayload.categories || []);
      setUncategorized(treePayload.uncategorized || []);
    }
  }, [assetPage, assetQuery]);

  useEffect(() => {
    reload().catch((e) =>
      setError(e?.response?.data?.detail || "Could not load documentation.")
    );
  }, [reload]);

  const flatCats = useMemo(() => flattenCats(categories), [categories]);

  const filteredDocs = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) =>
      `${d.title} ${d.slug} ${d.description} ${d.status} ${d.category_name || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [docs, docSearch]);

  const normalizeContent = (raw) => {
    if (raw == null) return "";
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw)) {
      return raw
        .map((block) => {
          if (!block || typeof block !== "object") return "";
          if (block.type === "heading") return `${"#".repeat(block.level || 2)} ${block.text || ""}`;
          if (block.type === "paragraph") return block.text || "";
          if (block.type === "code") return "```" + (block.language || "") + "\n" + (block.code || "") + "\n```";
          if (block.type === "list") {
            const items = block.items || [];
            return items.map((it, i) => (block.ordered ? `${i + 1}. ${it}` : `- ${it}`)).join("\n");
          }
          if (block.type === "callout") return `:::${block.tone || "note"}\n${block.text || ""}\n:::`;
          if (block.type === "quote") return `> ${block.text || ""}`;
          if (block.type === "divider") return "---";
          if (block.type === "link") return `[${block.label || block.url || ""}](${block.url || ""})`;
          if (typeof block.text === "string") return block.text;
          return "";
        })
        .filter(Boolean)
        .join("\n\n");
    }
    if (typeof raw === "object" && typeof raw.markdown === "string") return raw.markdown;
    try { return String(raw); } catch { return ""; }
  };

  const selectDocument = async (doc) => {
    if (!doc) { setDraft(null); return; }
    setDraft({ ...doc, content: normalizeContent(doc.content) });
    setMainTab(0);
    if (!doc.id) return;
    setError("");
    try {
      const res = await apiRequest({ url: `${base}/admin/documents/${doc.id}/` });
      const full = res?.data?.data || res?.data || doc;
      setDraft({ ...full, content: normalizeContent(full.content) });
    } catch (e) {
      setError(e?.response?.data?.detail || "Could not load full article body.");
    }
  };

    const create = () =>
    setDraft({
      id: null,
      title: "",
      slug: "",
      description: "",
      category: null,
      status: "draft",
      content: "# New document\n\nStart writing here.\n",
    });

  const createCategory = async () => {
    if (!newCat.name.trim()) return;
    setError("");
    try {
      await apiRequest({
        url: `${base}/admin/categories/`,
        method: "POST",
        data: { name: newCat.name.trim(), parent: newCat.parent || null },
      });
      setNewCat({ name: "", parent: "" });
      await reload();
      setSuccess("Category created.");
    } catch (e) {
      setError(
        e?.response?.data?.detail ||
          e?.response?.data?.name?.[0] ||
          "Could not create category."
      );
    }
  };

  const handleCategoryAction = async (action, category) => {
    if (!category) return;
    if (action === "add-child") {
      setNewCat({ name: "", parent: category.id });
      setMainTab(0);
      return;
    }
    if (action === "edit") {
      const next = window.prompt("Category name", category.name);
      if (!next || next.trim() === category.name) return;
      try {
        await apiRequest({ url: `${base}/admin/categories/${category.id}/`, method: "PATCH", data: { name: next.trim() } });
        await reload();
        setSuccess("Category updated.");
      } catch (e) { setError(e?.response?.data?.detail || e?.response?.data?.name?.[0] || "Could not update category."); }
      return;
    }
    if (action === "delete") {
      const hasChildren = Boolean(category.children?.length);
      const hasDocs = Boolean(category.documents?.length);
      const target = category.parent_id ? "its parent category" : "General (no category)";
      const message = `Delete “${category.name}”? ${hasDocs ? `${category.documents.length} article(s) will move to ${target}. ` : ""}${hasChildren ? "Its subcategories will also move up one level." : ""}`;
      if (!window.confirm(message.trim())) return;
      try {
        await apiRequest({ url: `${base}/admin/categories/${category.id}/`, method: "DELETE" });
        await reload();
        setSuccess("Category deleted and content moved safely.");
      } catch (e) { setError(e?.response?.data?.detail || "Could not delete category."); }
    }
  };

  const save = async (silent = false) => {
    if (!draft) return null;
    setSaving(true);
    if (!silent) setError("");
    try {
      const method = draft.id ? "PATCH" : "POST";
      const url = draft.id
        ? `${base}/admin/documents/${draft.id}/`
        : `${base}/admin/documents/`;
      const payload = {
        title: draft.title,
        slug: draft.slug,
        description: draft.description,
        category: draft.category || null,
        content: draft.content,
      };
      const saved = await apiRequest({ url, method, data: payload });
      setDraft(saved.data);
      await reload();
      if (!silent) setSuccess("Document saved.");
      return saved.data;
    } catch (e) {
      const detail =
        e?.response?.data?.detail ||
        e?.response?.data?.title?.[0] ||
        e?.response?.data?.slug?.[0] ||
        "Could not save document.";
      setError(detail);
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!draft?.id) return;
    setError("");
    try {
      const saved = await apiRequest({
        url: `${base}/admin/documents/${draft.id}/publish/`,
        method: "POST",
      });
      setDraft(saved.data);
      await reload();
      setSuccess("Document published.");
    } catch (e) {
      setError(e?.response?.data?.detail || "Could not publish document.");
    }
  };

  const unpublish = async () => {
    if (!draft?.id) return;
    setError("");
    try {
      const saved = await apiRequest({
        url: `${base}/admin/documents/${draft.id}/unpublish/`,
        method: "POST",
      });
      setDraft(saved.data);
      await reload();
      setSuccess("Document unpublished.");
    } catch (e) {
      setError(e?.response?.data?.detail || "Could not unpublish document.");
    }
  };

  const remove = async () => {
    if (!draft?.id || !window.confirm("Delete this document permanently?"))
      return;
    try {
      await apiRequest({
        url: `${base}/admin/documents/${draft.id}/`,
        method: "DELETE",
      });
      setDraft(null);
      await reload();
      setSuccess("Document deleted.");
    } catch (e) {
      setError(e?.response?.data?.detail || "Could not delete document.");
    }
  };

  const upload = async (file, documentId) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      let currentId = documentId;
      if (currentId === undefined) {
        // Attach to current draft if possible
        let current = draft;
        if (!current?.id) {
          current = await save(true);
        }
        currentId = current?.id || null;
      }
      const fd = new FormData();
      fd.append("file", file);
      if (currentId) fd.append("document", currentId);
      const response = await apiRequest({
        url: `${base}/admin/assets/`,
        method: "POST",
        data: fd,
      });
      const asset = response.data;
      setAssets((prev) => [asset, ...prev.filter((x) => x.id !== asset.id)]);
      if (draft) {
        const snippet =
          asset.kind === "image"
            ? `\n\n![${asset.alt || asset.name}](${asset.url})\n`
            : asset.kind === "audio"
              ? `\n\n::audio[${asset.name}](${asset.url})\n`
              : asset.kind === "video"
                ? `\n\n::video[${asset.name}](${asset.url})\n`
                : `\n\n[${asset.name}](${asset.url})\n`;
        setDraft((d) =>
          d ? { ...d, content: `${d.content || ""}${snippet}` } : d
        );
      }
      setSuccess("File uploaded.");
      await reload();
    } catch (e) {
      setError(
        e?.response?.data?.detail || "Upload failed. Check file type and size (max 50 MB)."
      );
    } finally {
      setUploading(false);
    }
  };

  const deleteAsset = async (id) => {
    try {
      await apiRequest({ url: `${base}/assets/${id}/`, method: "DELETE" });
      setAssets((prev) => prev.filter((x) => x.id !== id));
      setSuccess("File deleted.");
    } catch (e) {
      setError(e?.response?.data?.detail || "Could not delete file.");
    }
  };

  const reassignAsset = async (id, documentId) => {
    try {
      const res = await apiRequest({
        url: `${base}/assets/${id}/`,
        method: "PATCH",
        data: { document: documentId },
      });
      setAssets((prev) =>
        prev.map((x) => (x.id === id ? res.data : x))
      );
      setSuccess("Attachment updated.");
    } catch (e) {
      setError(e?.response?.data?.detail || "Could not update attachment.");
    }
  };

  const insertAsset = (asset) => {
    if (!draft) {
      setError("Select or create a document first, then insert media.");
      return;
    }
    const url = asset.url;
    const snippet =
      asset.kind === "image"
        ? `![${asset.alt || asset.name}](${url})\n`
        : asset.kind === "audio"
          ? `::audio[${asset.name}](${url})\n`
          : asset.kind === "video"
            ? `::video[${asset.name}](${url})\n`
            : `[${asset.name}](${url})\n`;
    setDraft((d) => ({
      ...d,
      content: `${d.content || ""}${d.content?.endsWith("\n") ? "" : "\n"}${snippet}`,
    }));
    setMainTab(0);
    setSuccess("Media inserted into the article.");
  };

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        justifyContent="space-between"
        gap={1.5}
      >
        <Box>
          <Typography variant="h5" fontWeight={950}>
            Documentation
          </Typography>
          <Typography color="text.secondary">
            Markdown articles, nested categories, and a full media library.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Tooltip title="Reload">
            <IconButton onClick={() => reload().catch(() => {})}>
              <RefreshRoundedIcon />
            </IconButton>
          </Tooltip>
          {mainTab === 0 && (
            <Button
              variant="outlined"
              startIcon={treeCollapsed ? <MenuOpenRoundedIcon /> : <ChevronLeftRoundedIcon />}
              onClick={toggleTree}
              sx={{ borderRadius: 0.5, textTransform: "none" }}
            >
              {treeCollapsed ? "Show tree" : "Hide tree"}
            </Button>
          )}
          <Button
            component="a"
            href="/docs"
            target="_blank"
            rel="noreferrer"
            startIcon={<OpenInNewRoundedIcon />}
            variant="outlined"
          >
            Open docs
          </Button>
          <Button
            startIcon={<AddRoundedIcon />}
            onClick={() => {
              create();
              setMainTab(0);
            }}
            variant="contained"
          >
            New document
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      <Tabs
        value={mainTab}
        onChange={(_, v) => setMainTab(v)}
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Tab label="Articles" icon={<DescriptionRoundedIcon />} iconPosition="start" />
        <Tab
          label={`Media library (${assetsTotal})`}
          icon={<CollectionsRoundedIcon />}
          iconPosition="start"
        />
      </Tabs>

      {mainTab === 1 && (
        <AssetLibrary
          assets={assets}
          assetsTotal={assetsTotal}
          assetPage={assetPage}
          assetPageCount={assetPageCount}
          onAssetPageChange={(page) => setAssetPage(page)}
          onAssetQueryChange={({ search, kind }) => { setAssetQuery({ search, kind }); setAssetPage(1); }}
          docs={docs}
          onDelete={deleteAsset}
          onReassign={reassignAsset}
          onUpload={upload}
          uploading={uploading}
          onInsert={draft ? insertAsset : null}
        />
      )}

      {mainTab === 0 && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: treeCollapsed ? "minmax(0, 1fr)" : "300px minmax(0, 1fr)",
              xl: treeCollapsed ? "minmax(0, 1fr)" : "320px minmax(0, 1fr)",
            },
            gap: 2,
            alignItems: "start",
            transition: "grid-template-columns 180ms ease",
          }}
        >
          {/* Sidebar: categories + document list (collapsible) */}
          {!treeCollapsed && (
          <Paper
            variant="outlined"
            sx={{
              borderRadius: 0.5,
              overflow: "hidden",
              position: { md: "sticky" },
              top: { md: 12 },
              maxHeight: { md: "calc(100vh - 120px)" },
              display: "flex",
              flexDirection: "column",
              boxShadow: (t) =>
                `inset 0 1px 0 ${t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.85)"}`,
            }}
          >
              <>
                <Box sx={{ p: 1.25, display: "flex", alignItems: "flex-start", gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={850}>Content tree</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Categories and all articles (draft & published)
                    </Typography>
                  </Box>
                  <Tooltip title="Collapse tree — more writing space">
                    <IconButton
                      size="small"
                      onClick={toggleTree}
                      aria-label="Collapse content tree"
                      sx={{ borderRadius: 0.5, border: 1, borderColor: "divider", flexShrink: 0 }}
                    >
                      <ChevronLeftRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Divider />
                <Box sx={{ p: 1.25, borderBottom: 1, borderColor: "divider" }}>
                  <Stack spacing={1}>
                    <TextField
                      size="small"
                      label="New category"
                      value={newCat.name}
                      onChange={(e) =>
                        setNewCat({ ...newCat, name: e.target.value })
                      }
                    />
                    <FormControl size="small" fullWidth>
                      <InputLabel id="parent-cat-label">Parent category</InputLabel>
                      <Select
                        labelId="parent-cat-label"
                        label="Parent category"
                        value={newCat.parent}
                        onChange={(e) =>
                          setNewCat({ ...newCat, parent: e.target.value })
                        }
                      >
                        <MenuItem value="">
                          <em>Root category</em>
                        </MenuItem>
                        {flatCats.map((c) => (
                          <MenuItem key={c.id} value={c.id}>
                            {"\u00A0".repeat(c.depth * 2)}
                            {c.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button
                      onClick={createCategory}
                      size="small"
                      startIcon={<AddRoundedIcon />}
                      variant="outlined"
                      sx={{ borderRadius: 0.5 }}
                    >
                      Create category
                    </Button>
                  </Stack>
                </Box>
                <Box sx={{ p: 1, borderBottom: 1, borderColor: "divider" }}>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Filter articles…"
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchRoundedIcon fontSize="small" color="disabled" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>
                <Box sx={{ flex: 1, overflow: "auto", p: 0.75, minHeight: 0 }}>
                  {!docSearch && (
                    <>
                      <CategoryTree
                        nodes={categories}
                        selectedId={draft?.id}
                        onSelect={(doc) => {
                          selectDocument(doc);
                          setMainTab(0);
                        }}
                        onCategoryAction={handleCategoryAction}
                      />
                      {(uncategorized.length > 0 ||
                        docs.some((d) => !d.category)) && (
                        <>
                          <Divider sx={{ my: 1 }} />
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ px: 1.5, fontWeight: 700 }}
                          >
                            General (no category)
                          </Typography>
                          {(uncategorized.length
                            ? uncategorized
                            : docs.filter((d) => !d.category)
                          ).map((doc) => (
                            <ListItemButton
                              key={doc.id}
                              selected={draft?.id === doc.id}
                              onClick={() => selectDocument(doc)}
                              sx={{ borderRadius: 0.5, mt: 0.25 }}
                            >
                              <ListItemIcon sx={{ minWidth: 28 }}>
                                <DescriptionRoundedIcon fontSize="small" />
                              </ListItemIcon>
                              <ListItemText
                                primary={doc.title}
                                secondary={doc.status}
                                primaryTypographyProps={{ fontSize: 13 }}
                              />
                              <Chip
                                size="small"
                                label={doc.status}
                                color={
                                  doc.status === "published" ? "success" : "default"
                                }
                                sx={{ height: 20, fontSize: 10 }}
                              />
                            </ListItemButton>
                          ))}
                        </>
                      )}
                    </>
                  )}
                  {docSearch && (
                    <List dense>
                      {filteredDocs.map((doc) => (
                        <ListItemButton
                          key={doc.id}
                          selected={draft?.id === doc.id}
                          onClick={() => selectDocument(doc)}
                          sx={{ borderRadius: 0.5 }}
                        >
                          <ListItemText
                            primary={doc.title}
                            secondary={`${doc.status}${doc.category_name ? ` · ${doc.category_name}` : ""}`}
                            primaryTypographyProps={{ fontSize: 13 }}
                          />
                        </ListItemButton>
                      ))}
                      {!filteredDocs.length && (
                        <Alert severity="info" sx={{ m: 1 }}>
                          No articles match “{docSearch}”.
                        </Alert>
                      )}
                    </List>
                  )}
                  {!categories.length && !docs.length && (
                    <Alert severity="info" sx={{ m: 1 }}>
                      No documentation yet. Create a category or a new document.
                    </Alert>
                  )}
                </Box>
              </>
          </Paper>
          )}

          {/* Editor */}
          {!draft ? (
            <Paper
              variant="outlined"
              sx={{
                p: 6,
                minHeight: 520,
                display: "grid",
                placeItems: "center",
                borderRadius: 0.5,
                boxShadow: (t) =>
                  `inset 0 1px 0 ${t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.85)"}`,
              }}
            >
              <Box textAlign="center">
                <DescriptionRoundedIcon
                  sx={{ fontSize: 48, opacity: 0.35, mb: 1 }}
                />
                <Typography variant="h6" fontWeight={900}>
                  Select an article
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                  Or create a new Markdown document. Published pages appear on{" "}
                  <Box component="a" href="/docs" target="_blank" rel="noreferrer">
                    /docs
                  </Box>
                  .
                </Typography>
                <Button
                  sx={{ mt: 2 }}
                  onClick={create}
                  startIcon={<AddRoundedIcon />}
                  variant="contained"
                >
                  Create document
                </Button>
              </Box>
            </Paper>
          ) : (
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 1.25, md: 2 },
                borderRadius: 0.5,
                overflow: "hidden",
                boxShadow: (t) =>
                  `inset 0 1px 0 ${t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.85)"}`,
              }}
            >
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  justifyContent="space-between"
                  alignItems={{ xs: "stretch", md: "center" }}
                  gap={1}
                >
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {treeCollapsed && (
                        <Tooltip title="Expand content tree">
                          <IconButton
                            size="small"
                            onClick={toggleTree}
                            sx={{ borderRadius: 0.5, border: 1, borderColor: "divider" }}
                          >
                            <MenuOpenRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Typography fontWeight={900}>
                        {draft.id ? "Edit article" : "New article"}
                      </Typography>
                      {draft.id && (
                        <Chip
                          size="small"
                          label={draft.status}
                          color={
                            draft.status === "published" ? "success" : "default"
                          }
                          sx={{ fontWeight: 700 }}
                        />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Markdown is the source of truth. Save before publishing.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Tooltip title={treeCollapsed ? "Show content tree" : "Hide content tree for more writing space"}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={toggleTree}
                        startIcon={treeCollapsed ? <MenuOpenRoundedIcon /> : <ChevronLeftRoundedIcon />}
                        sx={{ borderRadius: 0.5, textTransform: "none" }}
                      >
                        {treeCollapsed ? "Show tree" : "Hide tree"}
                      </Button>
                    </Tooltip>
                    <Button
                      startIcon={<SaveRoundedIcon />}
                      onClick={() => save()}
                      disabled={saving}
                      variant="contained"
                    >
                      {saving ? "Saving…" : "Save"}
                    </Button>
                    {draft.id && draft.status !== "published" && (
                      <Button
                        startIcon={<PublishRoundedIcon />}
                        onClick={publish}
                        variant="outlined"
                        color="success"
                      >
                        Publish
                      </Button>
                    )}
                    {draft.id && draft.status === "published" && (
                      <Button
                        startIcon={<UnpublishedRoundedIcon />}
                        onClick={unpublish}
                        variant="outlined"
                      >
                        Unpublish
                      </Button>
                    )}
                    {draft.id && draft.status === "published" && (
                      <Button
                        component="a"
                        href={`/docs/${draft.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        startIcon={<OpenInNewRoundedIcon />}
                        variant="text"
                        size="small"
                      >
                        View
                      </Button>
                    )}
                    {draft.id && (
                      <IconButton color="error" onClick={remove}>
                        <DeleteOutlineRoundedIcon />
                      </IconButton>
                    )}
                  </Stack>
                </Stack>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    gap: 1.25,
                  }}
                >
                  <TextField
                    label="Title"
                    value={draft.title}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                    required
                    fullWidth
                  />
                  <TextField
                    label="Slug"
                    value={draft.slug}
                    onChange={(e) =>
                      setDraft({ ...draft, slug: e.target.value })
                    }
                    helperText="URL path under /docs/"
                    fullWidth
                  />
                  <TextField
                    label="Description"
                    value={draft.description}
                    onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                    }
                    multiline
                    minRows={2}
                    sx={{ gridColumn: { md: "1 / -1" } }}
                    fullWidth
                  />
                  <FormControl fullWidth>
                    <InputLabel id="doc-category-label">Category</InputLabel>
                    <Select
                      labelId="doc-category-label"
                      label="Category"
                      value={draft.category || ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          category: e.target.value || null,
                        })
                      }
                    >
                      <MenuItem value="">
                        <em>General (no category)</em>
                      </MenuItem>
                      {flatCats.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {"\u00A0".repeat(c.depth * 2)}
                          {c.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    component="label"
                    variant="outlined"
                    disabled={uploading}
                    startIcon={
                      uploading ? (
                        <CircularProgress size={18} />
                      ) : (
                        <CloudUploadRoundedIcon />
                      )
                    }
                    sx={{ minHeight: 56 }}
                  >
                    Upload & attach
                    <input
                      hidden
                      type="file"
                      onChange={(e) => {
                        upload(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </Button>
                </Box>

                <MarkdownEditor
                  value={typeof draft.content === "string" ? draft.content : (draft.content == null ? "" : String(draft.content))}
                  onChange={(content) => setDraft({ ...draft, content })}
                  assets={assets}
                  onUpload={upload}
                  uploadState={{ uploading }}
                />
              </Stack>
            </Paper>
          )}
        </Box>
      )}

      <Paper
        variant="outlined"
        sx={{
          p: 1.25,
          borderRadius: 0.5,
          bgcolor: (t) => alpha(t.palette.primary.main, 0.025),
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Tip: use the Media library tab to upload, reassign or delete files without opening an
          article. Attachments on draft articles stay private until the article is published.
        </Typography>
      </Paper>
    </Stack>
  );
}
