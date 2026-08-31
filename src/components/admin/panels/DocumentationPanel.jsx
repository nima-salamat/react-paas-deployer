import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, Divider, FormControl, IconButton,
  InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveIcon from "@mui/icons-material/Save";
import PublishIcon from "@mui/icons-material/Publish";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import apiRequest from "../../customHooks/apiRequest";
import { hostBase } from "../adminUtils";

const emptyDoc = () => ({ title: "", slug: "", description: "", section: "Getting started", icon: "description", order: 0, status: "draft", content: [] });
const TYPES = ["heading", "paragraph", "list", "code", "image", "callout", "quote", "link", "divider"];
const API = () => `${hostBase()}/api/docs/admin/documents`;

function makeBlock(type) {
  switch (type) {
    case "heading": return { type, level: 2, text: "New section" };
    case "paragraph": return { type, text: "Write documentation here…" };
    case "list": return { type, ordered: false, items: ["First item"] };
    case "code": return { type, language: "bash", filename: "", code: "echo \"hello\"" };
    case "image": return { type, asset_id: "", alt: "", caption: "" };
    case "callout": return { type, tone: "info", title: "Note", text: "Important information" };
    case "quote": return { type, text: "Useful quote", author: "" };
    case "link": return { type, label: "Read more", url: "https://", description: "" };
    default: return { type: "divider" };
  }
}

