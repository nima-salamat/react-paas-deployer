import React, { useMemo, useState } from "react";
import {
  Avatar, Box, Button, Dialog, DialogContent, IconButton, Menu, MenuItem,
  Stack, Tooltip, Typography, alpha,
} from "@mui/material";
import CodeIcon from "@mui/icons-material/Code";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CloseIcon from "@mui/icons-material/Close";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ImageIcon from "@mui/icons-material/Image";
import VideocamIcon from "@mui/icons-material/Videocam";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import DoneIcon from "@mui/icons-material/Done";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import { authMediaSrc } from "../adminUtils";
import { normalizeTicketMessageBody, normalizeTicketRichTextHtml } from "../../tickets/ticketRichText.js";

function formatSize(bytes) {
  if (bytes == null || bytes === "") return "";
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(ct, name = "") {
  if (ct && String(ct).startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name || "");
}
function isVideo(ct, name = "") {
  if (ct && String(ct).startsWith("video/")) return true;
  return /\.(mp4|webm|mov|mkv)$/i.test(name || "");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

async function downloadUrl(url, filename) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = filename || "file";
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 30_000);
  } catch {
    window.open(url, "_blank");
  }
}

function authorAvatarSrc(author) {
  if (!author) return "";
  const profiles = author.profiles || [];
  const first = profiles.find((p) => p.image) || profiles[0];
  if (first?.image) return authMediaSrc(first.image);
  if (author.avatar) return authMediaSrc(author.avatar);
  if (author.image) return authMediaSrc(author.image);
  return "";
}


function SeenTicks({ seen, mine }) {
  if (!mine) return null;
  // Messenger-style: single check = sent, double check (info color) = seen
  if (seen) {
    return (
      <Tooltip title="Seen">
        <DoneAllIcon sx={{ fontSize: 14, color: "info.light", opacity: 0.95 }} />
      </Tooltip>
    );
  }
  return (
    <Tooltip title="Sent">
      <DoneIcon sx={{ fontSize: 14, opacity: 0.75 }} />
    </Tooltip>
  );
}

