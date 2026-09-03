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
  Switch,
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
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
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
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import { DndContext, DragOverlay, useDraggable, useDroppable } from "@dnd-kit/core";
import apiRequest from "../../../customHooks/apiRequest";
import { fetchDocsAssetBlob, hostBase } from "../../adminUtils";
import MarkdownEditor from "../../../docs/MarkdownEditor";
import {
  categoryMoveBody,
  documentMoveBody,
  indexOfId,
} from "./docsOrder";
import {
  fallbackSlug,
  looksBinary,
  makeSlug,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_CHARS,
  parseImportedDoc,
  readTextFile,
  sanitizeSlugInput,
} from "./docsImport";
import { GENERAL_ID } from "./docsDndPlan";
import { useDocsDnd } from "./useDocsDnd";

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

/**
 * Draggable article row of the content tree.
 *
 * The row number doubles as the drag handle (listeners live there, so
 * plain clicks anywhere else keep selecting articles and the buttons
 * stay clickable). The whole row is also a drop target: dropping another
 * article on it reorders inside the section — or moves + inserts when
 * the articles live in different folders.
 */
function TreeDocRow({
  doc,
  docIndex,
  siblingCount,
  sectionId,
  selected,
  onSelect,
  onMove,
  plan,
  pl = 4.25,
}) {
  const dragId = `doc:${doc.id}`;
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { kind: "doc", id: doc.id, title: doc.title, sectionId },
  });
  const { setNodeRef: setDropRef } = useDroppable({
    id: dragId,
    data: { kind: "doc", id: doc.id, title: doc.title, sectionId },
  });
  const indicator =
    plan?.type === "doc-position" && String(plan.targetId) === String(doc.id)
      ? plan.position
      : null;
  return (
    <ListItemButton
      ref={(el) => {
        setNodeRef(el);
        setDropRef(el);
      }}
      selected={selected}
      onClick={() => onSelect(doc)}
      sx={{
        borderRadius: 0.5,
        py: 0.45,
        mb: 0.15,
        pl,
        minWidth: 0,
        opacity: isDragging ? 0.35 : 1,
        ...(indicator === "before" && {
          boxShadow: (t) => `inset 0 2px 0 0 ${t.palette.primary.main}`,
        }),
        ...(indicator === "after" && {
          boxShadow: (t) => `inset 0 -2px 0 0 ${t.palette.primary.main}`,
        }),
      }}
    >
      <Tooltip title="Drag to reorder or move to another folder">
        <Box
          {...listeners}
          sx={{
            fontSize: 10,
            fontWeight: 700,
            width: 18,
            textAlign: "center",
            flexShrink: 0,
            mr: 0.25,
            borderRadius: 0.25,
            color: selected ? "primary.main" : "text.disabled",
            fontFamily: "ui-monospace, monospace",
            cursor: "grab",
            touchAction: "none",
            "&:active": { cursor: "grabbing" },
          }}
        >
          {docIndex + 1}
        </Box>
      </Tooltip>
      <ListItemIcon sx={{ minWidth: 27, mr: 0.5 }}>
        <DescriptionRoundedIcon fontSize="small" color="action" />
      </ListItemIcon>
      <ListItemText
        primary={doc.title || "Untitled"}
        primaryTypographyProps={{ fontSize: 12.5, noWrap: true }}
        sx={{ minWidth: 0 }}
      />
      {onMove && (
        <Box sx={{ display: "flex", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Move article up">
            <span>
              <IconButton
                size="small"
                disabled={docIndex === 0}
                aria-label={`Move ${doc.title || "article"} up`}
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(doc, "up");
                }}
                sx={{ p: 0.35 }}
              >
                <ArrowUpwardRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Move article down">
            <span>
              <IconButton
                size="small"
                disabled={docIndex === siblingCount - 1}
                aria-label={`Move ${doc.title || "article"} down`}
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(doc, "down");
                }}
                sx={{ p: 0.35 }}
              >
                <ArrowDownwardRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      )}
      <Chip
        size="small"
        label={doc.status}
        color={doc.status === "published" ? "success" : "default"}
        sx={{ height: 19, fontSize: 9.5, flexShrink: 0, ml: 0.25 }}
      />
    </ListItemButton>
  );
}

