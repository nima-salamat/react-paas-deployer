import React from "react";
import { useLocale } from "../../../i18n/LocaleProvider.jsx";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, Typography, TextField, Box,
} from "@mui/material";

/**
 * Search messages in the active conversation and jump to a result.
 */
export default function MessageSearchDialog({
  open,
  onClose,
  query,
  setQuery,
  results = [],
  loading = false,
  onSearch,
  onJumpToMessage,
}) {
  const { t: tr } = useLocale();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Search messages</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder={tr("Search in this chat…")}
          value={query}
          onChange={(e) => setQuery?.(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSearch?.(query); }}
          sx={{ mb: 1.5, mt: 0.5 }}
        />
        <Button
          variant="contained"
          size="small"
          onClick={() => onSearch?.(query)}
          disabled={loading}
        >
          {loading ? "Searching…" : "Search"}
        </Button>
        <Stack spacing={0.75} sx={{ mt: 2, maxHeight: 360, overflow: "auto" }}>
          {results.map((m) => (
            <Box
              key={m.id}
              onClick={() => {
                onClose?.();
                onJumpToMessage?.(m.id);
              }}
              sx={{
                p: 1, borderRadius: 1, cursor: "pointer",
                bgcolor: "action.hover",
                "&:hover": { bgcolor: "action.selected" },
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {m.sender?.username || "User"} ·{" "}
                {m.created_at ? new Date(m.created_at).toLocaleString() : ""}
              </Typography>
              <Typography variant="body2" noWrap>
                {(m.body || "").slice(0, 160)}
              </Typography>
            </Box>
          ))}
          {!loading && query && !results.length && (
            <Typography variant="body2" color="text.secondary">No results</Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
