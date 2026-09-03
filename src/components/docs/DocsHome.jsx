import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import UnfoldLessRoundedIcon from "@mui/icons-material/UnfoldLessRounded";
import UnfoldMoreRoundedIcon from "@mui/icons-material/UnfoldMoreRounded";
import UpdateRoundedIcon from "@mui/icons-material/UpdateRounded";
import apiRequest from "../customHooks/apiRequest";
import { hostBase, publicDocsAssetSrc } from "../admin/adminUtils";
import { renderMarkdown } from "./markdown";
import MarkdownPreview from "./MarkdownPreview";

/** PassDeployer brand mark (public/icon.svg) — the "back to home" affordance. */
const BRAND_LOGO_URL = "/icon.svg";
const BRAND_NAME = "PassDeployer";

const HEADER_HEIGHT = { xs: 60, sm: 68 };
const SIDEBAR_WIDTH = 312;
const RAIL_WIDTH = 236;

/** Public Docs assets are anonymous resources only when their parent document is published. */
const resolvePublicUrl = (url) => {
  if (!url || url === "#") return url;
  if (url.startsWith("#") || /^https?:\/\//i.test(url) || url.startsWith("mailto:") || url.startsWith("tel:")) {
    return url;
  }
  return publicDocsAssetSrc(url);
};

function flatten(nodes, parent = null, out = []) {
  (nodes || []).forEach((node) => {
    out.push({ ...node, parent });
    flatten(node.children || [], node, out);
  });
  return out;
}

function countDocs(node) {
  const own = node?.documents?.length || 0;
  return own + (node?.children || []).reduce((acc, child) => acc + countDocs(child), 0);
}

/** Category ids that must stay open so `docId` is visible (its ancestor path). */
function findPathToDoc(nodes, docId, trail = []) {
  for (const node of nodes || []) {
    const here = [...trail, node.id];
    if ((node.documents || []).some((doc) => doc.id === docId)) return here;
    const deeper = findPathToDoc(node.children || [], docId, here);
    if (deeper) return deeper;
  }
  return null;
}

function isTypingTarget(target) {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable)
  );
}

