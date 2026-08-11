import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack,
  Typography, Slider, IconButton, ToggleButton, ToggleButtonGroup, CircularProgress,
  Tooltip, Divider, alpha,
} from "@mui/material";
import CropIcon from "@mui/icons-material/Crop";
import CloseIcon from "@mui/icons-material/Close";
import RotateLeftIcon from "@mui/icons-material/RotateLeft";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import SendIcon from "@mui/icons-material/Send";
import BrushIcon from "@mui/icons-material/Brush";
import HighlightIcon from "@mui/icons-material/Highlight";
import EditIcon from "@mui/icons-material/Edit";
import EraserIcon from "@mui/icons-material/AutoFixOff";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import ClearIcon from "@mui/icons-material/Clear";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import TuneIcon from "@mui/icons-material/Tune";

/**
 * Professional image editor dialog — replaces the old simple crop dialog.
 *
 * Features:
 *  - Crop mode: draggable + resizable rectangle with 8 handles, aspect ratio
 *    lock (1:1 for avatars, or 1:1 / 4:3 / 16:9 / Free for images), circular
 *    mask overlay when `circular=true`.
 *  - Draw mode: freehand drawing with 4 pen types (Solid, Highlighter, Marker,
 *    Eraser), 8 preset colors + custom color picker, thickness slider 1-30px,
 *    undo/redo, clear-all.
 *  - Common: rotate left/right 90°, zoom slider 0.5×-3×, reset.
 *  - Output: composites image + drawings, applies crop, scales to outputSize,
 *    optional circular clip, exports as JPEG blob.
 *
 * Props (backward-compatible with the old ImageCropDialog):
 *  - open, file, onClose, onConfirm(blob, filename)
 *  - circular: boolean (default true) — circular crop + output
 *  - outputSize: number (default 512) — max output dimension in px
 *  - title: string (default "Edit image")
 */
const EDITOR_W = 420;       // canvas display width
const EDITOR_H = 420;       // canvas display height
const PEN_COLORS = ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa", "#000000", "#ffffff"];