/* ─── Image with lightbox + download (messenger-style) ─── */
function TicketImage({ src, name, sizeLabel, mine }) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(null);

  return (
    <>
      <Box sx={{ mt: 0.75, maxWidth: 340, position: "relative" }}>
        <Box
          onClick={() => setOpen(true)}
          sx={{
            borderRadius: 2,
            overflow: "hidden",
            cursor: "zoom-in",
            lineHeight: 0,
            bgcolor: mine ? "rgba(0,0,0,0.12)" : "action.hover",
            border: "1px solid",
            borderColor: mine ? "rgba(255,255,255,0.12)" : "divider",
          }}
        >
          <img
            src={src}
            alt={name}
            loading="lazy"
            style={{
              width: "100%",
              maxHeight: 360,
              objectFit: "cover",
              display: "block",
              minHeight: 120,
            }}
          />
        </Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mt={0.4}>
          <Typography
            variant="caption"
            sx={{
              opacity: 0.85,
              wordBreak: "break-all",
              color: mine ? "rgba(255,255,255,0.9)" : "text.secondary",
            }}
          >
            <ImageIcon sx={{ fontSize: 12, mr: 0.4, verticalAlign: "middle" }} />
            {name}
            {sizeLabel ? ` · ${sizeLabel}` : ""}
          </Typography>
          <IconButton
            size="small"
            onClick={(e) => setMenu(e.currentTarget)}
            sx={{ p: 0.25, color: mine ? "rgba(255,255,255,0.85)" : "text.secondary" }}
          >
            <MoreVertIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Stack>
        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} dense>
          <MenuItem
            onClick={() => {
              setOpen(true);
              setMenu(null);
            }}
          >
            <OpenInNewIcon fontSize="small" sx={{ mr: 1 }} /> Open
          </MenuItem>
          <MenuItem
            onClick={() => {
              downloadUrl(src, name);
              setMenu(null);
            }}
          >
            <DownloadIcon fontSize="small" sx={{ mr: 1 }} /> Download
          </MenuItem>
          <MenuItem
            onClick={async () => {
              await copyText(src);
              setMenu(null);
            }}
          >
            <ContentCopyIcon fontSize="small" sx={{ mr: 1 }} /> Copy link
          </MenuItem>
        </Menu>
      </Box>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: "rgba(0,0,0,0.92)",
            backgroundImage: "none",
            boxShadow: "none",
            m: 1,
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            px: 1,
            pt: 1,
          }}
        >
          <Typography variant="body2" sx={{ color: "#fff", opacity: 0.85 }} noWrap>
            {name}
          </Typography>
          <Stack direction="row">
            <Tooltip title="Download">
              <IconButton onClick={() => downloadUrl(src, name)} sx={{ color: "#fff" }}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Copy link">
              <IconButton onClick={() => copyText(src)} sx={{ color: "#fff" }}>
                <ContentCopyIcon />
              </IconButton>
            </Tooltip>
            <IconButton onClick={() => setOpen(false)} sx={{ color: "#fff" }}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </Box>
        <DialogContent
          sx={{ display: "flex", justifyContent: "center", alignItems: "center", p: 1 }}
        >
          <img
            src={src}
            alt={name}
            style={{
              maxWidth: "100%",
              maxHeight: "80vh",
              objectFit: "contain",
              borderRadius: 8,
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function AttachmentBlock({ a, mine }) {
  const name = a.original_filename || a.name || a.filename || "file";
  const ct = a.content_type || a.mime || "";
  const url = a.download_url || a.url || a.file || a.image;
  const sizeLabel = formatSize(a.size);
  const kind = isImage(ct, name) ? "image" : isVideo(ct, name) ? "video" : "file";
  const src = useMemo(() => authMediaSrc(url), [url]);

  if (!url) return null;

  if (kind === "image") {
    return <TicketImage src={src} name={name} sizeLabel={sizeLabel} mine={mine} />;
  }

  if (kind === "video") {
    return (
      <Box sx={{ mt: 0.75, maxWidth: 360 }}>
        <video
          controls
          preload="metadata"
          src={src}
          style={{ width: "100%", maxHeight: 280, borderRadius: 12, background: "#000" }}
        />
        <Stack direction="row" justifyContent="space-between" alignItems="center" mt={0.4}>
          <Typography
            variant="caption"
            sx={{ opacity: 0.85, color: mine ? "rgba(255,255,255,0.9)" : "text.secondary" }}
          >
            <VideocamIcon sx={{ fontSize: 12, mr: 0.4, verticalAlign: "middle" }} />
            {name}
            {sizeLabel ? ` · ${sizeLabel}` : ""}
          </Typography>
          <Tooltip title="Download">
            <IconButton
              size="small"
              onClick={() => downloadUrl(src, name)}
              sx={{ color: mine ? "rgba(255,255,255,0.85)" : "text.secondary" }}
            >
              <DownloadIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    );
  }

  return (
    <Button
      size="small"
      onClick={() => downloadUrl(src, name)}
      startIcon={<InsertDriveFileIcon />}
      endIcon={<DownloadIcon sx={{ fontSize: 14 }} />}
      variant="outlined"
      sx={{
        mt: 0.75,
        maxWidth: "100%",
        justifyContent: "flex-start",
        textTransform: "none",
        color: mine ? "primary.contrastText" : "text.primary",
        borderColor: mine ? "rgba(255,255,255,0.45)" : "divider",
      }}
    >
      <Box sx={{ textAlign: "left", overflow: "hidden" }}>
        <Typography variant="caption" noWrap display="block" title={name} sx={{ maxWidth: 180 }}>
          {name}
        </Typography>
        {sizeLabel && (
          <Typography variant="caption" sx={{ opacity: 0.75, fontSize: 10 }}>
            {sizeLabel}
          </Typography>
        )}
      </Box>
    </Button>
  );
}

/**
 * AdminTicketMessage — messenger-style bubble for admin ticket thread.
 *
 * - Staff replies (mine) → right side, primary bubble
 * - Customer messages → left side
 * - Avatar / profile image on each side
 * - Images: thumbnail, lightbox open, download
 * - Files/videos: preview + download
 */
export default function AdminTicketMessage({ message: m, showHtmlToggle = true, onAvatarClick }) {
  const mine = Boolean(m?.is_staff_reply);
  const seen = Boolean(
    m?.read_state === "read" || m?.seen_at || m?.is_seen
  );
  const author = m?.user || m?.author || {};
  const name =
    author.username ||
    author.email ||
    (mine ? "Staff" : "User");

  const avatarSrc = authorAvatarSrc(author);
  const bodyHtml = normalizeTicketMessageBody(m?.body);
  const hasCodeBlock = /<pre\b/i.test(bodyHtml);
  const bodyText = bodyHtml.replace(/<[^>]+>/g, "").trim();
  const hasBody = Boolean(bodyText);
  const hasHtml = /<[a-z][\s\S]*>/i.test(bodyHtml);
  const attachments = m?.attachments || m?.files || [];

  const [showRaw, setShowRaw] = useState(false);
  const [menu, setMenu] = useState(null);
  const [toast, setToast] = useState("");

  const renderedBodyHtml = useMemo(() => normalizeTicketRichTextHtml(bodyHtml), [bodyHtml]);

  const plainBody = useMemo(() => {
    if (typeof document === "undefined") return bodyText;
    const d = document.createElement("div");
    d.innerHTML = bodyHtml;
    return (d.textContent || d.innerText || "").trim();
  }, [bodyHtml, bodyText]);

  const ts = m?.created_at || m?.timestamp;
  const time = ts
    ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1500);
  };

  return (
    <Stack
      direction="row"
      justifyContent={mine ? "flex-end" : "flex-start"}
      alignItems="flex-end"
      gap={0.85}
      sx={{ width: "100%", px: 0.5 }}
    >
      {/* Customer avatar — left */}
      {!mine ? (
        <Avatar
          src={avatarSrc || undefined}
          alt={name}
          onClick={() => onAvatarClick?.(author)}
          sx={{
            width: 34,
            height: 34,
            fontSize: 13,
            fontWeight: 700,
            bgcolor: "grey.600",
            flexShrink: 0,
            cursor: onAvatarClick ? "pointer" : "default",
          }}
        >
          {(name || "?").charAt(0).toUpperCase()}
        </Avatar>
      ) : (
        <Box sx={{ width: 34, flexShrink: 0 }} />
      )}

      {/* Bubble */}
      <Box
        sx={{
          maxWidth: { xs: "calc(100% - 46px)", sm: "min(74%, 680px)" },
          minWidth: hasCodeBlock ? { xs: "min(280px, calc(100vw - 92px))", sm: 340 } : 0,
          width: hasCodeBlock ? { xs: "min(100%, 360px)", sm: "min(100%, 640px)" } : "fit-content",
          boxSizing: "border-box",
          overflowWrap: "anywhere",
          px: 1.5,
          py: 1.05,
          borderRadius: mine ? "16px 16px 5px 16px" : "16px 16px 16px 5px",
          bgcolor: mine ? "primary.main" : "background.paper",
          color: mine ? "primary.contrastText" : "text.primary",
          boxShadow: mine
            ? (theme) => `0 6px 20px ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.13 : 0.15)}`
            : (theme) => `0 4px 18px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.15 : 0.045)}`,
          border: "1px solid",
          borderColor: mine
            ? (theme) => alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.45 : 0.25)
            : "divider",
          position: "relative",
        }}
      >
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
          {!mine ? (
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: m?.is_staff_reply ? "primary.main" : "text.secondary",
              }}
            >
              {name}
            </Typography>
          ) : (
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, color: "rgba(255,255,255,0.85)" }}
            >
              {name} · Staff
            </Typography>
          )}
          <IconButton
            size="small"
            onClick={(e) => setMenu(e.currentTarget)}
            sx={{
              p: 0.25,
              color: mine ? "rgba(255,255,255,0.75)" : "text.secondary",
              ml: "auto",
            }}
          >
            <MoreVertIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Stack>

        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} dense>
          {hasBody && (
            <MenuItem
              onClick={async () => {
                const ok = await copyText(plainBody);
                flash(ok ? "Copied" : "Copy failed");
                setMenu(null);
              }}
            >
              <ContentCopyIcon fontSize="small" sx={{ mr: 1 }} /> Copy text
            </MenuItem>
          )}
          {hasBody && hasHtml && (
            <MenuItem
              onClick={async () => {
                await copyText(bodyHtml);
                flash("HTML copied");
                setMenu(null);
              }}
            >
              <CodeIcon fontSize="small" sx={{ mr: 1 }} /> Copy HTML
            </MenuItem>
          )}
          {attachments.map((a, idx) => {
            const fname = a.original_filename || a.name || a.filename || "file";
            const url = a.download_url || a.url || a.file || a.image;
            return (
              <MenuItem
                key={a.id || url || idx}
                onClick={() => {
                  if (url) downloadUrl(authMediaSrc(url), fname);
                  setMenu(null);
                }}
              >
                <DownloadIcon fontSize="small" sx={{ mr: 1 }} />
                Download {fname}
              </MenuItem>
            );
          })}
          {showHtmlToggle && hasBody && hasHtml && (
            <MenuItem
              onClick={() => {
                setShowRaw((v) => !v);
                setMenu(null);
              }}
            >
              <CodeIcon fontSize="small" sx={{ mr: 1 }} />
              {showRaw ? "Show rendered" : "Show HTML source"}
            </MenuItem>
          )}
        </Menu>

        {/* Body */}
        {hasBody && !showRaw && (
          <Box
            sx={{
              fontSize: 14,
              lineHeight: 1.62,
              width: "100%",
              minWidth: 0,
              maxWidth: "min(68ch, 100%)",
              overflow: "hidden",
              overflowWrap: "anywhere",
              wordBreak: "normal",
              mt: 0.35,
              "& *": { boxSizing: "border-box", maxWidth: "100%" },
              "& p, & li, & blockquote, & h1, & h2, & h3, & h4": {
                maxWidth: "min(68ch, 100%)",
              },
              "& p": { m: 0, mb: 0.55 },
              "& p:last-child": { mb: 0 },
              "& h1, & h2, & h3, & h4": { mt: 0.8, mb: 0.55, lineHeight: 1.2, fontWeight: 800 },
              "& h1": { fontSize: "1.45em" },
              "& h2": { fontSize: "1.3em" },
              "& h3": { fontSize: "1.18em" },
              "& h4": { fontSize: "1.08em" },
              "& ul, & ol": {
                display: "block",
                paddingInlineStart: "1.5em",
                paddingInlineEnd: 0,
                my: 0.5,
              },
              "& ul": { listStyleType: "disc" },
              "& ol": { listStyleType: "decimal" },
              "& ul ul": { listStyleType: "circle" },
              "& ul ul ul": { listStyleType: "square" },
              "& ol ol": { listStyleType: "lower-alpha" },
              "& ol ol ol": { listStyleType: "lower-roman" },
              "& li": { display: "list-item", paddingInlineStart: 0.2, mb: 0.2 },
              '& [dir="rtl"]': { direction: "rtl", unicodeBidi: "plaintext" },
              '& [dir="ltr"]': { direction: "ltr", unicodeBidi: "plaintext" },
              "& p.ticket-align-left, & h1.ticket-align-left, & h2.ticket-align-left, & h3.ticket-align-left, & h4.ticket-align-left, & li.ticket-align-left, & blockquote.ticket-align-left, & [data-ticket-align='left']": {
                textAlign: "left !important",
              },
              "& p.ticket-align-center, & h1.ticket-align-center, & h2.ticket-align-center, & h3.ticket-align-center, & h4.ticket-align-center, & li.ticket-align-center, & blockquote.ticket-align-center, & [data-ticket-align='center']": {
                textAlign: "center !important",
              },
              "& p.ticket-align-right, & h1.ticket-align-right, & h2.ticket-align-right, & h3.ticket-align-right, & h4.ticket-align-right, & li.ticket-align-right, & blockquote.ticket-align-right, & [data-ticket-align='right']": {
                textAlign: "right !important",
              },
              "& strong, & b": { fontWeight: 800 },
              "& em, & i": { fontStyle: "italic" },
              "& u": { textDecoration: "underline", textUnderlineOffset: "2px" },
              "& s": { textDecoration: "line-through" },
              "& a": { color: mine ? "inherit" : "primary.main", textDecoration: "underline", overflowWrap: "anywhere" },
              "& pre": {
                display: "block",
                width: "100%",
                minWidth: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
                overflowX: "auto",
                overflowY: "hidden",
                overscrollBehaviorX: "contain",
                WebkitOverflowScrolling: "touch",
                whiteSpace: "pre",
                overflowWrap: "normal",
                bgcolor: mine ? "rgba(0,0,0,0.15)" : "action.hover",
                p: 1,
                borderRadius: 1.3,
                fontSize: 12,
                lineHeight: 1.6,
              },
              "& pre code": {
                display: "block",
                minWidth: "max-content",
                maxWidth: "none",
                whiteSpace: "inherit",
                overflowWrap: "normal",
              },
              "& code": {
                bgcolor: mine ? "rgba(0,0,0,0.12)" : alpha("#000", 0.06),
                px: 0.5,
                borderRadius: 0.5,
                fontSize: "0.9em",
                overflowWrap: "anywhere",
              },
              "& img, & video, & audio": { maxWidth: "100%" },
              "& img": { borderRadius: 1, display: "block", my: 0.5 },
              "& blockquote": {
                m: "0.65rem 0",
                pl: 1.5,
                pr: 1,
                py: 0.8,
                borderLeft: "3px solid",
                borderColor: mine ? "rgba(255,255,255,0.62)" : "divider",
                borderRadius: "0 8px 8px 0",
                bgcolor: mine ? "rgba(255,255,255,0.09)" : "action.hover",
                color: mine ? "rgba(255,255,255,0.93)" : "text.secondary",
                fontStyle: "italic",
                position: "relative",
              },
              "& blockquote::before": {
                content: '"“"',
                position: "absolute",
                left: 6,
                top: -4,
                fontSize: 28,
                fontWeight: 800,
                lineHeight: 1,
                color: mine ? "rgba(255,255,255,0.78)" : "text.secondary",
                opacity: 0.9,
              },
              userSelect: "text",
            }}
            dangerouslySetInnerHTML={{ __html: renderedBodyHtml }}
          />
        )}

        {hasBody && showRaw && (
          <Box
            component="pre"
            sx={{
              m: 0,
              mt: 0.5,
              p: 0.75,
              bgcolor: mine ? "rgba(0,0,0,0.12)" : "action.hover",
              borderRadius: 1,
              fontSize: 11,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {bodyHtml}
          </Box>
        )}

        {/* Attachments */}
        {attachments.map((a, idx) => (
          <AttachmentBlock
            key={a.id || a.download_url || a.url || idx}
            a={a}
            mine={mine}
          />
        ))}

        {/* Footer */}
        {/* Bottom meta — messenger style: time + read ticks bottom-right */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="flex-end"
          spacing={0.4}
          sx={{ mt: 0.35, minHeight: 16 }}
        >
          {toast && (
            <Typography variant="caption" sx={{ opacity: 0.8, mr: "auto", fontSize: 11 }}>
              {toast}
            </Typography>
          )}
          <Typography
            variant="caption"
            sx={{
              fontSize: 11,
              opacity: 0.75,
              color: mine ? "rgba(255,255,255,0.85)" : "text.secondary",
              lineHeight: 1,
            }}
          >
            {time}
          </Typography>
          {mine && (
            <Box sx={{ display: "inline-flex", alignItems: "center", lineHeight: 0 }}>
              <SeenTicks seen={seen} mine={mine} />
            </Box>
          )}
        </Stack>
      </Box>

      {/* Staff avatar — right */}
      {mine ? (
        <Avatar
          src={avatarSrc || undefined}
          alt={name}
          onClick={() => onAvatarClick?.(author)}
          sx={{
            width: 34,
            height: 34,
            fontSize: 13,
            fontWeight: 700,
            bgcolor: "primary.main",
            flexShrink: 0,
            cursor: onAvatarClick ? "pointer" : "default",
          }}
        >
          {(name || "?").charAt(0).toUpperCase()}
        </Avatar>
      ) : (
        <Box sx={{ width: 34, flexShrink: 0 }} />
      )}
    </Stack>
  );
}