/**
 * Draggable + droppable folder row. Dragging it moves the whole section;
 * dropping things on it files them INTO the folder (articles) or reparents
 * (other sections, when not siblings — siblings reorder instead).
 */
function TreeFolderRow({
  node,
  nodeIndex,
  siblingCount,
  expanded,
  hasChildren,
  onToggle,
  onCategoryMove,
  onMenu,
  plan,
}) {
  const dragId = `cat:${node.id}`;
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { kind: "category", id: node.id, name: node.name, parentId: node.parent_id ?? null },
  });
  const { setNodeRef: setDropRef } = useDroppable({
    id: dragId,
    data: { kind: "folder", node },
  });
  const into =
    plan &&
    (plan.type === "doc-into-folder" || plan.type === "cat-into-folder") &&
    String(plan.folderId) === String(node.id);
  const reorderAt =
    plan?.type === "cat-reorder" && String(plan.targetId) === String(node.id)
      ? plan.position
      : null;
  return (
    <ListItemButton
      ref={(el) => {
        setNodeRef(el);
        setDropRef(el);
      }}
      onClick={onToggle}
      sx={{
        borderRadius: 0.5,
        py: 0.55,
        mb: 0.2,
        minWidth: 0,
        opacity: isDragging ? 0.35 : 1,
        ...(into && {
          bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.2 : 0.12),
          outline: "2px solid",
          outlineColor: "primary.main",
        }),
        ...(reorderAt === "before" && {
          boxShadow: (t) => `inset 0 2px 0 0 ${t.palette.primary.main}`,
        }),
        ...(reorderAt === "after" && {
          boxShadow: (t) => `inset 0 -2px 0 0 ${t.palette.primary.main}`,
        }),
      }}
    >
      {hasChildren ? (
        expanded ? <ExpandMoreRoundedIcon fontSize="small" sx={{ mr: 0.35 }} />
          : <ChevronRightRoundedIcon fontSize="small" sx={{ mr: 0.35 }} />
      ) : <Box sx={{ width: 24, mr: 0.35, flexShrink: 0 }} />}
      <Tooltip title="Drag to reorder this section or move it into another folder">
        <Box
          {...listeners}
          sx={{
            fontSize: 10,
            fontWeight: 700,
            width: 18,
            textAlign: "center",
            flexShrink: 0,
            mr: 0.25,
            borderRadius: 0.25,
            color: "text.disabled",
            fontFamily: "ui-monospace, monospace",
            cursor: "grab",
            touchAction: "none",
            "&:active": { cursor: "grabbing" },
          }}
        >
          {nodeIndex + 1}
        </Box>
      </Tooltip>
      <FolderRoundedIcon fontSize="small" sx={{ mr: 0.65, color: "warning.main", flexShrink: 0 }} />
      <ListItemText
        primary={node.name}
        secondary={`${(node.documents || []).length} article(s)${node.children?.length ? ` · ${node.children.length} subfolder(s)` : ""}`}
        primaryTypographyProps={{ fontWeight: 750, fontSize: 13, noWrap: true }}
        secondaryTypographyProps={{ fontSize: 10.5, noWrap: true }}
        sx={{ minWidth: 0 }}
      />
      {onCategoryMove && (
        <Box sx={{ display: "flex", flexShrink: 0, mr: 0.25 }} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Move section up">
            <span>
              <IconButton
                size="small"
                edge="end"
                disabled={nodeIndex === 0}
                aria-label={`Move ${node.name} up`}
                onClick={() => onCategoryMove(node, "up")}
                sx={{ p: 0.35 }}
              >
                <ArrowUpwardRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Move section down">
            <span>
              <IconButton
                size="small"
                edge="end"
                disabled={nodeIndex === siblingCount - 1}
                aria-label={`Move ${node.name} down`}
                onClick={() => onCategoryMove(node, "down")}
                sx={{ p: 0.35 }}
              >
                <ArrowDownwardRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      )}
      <IconButton
        size="small"
        edge="end"
        aria-label={`Actions for ${node.name}`}
        onClick={(e) => {
          e.stopPropagation();
          onMenu(e, node);
        }}
        sx={{ ml: 0.5, flexShrink: 0 }}
      >
        <MoreVertRoundedIcon fontSize="small" />
      </IconButton>
    </ListItemButton>
  );
}