export default function ImageCropDialog({
  open, file, onClose, onConfirm,
  circular = false,
  outputSize = 512,
  title = "Edit image",
}) {
  const imgCanvasRef = useRef(null);      // renders image (zoom + rotation)
  const drawCanvasRef = useRef(null);     // captures drawings
  const containerRef = useRef(null);
  const imgRef = useRef(null);            // HTMLImageElement
  const [imgSrc, setImgSrc] = useState(null);
  const [mode, setMode] = useState("crop");        // "crop" | "draw" | "adjust"
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);     // degrees
  const [aspect, setAspect] = useState(circular ? 1 : null); // null = free
  const [sending, setSending] = useState(false);
  // Image adjustment filters (CSS-style). Applied at export time too.
  const [brightness, setBrightness] = useState(100);  // % (100 = no change)
  const [contrast, setContrast] = useState(100);      // %
  const [saturate, setSaturate] = useState(100);      // %
  const [blur, setBlur] = useState(0);                // px
  const [grayscale, setGrayscale] = useState(0);      // %
  const [sepia, setSepia] = useState(0);              // %
  // Crop rect in display coords: {x, y, w, h}
  const [crop, setCrop] = useState({ x: 60, y: 60, w: 300, h: 300 });
  const cropDragRef = useRef(null);  // {mode, startX, startY, origCrop}
  // Drawing state
  const [tool, setTool] = useState("solid");       // solid | highlighter | marker | eraser
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [thickness, setThickness] = useState(6);
  const [strokes, setStrokes] = useState([]);      // history of strokes
  const [redoStack, setRedoStack] = useState([]);
  const drawingRef = useRef(null);                 // active stroke being drawn

  // Load file → object URL → image element
  useEffect(() => {
    if (!file) { setImgSrc(null); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImgSrc(url);
      // Initialize crop to a centered square fitting the shorter dimension
      const shortSide = Math.min(EDITOR_W, EDITOR_H);
      const cw = circular ? shortSide * 0.7 : shortSide * 0.8;
      const ch = circular ? shortSide * 0.7 : shortSide * 0.8;
      setCrop({
        x: (EDITOR_W - cw) / 2,
        y: (EDITOR_H - ch) / 2,
        w: cw,
        h: ch,
      });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, circular]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setMode(circular ? "crop" : "crop");
      setZoom(1);
      setRotation(0);
      setAspect(circular ? 1 : null);
      setStrokes([]);
      setRedoStack([]);
      setTool("solid");
      setColor(PEN_COLORS[0]);
      setThickness(6);
      setBrightness(100);
      setContrast(100);
      setSaturate(100);
      setBlur(0);
      setGrayscale(0);
      setSepia(0);
    }
  }, [open, circular]);

  // Build the CSS filter string from the current filter state.
  // Applied both to the live preview canvas (via ctx.filter) and at export time.
  const filterString = useCallback(() => {
    const parts = [];
    if (brightness !== 100) parts.push(`brightness(${brightness}%)`);
    if (contrast !== 100) parts.push(`contrast(${contrast}%)`);
    if (saturate !== 100) parts.push(`saturate(${saturate}%)`);
    if (blur > 0) parts.push(`blur(${blur}px)`);
    if (grayscale > 0) parts.push(`grayscale(${grayscale}%)`);
    if (sepia > 0) parts.push(`sepia(${sepia}%)`);
    return parts.length ? parts.join(" ") : "none";
  }, [brightness, contrast, saturate, blur, grayscale, sepia]);

  // Render the image canvas (zoom + rotation + filters)
  const renderImage = useCallback(() => {
    const c = imgCanvasRef.current;
    if (!c || !imgRef.current) return;
    const ctx = c.getContext("2d");
    ctx.save();
    ctx.clearRect(0, 0, EDITOR_W, EDITOR_H);
    // Fill dark background
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, EDITOR_W, EDITOR_H);
    // Apply CSS-style filter for live preview (brightness/contrast/saturate/blur/grayscale/sepia)
    ctx.filter = filterString();
    // Translate to center, rotate, scale, draw image centered
    ctx.translate(EDITOR_W / 2, EDITOR_H / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);
    const img = imgRef.current;
    // Fit image into EDITOR_W×EDITOR_H at zoom=1 (contain)
    const scale = Math.min(EDITOR_W / img.width, EDITOR_H / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.filter = "none";
    ctx.restore();
  }, [zoom, rotation, filterString]);

  // Render drawings on top
  const renderDrawings = useCallback(() => {
    const c = drawCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, EDITOR_W, EDITOR_H);
    const drawStroke = (s) => {
      if (!s.points || s.points.length < 1) return;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (s.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
      } else if (s.tool === "highlighter") {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = s.color;
      } else if (s.tool === "marker") {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = s.color;
      } else {
        // solid
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = s.color;
      }
      ctx.lineWidth = s.size;
      ctx.beginPath();
      const pts = s.points;
      ctx.moveTo(pts[0].x, pts[0].y);
      if (pts.length === 1) {
        // dot
        ctx.lineTo(pts[0].x + 0.1, pts[0].y + 0.1);
      } else {
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
      }
      ctx.stroke();
      ctx.restore();
    };
    strokes.forEach(drawStroke);
    if (drawingRef.current) drawStroke(drawingRef.current);
  }, [strokes]);

  useEffect(() => { renderImage(); }, [renderImage, imgSrc]);
  useEffect(() => { renderDrawings(); }, [renderDrawings]);

  // ============= Crop rectangle interactions =============
  const onCropPointerDown = (e, handle) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    cropDragRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origCrop: { ...crop },
    };
  };
  const onCropPointerMove = (e) => {
    const drag = cropDragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    let { x, y, w, h } = drag.origCrop;
    const h_id = drag.handle;
    const MIN = 40;
    if (h_id === "body") {
      x = clamp(drag.origCrop.x + dx, 0, EDITOR_W - w);
      y = clamp(drag.origCrop.y + dy, 0, EDITOR_H - h);
    } else {
      if (h_id.includes("e")) w = clamp(drag.origCrop.w + dx, MIN, EDITOR_W - drag.origCrop.x);
      if (h_id.includes("s")) h = clamp(drag.origCrop.h + dy, MIN, EDITOR_H - drag.origCrop.y);
      if (h_id.includes("w")) {
        const newX = clamp(drag.origCrop.x + dx, 0, drag.origCrop.x + drag.origCrop.w - MIN);
        w = drag.origCrop.w + (drag.origCrop.x - newX);
        x = newX;
      }
      if (h_id.includes("n")) {
        const newY = clamp(drag.origCrop.y + dy, 0, drag.origCrop.y + drag.origCrop.h - MIN);
        h = drag.origCrop.h + (drag.origCrop.y - newY);
        y = newY;
      }
      // Aspect ratio lock
      if (aspect) {
        const targetH = w / aspect;
        if (targetH >= MIN && y + targetH <= EDITOR_H) {
          h = targetH;
        } else {
          const targetW = h * aspect;
          if (targetW >= MIN && x + targetW <= EDITOR_W) w = targetW;
        }
      }
    }
    setCrop({ x, y, w, h });
  };
  const onCropPointerUp = (e) => {
    if (cropDragRef.current) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* */ }
    }
    cropDragRef.current = null;
  };

  // ============= Drawing interactions =============
  const getDrawPos = (e) => {
    const c = drawCanvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * EDITOR_W,
      y: ((e.clientY - rect.top) / rect.height) * EDITOR_H,
    };
  };
  const onDrawPointerDown = (e) => {
    if (mode !== "draw") return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = getDrawPos(e);
    drawingRef.current = {
      tool, color, size: thickness,
      points: [pos],
    };
    renderDrawings();
  };
  const onDrawPointerMove = (e) => {
    if (mode !== "draw" || !drawingRef.current) return;
    const pos = getDrawPos(e);
    drawingRef.current.points.push(pos);
    renderDrawings();
  };
  const onDrawPointerUp = (e) => {
    if (mode !== "draw" || !drawingRef.current) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* */ }
    setStrokes((prev) => [...prev, drawingRef.current]);
    drawingRef.current = null;
    setRedoStack([]);
  };

  // ============= Toolbar actions =============
  const undo = () => {
    if (!strokes.length) return;
    setStrokes((prev) => {
      const last = prev[prev.length - 1];
      setRedoStack((r) => [...r, last]);
      return prev.slice(0, -1);
    });
  };
  const redo = () => {
    if (!redoStack.length) return;
    setRedoStack((prev) => {
      const last = prev[prev.length - 1];
      setStrokes((s) => [...s, last]);
      return prev.slice(0, -1);
    });
  };
  const clearDrawings = () => {
    setStrokes([]);
    setRedoStack([]);
  };
  const reset = () => {
    setZoom(1);
    setRotation(0);
    setStrokes([]);
    setRedoStack([]);
    const shortSide = Math.min(EDITOR_W, EDITOR_H);
    const cw = circular ? shortSide * 0.7 : shortSide * 0.8;
    const ch = circular ? shortSide * 0.7 : shortSide * 0.8;
    setCrop({ x: (EDITOR_W - cw) / 2, y: (EDITOR_H - ch) / 2, w: cw, h: ch });
  };

  // ============= Export =============
  const onConfirmClick = async () => {
    if (!imgRef.current || !imgCanvasRef.current || !drawCanvasRef.current) return;
    setSending(true);
    try {
      const off = document.createElement("canvas");
      off.width = EDITOR_W;
      off.height = EDITOR_H;
      const octx = off.getContext("2d");
      octx.drawImage(imgCanvasRef.current, 0, 0);
      octx.drawImage(drawCanvasRef.current, 0, 0);

      const cx = crop.x;
      const cy = crop.y;
      const cw = crop.w;
      const ch = crop.h;
      const outScale = Math.min(outputSize / cw, outputSize / ch, 1);
      const outW = Math.max(1, Math.round(cw * outScale));
      const outH = Math.max(1, Math.round(ch * outScale));
      const out = document.createElement("canvas");
      out.width = outW;
      out.height = outH;
      const octx2 = out.getContext("2d");
      if (circular) {
        octx2.save();
        octx2.beginPath();
        octx2.arc(outW / 2, outH / 2, Math.min(outW, outH) / 2, 0, Math.PI * 2);
        octx2.closePath();
        octx2.clip();
      }
      octx2.drawImage(off, cx, cy, cw, ch, 0, 0, outW, outH);
      if (circular) octx2.restore();

      const blob = await new Promise((resolve) => {
        out.toBlob((b) => resolve(b), "image/jpeg", 0.92);
      });
      if (!blob) return;
      const baseName = (file?.name || "image").replace(/\.[^.]+$/, "");
      onConfirm(blob, `${baseName}_edit.jpg`);
    } finally {
      setSending(false);
    }
  };
  const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  const handleStyle = (h) => {
    const map = {
      nw: { left: 0, top: 0, cursor: "nwse-resize" },
      n: { left: "50%", top: 0, cursor: "ns-resize", transform: "translateX(-50%)" },
      ne: { right: 0, top: 0, cursor: "nesw-resize" },
      e: { right: 0, top: "50%", cursor: "ew-resize", transform: "translateY(-50%)" },
      se: { right: 0, bottom: 0, cursor: "nwse-resize" },
      s: { left: "50%", bottom: 0, cursor: "ns-resize", transform: "translateX(-50%)" },
      sw: { left: 0, bottom: 0, cursor: "nesw-resize" },
      w: { left: 0, top: "50%", cursor: "ew-resize", transform: "translateY(-50%)" },
    };
    return {
      position: "absolute",
      width: 14, height: 14,
      bgcolor: "#fff",
      border: "2px solid #1976d2",
      borderRadius: "50%",
      ...map[h],
    };
  };

  return (
    <Dialog open={Boolean(open)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: "flex", alignItems: "center", py: 1.5 }}>
        <CropIcon sx={{ mr: 1 }} />
        <Typography fontWeight={700} sx={{ flex: 1 }}>{title}</Typography>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {/* Top toolbar */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider", flexWrap: "wrap", gap: 1 }}>
          <ToggleButtonGroup
            size="small" exclusive value={mode}
            onChange={(_, v) => v && setMode(v)}
          >
            <ToggleButton value="crop"><CropIcon sx={{ fontSize: 18, mr: 0.5 }} />Crop</ToggleButton>
            <ToggleButton value="draw"><BrushIcon sx={{ fontSize: 18, mr: 0.5 }} />Draw</ToggleButton>
            <ToggleButton value="adjust"><TuneIcon sx={{ fontSize: 18, mr: 0.5 }} />Adjust</ToggleButton>
          </ToggleButtonGroup>
          <Divider orientation="vertical" flexItem />
          <Tooltip title="Rotate left 90°">
            <IconButton size="small" onClick={() => setRotation((r) => (r - 90 + 360) % 360)}>
              <RotateLeftIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Rotate right 90°">
            <IconButton size="small" onClick={() => setRotation((r) => (r + 90) % 360)}>
              <RotateRightIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Box sx={{ display: "flex", alignItems: "center", minWidth: 140, flex: 1, maxWidth: 200 }}>
            <Typography variant="caption" sx={{ mr: 1 }}>Zoom</Typography>
            <Slider
              size="small" min={0.5} max={3} step={0.05}
              value={zoom} onChange={(_, v) => setZoom(v)}
            />
            <Typography variant="caption" sx={{ ml: 1, fontVariantNumeric: "tabular-nums", minWidth: 32 }}>
              {zoom.toFixed(1)}×
            </Typography>
          </Box>
          <Tooltip title="Reset all">
            <IconButton size="small" onClick={reset}><RestartAltIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Stack>

        {/* Draw toolbar (only in draw mode) */}
        {mode === "draw" && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider", flexWrap: "wrap", gap: 1 }}>
            <ToggleButtonGroup size="small" exclusive value={tool} onChange={(_, v) => v && setTool(v)}>
              <Tooltip title="Solid pen">
                <ToggleButton value="solid"><EditIcon sx={{ fontSize: 18 }} /></ToggleButton>
              </Tooltip>
              <Tooltip title="Highlighter (translucent)">
                <ToggleButton value="highlighter"><HighlightIcon sx={{ fontSize: 18 }} /></ToggleButton>
              </Tooltip>
              <Tooltip title="Marker (thick rounded)">
                <ToggleButton value="marker"><BrushIcon sx={{ fontSize: 18 }} /></ToggleButton>
              </Tooltip>
              <Tooltip title="Eraser">
                <ToggleButton value="eraser"><EraserIcon sx={{ fontSize: 18 }} /></ToggleButton>
              </Tooltip>
            </ToggleButtonGroup>
            <Divider orientation="vertical" flexItem />
            <Stack direction="row" spacing={0.5} alignItems="center">
              {PEN_COLORS.map((c) => (
                <IconButton
                  key={c}
                  size="small"
                  onClick={() => setColor(c)}
                  sx={{
                    width: 24, height: 24, p: 0,
                    bgcolor: c,
                    border: color === c ? "2px solid #1976d2" : "2px solid transparent",
                    "&:hover": { bgcolor: c, opacity: 0.85 },
                  }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", padding: 0 }}
                title="Custom color"
              />
            </Stack>
            <Divider orientation="vertical" flexItem />
            <Box sx={{ display: "flex", alignItems: "center", minWidth: 120, flex: 1, maxWidth: 180 }}>
              <Typography variant="caption" sx={{ mr: 1 }}>Size</Typography>
              <Slider
                size="small" min={1} max={30} step={1}
                value={thickness} onChange={(_, v) => setThickness(v)}
              />
              <Typography variant="caption" sx={{ ml: 1, minWidth: 24 }}>{thickness}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Tooltip title="Undo"><span><IconButton size="small" onClick={undo} disabled={!strokes.length}><UndoIcon fontSize="small" /></IconButton></span></Tooltip>
            <Tooltip title="Redo"><span><IconButton size="small" onClick={redo} disabled={!redoStack.length}><RedoIcon fontSize="small" /></IconButton></span></Tooltip>
            <Tooltip title="Clear all drawings"><span><IconButton size="small" onClick={clearDrawings} disabled={!strokes.length}><ClearIcon fontSize="small" /></IconButton></span></Tooltip>
          </Stack>
        )}

        {/* Adjust toolbar (only in adjust mode) — filters / color grading */}
        {mode === "adjust" && (
          <Stack direction="row" spacing={2} alignItems="center" sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider", flexWrap: "wrap", gap: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", minWidth: 130, flex: "1 1 130px", maxWidth: 200 }}>
              <Typography variant="caption" sx={{ mr: 1, minWidth: 70 }}>Brightness</Typography>
              <Slider
                size="small" min={0} max={200} step={1}
                value={brightness} onChange={(_, v) => setBrightness(v)}
              />
              <Typography variant="caption" sx={{ ml: 1, minWidth: 32, fontVariantNumeric: "tabular-nums" }}>{brightness}%</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", minWidth: 130, flex: "1 1 130px", maxWidth: 200 }}>
              <Typography variant="caption" sx={{ mr: 1, minWidth: 70 }}>Contrast</Typography>
              <Slider
                size="small" min={0} max={200} step={1}
                value={contrast} onChange={(_, v) => setContrast(v)}
              />
              <Typography variant="caption" sx={{ ml: 1, minWidth: 32, fontVariantNumeric: "tabular-nums" }}>{contrast}%</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", minWidth: 130, flex: "1 1 130px", maxWidth: 200 }}>
              <Typography variant="caption" sx={{ mr: 1, minWidth: 70 }}>Saturation</Typography>
              <Slider
                size="small" min={0} max={200} step={1}
                value={saturate} onChange={(_, v) => setSaturate(v)}
              />
              <Typography variant="caption" sx={{ ml: 1, minWidth: 32, fontVariantNumeric: "tabular-nums" }}>{saturate}%</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", minWidth: 130, flex: "1 1 130px", maxWidth: 200 }}>
              <Typography variant="caption" sx={{ mr: 1, minWidth: 70 }}>Blur</Typography>
              <Slider
                size="small" min={0} max={10} step={0.1}
                value={blur} onChange={(_, v) => setBlur(v)}
              />
              <Typography variant="caption" sx={{ ml: 1, minWidth: 32, fontVariantNumeric: "tabular-nums" }}>{blur.toFixed(1)}px</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", minWidth: 130, flex: "1 1 130px", maxWidth: 200 }}>
              <Typography variant="caption" sx={{ mr: 1, minWidth: 70 }}>Grayscale</Typography>
              <Slider
                size="small" min={0} max={100} step={1}
                value={grayscale} onChange={(_, v) => setGrayscale(v)}
              />
              <Typography variant="caption" sx={{ ml: 1, minWidth: 32, fontVariantNumeric: "tabular-nums" }}>{grayscale}%</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", minWidth: 130, flex: "1 1 130px", maxWidth: 200 }}>
              <Typography variant="caption" sx={{ mr: 1, minWidth: 70 }}>Sepia</Typography>
              <Slider
                size="small" min={0} max={100} step={1}
                value={sepia} onChange={(_, v) => setSepia(v)}
              />
              <Typography variant="caption" sx={{ ml: 1, minWidth: 32, fontVariantNumeric: "tabular-nums" }}>{sepia}%</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            {/* Quick presets */}
            <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="caption" sx={{ mr: 0.5 }}>Presets:</Typography>
              <ToggleButtonGroup size="small" exclusive>
                <ToggleButton
                  value="none"
                  onClick={() => { setBrightness(100); setContrast(100); setSaturate(100); setBlur(0); setGrayscale(0); setSepia(0); }}
                  sx={{ py: 0.25, fontSize: 11 }}
                >Original</ToggleButton>
                <ToggleButton
                  value="vivid"
                  onClick={() => { setBrightness(105); setContrast(115); setSaturate(140); setBlur(0); setGrayscale(0); setSepia(0); }}
                  sx={{ py: 0.25, fontSize: 11 }}
                >Vivid</ToggleButton>
                <ToggleButton
                  value="bw"
                  onClick={() => { setBrightness(105); setContrast(115); setSaturate(100); setBlur(0); setGrayscale(100); setSepia(0); }}
                  sx={{ py: 0.25, fontSize: 11 }}
                >B&W</ToggleButton>
                <ToggleButton
                  value="vintage"
                  onClick={() => { setBrightness(105); setContrast(95); setSaturate(85); setBlur(0); setGrayscale(0); setSepia(45); }}
                  sx={{ py: 0.25, fontSize: 11 }}
                >Vintage</ToggleButton>
                <ToggleButton
                  value="warm"
                  onClick={() => { setBrightness(105); setContrast(105); setSaturate(115); setBlur(0); setGrayscale(0); setSepia(20); }}
                  sx={{ py: 0.25, fontSize: 11 }}
                >Warm</ToggleButton>
                <ToggleButton
                  value="cool"
                  onClick={() => { setBrightness(95); setContrast(110); setSaturate(90); setBlur(0); setGrayscale(0); setSepia(0); }}
                  sx={{ py: 0.25, fontSize: 11 }}
                >Cool</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Stack>
        )}

        {/* Crop aspect ratio (only in crop mode) */}
        {mode === "crop" && !circular && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography variant="caption" sx={{ mr: 1 }}>Aspect</Typography>
            <ToggleButtonGroup
              size="small" exclusive
              value={aspect === null ? "free" : String(aspect)}
              onChange={(_, v) => {
                if (!v) return;
                if (v === "free") setAspect(null);
                else setAspect(parseFloat(v));
              }}
            >
              <ToggleButton value="free">Free</ToggleButton>
              <ToggleButton value="1">1:1</ToggleButton>
              <ToggleButton value="1.3333333333333333">4:3</ToggleButton>
              <ToggleButton value="1.7777777777777777">16:9</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        )}

        {/* Editor canvas area */}
        <Box
          ref={containerRef}
          sx={{
            position: "relative",
            width: EDITOR_W,
            height: EDITOR_H,
            mx: "auto",
            my: 2,
            bgcolor: "#1a1a1a",
            borderRadius: 1,
            overflow: "hidden",
            boxShadow: 2,
            cursor: mode === "draw" ? "crosshair" : "default",
            userSelect: "none",
            touchAction: "none",
          }}
          onPointerMove={(e) => {
            onCropPointerMove(e);
            onDrawPointerMove(e);
          }}
          onPointerUp={(e) => {
            onCropPointerUp(e);
            onDrawPointerUp(e);
          }}
        >
          {/* Image canvas (bottom) */}
          <canvas
            ref={imgCanvasRef}
            width={EDITOR_W}
            height={EDITOR_H}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          />
          {/* Drawing canvas (top, transparent) — captures pointer events in draw mode */}
          <canvas
            ref={drawCanvasRef}
            width={EDITOR_W}
            height={EDITOR_H}
            onPointerDown={onDrawPointerDown}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: mode === "draw" ? "auto" : "none",
            }}
          />
          {/* Crop overlay (only in crop mode) */}
          {mode === "crop" && (
            <>
              {/* Dark mask outside the crop rect (4 divs) */}
              <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                <Box sx={{ position: "absolute", left: 0, top: 0, right: 0, height: crop.y, bgcolor: "rgba(0,0,0,0.55)" }} />
                <Box sx={{ position: "absolute", left: 0, top: crop.y + crop.h, right: 0, bottom: 0, bgcolor: "rgba(0,0,0,0.55)" }} />
                <Box sx={{ position: "absolute", left: 0, top: crop.y, width: crop.x, height: crop.h, bgcolor: "rgba(0,0,0,0.55)" }} />
                <Box sx={{ position: "absolute", left: crop.x + crop.w, top: crop.y, right: 0, height: crop.h, bgcolor: "rgba(0,0,0,0.55)" }} />
              </Box>
              {/* Crop rectangle (draggable body) */}
              <Box
                onPointerDown={(e) => onCropPointerDown(e, "body")}
                sx={{
                  position: "absolute",
                  left: crop.x,
                  top: crop.y,
                  width: crop.w,
                  height: crop.h,
                  border: "2px solid #fff",
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
                  cursor: "move",
                  boxSizing: "border-box",
                }}
              >
                {/* Rule-of-thirds lines */}
                <Box sx={{ position: "absolute", left: "33.33%", top: 0, bottom: 0, width: 0, borderLeft: "1px solid rgba(255,255,255,0.4)" }} />
                <Box sx={{ position: "absolute", left: "66.66%", top: 0, bottom: 0, width: 0, borderLeft: "1px solid rgba(255,255,255,0.4)" }} />
                <Box sx={{ position: "absolute", top: "33.33%", left: 0, right: 0, height: 0, borderTop: "1px solid rgba(255,255,255,0.4)" }} />
                <Box sx={{ position: "absolute", top: "66.66%", left: 0, right: 0, height: 0, borderTop: "1px solid rgba(255,255,255,0.4)" }} />
                {/* Circular mask overlay (when circular=true) */}
                {circular && (
                  <Box sx={{
                    position: "absolute", inset: 0,
                    borderRadius: "50%",
                    border: "2px dashed rgba(255,255,255,0.7)",
                    pointerEvents: "none",
                  }} />
                )}
                {/* Resize handles */}
                {handles.map((h) => (
                  <Box
                    key={h}
                    onPointerDown={(e) => onCropPointerDown(e, h)}
                    sx={handleStyle(h)}
                  />
                ))}
              </Box>
            </>
          )}
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", pb: 1, px: 2 }}>
          {mode === "crop"
            ? "Drag the rectangle to move. Use the corner/edge handles to resize."
            : "Draw freely on the image. Use the toolbar to change pen, color, and size."}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained" color="primary"
          startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
          onClick={onConfirmClick}
          disabled={sending || !imgRef.current}
        >
          Send
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
