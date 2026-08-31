import React, { useEffect, useMemo, useState } from "react";
import { AppBar, Box, Button, Chip, CircularProgress, Drawer, IconButton, ListItemButton, TextField, Toolbar, Typography, Stack, Divider, alpha, useMediaQuery, useTheme } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import CodeIcon from "@mui/icons-material/Code";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import LaunchIcon from "@mui/icons-material/Launch";
import { useNavigate, useParams } from "react-router-dom";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import python from "highlight.js/lib/languages/python";
import php from "highlight.js/lib/languages/php";
import css from "highlight.js/lib/languages/css";

hljs.registerLanguage("javascript", javascript); hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript); hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("json", json); hljs.registerLanguage("bash", bash); hljs.registerLanguage("shell", bash);
hljs.registerLanguage("python", python); hljs.registerLanguage("php", php); hljs.registerLanguage("css", css);

const API = () => `https://${import.meta.env.VITE_API_BASE}`.replace(/\/+$/, "");
const headers = () => { const token = localStorage.getItem("access"); return token ? { Authorization: `Bearer ${token}` } : {}; };
async function getJSON(path) { const r = await fetch(`${API()}${path}`, { headers: headers() }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }

function CodeBlock({ block }) {
  const language = String(block.language || "text").toLowerCase();
  let html = null;
  try { if (language !== "text" && hljs.getLanguage(language)) html = hljs.highlight(block.code || "", { language }).value; } catch { /* plain text */ }
  return <Box sx={{ mb: 3, overflow: "hidden", borderRadius: 3, border: 1, borderColor: "rgba(148,163,184,.18)", bgcolor: "#0b1220", boxShadow: "0 18px 50px rgba(2,8,23,.16)" }}>
    {block.filename && <Box sx={{ px: 2, py: 1, color: "rgba(255,255,255,.62)", borderBottom: 1, borderColor: "rgba(255,255,255,.08)", fontSize: 12, fontFamily: "ui-monospace, monospace" }}>{block.filename}</Box>}
    <Box component="pre" sx={{ m: 0, p: { xs: 1.75, md: 2.5 }, overflow: "auto", color: "#e2e8f0", fontSize: 13, lineHeight: 1.75, fontFamily: "ui-monospace, monospace" }}><code dangerouslySetInnerHTML={html ? { __html: html } : undefined}>{html ? undefined : (block.code || "")}</code></Box>
  </Box>;
}

function Block({ block }) {
  if (!block) return null;
  switch (block.type) {
    case "heading": { const Tag = `h${block.level || 2}`; return <Typography component={Tag} variant={block.level === 1 ? "h3" : block.level === 2 ? "h4" : "h5"} sx={{ mt: block.level === 1 ? 1 : 4, mb: 1.5, fontWeight: 800, letterSpacing: -0.4 }}>{block.text}</Typography>; }
    case "paragraph": return <Typography sx={{ mb: 2.1, color: "text.secondary", fontSize: 16, lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{block.text}</Typography>;
    case "list": { const Tag = block.ordered ? "ol" : "ul"; return <Box component={Tag} sx={{ pl: 3.5, mb: 3 }}>{(block.items || []).map((x, i) => <Box component="li" key={i} sx={{ mb: .9, color: "text.secondary", lineHeight: 1.8 }}>{x}</Box>)}</Box>; }
    case "code": return <CodeBlock block={block} />;
    case "image": return <Box sx={{ mb: 3 }}><Box component="img" src={`${API()}/api/docs/assets/${block.asset_id}/`} alt={block.alt || ""} sx={{ display: "block", width: "100%", maxHeight: 620, objectFit: "contain", borderRadius: 3, border: 1, borderColor: "divider", bgcolor: "background.paper" }} />{block.caption && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>{block.caption}</Typography>}</Box>;
    case "callout": { const cfg = { info: [InfoOutlinedIcon, "primary"], success: [CheckCircleOutlineIcon, "success"], warning: [WarningAmberOutlinedIcon, "warning"], danger: [ErrorOutlineIcon, "error"] }[block.tone || "info"] || [InfoOutlinedIcon, "primary"]; const Icon = cfg[0]; return <Box sx={{ mb: 3, p: 2.1, display: "flex", gap: 1.5, borderRadius: 3, bgcolor: t => alpha(t.palette[cfg[1]].main, .08), border: 1, borderColor: t => alpha(t.palette[cfg[1]].main, .18) }}><Icon sx={{ mt: .2, color: `${cfg[1]}.main` }} /><Box><Typography fontWeight={800}>{block.title || "Note"}</Typography><Typography sx={{ mt: .4, color: "text.secondary", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{block.text}</Typography></Box></Box>; }
    case "quote": return <Box sx={{ mb: 3, pl: 2.2, borderLeft: 4, borderColor: "primary.main" }}><Typography sx={{ color: "text.secondary", fontStyle: "italic", lineHeight: 1.9 }}>{block.text}</Typography>{block.author && <Typography variant="caption" color="text.secondary">— {block.author}</Typography>}</Box>;
    case "link": return <Box sx={{ mb: 2.5 }}><Button href={block.url} target={block.url?.startsWith("http") ? "_blank" : undefined} rel="noreferrer" endIcon={<LaunchIcon fontSize="small" />} sx={{ px: 0, fontWeight: 800 }}>{block.label || block.url}</Button>{block.description && <Typography color="text.secondary" variant="body2">{block.description}</Typography>}</Box>;
    case "divider": return <Divider sx={{ my: 4 }} />;
    default: return null;
  }
}

export default function DocumentationWorkspace() {
  const { slug } = useParams(); const navigate = useNavigate(); const theme = useTheme(); const mobile = useMediaQuery(theme.breakpoints.down("md"));
  const [docs, setDocs] = useState([]); const [doc, setDoc] = useState(null); const [query, setQuery] = useState(""); const [mobileOpen, setMobileOpen] = useState(false); const [loading, setLoading] = useState(true);
  useEffect(() => { let live = true; setLoading(true); getJSON(`/api/docs/`).then(rows => live && setDocs(Array.isArray(rows) ? rows : [])).catch(() => {}).finally(() => live && setLoading(false)); return () => { live = false; }; }, []);
  useEffect(() => { if (!slug && docs[0]?.slug) navigate(`/docs/${docs[0].slug}`, { replace: true }); }, [slug, docs, navigate]);
  useEffect(() => { if (!slug) return undefined; let live = true; getJSON(`/api/docs/public/${encodeURIComponent(slug)}/`).then(row => live && setDoc(row)).catch(() => live && setDoc(null)); return () => { live = false; }; }, [slug]);
  const groups = useMemo(() => { const q = query.trim().toLowerCase(); const filtered = q ? docs.filter(d => `${d.title} ${d.description} ${d.section}`.toLowerCase().includes(q)) : docs; return filtered.reduce((a, x) => { (a[x.section || "Documentation"] ||= []).push(x); return a; }, {}); }, [docs, query]);
  const sidebar = <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.paper" }}><Box sx={{ p: 2 }}><Stack direction="row" alignItems="center" spacing={1.2}><Box sx={{ width: 38, height: 38, borderRadius: 2.2, display: "grid", placeItems: "center", bgcolor: "primary.main", color: "primary.contrastText" }}><DescriptionOutlinedIcon /></Box><Box><Typography fontWeight={900}>Documentation</Typography><Typography variant="caption" color="text.secondary">Developer knowledge base</Typography></Box></Stack><TextField fullWidth size="small" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search docs…" sx={{ mt: 2 }} InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: "text.secondary" }} fontSize="small" /> }} /></Box><Divider /><Box sx={{ px: 1.1, py: 1.2, overflow: "auto", flex: 1 }}>{Object.entries(groups).map(([section, items]) => <Box key={section} sx={{ mb: 2 }}><Typography sx={{ px: 1.2, mb: .5, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: 900, color: "text.secondary" }}>{section}</Typography>{items.map(item => <ListItemButton key={item.id} selected={item.slug === slug} onClick={() => { navigate(`/docs/${item.slug}`); setMobileOpen(false); }} sx={{ borderRadius: 1.8, mb: .25 }}><Typography sx={{ fontSize: 13.5, fontWeight: item.slug === slug ? 800 : 600 }}>{item.title}</Typography></ListItemButton>)}</Box>)}</Box></Box>;
  return <Box sx={{ minHeight: "100vh", bgcolor: "background.default", color: "text.primary" }}><AppBar position="sticky" elevation={0} color="inherit" sx={{ bgcolor: alpha(theme.palette.background.paper, .92), backdropFilter: "blur(16px)", borderBottom: 1, borderColor: "divider" }}><Toolbar sx={{ minHeight: "68px !important", px: { xs: 1.5, md: 2.5 } }}>{mobile && <IconButton onClick={() => setMobileOpen(true)} edge="start" sx={{ mr: 1 }}><MenuIcon /></IconButton>}<Stack direction="row" alignItems="center" spacing={1.2} sx={{ flex: 1 }}><CodeIcon color="primary" /><Typography fontWeight={850}>PaaS Docs</Typography></Stack><Button onClick={() => navigate("/")} color="inherit" sx={{ display: { xs: "none", sm: "inline-flex" } }}>Back to app</Button></Toolbar></AppBar>{mobile ? <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} PaperProps={{ sx: { width: 310 } }}>{sidebar}</Drawer> : <Drawer variant="permanent" PaperProps={{ sx: { width: 292, boxSizing: "border-box", top: 68, height: "calc(100vh - 68px)", borderRight: 1, borderColor: "divider" } }}>{sidebar}</Drawer>}<Box sx={{ ml: { md: "292px" }, px: { xs: 2, sm: 4, lg: 7 }, py: { xs: 3, md: 6 } }}><Box sx={{ maxWidth: 920, mx: "auto" }}>{loading && !doc ? <Stack alignItems="center" py={10}><CircularProgress /></Stack> : doc ? <><Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}><Chip size="small" label={doc.section || "Documentation"} /><Typography variant="caption" color="text.secondary">Updated {new Date(doc.updated_at).toLocaleDateString()}</Typography></Stack><Typography variant="h2" sx={{ fontWeight: 900, letterSpacing: -1.4, fontSize: { xs: 34, md: 52 }, lineHeight: 1.05 }}>{doc.title}</Typography>{doc.description && <Typography sx={{ mt: 2, mb: 4, maxWidth: 740, fontSize: 18, color: "text.secondary", lineHeight: 1.7 }}>{doc.description}</Typography>}<Box>{(doc.content || []).map((block, i) => <Block key={`${block.type}-${i}`} block={block} />)}</Box></> : <Box sx={{ py: 10, textAlign: "center" }}><Typography variant="h5" fontWeight={800}>Documentation page not found</Typography><Button onClick={() => navigate("/docs")} sx={{ mt: 2 }}>Browse documentation</Button></Box>}</Box></Box></Box>;
}