export default function DocumentationPanel() {
  const [docs, setDocs] = useState([]); const [doc, setDoc] = useState(null); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [newType, setNewType] = useState("paragraph");
  const load = async () => { setLoading(true); setError(""); try { const r = await apiRequest({ method: "GET", url: `${API()}/` }); setDocs(r.data?.results || r.data || []); } catch (e) { setError(e?.response?.data?.detail || "Unable to load documents."); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const save = async () => { if (!doc?.title?.trim()) return setError("Title is required."); setLoading(true); setError(""); try { const method = doc.id ? "PATCH" : "POST"; const url = doc.id ? `${API()}/${doc.id}/` : `${API()}/`; const r = await apiRequest({ method, url, data: doc }); const saved = r.data; setDoc(saved); await load(); } catch (e) { setError(e?.response?.data?.detail || JSON.stringify(e?.response?.data?.errors || e?.response?.data || {}) || "Save failed."); } finally { setLoading(false); } };
  const remove = async () => { if (!doc?.id || !window.confirm("Delete this documentation page?")) return; setLoading(true); try { await apiRequest({ method: "DELETE", url: `${API()}/${doc.id}/` }); setDoc(null); await load(); } catch (e) { setError(e?.response?.data?.detail || "Delete failed."); } finally { setLoading(false); } };
  const publish = async () => { if (!doc?.id) return save(); setLoading(true); try { const r = await apiRequest({ method: "POST", url: `${API()}/${doc.id}/publish/`, data: {} }); setDoc(r.data); await load(); } catch (e) { setError(e?.response?.data?.detail || "Publish failed."); } finally { setLoading(false); } };
  const upload = async (block, file) => { if (!doc?.id || !file) return setError("Save the document before uploading an image."); const form = new FormData(); form.append("image", file); form.append("alt", block.alt || ""); try { const r = await apiRequest({ method: "POST", url: `${API()}/${doc.id}/assets/`, data: form }); setDoc(d => ({ ...d, content: d.content.map(b => b === block ? { ...b, asset_id: r.data.id, alt: r.data.alt } : b) })); } catch (e) { setError(e?.response?.data?.detail || "Image upload failed."); } };
  const updateBlock = (index, patch) => setDoc(d => ({ ...d, content: d.content.map((b, i) => i === index ? { ...b, ...patch } : b) }));
  const removeBlock = (index) => setDoc(d => ({ ...d, content: d.content.filter((_, i) => i !== index) }));
  const addBlock = () => setDoc(d => ({ ...d, content: [...(d.content || []), makeBlock(newType)] }));
  const grouped = useMemo(() => docs.reduce((a, d) => { (a[d.section || "Documentation"] ||= []).push(d); return a; }, {}), [docs]);

  return <Stack spacing={2.2}>
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1.5}><Box><Typography variant="h4" fontWeight={900}>Documentation</Typography><Typography color="text.secondary">Create and publish developer documentation without touching the main website UI.</Typography></Box><Button variant="contained" startIcon={<AddIcon />} onClick={() => setDoc(emptyDoc())}>New document</Button></Stack>
    {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "290px minmax(0,1fr)" }, gap: 2 }}>
      <Card variant="outlined"><CardContent><Typography fontWeight={900} sx={{ mb: 1.2 }}>Pages</Typography>{Object.entries(grouped).map(([section, items]) => <Box key={section} sx={{ mb: 1.5 }}><Typography variant="caption" color="text.secondary" sx={{ px: .8, textTransform: "uppercase", letterSpacing: .8 }}>{section}</Typography>{items.map(x => <Button key={x.id} fullWidth color="inherit" onClick={() => setDoc(x)} sx={{ justifyContent: "flex-start", textAlign: "left", borderRadius: 1.5, py: 1 }}><Stack alignItems="flex-start"><Typography fontSize={13} fontWeight={x.id === doc?.id ? 800 : 600}>{x.title}</Typography><Typography variant="caption" color="text.secondary">{x.status}</Typography></Stack></Button>)}</Box>)}</CardContent></Card>
      <Card variant="outlined"><CardContent>
        {!doc ? <Box sx={{ py: 9, textAlign: "center" }}><Typography fontWeight={800}>Select a page or create a new one</Typography></Box> : <>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} sx={{ mb: 2 }}><TextField fullWidth label="Title" value={doc.title} onChange={e => setDoc({ ...doc, title: e.target.value })} /><TextField fullWidth label="Slug" value={doc.slug} onChange={e => setDoc({ ...doc, slug: e.target.value })} /></Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} sx={{ mb: 2 }}><TextField fullWidth label="Description" value={doc.description} onChange={e => setDoc({ ...doc, description: e.target.value })} /><TextField label="Section" value={doc.section} onChange={e => setDoc({ ...doc, section: e.target.value })} sx={{ minWidth: { md: 210 } }} /><TextField type="number" label="Order" value={doc.order} onChange={e => setDoc({ ...doc, order: Number(e.target.value) })} sx={{ width: 110 }} /></Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}><Chip label={doc.status} size="small" /><Button startIcon={<SaveIcon />} onClick={save} disabled={loading}>Save</Button><Button variant="contained" color="success" startIcon={<PublishIcon />} onClick={publish} disabled={loading}>Publish</Button>{doc.id && <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={remove} disabled={loading}>Delete</Button>} {doc.id && <Button href={`/docs/${doc.slug}`} target="_blank" rel="noreferrer">Preview</Button>}</Stack>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={1.2}>{(doc.content || []).map((block, index) => <Card key={index} variant="outlined" sx={{ borderRadius: 2.5 }}><CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.2 }}><DragIndicatorIcon color="disabled" /><Chip label={block.type} size="small" /><Box sx={{ flex: 1 }} /><IconButton size="small" color="error" onClick={() => removeBlock(index)}><DeleteOutlineIcon fontSize="small" /></IconButton></Stack>
            {block.type === "heading" && <Stack direction="row" spacing={1}><FormControl size="small" sx={{ minWidth: 90 }}><InputLabel>Level</InputLabel><Select label="Level" value={block.level || 2} onChange={e => updateBlock(index, { level: Number(e.target.value) })}><MenuItem value={1}>H1</MenuItem><MenuItem value={2}>H2</MenuItem><MenuItem value={3}>H3</MenuItem></Select></FormControl><TextField fullWidth label="Heading" value={block.text || ""} onChange={e => updateBlock(index, { text: e.target.value })} /></Stack>}
            {block.type === "paragraph" && <TextField multiline minRows={4} fullWidth label="Text" value={block.text || ""} onChange={e => updateBlock(index, { text: e.target.value })} />}
            {block.type === "list" && <Stack spacing={1}><FormControl size="small" sx={{ width: 150 }}><InputLabel>List type</InputLabel><Select label="List type" value={block.ordered ? "ordered" : "bullet"} onChange={e => updateBlock(index, { ordered: e.target.value === "ordered" })}><MenuItem value="bullet">Bullets</MenuItem><MenuItem value="ordered">Numbered</MenuItem></Select></FormControl>{(block.items || []).map((x, i) => <Stack direction="row" key={i} spacing={1}><TextField fullWidth size="small" value={x} onChange={e => updateBlock(index, { items: block.items.map((it, j) => j === i ? e.target.value : it) })} /><IconButton size="small" onClick={() => updateBlock(index, { items: block.items.filter((_, j) => j !== i) })}><DeleteOutlineIcon fontSize="small" /></IconButton></Stack>)}<Button size="small" onClick={() => updateBlock(index, { items: [...(block.items || []), "New item"] })}>Add item</Button></Stack>}
            {block.type === "code" && <Stack spacing={1}><Stack direction={{ xs: "column", md: "row" }} spacing={1}><TextField label="Language" value={block.language || "text"} onChange={e => updateBlock(index, { language: e.target.value })} /><TextField fullWidth label="Filename" value={block.filename || ""} onChange={e => updateBlock(index, { filename: e.target.value })} /></Stack><TextField multiline minRows={9} fullWidth label="Code" value={block.code || ""} onChange={e => updateBlock(index, { code: e.target.value })} inputProps={{ style: { fontFamily: "ui-monospace, monospace" } }} /></Stack>}
            {block.type === "image" && <Stack spacing={1}><Stack direction="row" spacing={1} alignItems="center"><Button component="label" startIcon={<UploadFileIcon />}>Upload image<input hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => upload(block, e.target.files?.[0])} /></Button><Typography variant="caption" color="text.secondary">{block.asset_id ? `Asset ${block.asset_id.slice(0, 8)}…` : "No image uploaded"}</Typography></Stack><TextField fullWidth label="Alt text" value={block.alt || ""} onChange={e => updateBlock(index, { alt: e.target.value })} /><TextField fullWidth label="Caption" value={block.caption || ""} onChange={e => updateBlock(index, { caption: e.target.value })} /></Stack>}
            {block.type === "callout" && <Stack spacing={1}><Stack direction={{ xs: "column", md: "row" }} spacing={1}><FormControl size="small" sx={{ minWidth: 140 }}><InputLabel>Tone</InputLabel><Select label="Tone" value={block.tone || "info"} onChange={e => updateBlock(index, { tone: e.target.value })}>{["info","success","warning","danger"].map(x => <MenuItem key={x} value={x}>{x}</MenuItem>)}</Select></FormControl><TextField fullWidth label="Title" value={block.title || ""} onChange={e => updateBlock(index, { title: e.target.value })} /></Stack><TextField multiline minRows={3} fullWidth label="Text" value={block.text || ""} onChange={e => updateBlock(index, { text: e.target.value })} /></Stack>}
            {block.type === "quote" && <Stack spacing={1}><TextField multiline minRows={3} fullWidth label="Quote" value={block.text || ""} onChange={e => updateBlock(index, { text: e.target.value })} /><TextField label="Author" value={block.author || ""} onChange={e => updateBlock(index, { author: e.target.value })} /></Stack>}
            {block.type === "link" && <Stack spacing={1}><TextField label="Label" value={block.label || ""} onChange={e => updateBlock(index, { label: e.target.value })} /><TextField fullWidth label="URL" value={block.url || ""} onChange={e => updateBlock(index, { url: e.target.value })} /><TextField fullWidth label="Description" value={block.description || ""} onChange={e => updateBlock(index, { description: e.target.value })} /></Stack>}
            {block.type === "divider" && <Typography color="text.secondary">Visual divider</Typography>}
          </CardContent></Card>)}</Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}><Select size="small" value={newType} onChange={e => setNewType(e.target.value)}>{TYPES.map(x => <MenuItem key={x} value={x}>{x}</MenuItem>)}</Select><Button startIcon={<AddIcon />} onClick={addBlock}>Add block</Button></Stack>
        </>}
      </CardContent></Card>
    </Box>
  </Stack>;
}
