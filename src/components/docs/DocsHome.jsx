import React, { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import apiRequest from "../customHooks/apiRequest";
import { hostBase, publicDocsAssetSrc } from "../admin/adminUtils";
import { renderMarkdown } from "./markdown";
import MarkdownPreview from "./MarkdownPreview";

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

function Tree({ nodes, selectedId, depth = 0 }) {
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    const next = {};
    flatten(nodes).forEach((node) => {
      if (node.documents?.length || node.children?.length) next[node.id] = true;
    });
    setExpanded(next);
  }, [nodes]);

  if (!nodes?.length) return null;

  return (
    <List dense disablePadding sx={{ pl: depth ? 1 : 0 }}>
      {nodes.map((node) => {
        const open = expanded[node.id] !== false;
        const hasKids =
          (node.children && node.children.length > 0) ||
          (node.documents && node.documents.length > 0);
        return (
          <React.Fragment key={node.id}>
            <ListItemButton
              onClick={() =>
                setExpanded((v) => ({ ...v, [node.id]: !open }))
              }
              sx={{
                borderRadius: 1.5,
                mb: 0.25,
                py: 0.7,
              }}
            >
              <FolderRoundedIcon
                fontSize="small"
                sx={{ mr: 1, color: "warning.main", flexShrink: 0 }}
              />
              <ListItemText
                primary={node.name}
                primaryTypographyProps={{
                  fontWeight: 800,
                  fontSize: 13,
                  noWrap: true,
                }}
              />
              {hasKids &&
                (open ? (
                  <ExpandLessRoundedIcon fontSize="small" />
                ) : (
                  <ExpandMoreRoundedIcon fontSize="small" />
                ))}
            </ListItemButton>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ pl: 1.25 }}>
                {(node.documents || []).map((doc) => (
                  <ListItemButton
                    key={doc.id}
                    component={RouterLink}
                    to={`/docs/${doc.slug}`}
                    selected={selectedId === doc.id}
                    sx={{ borderRadius: 1.5, mb: 0.25, py: 0.55 }}
                  >
                    <DescriptionRoundedIcon
                      fontSize="small"
                      sx={{ mr: 1, opacity: 0.55, flexShrink: 0 }}
                    />
                    <ListItemText
                      primary={doc.title}
                      primaryTypographyProps={{ fontSize: 13, noWrap: true }}
                    />
                  </ListItemButton>
                ))}
                <Tree
                  nodes={node.children || []}
                  selectedId={selectedId}
                  depth={depth + 1}
                />
              </Box>
            </Collapse>
          </React.Fragment>
        );
      })}
    </List>
  );
}

