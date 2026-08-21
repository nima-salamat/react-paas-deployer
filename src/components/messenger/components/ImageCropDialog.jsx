import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack,
  Typography, Slider, IconButton, ToggleButton, ToggleButtonGroup, CircularProgress,
  useMediaQuery,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import RotateLeftIcon from "@mui/icons-material/RotateLeft";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import CropIcon from "@mui/icons-material/Crop";
import BrushIcon from "@mui/icons-material/Brush";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import AutoFixOffIcon from "@mui/icons-material/AutoFixOff";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

/**
 * Image editor — free crop with edge handles, draw tools.
 * Done saves settings (edits); real crop is applied on send unless circular.
 */

const ASPECTS = [
  { id: "free", label: "Free", value: null },
  { id: "1:1", label: "1:1", value: 1 },
  { id: "4:3", label: "4:3", value: 4 / 3 },
  { id: "16:9", label: "16:9", value: 16 / 9 },
  { id: "3:4", label: "3:4", value: 3 / 4 },
  { id: "9:16", label: "9:16", value: 9 / 16 },
];

const PEN_COLORS = ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa", "#ffffff", "#000000"];
const MIN_CROP = 36;
const HIT = 22; // invisible hit size for edges/corners

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.crossOrigin = "anonymous";
    img.src = url;
  });
}

function fitContain(nw, nh, sw, sh) {
  const scale = Math.min(sw / nw, sh / nh);
  const dw = nw * scale;
  const dh = nh * scale;
  return { scale, x: (sw - dw) / 2, y: (sh - dh) / 2, w: dw, h: dh };
}

function applyAspectToRect(rect, aspect, bounds) {
  if (!aspect || aspect <= 0) return rect;
  let { x, y, w, h } = rect;
  const cx = x + w / 2;
  const cy = y + h / 2;
  if (w / h > aspect) w = h * aspect;
  else h = w / aspect;
  w = Math.min(w, bounds.w);
  h = Math.min(h, bounds.h);
  if (w / h > aspect) w = h * aspect;
  else h = w / aspect;
  x = clamp(cx - w / 2, bounds.x, bounds.x + bounds.w - w);
  y = clamp(cy - h / 2, bounds.y, bounds.y + bounds.h - h);
  return { x, y, w, h };
}

function paintStrokesOnCtx(ctx, strokes) {
  for (const s of strokes || []) {
    if (!s?.points?.length) continue;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // Stroke width is stored in natural (rotated) pixels already
    ctx.lineWidth = Math.max(2, Number(s.width) || 6);
    ctx.globalAlpha = s.alpha != null ? s.alpha : 1;
    if (s.eraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = s.color || "#e53935";
    }
    ctx.beginPath();
    const pts = s.points;
    if (pts.length === 1) {
      // single tap — draw a dot
      ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = s.eraser ? "rgba(0,0,0,1)" : (s.color || "#e53935");
      if (s.eraser) ctx.globalCompositeOperation = "destination-out";
      ctx.fill();
    } else {
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }
    ctx.restore();
  }
}