/**
 * The root-level drop zone: articles dropped here leave their folder
 * (moved to "no category"), sections dropped here move up to root.
 */
function GeneralDropZone({ plan, children }) {
  const { setNodeRef } = useDroppable({ id: "general", data: { kind: "general" } });
  const active = Boolean(
    plan && (plan.type === "doc-to-general" || plan.type === "cat-to-root")
  );
  return (
    <Box
      ref={setNodeRef}
      sx={{
        mt: 0.25,
        px: 0.75,
        pb: 0.5,
        borderRadius: 0.5,
        transition: "background-color 120ms ease",
        ...(active && {
          bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.16 : 0.1),
        }),
      }}
    >
      <Box
        sx={{
          px: 0.75,
          py: 0.45,
          borderRadius: 0.5,
          border: active ? "2px dashed" : "1px dashed",
          borderColor: active ? "primary.main" : "divider",
        }}
      >
        <Typography
          variant="caption"
          color={active ? "primary" : "text.secondary"}
          sx={{ fontWeight: 700, letterSpacing: 0.2 }}
        >
          General (no category)
        </Typography>
      </Box>
      {children}
    </Box>
  );
}

function CategoryTree({
  nodes,
  selectedId,
  onSelect,
  onCategoryAction,
  onDocMove,
  onCategoryMove,
  folderOpen,
  onToggleFolder,
  plan,
  depth = 0,
}) {
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuNode, setMenuNode] = useState(null);

  if (!nodes?.length) return null;

  return (
    <List dense disablePadding sx={{ pl: depth ? 1.25 : 0 }}>
      {nodes.map((node, nodeIndex) => {
        const expanded = folderOpen[node.id] !== false;
        const docs = node.documents || [];
        const hasChildren =
          (node.children && node.children.length > 0) ||
          docs.length > 0;
        return (
          <React.Fragment key={node.id}>
            <TreeFolderRow
              node={node}
              nodeIndex={nodeIndex}
              siblingCount={nodes.length}
              expanded={expanded}
              hasChildren={hasChildren}
              onToggle={() => onToggleFolder(node.id)}
              onCategoryMove={onCategoryMove}
              onMenu={(e, n) => {
                setMenuAnchor(e.currentTarget);
                setMenuNode(n);
              }}
              plan={plan}
            />
            <Collapse in={expanded} unmountOnExit>
              {docs.map((doc, docIndex) => (
                <TreeDocRow
                  key={doc.id}
                  doc={doc}
                  docIndex={docIndex}
                  siblingCount={docs.length}
                  sectionId={node.id}
                  selected={selectedId === doc.id}
                  onSelect={onSelect}
                  onMove={onDocMove}
                  plan={plan}
                />
              ))}
              <CategoryTree
                nodes={node.children || []}
                selectedId={selectedId}
                onSelect={onSelect}
                onCategoryAction={onCategoryAction}
                onDocMove={onDocMove}
                onCategoryMove={onCategoryMove}
                folderOpen={folderOpen}
                onToggleFolder={onToggleFolder}
                plan={plan}
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
  // Auto Slug Maker: while ON, editing the title regenerates the slug live
  // (lower-cased, words joined with "-"). Any manual slug edit switches it
  // off — the WordPress behaviour. Defaults ON for new articles and OFF
  // when an existing article is opened (its URL must not drift silently).
  const [autoSlug, setAutoSlug] = useState(true);
  // Shared folder expand/collapse map of the content tree (lifted here so
  // drag moves can reveal the folder an article was just filed into).
  const [folderOpen, setFolderOpen] = useState({});
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

  const generalDocs = useMemo(
    () => (uncategorized.length ? uncategorized : docs.filter((d) => !d.category)),
    [uncategorized, docs]
  );

  const toggleFolder = useCallback((id) => {
    setFolderOpen((m) => ({ ...m, [id]: m[id] === false ? true : false }));
  }, []);

  const notifyDndError = useCallback((msg) => setError(String(msg || "The drag move could not be saved.")), []);
  const notifyDndSuccess = useCallback((msg) => setSuccess(String(msg || "")), []);

  // Keep the open editor in sync when a drag re-files the article being edited.
  const handleDocCategoryChanged = useCallback((docId, categoryId) => {
    setDraft((d) => (d && String(d.id) === String(docId) ? { ...d, category: categoryId } : d));
  }, []);

  // Reveal (expand) the folder an article/section was just dropped into.
  const handleRevealFolder = useCallback((folderId) => {
    if (!folderId) return;
    setFolderOpen((m) => (m[folderId] === false ? { ...m, [folderId]: true } : m));
  }, []);

  const dnd = useDocsDnd({
    categories,
    uncategorized,
    reload,
    notifyError: notifyDndError,
    notifySuccess: notifyDndSuccess,
    onCategoryChanged: handleDocCategoryChanged,
    onRevealFolder: handleRevealFolder,
  });

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
    // An existing article owns its URL — auto-slug stays off until the
    // admin explicitly re-enables it (or presses the wand).
    setAutoSlug(false);
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

  const create = () => {
    setAutoSlug(true);
    setDraft({
      id: null,
      title: "",
      slug: "",
      description: "",
      category: null,
      status: "draft",
      order: "",
      content: "# New document\n\nStart writing here.\n",
    });
  };

  /**
   * Import a Markdown file as a new article instead of writing it by hand:
   * the first non-empty line becomes the title (leading # stripped), the
   * rest becomes the body, and the slug is generated from that title
   * (lower-cased, dash-joined; non-Latin titles get a URL-safe fallback).
   * The article opens as an editable draft — nothing is saved until Save.
   */
  const importFromFile = async (file) => {
    if (!file) return;
    setError("");
    try {
      if (file.size > MAX_IMPORT_BYTES) {
        throw new Error(`File is too large — imported documents are capped at ${MAX_IMPORT_BYTES.toLocaleString()} bytes.`);
      }
      const text = await readTextFile(file);
      if (looksBinary(text)) {
        throw new Error("This file does not look like a text/Markdown file.");
      }
      if (text.length > MAX_IMPORT_CHARS) {
        throw new Error(`Document is too long — the limit is ${MAX_IMPORT_CHARS.toLocaleString()} characters.`);
      }
      const parsed = parseImportedDoc(text, file.name);
      const slug =
        makeSlug(parsed.title) || makeSlug(file.name) || fallbackSlug();
      setDraft({
        id: null,
        title: parsed.title,
        slug,
        description: "",
        category: null,
        status: "draft",
        order: "",
        content: parsed.content,
      });
      setAutoSlug(true);
      setMainTab(0);
      setSuccess(
        `Imported “${file.name}” — title from the ${
          parsed.titleSource === "filename" ? "file name" : "first line"
        }. Review, then Save.`
      );
    } catch (e) {
      setError(e?.message || "Could not import the file.");
    }
  };

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
        // Never send a blank slug: derive it from the title (and fall back
        // to a generated one for non-Latin titles) so the backend's
        // ASCII-only <slug:slug> URLs always resolve.
        slug: (draft.slug || "").trim() || makeSlug(draft.title) || fallbackSlug(),
        description: draft.description,
        category: draft.category || null,
        content: draft.content,
      };
      // Order is optional: when the field is blank the backend appends the
      // article to the end of its section (order = max + 10).
      const orderValue = Number.parseInt(draft.order, 10);
      if (draft.order !== "" && draft.order != null && !Number.isNaN(orderValue)) {
        payload.order = orderValue;
      }
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

  // ── Ordering: one reorder API call per up/down click. The API takes the
  // FULL sibling sequence of the affected section, so every move also
  // renumbers that section (10, 20, 30 …) and cleans up old ties.
  const moveDocument = async (doc, direction) => {
    const body = documentMoveBody(categories, uncategorized, doc.id, direction);
    if (!body) return;
    setError("");
    try {
      await apiRequest({
        url: `${base}/admin/documents/reorder/`,
        method: "POST",
        data: body,
      });
      await reload();
      setSuccess(`“${doc.title || "Article"}” moved ${direction === "up" ? "up" : "down"}.`);
    } catch (e) {
      setError(e?.response?.data?.detail || "Could not move the article.");
    }
  };

  const moveCategory = async (node, direction) => {
    const body = categoryMoveBody(categories, node.id, direction);
    if (!body) return;
    setError("");
    try {
      await apiRequest({
        url: `${base}/admin/categories/reorder/`,
        method: "POST",
        data: body,
      });
      await reload();
      setSuccess(`Section “${node.name}” moved ${direction === "up" ? "up" : "down"}.`);
    } catch (e) {
      setError(e?.response?.data?.detail || "Could not move the section.");
    }
  };

  const moveUncategorized = (doc, direction) => {
    const index = indexOfId(uncategorized, doc.id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= uncategorized.length) return;
    const ids = [...uncategorized.map((d) => d.id)];
    [ids[index], ids[target]] = [ids[target], ids[index]];
    (async () => {
      setError("");
      try {
        await apiRequest({
          url: `${base}/admin/documents/reorder/`,
          method: "POST",
          data: { ids },
        });
        await reload();
        setSuccess(`“${doc.title || "Article"}” moved ${direction === "up" ? "up" : "down"}.`);
      } catch (e) {
        setError(e?.response?.data?.detail || "Could not move the article.");
      }
    })();
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
          {mainTab === 0 && (
            <Button
              component="label"
              variant="outlined"
              startIcon={<UploadFileRoundedIcon />}
              sx={{ borderRadius: 0.5, textTransform: "none" }}
            >
              Import .md
              <input
                hidden
                type="file"
                accept=".md,.markdown,.mdown,.markdn,.txt,.text,text/markdown,text/plain"
                onChange={(e) => {
                  importFromFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </Button>
          )}
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
          <DndContext
            sensors={dnd.sensors}
            collisionDetection={dnd.collisionDetection}
            measuring={dnd.measuring}
            onDragStart={dnd.onDragStart}
            onDragOver={dnd.onDragOver}
            onDragEnd={dnd.onDragEnd}
            onDragCancel={dnd.onDragCancel}
          >
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
                      Drag the No. handle to reorder or move between folders — the ▲/▼ buttons still work.
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
                {dnd.dropPlan && (
                  <Box
                    sx={{
                      px: 1.25,
                      py: 0.55,
                      borderBottom: 1,
                      borderColor: "divider",
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                    }}
                  >
                    <Typography
                      variant="caption"
                      fontWeight={750}
                      color="primary.main"
                      noWrap
                      component="div"
                    >
                      {dnd.dropPlan.label}
                    </Typography>
                  </Box>
                )}
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
                        onDocMove={moveDocument}
                        onCategoryMove={moveCategory}
                        folderOpen={folderOpen}
                        onToggleFolder={toggleFolder}
                        plan={dnd.dropPlan}
                      />
                      <Divider sx={{ my: 1 }} />
                      <GeneralDropZone plan={dnd.dropPlan}>
                        {generalDocs.map((doc, uncatIndex) => (
                          <TreeDocRow
                            key={doc.id}
                            doc={doc}
                            docIndex={uncatIndex}
                            siblingCount={generalDocs.length}
                            sectionId={GENERAL_ID}
                            selected={draft?.id === doc.id}
                            onSelect={selectDocument}
                            onMove={moveUncategorized}
                            plan={dnd.dropPlan}
                            pl={2.75}
                          />
                        ))}
                        {!generalDocs.length && (
                          <Typography
                            variant="caption"
                            color="text.disabled"
                            sx={{ px: 1.5, py: 0.75, display: "block" }}
                          >
                            Nothing here — drop an article on this zone to take it out of its folder.
                          </Typography>
                        )}
                      </GeneralDropZone>
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
          <DragOverlay>
            {dnd.activeDrag?.kind === "doc" ? (
              <Paper
                elevation={6}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  px: 1.25,
                  py: 0.7,
                  borderRadius: 0.5,
                  maxWidth: 280,
                  border: "1px solid",
                  borderColor: "primary.main",
                }}
              >
                <DescriptionRoundedIcon fontSize="small" color="primary" />
                <Typography fontSize={12.5} fontWeight={750} noWrap>
                  {dnd.activeDrag.title || "Article"}
                </Typography>
              </Paper>
            ) : dnd.activeDrag?.kind === "category" ? (
              <Paper
                elevation={6}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  px: 1.25,
                  py: 0.7,
                  borderRadius: 0.5,
                  maxWidth: 280,
                  border: "1px solid",
                  borderColor: "warning.main",
                }}
              >
                <FolderRoundedIcon fontSize="small" sx={{ color: "warning.main" }} />
                <Typography fontSize={12.5} fontWeight={750} noWrap>
                  {dnd.activeDrag.name}
                </Typography>
              </Paper>
            ) : null}
          </DragOverlay>
          </DndContext>
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
                    onChange={(e) => {
                      const value = e.target.value;
                      setDraft((d) => ({
                        ...d,
                        title: value,
                        // Auto Slug Maker: the slug follows the title live
                        // (lower-cased, words joined with "-") until the
                        // admin edits the slug by hand.
                        slug: autoSlug ? makeSlug(value) : d.slug,
                      }));
                    }}
                    required
                    fullWidth
                  />
                  <TextField
                    label="Slug"
                    value={draft.slug}
                    onChange={(e) => {
                      // Manual edit → auto-slug switches off (WordPress
                      // behaviour), and the input is normalised on the fly.
                      setAutoSlug(false);
                      setDraft({ ...draft, slug: sanitizeSlugInput(e.target.value) });
                    }}
                    helperText={
                      autoSlug && draft.title && !makeSlug(draft.title)
                        ? "No Latin characters in the title — a URL-safe slug is generated on save."
                        : `URL: /docs/${draft.slug || "your-slug"}`
                    }
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Tooltip
                            title={
                              autoSlug
                                ? "Auto slug ON — the slug follows the title while typing"
                                : "Auto slug OFF — turn on to let the title drive the slug"
                            }
                          >
                            <Switch
                              size="small"
                              checked={autoSlug}
                              onChange={(e) => setAutoSlug(e.target.checked)}
                              inputProps={{ "aria-label": "Auto slug maker" }}
                              sx={{ mr: -0.4 }}
                            />
                          </Tooltip>
                          <Tooltip title="Generate slug from title now">
                            <IconButton
                              size="small"
                              edge="end"
                              aria-label="Generate slug from title"
                              onClick={() =>
                                setDraft((d) => ({
                                  ...d,
                                  slug: makeSlug(d.title) || fallbackSlug(),
                                }))
                              }
                            >
                              <AutoFixHighRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      ),
                    }}
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
                        setDraft((d) => ({
                          ...d,
                          category: e.target.value || null,
                          // Switching sections resets the manual position so
                          // the article appends to the end of the new section
                          // on the next save (predictable default).
                          order:
                            (e.target.value || null) === (d.category || null)
                              ? d.order
                              : "",
                        }))
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
                  <TextField
                    label="Order"
                    value={draft.order ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw !== "" && !/^\d*$/.test(raw)) return;
                      setDraft({ ...draft, order: raw });
                    }}
                    inputProps={{
                      inputMode: "numeric",
                      "aria-label": "Article order inside its category",
                      min: 0,
                    }}
                    helperText={
                      draft.order === "" || draft.order == null
                        ? "Blank — appended to the end of the section"
                        : "Lower shows first inside the section"
                    }
                    fullWidth
                  />
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
                    sx={{ minHeight: 56, gridColumn: { md: "1 / -1" } }}
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
          Tip: order and file content by dragging — drop an article on another article
          to reorder it, on a folder to file it inside, or on the General zone to take
          it out; drop a folder on a sibling to reorder or on any other folder to nest
          it. The ▲/▼ buttons still work (the public docs sidebar, index cards and
          prev/next links follow that exact order). New articles are appended to the
          end of their section automatically — or set an exact position in the Order
          field. "Import .md" turns a Markdown file into an article (the first line
          becomes the title, a slug is generated lower-cased and dash-joined), and the
          Auto Slug switch makes the slug follow the title while you type. Use the
          Media library tab to upload, reassign or delete files; every file link is
          public (unguessable UUID) — draft bytes are just kept out of shared caches
          until the article is published.
        </Typography>
      </Paper>
    </Stack>
  );
}