function formatReadingTime(content) {
  const words = String(content || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function formatUpdatedDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function BrandMark({ size = 36, sx = {} }) {
  return (
    <Box
      component="img"
      src={BRAND_LOGO_URL}
      alt={BRAND_NAME}
      loading="eager"
      sx={{
        width: size,
        height: size,
        borderRadius: "26%",
        display: "block",
        flexShrink: 0,
        border: "1px solid",
        borderColor: "divider",
        ...sx,
      }}
    />
  );
}

function Tree({ nodes, selectedId, depth = 0, expanded, onToggle, onDocClick }) {
  if (!nodes?.length) return null;

  return (
    <List dense disablePadding sx={{ pl: depth ? 1.25 : 0 }}>
      {nodes.map((node) => {
        const open = expanded[node.id] !== false;
        const hasKids =
          (node.children && node.children.length > 0) ||
          (node.documents && node.documents.length > 0);
        const count = countDocs(node);
        return (
          <React.Fragment key={node.id}>
            <ListItemButton
              onClick={() => onToggle(node.id)}
              disableRipple={!hasKids}
              sx={{
                borderRadius: 1.5,
                mb: 0.25,
                py: 0.65,
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              {open ? (
                <FolderOpenRoundedIcon
                  fontSize="small"
                  sx={{ mr: 1, color: "warning.main", flexShrink: 0 }}
                />
              ) : (
                <FolderRoundedIcon
                  fontSize="small"
                  sx={{ mr: 1, color: "warning.main", flexShrink: 0 }}
                />
              )}
              <ListItemText
                primary={node.name}
                primaryTypographyProps={{
                  fontWeight: 800,
                  fontSize: 13,
                  noWrap: true,
                }}
              />
              {count > 0 && (
                <Chip
                  size="small"
                  label={count}
                  sx={{
                    ml: 0.75,
                    mr: hasKids ? 0 : 0,
                    height: 20,
                    minWidth: 22,
                    fontSize: 11,
                    fontWeight: 700,
                    bgcolor: (t) =>
                      alpha(t.palette.text.primary, t.palette.mode === "dark" ? 0.14 : 0.07),
                    color: "text.secondary",
                    flexShrink: 0,
                  }}
                />
              )}
              {hasKids &&
                (open ? (
                  <ExpandLessRoundedIcon fontSize="small" sx={{ flexShrink: 0 }} />
                ) : (
                  <ExpandMoreRoundedIcon fontSize="small" sx={{ flexShrink: 0 }} />
                ))}
            </ListItemButton>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ pl: 1 }}>
                {(node.documents || []).map((doc) => {
                  const isActive = selectedId === doc.id;
                  return (
                    <ListItemButton
                      key={doc.id}
                      data-doc-id={doc.id}
                      component={RouterLink}
                      to={`/docs/${doc.slug}`}
                      selected={isActive}
                      onClick={onDocClick}
                      sx={{
                        borderRadius: 1.5,
                        mb: 0.25,
                        py: 0.55,
                        position: "relative",
                        ...(isActive && {
                          bgcolor: (t) =>
                            alpha(
                              t.palette.primary.main,
                              t.palette.mode === "dark" ? 0.16 : 0.1
                            ),
                          "&::before": {
                            content: '""',
                            position: "absolute",
                            left: 0,
                            top: "20%",
                            bottom: "20%",
                            width: 3,
                            borderRadius: 3,
                            bgcolor: "primary.main",
                          },
                        }),
                      }}
                    >
                      <ArticleRoundedIcon
                        fontSize="small"
                        sx={{
                          mr: 1,
                          flexShrink: 0,
                          opacity: isActive ? 1 : 0.55,
                          color: isActive ? "primary.main" : "text.secondary",
                        }}
                      />
                      <ListItemText
                        primary={doc.title}
                        primaryTypographyProps={{
                          fontSize: 13,
                          noWrap: true,
                          fontWeight: isActive ? 800 : 500,
                        }}
                      />
                    </ListItemButton>
                  );
                })}
                <Tree
                  nodes={node.children || []}
                  selectedId={selectedId}
                  depth={depth + 1}
                  expanded={expanded}
                  onToggle={onToggle}
                  onDocClick={onDocClick}
                />
              </Box>
            </Collapse>
          </React.Fragment>
        );
      })}
    </List>
  );
}

function SidebarContent({
  tree,
  allDocs,
  selected,
  q,
  onQueryChange,
  filtered,
  loading,
  expanded,
  onToggle,
  onExpandAll,
  onCollapseAll,
  onOpenDoc,
  onGoHome,
  searchRef,
  containerRef,
}) {
  const activeId = selected?.id;

  // Keep the active article visible inside the long menu (scoped to THIS
  // sidebar instance — the same content is mounted for desktop and mobile).
  useEffect(() => {
    if (!activeId || !containerRef?.current) return;
    const el = containerRef.current.querySelector(
      `[data-doc-id="${activeId}"]`
    );
    if (el) el.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, [activeId, q, containerRef]);

  return (
    <Stack direction="column" sx={{ height: "100%", minHeight: 0 }} ref={containerRef}>
      <Box sx={{ p: 2, pb: 1.25 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography
            fontWeight={900}
            fontSize={11.5}
            letterSpacing={1.2}
            color="text.secondary"
            sx={{ textTransform: "uppercase" }}
          >
            Contents
          </Typography>
          <Stack direction="row" spacing={0.25}>
            <Tooltip title="Collapse all">
              <span>
                <IconButton size="small" onClick={onCollapseAll} aria-label="Collapse all sections">
                  <UnfoldLessRoundedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Expand all">
              <span>
                <IconButton size="small" onClick={onExpandAll} aria-label="Expand all sections">
                  <UnfoldMoreRoundedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
        <TextField
          fullWidth
          size="small"
          sx={{ mt: 1.25 }}
          placeholder="Search documentation"
          value={q}
          onChange={(e) => onQueryChange(e.target.value)}
          inputRef={searchRef}
          slotProps={{
            htmlInput: { "aria-label": "Search documentation" },
          }}
          InputProps={{
            startAdornment: (
              <SearchRoundedIcon sx={{ mr: 1, color: "text.disabled" }} />
            ),
            endAdornment: q ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  aria-label="Clear search"
                  onClick={() => onQueryChange("")}
                >
                  <ClearRoundedIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : (
              <Tooltip title="Press / to search">
                <Box component="kbd" sx={{ display: { xs: "none", sm: "inline-block" } }}>
                  <Typography
                    component="span"
                    sx={{
                      fontSize: 11,
                      fontWeight: 700,
                      px: 0.75,
                      py: 0.15,
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                      color: "text.secondary",
                      bgcolor: "action.hover",
                      fontFamily: "ui-monospace, monospace",
                    }}
                  >
                    /
                  </Typography>
                </Box>
              </Tooltip>
            ),
          }}
        />
      </Box>
      <Divider />

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          p: 1.25,
          scrollbarWidth: "thin",
          "&::-webkit-scrollbar": { width: 6 },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: (t) => alpha(t.palette.text.primary, 0.18),
            borderRadius: 3,
          },
          "&::-webkit-scrollbar-thumb:hover": {
            bgcolor: (t) => alpha(t.palette.text.primary, 0.32),
          },
        }}
      >
        {q ? (
          <>
            {filtered.map((doc) => (
              <ListItemButton
                key={doc.id}
                selected={activeId === doc.id}
                onClick={() => onOpenDoc(doc)}
                sx={{ borderRadius: 1.75, mb: 0.25 }}
              >
                <ArticleRoundedIcon
                  fontSize="small"
                  sx={{ mr: 1, opacity: 0.55, flexShrink: 0 }}
                />
                <ListItemText
                  primary={doc.title}
                  primaryTypographyProps={{ fontSize: 13, noWrap: true, fontWeight: 600 }}
                  secondary={doc.category_name || "General"}
                />
              </ListItemButton>
            ))}
            {!loading && !filtered.length && (
              <Alert severity="info" sx={{ mt: 1 }}>
                No article found for “{q}”.
              </Alert>
            )}
          </>
        ) : (
          <>
            <Tree
              nodes={tree}
              selectedId={activeId}
              expanded={expanded}
              onToggle={onToggle}
              onDocClick={onOpenDoc}
            />
            {allDocs
              .filter((doc) => !doc.category)
              .map((doc) => {
                const isActive = activeId === doc.id;
                return (
                  <ListItemButton
                    key={doc.id}
                    data-doc-id={doc.id}
                    component={RouterLink}
                    to={`/docs/${doc.slug}`}
                    selected={isActive}
                    onClick={onOpenDoc}
                    sx={{
                      borderRadius: 1.5,
                      mt: 0.25,
                      position: "relative",
                      ...(isActive && {
                        bgcolor: (t) =>
                          alpha(
                            t.palette.primary.main,
                            t.palette.mode === "dark" ? 0.16 : 0.1
                          ),
                        "&::before": {
                          content: '""',
                          position: "absolute",
                          left: 0,
                          top: "20%",
                          bottom: "20%",
                          width: 3,
                          borderRadius: 3,
                          bgcolor: "primary.main",
                        },
                      }),
                    }}
                  >
                    <ArticleRoundedIcon
                      fontSize="small"
                      sx={{
                        mr: 1,
                        opacity: isActive ? 1 : 0.5,
                        color: isActive ? "primary.main" : "text.secondary",
                      }}
                    />
                    <ListItemText
                      primary={doc.title}
                      secondary="General"
                      primaryTypographyProps={{
                        fontSize: 13,
                        noWrap: true,
                        fontWeight: isActive ? 800 : 500,
                      }}
                    />
                  </ListItemButton>
                );
              })}
            {!loading && !allDocs.length && (
              <Alert severity="info" sx={{ mt: 1 }}>
                No published articles yet.
              </Alert>
            )}
          </>
        )}
      </Box>

      <Divider />
      <Box sx={{ p: 1 }}>
        <ListItemButton
          onClick={onGoHome}
          sx={{ borderRadius: 1.75 }}
          aria-label="Back to home"
        >
          <BrandMark size={24} />
          <ListItemText
            primary="Back to home"
            primaryTypographyProps={{ fontWeight: 700, fontSize: 13 }}
            sx={{ ml: 1.25 }}
          />
        </ListItemButton>
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          sx={{ px: 1.5, pt: 1, pb: 0.5 }}
        >
          <ScheduleRoundedIcon sx={{ fontSize: 14, color: "text.disabled" }} />
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            {allDocs.length} article{allDocs.length === 1 ? "" : "s"} published
          </Typography>
        </Stack>
      </Box>
    </Stack>
  );
}

export default function DocsHome({ onThemeModeChange }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const muiTheme = useTheme();
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const [tree, setTree] = useState([]);
  const [allDocs, setAllDocs] = useState([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [docLoading, setDocLoading] = useState(false);
  const [q, setQ] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState({});

  const articleRef = useRef(null);
  const [activeHeading, setActiveHeading] = useState("");
  const [readPct, setReadPct] = useState(0);

  // Sidebar / search refs. These are declared early on purpose: the "/"
  // and Ctrl+K keyboard handlers below run while this component renders,
  // and referencing a const before its declaration crashes the whole page
  // (TDZ ReferenceError: Cannot access 'X' before initialization).
  const desktopSidebarRef = useRef(null);
  const mobileSidebarRef = useRef(null);
  const desktopSearchRef = useRef(null);
  const mobileSearchRef = useRef(null);
  // Set when "/" opens the mobile drawer, so focus lands in its search box
  // after the drawer contents have mounted.
  const pendingSearchFocusRef = useRef(false);

  // ── Data loading ────────────────────────────────────────────────
  const loadTree = useCallback(async () => {
    setTreeLoading(true);
    setError("");
    try {
      const response = await apiRequest({
        url: `${hostBase()}/api/docs/tree/`,
      });
      const payload = response?.data || {};
      const categories = payload.categories || [];
      const flat = flatten(categories).flatMap((x) => x.documents || []);
      const uncategorized = payload.uncategorized || [];
      setTree(categories);
      setAllDocs([...flat, ...uncategorized]);
    } catch (err) {
      setError(
        err?.response?.data?.detail || "Documentation could not be loaded."
      );
    } finally {
      setTreeLoading(false);
    }
  }, []);

  const loadDoc = useCallback(
    async (targetSlug, cache) => {
      if (!targetSlug) {
        setSelected(null);
        return;
      }
      setDocLoading(true);
      try {
        const detail = await apiRequest({
          url: `${hostBase()}/api/docs/public/${encodeURIComponent(targetSlug)}/`,
        });
        setSelected(detail?.data || null);
      } catch {
        const wanted = (cache || []).find((d) => d.slug === targetSlug) || null;
        setSelected(wanted);
      } finally {
        setDocLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  useEffect(() => {
    loadDoc(slug, allDocs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Default: every category open; the selected article's path stays open.
  useEffect(() => {
    if (!tree.length) return;
    setExpanded(() => {
      const next = {};
      flatten(tree).forEach((node) => {
        next[node.id] = true;
      });
      return next;
    });
  }, [tree]);

  useEffect(() => {
    if (!selected?.id || !tree.length) return;
    const path = findPathToDoc(tree, selected.id);
    if (!path) return;
    setExpanded((v) => {
      let changed = false;
      const next = { ...v };
      path.forEach((id) => {
        if (!next[id]) {
          next[id] = true;
          changed = true;
        }
      });
      return changed ? next : v;
    });
  }, [selected, tree]);

  // ── Reading progress (top bar + percentage) ─────────────────────
  const { scrollYProgress } = useScroll();
  const progressScale = useTransform(scrollYProgress, [0, 1], [0, 1]);
  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
    setReadPct((prev) => (prev === pct ? prev : pct));
  });

  useEffect(() => {
    setActiveHeading("");
  }, [slug]);

  // ── Search ──────────────────────────────────────────────────────
  const filtered = useMemo(
    () =>
      allDocs.filter(
        (d) =>
          !q ||
          `${d.title} ${d.description} ${d.category_name || ""}`
            .toLowerCase()
            .includes(q.toLowerCase())
      ),
    [allDocs, q]
  );

  // Focus whichever search box is currently on screen. On phones (drawer
  // closed) no search box is visible, so the shortcut opens the drawer and
  // focuses the mobile search field once it has mounted.
  const focusSearchInput = useCallback(() => {
    const visible = [desktopSearchRef.current, mobileSearchRef.current].find(
      (node) => node && node.offsetParent !== null
    );
    if (visible) {
      visible.focus?.();
      visible.select?.();
      return;
    }
    pendingSearchFocusRef.current = true;
    setMobileOpen(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        focusSearchInput();
        return;
      }
      if (event.key === "/" && !isTypingTarget(event.target)) {
        event.preventDefault();
        focusSearchInput();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusSearchInput]);

  // When "/" opened the mobile drawer, land focus in the drawer's search
  // field after it mounts (MUI keeps drawer contents unmounted while closed).
  useEffect(() => {
    if (!mobileOpen || !pendingSearchFocusRef.current) return undefined;
    pendingSearchFocusRef.current = false;
    const timer = setTimeout(() => {
      mobileSearchRef.current?.focus?.();
    }, 90);
    return () => clearTimeout(timer);
  }, [mobileOpen]);

  const chooseSearch = (doc) => {
    navigate(`/docs/${doc.slug}`);
    setMobileOpen(false);
    setQ("");
  };

  const goHome = () => {
    navigate("/");
    setMobileOpen(false);
  };

  // ── Theme toggle ────────────────────────────────────────────────
  const isDark = muiTheme.palette.mode === "dark";
  const handleToggleTheme = () => {
    const nextMode = isDark ? "light" : "dark";
    if (typeof onThemeModeChange === "function") onThemeModeChange(nextMode);
  };

  // ── Tree expand / collapse helpers ──────────────────────────────
  const handleToggle = (nodeId) =>
    setExpanded((v) => ({ ...v, [nodeId]: v[nodeId] === false }));

  const handleExpandAll = () =>
    setExpanded(() => {
      const next = {};
      flatten(tree).forEach((node) => {
        next[node.id] = true;
      });
      return next;
    });

  const handleCollapseAll = () =>
    setExpanded(() => {
      const next = {};
      (tree || []).forEach((node) => {
        next[node.id] = false;
      });
      return next;
    });

  // ── Rendered article + on-page TOC ──────────────────────────────
  const renderedHtml = useMemo(
    () =>
      selected
        ? renderMarkdown(selected.content || "", {
            resolveUrl: resolvePublicUrl,
          })
        : "",
    [selected]
  );

  const articleToc = useMemo(() => {
    if (!renderedHtml || typeof window === "undefined" || typeof DOMParser === "undefined") {
      return [];
    }
    try {
      const parsed = new DOMParser().parseFromString(renderedHtml, "text/html");
      return Array.from(parsed.querySelectorAll("h2[id], h3[id]"))
        .map((heading) => ({
          id: heading.getAttribute("id"),
          text: (heading.textContent || "").trim(),
          depth: heading.tagName === "H2" ? 2 : 3,
        }))
        .filter((item) => item.id && item.text);
    } catch {
      return [];
    }
  }, [renderedHtml]);

  useEffect(() => {
    const root = articleRef.current;
    if (!root || !articleToc.length) {
      setActiveHeading("");
      return undefined;
    }
    const headings = articleToc
      .map((item) => root.querySelector(`[id="${CSS.escape(item.id)}"]`))
      .filter(Boolean);
    if (!headings.length) return undefined;

    const visible = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        });
        if (visible.size) {
          const first = articleToc.find((item) => visible.has(item.id));
          if (first) setActiveHeading(first.id);
        }
      },
      { rootMargin: "-84px 0px -72% 0px", threshold: 0 }
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [articleToc, docLoading]);

  const scrollToHeading = (id) => {
    const el = articleRef.current?.querySelector(`[id="${CSS.escape(id)}"]`);
    if (!el) return;
    el.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  // ── Prev / next navigation ──────────────────────────────────────
  const { prevDoc, nextDoc } = useMemo(() => {
    if (!selected || !allDocs.length) return { prevDoc: null, nextDoc: null };
    const index = allDocs.findIndex((d) => d.id === selected.id);
    if (index < 0) return { prevDoc: null, nextDoc: null };
    return {
      prevDoc: index > 0 ? allDocs[index - 1] : null,
      nextDoc: index < allDocs.length - 1 ? allDocs[index + 1] : null,
    };
  }, [allDocs, selected]);

  const readingMinutes = useMemo(
    () => formatReadingTime(selected?.content),
    [selected?.content]
  );
  const updatedLabel = useMemo(
    () => formatUpdatedDate(selected?.updated_at || selected?.published_at),
    [selected?.updated_at, selected?.published_at]
  );

  const loading = treeLoading || (Boolean(slug) && docLoading && !selected);

  const sidebarProps = {
    tree,
    allDocs,
    selected,
    q,
    onQueryChange: setQ,
    filtered,
    loading: treeLoading,
    expanded,
    onToggle: handleToggle,
    onExpandAll: handleExpandAll,
    onCollapseAll: handleCollapseAll,
    onOpenDoc: chooseSearch,
    onGoHome: goHome,
    searchRef: desktopSearchRef,
  };

  const headerBar = (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 1200,
        bgcolor: (t) =>
          t.palette.mode === "dark"
            ? alpha(t.palette.background.paper, 0.82)
            : alpha(t.palette.background.paper, 0.86),
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.25}
        sx={{
          height: HEADER_HEIGHT,
          px: { xs: 1.5, sm: 2.5 },
          maxWidth: 1440,
          mx: "auto",
          width: "100%",
        }}
      >
        <IconButton
          onClick={() => setMobileOpen(true)}
          aria-label="Open documentation menu"
          sx={{ display: { xs: "inline-flex", md: "none" } }}
        >
          <MenuRoundedIcon />
        </IconButton>

        <Tooltip title="Back to home">
          <ButtonBase
            onClick={goHome}
            focusRipple
            aria-label="Back to PassDeployer home"
            sx={{
              borderRadius: 2,
              px: 1,
              py: 0.5,
              transition: "background-color .15s",
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <Stack direction="row" spacing={1.25} alignItems="center">
              <BrandMark size={36} />
              <Box sx={{ textAlign: "left", display: { xs: "none", sm: "block" } }}>
                <Typography
                  fontWeight={900}
                  fontSize={15}
                  letterSpacing={-0.2}
                  lineHeight={1.15}
                >
                  {BRAND_NAME}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontWeight: 700, letterSpacing: 0.4 }}
                >
                  DOCUMENTATION
                </Typography>
              </Box>
            </Stack>
          </ButtonBase>
        </Tooltip>

        <Box sx={{ flex: 1 }} />

        {selected && !loading && (
          <Tooltip title="Reading progress">
            <Chip
              size="small"
              icon={<ScheduleRoundedIcon />}
              label={`${readPct}% read`}
              sx={{
                display: { xs: "none", sm: "inline-flex" },
                fontWeight: 700,
                bgcolor: (t) =>
                  alpha(
                    t.palette.primary.main,
                    t.palette.mode === "dark" ? 0.16 : 0.1
                  ),
                color: "primary.main",
                "& .MuiChip-icon": { color: "primary.main" },
              }}
            />
          </Tooltip>
        )}

        <Tooltip title={isDark ? "Switch to light theme" : "Switch to dark theme"}>
          <IconButton
            onClick={handleToggleTheme}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "action.hover",
              "&:hover": { bgcolor: "action.selected" },
            }}
          >
            {isDark ? (
              <LightModeRoundedIcon fontSize="small" />
            ) : (
              <DarkModeRoundedIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Reading progress line */}
      <Box
        sx={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: -1,
          height: 3,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <Box
          component={motion.div}
          style={{ scaleX: progressScale }}
          sx={{
            height: "100%",
            transformOrigin: "0 50%",
            background: (t) =>
              `linear-gradient(90deg, ${t.palette.primary.main}, ${t.palette.secondary.main})`,
          }}
        />
      </Box>
    </Box>
  );

  return (
    <Box
      className="docs-workspace"
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        bgcolor: "background.default",
        color: "text.primary",
      }}
    >
      {headerBar}

      <Box sx={{ display: "flex", flex: 1, minHeight: 0, alignItems: "flex-start" }}>
        {/* Desktop sidebar — always pinned to the left while the article scrolls */}
        <Box
          component="aside"
          aria-label="Documentation navigation"
          sx={{
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            position: "sticky",
            top: 68,
            height: "calc(100vh - 68px)",
            borderRight: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <SidebarContent {...sidebarProps} containerRef={desktopSidebarRef} />
        </Box>

        {/* Mobile drawer */}
        <Drawer
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          PaperProps={{
            sx: {
              width: "min(88vw, 340px)",
              borderRight: "1px solid",
              borderColor: "divider",
            },
          }}
        >
          <SidebarContent
            {...sidebarProps}
            searchRef={mobileSearchRef}
            containerRef={mobileSidebarRef}
          />
        </Drawer>

        <Box component="section" sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            alignItems="flex-start"
            sx={{
              maxWidth: 1240,
              mx: "auto",
              px: { xs: 2, sm: 3, md: 4 },
              gap: { xl: 5 },
            }}
          >
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                maxWidth: 860,
                mx: "auto",
                width: "100%",
                py: { xs: 3, sm: 4, md: 5 },
              }}
            >
              {loading ? (
                <Stack alignItems="center" justifyContent="center" minHeight="65vh">
                  <CircularProgress />
                </Stack>
              ) : error ? (
                <Alert
                  severity="error"
                  action={<Button onClick={loadTree}>Retry</Button>}
                >
                  {error}
                </Alert>
              ) : !selected ? (
                <Box>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                    <BrandMark size={40} />
                    <Typography
                      component="h1"
                      variant="h3"
                      fontWeight={950}
                      letterSpacing={-1.2}
                    >
                      Documentation
                    </Typography>
                  </Stack>
                  <Typography color="text.secondary" sx={{ mb: 4, maxWidth: 640 }}>
                    Browse published guides from the sidebar, or search by title and
                    description. Press{" "}
                    <Typography
                      component="kbd"
                      sx={{
                        fontSize: 12,
                        fontWeight: 700,
                        px: 0.75,
                        py: 0.15,
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor: "action.hover",
                        fontFamily: "ui-monospace, monospace",
                      }}
                    >
                      /
                    </Typography>{" "}
                    anywhere to jump into search.
                  </Typography>
                  {!allDocs.length ? (
                    <Paper
                      variant="outlined"
                      sx={{ p: 6, textAlign: "center", borderRadius: 4 }}
                    >
                      <BrandMark size={64} sx={{ mx: "auto", mb: 2 }} />
                      <Typography variant="h5" fontWeight={900}>
                        Documentation is empty
                      </Typography>
                      <Typography color="text.secondary" sx={{ mt: 1 }}>
                        Published articles will appear here once an admin publishes
                        them.
                      </Typography>
                      <Button
                        sx={{ mt: 2 }}
                        component={RouterLink}
                        to="/"
                        variant="outlined"
                        startIcon={<ArrowBackRoundedIcon />}
                      >
                        Back to home
                      </Button>
                    </Paper>
                  ) : (
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: {
                          xs: "1fr",
                          sm: "1fr 1fr",
                          md: "1fr 1fr 1fr",
                        },
                        gap: 2,
                      }}
                    >
                      {allDocs.map((doc) => (
                        <Paper
                          key={doc.id}
                          component={RouterLink}
                          to={`/docs/${doc.slug}`}
                          variant="outlined"
                          sx={{
                            p: 2.5,
                            borderRadius: 3,
                            textDecoration: "none",
                            color: "inherit",
                            transition: "border-color .15s, box-shadow .15s",
                            "&:hover": {
                              borderColor: "primary.main",
                              boxShadow: (t) =>
                                `0 8px 28px ${alpha(t.palette.primary.main, 0.12)}`,
                            },
                          }}
                        >
                          <Chip
                            size="small"
                            label={doc.category_name || "General"}
                            sx={{ mb: 1.25, fontWeight: 700 }}
                          />
                          <Typography fontWeight={850} fontSize={16} sx={{ mb: 0.5 }}>
                            {doc.title}
                          </Typography>
                          {doc.description && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                display: "-webkit-box",
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              {doc.description}
                            </Typography>
                          )}
                        </Paper>
                      ))}
                    </Box>
                  )}
                </Box>
              ) : (
                <Box component="article" ref={articleRef} sx={{ minWidth: 0 }}>
                  <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
                    <Button
                      size="small"
                      component={RouterLink}
                      to="/docs"
                      sx={{ textTransform: "none", fontWeight: 700 }}
                    >
                      Docs
                    </Button>
                    {selected.category_name && (
                      <Typography color="text.secondary" fontSize={13}>
                        {selected.category_name}
                      </Typography>
                    )}
                  </Breadcrumbs>

                  <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", rowGap: 1 }}>
                    <Chip
                      label={selected.category_name || "General"}
                      size="small"
                      sx={{ fontWeight: 800 }}
                    />
                    <Chip
                      icon={<ScheduleRoundedIcon />}
                      label={`${readingMinutes} min read`}
                      size="small"
                      variant="outlined"
                      sx={{ fontWeight: 700 }}
                    />
                    {updatedLabel && (
                      <Chip
                        icon={<UpdateRoundedIcon />}
                        label={`Updated ${updatedLabel}`}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 700 }}
                      />
                    )}
                  </Stack>

                  <Typography
                    component="h1"
                    variant="h1"
                    sx={{
                      fontSize: { xs: "2rem", md: "3rem" },
                      lineHeight: 1.08,
                      fontWeight: 950,
                      letterSpacing: -2,
                      mb: 1.5,
                    }}
                  >
                    {selected.title}
                  </Typography>
                  {selected.description && (
                    <Typography
                      component="h2"
                      variant="h6"
                      color="text.secondary"
                      sx={{
                        fontWeight: 450,
                        lineHeight: 1.65,
                        maxWidth: 820,
                        mb: 3,
                      }}
                    >
                      {selected.description}
                    </Typography>
                  )}
                  <Divider sx={{ mb: 4 }} />
                  <Box sx={{ minWidth: 0 }}>
                    <MarkdownPreview
                      className="docs-markdown-preview docs-article"
                      html={renderedHtml}
                    />
                  </Box>
                  <Divider sx={{ my: 5 }} />

                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    justifyContent="space-between"
                  >
                    {prevDoc ? (
                      <Paper
                        component={RouterLink}
                        to={`/docs/${prevDoc.slug}`}
                        variant="outlined"
                        sx={{
                          flex: 1,
                          p: 2,
                          borderRadius: 3,
                          textDecoration: "none",
                          color: "inherit",
                          transition: "border-color .15s",
                          "&:hover": { borderColor: "primary.main" },
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center">
                          <ArrowBackRoundedIcon fontSize="small" sx={{ opacity: 0.6 }} />
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            Previous
                          </Typography>
                        </Stack>
                        <Typography fontWeight={800} fontSize={15} sx={{ mt: 0.5 }}>
                          {prevDoc.title}
                        </Typography>
                      </Paper>
                    ) : (
                      <Box sx={{ flex: 1 }} />
                    )}
                    {nextDoc && (
                      <Paper
                        component={RouterLink}
                        to={`/docs/${nextDoc.slug}`}
                        variant="outlined"
                        sx={{
                          flex: 1,
                          p: 2,
                          borderRadius: 3,
                          textDecoration: "none",
                          color: "inherit",
                          textAlign: "right",
                          transition: "border-color .15s",
                          "&:hover": { borderColor: "primary.main" },
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          justifyContent="flex-end"
                        >
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            Next
                          </Typography>
                          <ArrowForwardRoundedIcon fontSize="small" sx={{ opacity: 0.6 }} />
                        </Stack>
                        <Typography fontWeight={800} fontSize={15} sx={{ mt: 0.5 }}>
                          {nextDoc.title}
                        </Typography>
                      </Paper>
                    )}
                  </Stack>

                  <Divider sx={{ my: 5 }} />
                  <Stack direction="row" spacing={2} justifyContent="space-between">
                    <Button component={RouterLink} to="/docs" sx={{ textTransform: "none" }}>
                      All documentation
                    </Button>
                    <Button
                      component={RouterLink}
                      to="/"
                      startIcon={<BrandMark size={20} />}
                      sx={{ textTransform: "none" }}
                    >
                      Back to home
                    </Button>
                  </Stack>
                </Box>
              )}
            </Box>

            {/* On-page TOC rail (wide screens) */}
            {selected && !loading && articleToc.length > 0 && (
              <Box
                component="nav"
                aria-label="On this page"
                sx={{
                  display: { xs: "none", xl: "block" },
                  width: RAIL_WIDTH,
                  flexShrink: 0,
                  position: "sticky",
                  top: 92,
                  maxHeight: "calc(100vh - 116px)",
                  overflowY: "auto",
                  pt: 2,
                  pb: 3,
                  scrollbarWidth: "thin",
                  "&::-webkit-scrollbar": { width: 5 },
                  "&::-webkit-scrollbar-thumb": {
                    bgcolor: (t) => alpha(t.palette.text.primary, 0.16),
                    borderRadius: 3,
                  },
                }}
              >
                <Typography
                  fontWeight={900}
                  fontSize={11.5}
                  letterSpacing={1.2}
                  color="text.secondary"
                  sx={{ textTransform: "uppercase", mb: 1, px: 1.25 }}
                >
                  On this page
                </Typography>
                <Stack spacing={0.25}>
                  {articleToc.map((item) => {
                    const isActive = activeHeading === item.id;
                    return (
                      <Button
                        key={item.id}
                        size="small"
                        onClick={() => scrollToHeading(item.id)}
                        sx={{
                          justifyContent: "flex-start",
                          textAlign: "left",
                          textTransform: "none",
                          px: 1.25,
                          py: 0.5,
                          minWidth: 0,
                          borderRadius: 1.5,
                          pl: item.depth === 3 ? 3 : 1.25,
                          fontSize: item.depth === 3 ? 12.5 : 13,
                          fontWeight: isActive ? 800 : 550,
                          color: isActive ? "primary.main" : "text.secondary",
                          bgcolor: isActive ? "action.hover" : "transparent",
                          "&:hover": {
                            bgcolor: "action.hover",
                            color: isActive ? "primary.main" : "text.primary",
                          },
                          transition: "color .15s, background-color .15s",
                          "& .MuiButton-root": { minWidth: 0 },
                        }}
                      >
                        <Box
                          component="span"
                          sx={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "block",
                            width: "100%",
                          }}
                        >
                          {item.text}
                        </Box>
                      </Button>
                    );
                  })}
                </Stack>
              </Box>
            )}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