export default function ImageCropDialog({
  open,
  file,
  onClose,
  onConfirm,
  circular = false,
  outputSize = 1600,
  title = "Edit image",
  confirmLabel = "Done",
  initialEdits = null,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const stageRef = useRef(null);
  const baseCanvasRef = useRef(null); // shows rotated image + strokes
  const imgRef = useRef(null);
  const strokesRef = useRef([]);

  const [src, setSrc] = useState("");
  const [imgLayout, setImgLayout] = useState(null);
  const [crop, setCrop] = useState(null);
  const [aspectId, setAspectId] = useState(circular ? "1:1" : "free");
  const [rotation, setRotation] = useState(0);
  const [mode, setMode] = useState("crop");
  const [penColor, setPenColor] = useState("#e53935");
  const [penWidth, setPenWidth] = useState(6);
  const [penTool, setPenTool] = useState("pen");
  const [strokes, setStrokes] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0); // force base canvas redraw

  const dragRef = useRef(null);
  const drawingRef = useRef(null);

  useEffect(() => { strokesRef.current = strokes; }, [strokes]);

  const aspect = circular ? 1 : (ASPECTS.find((a) => a.id === aspectId)?.value ?? null);

  const rebuildBaseCanvas = useCallback((img, rot, strokeList, layout) => {
    const canvas = baseCanvasRef.current;
    if (!canvas || !img || !layout) return;
    const r = ((rot % 360) + 360) % 360;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const cw = (r === 90 || r === 270) ? nh : nw;
    const ch = (r === 90 || r === 270) ? nw : nh;
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate((r * Math.PI) / 180);
    ctx.drawImage(img, -nw / 2, -nh / 2);
    ctx.restore();
    paintStrokesOnCtx(ctx, strokeList);
  }, []);

  const measureAndInit = useCallback((img, rot, restore) => {
    const stage = stageRef.current;
    if (!stage || !img) return;
    const sw = stage.clientWidth || 360;
    const sh = stage.clientHeight || 360;
    const r = ((rot % 360) + 360) % 360;
    const nw = (r === 90 || r === 270) ? img.naturalHeight : img.naturalWidth;
    const nh = (r === 90 || r === 270) ? img.naturalWidth : img.naturalHeight;
    const fit = fitContain(nw, nh, sw, sh);
    const layout = { ...fit, nw, nh };
    setImgLayout(layout);

    if (restore?.crop && restore.crop.w > 0) {
      // restore natural crop → stage
      setCrop({
        x: layout.x + restore.crop.x * layout.scale,
        y: layout.y + restore.crop.y * layout.scale,
        w: restore.crop.w * layout.scale,
        h: restore.crop.h * layout.scale,
      });
    } else {
      let rect = { x: fit.x, y: fit.y, w: fit.w, h: fit.h };
      if (circular) {
        const side = Math.min(fit.w, fit.h);
        rect = { x: fit.x + (fit.w - side) / 2, y: fit.y + (fit.h - side) / 2, w: side, h: side };
      }
      setCrop(rect);
    }
    requestAnimationFrame(() => {
      rebuildBaseCanvas(img, rot, strokesRef.current, layout);
    });
  }, [circular, rebuildBaseCanvas]);

  // Load file + optional restored edits
  useEffect(() => {
    if (!open || !file) {
      setSrc("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setSrc(url);
    setError("");
    setBusy(false);
    setMode("crop");
    setUndoStack([]);
    setRedoStack([]);

    const restore = initialEdits || null;
    const rot = restore?.rotation != null ? Number(restore.rotation) : 0;
    setRotation(rot);
    setAspectId(circular ? "1:1" : "free");
    const restoredStrokes = Array.isArray(restore?.strokes) ? restore.strokes : [];
    setStrokes(restoredStrokes);
    strokesRef.current = restoredStrokes;

    let cancelled = false;
    loadImage(url).then((img) => {
      if (cancelled) return;
      imgRef.current = img;
      measureAndInit(img, rot, restore);
      setTick((t) => t + 1);
    }).catch(() => setError("Could not load image"));

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file, circular, initialEdits]);

  // Redraw base when strokes/rotation change
  useEffect(() => {
    if (imgRef.current && imgLayout) {
      rebuildBaseCanvas(imgRef.current, rotation, strokes, imgLayout);
    }
  }, [strokes, rotation, imgLayout, rebuildBaseCanvas, tick]);

  useEffect(() => {
    if (!open) return undefined;
    const stage = stageRef.current;
    if (!stage) return undefined;
    const ro = new ResizeObserver(() => {
      if (imgRef.current) measureAndInit(imgRef.current, rotation, null);
    });
    ro.observe(stage);
    return () => ro.disconnect();
  }, [open, rotation, measureAndInit]);

  useEffect(() => {
    if (!crop || !imgLayout || !aspect) return;
    setCrop((c) => applyAspectToRect(c, aspect, imgLayout));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspectId]);

  const stageToNatural = useCallback((pt) => {
    if (!imgLayout) return { x: 0, y: 0 };
    return {
      x: (pt.x - imgLayout.x) / imgLayout.scale,
      y: (pt.y - imgLayout.y) / imgLayout.scale,
    };
  }, [imgLayout]);

  const naturalCropFromStage = useCallback((rect) => {
    if (!imgLayout || !rect) return null;
    return {
      x: (rect.x - imgLayout.x) / imgLayout.scale,
      y: (rect.y - imgLayout.y) / imgLayout.scale,
      w: rect.w / imgLayout.scale,
      h: rect.h / imgLayout.scale,
    };
  }, [imgLayout]);

  const getStagePoint = (e) => {
    const stage = stageRef.current;
    const rect = stage.getBoundingClientRect();
    const cx = e.touches?.[0]?.clientX ?? e.clientX;
    const cy = e.touches?.[0]?.clientY ?? e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
  };

  /* ---- crop drag ---- */
  const onPointerDownCrop = (e, handle) => {
    if (mode !== "crop" || !crop) return;
    e.preventDefault();
    e.stopPropagation();
    const p = getStagePoint(e);
    dragRef.current = { type: handle || "move", ox: p.x, oy: p.y, start: { ...crop } };
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* */ }
  };

  const onPointerMoveCrop = (e) => {
    const d = dragRef.current;
    if (!d || !imgLayout) return;
    const p = getStagePoint(e);
    const dx = p.x - d.ox;
    const dy = p.y - d.oy;
    const b = imgLayout;
    let { x: cx, y: cy, w, h } = d.start;

    if (d.type === "move") {
      cx = clamp(d.start.x + dx, b.x, b.x + b.w - w);
      cy = clamp(d.start.y + dy, b.y, b.y + b.h - h);
      setCrop({ x: cx, y: cy, w, h });
      return;
    }
    const t = d.type;
    if (t.includes("w")) {
      const nx = clamp(d.start.x + dx, b.x, d.start.x + d.start.w - MIN_CROP);
      w = d.start.w + (d.start.x - nx);
      cx = nx;
    }
    if (t.includes("e")) {
      w = clamp(d.start.w + dx, MIN_CROP, b.x + b.w - d.start.x);
      cx = d.start.x;
    }
    if (t.includes("n")) {
      const ny = clamp(d.start.y + dy, b.y, d.start.y + d.start.h - MIN_CROP);
      h = d.start.h + (d.start.y - ny);
      cy = ny;
    }
    if (t.includes("s")) {
      h = clamp(d.start.h + dy, MIN_CROP, b.y + b.h - d.start.y);
      cy = d.start.y;
    }
    let next = { x: cx, y: cy, w, h };
    if (aspect) next = applyAspectToRect(next, aspect, b);
    next.w = clamp(next.w, MIN_CROP, b.w);
    next.h = clamp(next.h, MIN_CROP, b.h);
    next.x = clamp(next.x, b.x, b.x + b.w - next.w);
    next.y = clamp(next.y, b.y, b.y + b.h - next.h);
    setCrop(next);
  };

  /* ---- draw ---- */
  const onPointerDownDraw = (e) => {
    if (mode !== "draw" || !imgLayout) return;
    e.preventDefault();
    const p = getStagePoint(e);
    if (p.x < imgLayout.x || p.y < imgLayout.y || p.x > imgLayout.x + imgLayout.w || p.y > imgLayout.y + imgLayout.h) return;
    const nat = stageToNatural(p);
    const stroke = {
      points: [nat],
      color: penColor,
      width: penWidth / imgLayout.scale,
      alpha: penTool === "highlight" ? 0.4 : 1,
      eraser: penTool === "eraser",
    };
    drawingRef.current = stroke;
    setStrokes((prev) => {
      const next = [...prev, stroke];
      strokesRef.current = next;
      return next;
    });
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* */ }
  };

  const onPointerMoveDraw = (e) => {
    if (!drawingRef.current || !imgLayout) return;
    const p = getStagePoint(e);
    const nat = stageToNatural(p);
    drawingRef.current.points.push(nat);
    const snap = { ...drawingRef.current, points: [...drawingRef.current.points] };
    setStrokes((prev) => {
      const next = prev.slice(0, -1).concat([snap]);
      strokesRef.current = next;
      return next;
    });
  };

  const onPointerUp = () => {
    if (drawingRef.current) {
      const finished = strokesRef.current;
      setUndoStack((u) => [...u, finished.slice(0, -1)]);
      setRedoStack([]);
    }
    drawingRef.current = null;
    dragRef.current = null;
  };

  const undo = () => {
    setStrokes((cur) => {
      if (!undoStack.length) return cur;
      const prev = undoStack[undoStack.length - 1];
      setUndoStack((u) => u.slice(0, -1));
      setRedoStack((r) => [...r, cur]);
      strokesRef.current = prev;
      return prev;
    });
  };

  const redo = () => {
    setStrokes((cur) => {
      if (!redoStack.length) return cur;
      const next = redoStack[redoStack.length - 1];
      setRedoStack((r) => r.slice(0, -1));
      setUndoStack((u) => [...u, cur]);
      strokesRef.current = next;
      return next;
    });
  };

  const rotateBy = (delta) => {
    const next = (((rotation + delta) % 360) + 360) % 360;
    setRotation(next);
    // keep strokes in rotated space is hard — clear on rotate
    setStrokes([]);
    strokesRef.current = [];
    setUndoStack([]);
    setRedoStack([]);
    if (imgRef.current) {
      requestAnimationFrame(() => measureAndInit(imgRef.current, next, null));
    }
  };

  const handleConfirm = async () => {
    if (!imgRef.current || !crop || !imgLayout) return;
    setBusy(true);
    setError("");
    try {
      const naturalCrop = naturalCropFromStage(crop);
      const strokeList = strokesRef.current || strokes;
      const edits = {
        pending: !circular, // chat: defer real crop to send; profile: bake now
        crop: naturalCrop,
        rotation,
        strokes: strokeList,
        circular: Boolean(circular),
        outputSize,
      };

      // Always build preview with strokes + crop so user sees the result
      const img = imgRef.current;
      const r = ((rotation % 360) + 360) % 360;
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      const rotCanvas = document.createElement("canvas");
      if (r === 90 || r === 270) {
        rotCanvas.width = nh;
        rotCanvas.height = nw;
      } else {
        rotCanvas.width = nw;
        rotCanvas.height = nh;
      }
      const rctx = rotCanvas.getContext("2d");
      // Draw rotated image, then RESET transform so strokes use natural pixel coords
      rctx.save();
      rctx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
      rctx.rotate((r * Math.PI) / 180);
      rctx.drawImage(img, -nw / 2, -nh / 2);
      rctx.restore();
      paintStrokesOnCtx(rctx, strokeList);

      const sx = Math.max(0, Math.round(naturalCrop.x));
      const sy = Math.max(0, Math.round(naturalCrop.y));
      const sw = Math.max(1, Math.min(rotCanvas.width - sx, Math.round(naturalCrop.w)));
      const sh = Math.max(1, Math.min(rotCanvas.height - sy, Math.round(naturalCrop.h)));

      let outW = sw;
      let outH = sh;
      const maxOut = circular ? Math.min(outputSize, 512) : Math.min(outputSize, 1600);
      const maxEdge = Math.max(outW, outH);
      if (maxEdge > maxOut) {
        const k = maxOut / maxEdge;
        outW = Math.max(1, Math.round(outW * k));
        outH = Math.max(1, Math.round(outH * k));
      }

      const preview = document.createElement("canvas");
      preview.width = outW;
      preview.height = outH;
      const pctx = preview.getContext("2d");
      if (circular) {
        pctx.beginPath();
        pctx.arc(outW / 2, outH / 2, Math.min(outW, outH) / 2, 0, Math.PI * 2);
        pctx.closePath();
        pctx.clip();
      }
      pctx.drawImage(rotCanvas, sx, sy, sw, sh, 0, 0, outW, outH);

      const mime = circular ? "image/png" : "image/jpeg";
      const blob = await new Promise((resolve, reject) => {
        preview.toBlob((b) => (b ? resolve(b) : reject(new Error("export failed"))), mime, 0.92);
      });
      const base = (file?.name || "image").replace(/\.[^.]+$/, "");
      const filename = `${base}_edit.${circular ? "png" : "jpg"}`;

      // circular (profile): no deferred edits
      onConfirm?.(blob, filename, circular ? null : edits);
    } catch (e) {
      setError(e?.message || "Could not save edits");
    } finally {
      setBusy(false);
    }
  };

  const stageH = isMobile
    ? Math.min(440, typeof window !== "undefined" ? window.innerHeight * 0.5 : 360)
    : 460;

  const handleDefs = [
    { id: "nw", cursor: "nwse-resize", left: -HIT / 2, top: -HIT / 2 },
    { id: "n", cursor: "ns-resize", left: "50%", top: -HIT / 2, ml: -HIT / 2 },
    { id: "ne", cursor: "nesw-resize", right: -HIT / 2, top: -HIT / 2 },
    { id: "e", cursor: "ew-resize", right: -HIT / 2, top: "50%", mt: -HIT / 2 },
    { id: "se", cursor: "nwse-resize", right: -HIT / 2, bottom: -HIT / 2 },
    { id: "s", cursor: "ns-resize", left: "50%", bottom: -HIT / 2, ml: -HIT / 2 },
    { id: "sw", cursor: "nesw-resize", left: -HIT / 2, bottom: -HIT / 2 },
    { id: "w", cursor: "ew-resize", left: -HIT / 2, top: "50%", mt: -HIT / 2 },
  ];

  return (
    <Dialog
      open={Boolean(open)}
      onClose={busy ? undefined : onClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 2,
          maxHeight: isMobile ? "100%" : "94vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
      }}
    >
      <DialogTitle sx={{ py: 1.25, px: 1.5, display: "flex", alignItems: "center", gap: 1, borderBottom: "1px solid", borderColor: "divider" }}>
        <CropIcon fontSize="small" color="primary" />
        <Typography component="span" variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>{title}</Typography>
        <IconButton edge="end" onClick={onClose} disabled={busy}><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Box
          ref={stageRef}
          sx={{
            position: "relative",
            width: "100%",
            height: stageH,
            bgcolor: "#0a0a0a",
            touchAction: "none",
            userSelect: "none",
            overflow: "hidden",
            cursor: mode === "draw" ? "crosshair" : "default",
          }}
          onPointerMove={(e) => {
            if (mode === "crop") onPointerMoveCrop(e);
            else onPointerMoveDraw(e);
          }}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerDown={mode === "draw" ? onPointerDownDraw : undefined}
        >
          {/* Image + drawings (single canvas) */}
          {src && imgLayout && (
            <Box
              component="canvas"
              ref={baseCanvasRef}
              sx={{
                position: "absolute",
                left: imgLayout.x,
                top: imgLayout.y,
                width: imgLayout.w,
                height: imgLayout.h,
                pointerEvents: "none",
              }}
            />
          )}

          {/* Dim outside crop + frame */}
          {mode === "crop" && crop && (
            <>
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  boxShadow: `inset ${crop.x}px ${crop.y}px 0 0 ${alpha("#000", 0.55)},
                    inset -${Math.max(0, (stageRef.current?.clientWidth || 0) - crop.x - crop.w)}px ${crop.y}px 0 0 ${alpha("#000", 0.55)},
                    inset 0 ${crop.y}px 0 0 transparent`,
                  // fallback simple overlay using clipPath
                  background: alpha("#000", 0.5),
                  clipPath: `polygon(
                    0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
                    ${crop.x}px ${crop.y}px,
                    ${crop.x}px ${crop.y + crop.h}px,
                    ${crop.x + crop.w}px ${crop.y + crop.h}px,
                    ${crop.x + crop.w}px ${crop.y}px,
                    ${crop.x}px ${crop.y}px
                  )`,
                }}
              />
              <Box
                onPointerDown={(e) => onPointerDownCrop(e, "move")}
                sx={{
                  position: "absolute",
                  left: crop.x,
                  top: crop.y,
                  width: crop.w,
                  height: crop.h,
                  border: circular ? "none" : "1.5px solid rgba(255,255,255,0.95)",
                  borderRadius: circular ? "50%" : 0,
                  boxShadow: circular
                    ? "0 0 0 1.5px rgba(255,255,255,0.95)"
                    : "0 0 0 1px rgba(0,0,0,0.35)",
                  cursor: "move",
                  boxSizing: "border-box",
                }}
              >
                {/* subtle rule-of-thirds */}
                {!circular && (
                  <>
                    <Box sx={{ position: "absolute", left: "33.33%", top: 0, bottom: 0, width: "1px", bgcolor: "rgba(255,255,255,0.25)" }} />
                    <Box sx={{ position: "absolute", left: "66.66%", top: 0, bottom: 0, width: "1px", bgcolor: "rgba(255,255,255,0.25)" }} />
                    <Box sx={{ position: "absolute", top: "33.33%", left: 0, right: 0, height: "1px", bgcolor: "rgba(255,255,255,0.25)" }} />
                    <Box sx={{ position: "absolute", top: "66.66%", left: 0, right: 0, height: "1px", bgcolor: "rgba(255,255,255,0.25)" }} />
                  </>
                )}
                {/* Invisible hit areas — small corner ticks only (no white squares) */}
                {!circular && handleDefs.map((h) => (
                  <Box
                    key={h.id}
                    onPointerDown={(e) => onPointerDownCrop(e, h.id)}
                    sx={{
                      position: "absolute",
                      width: HIT,
                      height: HIT,
                      left: h.left,
                      right: h.right,
                      top: h.top,
                      bottom: h.bottom,
                      ml: h.ml,
                      mt: h.mt,
                      cursor: h.cursor,
                      touchAction: "none",
                      zIndex: 3,
                      // corner accent: thin L-shaped mark via borders on a transparent box
                      ...(h.id.length === 2 ? {
                        "&::after": {
                          content: '""',
                          position: "absolute",
                          width: 12,
                          height: 12,
                          borderStyle: "solid",
                          borderColor: "#fff",
                          borderWidth: 0,
                          ...(h.id === "nw" ? { left: 4, top: 4, borderTopWidth: 2, borderLeftWidth: 2 } : {}),
                          ...(h.id === "ne" ? { right: 4, top: 4, borderTopWidth: 2, borderRightWidth: 2 } : {}),
                          ...(h.id === "se" ? { right: 4, bottom: 4, borderBottomWidth: 2, borderRightWidth: 2 } : {}),
                          ...(h.id === "sw" ? { left: 4, bottom: 4, borderBottomWidth: 2, borderLeftWidth: 2 } : {}),
                        },
                      } : {
                        // edge midpoints: short line
                        "&::after": {
                          content: '""',
                          position: "absolute",
                          bgcolor: "#fff",
                          ...(h.id === "n" || h.id === "s"
                            ? { width: 18, height: 2, left: "50%", top: "50%", ml: "-9px", mt: "-1px" }
                            : { width: 2, height: 18, left: "50%", top: "50%", ml: "-1px", mt: "-9px" }),
                        },
                      }),
                    }}
                  />
                ))}
              </Box>
            </>
          )}
        </Box>

        <Box sx={{ px: 1.5, py: 1.25, borderTop: "1px solid", borderColor: "divider" }}>
          <Stack direction="row" spacing={1} sx={{ mb: 1.25 }} alignItems="center">
            <ToggleButtonGroup
              exclusive
              size="small"
              value={mode}
              onChange={(_, v) => v && setMode(v)}
              sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 600, px: 1.5 } }}
            >
              <ToggleButton value="crop"><CropIcon sx={{ fontSize: 18, mr: 0.5 }} />Crop</ToggleButton>
              <ToggleButton value="draw"><BrushIcon sx={{ fontSize: 18, mr: 0.5 }} />Draw</ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ flex: 1 }} />
            <IconButton onClick={() => rotateBy(-90)} size="small"><RotateLeftIcon /></IconButton>
            <IconButton onClick={() => rotateBy(90)} size="small"><RotateRightIcon /></IconButton>
            <IconButton
              size="small"
              onClick={() => {
                setStrokes([]);
                strokesRef.current = [];
                setUndoStack([]);
                setRedoStack([]);
                if (imgRef.current) measureAndInit(imgRef.current, rotation, null);
              }}
            >
              <RestartAltIcon />
            </IconButton>
          </Stack>

          {mode === "crop" && !circular && (
            <Box sx={{ overflowX: "auto", mb: 0.5, WebkitOverflowScrolling: "touch" }}>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={aspectId}
                onChange={(_, v) => v && setAspectId(v)}
                sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 600, fontSize: 12.5, px: 1.25 } }}
              >
                {ASPECTS.map((a) => (
                  <ToggleButton key={a.id} value={a.id}>{a.label}</ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          )}

          {mode === "draw" && (
            <Box>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1, flexWrap: "wrap" }}>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={penTool}
                  onChange={(_, v) => v && setPenTool(v)}
                  sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 600, fontSize: 12 } }}
                >
                  <ToggleButton value="pen">Pen</ToggleButton>
                  <ToggleButton value="highlight">Marker</ToggleButton>
                  <ToggleButton value="eraser"><AutoFixOffIcon sx={{ fontSize: 16 }} /></ToggleButton>
                </ToggleButtonGroup>
                <IconButton size="small" onClick={undo} disabled={!undoStack.length}><UndoIcon fontSize="small" /></IconButton>
                <IconButton size="small" onClick={redo} disabled={!redoStack.length}><RedoIcon fontSize="small" /></IconButton>
              </Stack>
              <Stack direction="row" spacing={0.75} sx={{ mb: 1 }}>
                {PEN_COLORS.map((c) => (
                  <Box
                    key={c}
                    onClick={() => setPenColor(c)}
                    sx={{
                      width: 28, height: 28, borderRadius: "50%", bgcolor: c, cursor: "pointer",
                      outline: penColor === c ? `2px solid ${theme.palette.primary.main}` : "2px solid transparent",
                      outlineOffset: 1,
                      boxShadow: c === "#ffffff" ? "inset 0 0 0 1px rgba(0,0,0,0.25)" : "none",
                    }}
                  />
                ))}
              </Stack>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="caption" color="text.secondary">Size</Typography>
                <Slider value={penWidth} min={2} max={28} onChange={(_, v) => setPenWidth(v)} sx={{ flex: 1 }} size="small" />
              </Stack>
            </Box>
          )}

          {error && (
            <Typography color="error" variant="caption" sx={{ display: "block", mt: 0.75 }}>{error}</Typography>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5, borderTop: "1px solid", borderColor: "divider", gap: 1 }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={busy || !crop}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{ textTransform: "none", fontWeight: 700, minWidth: 110 }}
        >
          {busy ? "Saving…" : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