export default function DocsHome() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [tree, setTree] = useState([]);
  const [allDocs, setAllDocs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest({
        url: `${hostBase()}/api/docs/tree/`,
      });
      const payload = response?.data || {};
      const categories = payload.categories || [];
      const flat = flatten(categories).flatMap((x) => x.documents || []);
      const uncategorized = payload.uncategorized || [];
      const combined = [...flat, ...uncategorized];
      setTree(categories);
      setAllDocs(combined);

      if (slug) {
        // Prefer full detail endpoint so content is always fresh
        try {
          const detail = await apiRequest({
            url: `${hostBase()}/api/docs/public/${encodeURIComponent(slug)}/`,
          });
          setSelected(detail?.data || null);
        } catch {
          const wanted = combined.find((d) => d.slug === slug) || null;
          setSelected(wanted);
        }
      } else {
        setSelected(null);
      }
    } catch (err) {
      setError(
        err?.response?.data?.detail || "Documentation could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

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

  const chooseSearch = (doc) => {
    navigate(`/docs/${doc.slug}`);
    setMobileOpen(false);
    setQ("");
  };

  const sidebar = (
    <Paper
      square
      elevation={0}
      sx={{
        width: { xs: "min(88vw, 340px)", md: 320 },
        height: "100%",
        maxHeight: "100vh",
        overflow: "hidden",
        borderRight: 1,
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
      }}
    >
      <Box sx={{ p: 2.25 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
        >
          <Box>
            <Typography fontWeight={950} fontSize={22} letterSpacing={-0.5}>
              Documentation
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Guides, references and how‑tos.
            </Typography>
          </Box>
          <Tooltip title="Back to home">
            <IconButton size="small" onClick={() => navigate("/")}>
              <ArrowBackRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
        <TextField
          fullWidth
          size="small"
          sx={{ mt: 2 }}
          placeholder="Search documentation"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          InputProps={{
            startAdornment: (
              <SearchRoundedIcon sx={{ mr: 1, color: "text.disabled" }} />
            ),
          }}
        />
      </Box>
      <Divider />
      <Box sx={{ flex: 1, overflow: "auto", p: 1.25 }}>
        {q ? (
          filtered.map((doc) => (
            <ListItemButton
              key={doc.id}
              selected={selected?.id === doc.id}
              onClick={() => chooseSearch(doc)}
              sx={{ borderRadius: 1.75, mb: 0.25 }}
            >
              <ListItemText
                primary={doc.title}
                secondary={doc.category_name || "General"}
              />
            </ListItemButton>
          ))
        ) : (
          <>
            <Tree nodes={tree} selectedId={selected?.id} />
            {allDocs
              .filter((doc) => !doc.category)
              .map((doc) => (
                <ListItemButton
                  key={doc.id}
                  component={RouterLink}
                  to={`/docs/${doc.slug}`}
                  selected={selected?.id === doc.id}
                  sx={{ borderRadius: 1.5, mt: 0.25 }}
                >
                  <DescriptionRoundedIcon
                    fontSize="small"
                    sx={{ mr: 1, opacity: 0.5 }}
                  />
                  <ListItemText primary={doc.title} secondary="General" />
                </ListItemButton>
              ))}
          </>
        )}
        {!loading && q && !filtered.length && (
          <Alert severity="info" sx={{ mt: 1 }}>
            No article found for “{q}”.
          </Alert>
        )}
        {!loading && !q && !allDocs.length && (
          <Alert severity="info" sx={{ mt: 1 }}>
            No published articles yet.
          </Alert>
        )}
      </Box>
    </Paper>
  );

  return (
    <Box
      className="docs-workspace"
      sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}
    >
      <Box sx={{ display: { xs: "none", md: "block" } }}>{sidebar}</Box>
      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{ sx: { p: 0 } }}
      >
        {sidebar}
      </Drawer>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            display: { xs: "flex", md: "none" },
            p: 1,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <IconButton onClick={() => setMobileOpen(true)}>
            <MenuRoundedIcon />
          </IconButton>
          <Typography fontWeight={900}>Docs</Typography>
          <IconButton onClick={() => navigate("/")}>
            <ArrowBackRoundedIcon />
          </IconButton>
        </Stack>

        <Box sx={{ maxWidth: 1040, mx: "auto", p: { xs: 2, sm: 3, md: 6 } }}>
          {loading ? (
            <Stack alignItems="center" justifyContent="center" minHeight="65vh">
              <CircularProgress />
            </Stack>
          ) : error ? (
            <Alert
              severity="error"
              action={<Button onClick={load}>Retry</Button>}
            >
              {error}
            </Alert>
          ) : !selected ? (
            <Box>
              <Typography
                component="h1"
                variant="h3"
                fontWeight={950}
                letterSpacing={-1.2}
                sx={{ mb: 1 }}
              >
                Documentation
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 4, maxWidth: 640 }}>
                Browse published guides from the sidebar, or search by title and
                description.
              </Typography>
              {!allDocs.length ? (
                <Paper
                  variant="outlined"
                  sx={{ p: 6, textAlign: "center", borderRadius: 4 }}
                >
                  <HomeRoundedIcon sx={{ fontSize: 48, opacity: 0.4, mb: 1 }} />
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
            <>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={2}
                mb={3}
              >
                <Breadcrumbs aria-label="breadcrumb">
                  <Button
                    size="small"
                    component={RouterLink}
                    to="/docs"
                    startIcon={<HomeRoundedIcon />}
                    sx={{ textTransform: "none" }}
                  >
                    Docs
                  </Button>
                  {selected.category_name && (
                    <Typography color="text.secondary">
                      {selected.category_name}
                    </Typography>
                  )}
                </Breadcrumbs>
                <Button
                  size="small"
                  component={RouterLink}
                  to="/"
                  startIcon={<ArrowBackRoundedIcon />}
                  sx={{ textTransform: "none" }}
                >
                  Home
                </Button>
              </Stack>
              <Chip
                label={selected.category_name || "General"}
                size="small"
                sx={{ mb: 2, fontWeight: 800 }}
              />
              <Typography
                component="h1"
                variant="h1"
                sx={{
                  fontSize: { xs: "2rem", md: "3.25rem" },
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
                    mb: 4,
                  }}
                >
                  {selected.description}
                </Typography>
              )}
              <Divider sx={{ mb: 4 }} />
              <Box component="article" sx={{ minWidth: 0 }}>
                <MarkdownPreview
                  className="docs-markdown-preview docs-article"
                  html={renderMarkdown(selected.content || "", {
                    resolveUrl: resolvePublicUrl,
                  })}
                />
              </Box>
              <Divider sx={{ my: 6 }} />
              <Stack direction="row" justifyContent="space-between">
                <Button
                  component={RouterLink}
                  to="/docs"
                  startIcon={<HomeRoundedIcon />}
                >
                  All documentation
                </Button>
                <Button
                  component={RouterLink}
                  to="/"
                  endIcon={<ArrowBackRoundedIcon />}
                >
                  Back to home
                </Button>
              </Stack>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
