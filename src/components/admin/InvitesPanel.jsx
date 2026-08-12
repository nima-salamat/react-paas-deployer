import React, { useMemo, useState } from "react";
import {
  Box, Button, Chip, CircularProgress, Pagination, Paper, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";

const PAGE_SIZE = 15;

export default function InvitesPanel({
  invites, invLoading, newInvite, setNewInvite, onCreate, onDeactivate,
}) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil((invites?.length || 0) / PAGE_SIZE));
  const slice = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return (invites || []).slice(start, start + PAGE_SIZE);
  }, [invites, page]);

  return (
    <>
      <Typography variant="h5" fontWeight={700} mb={2}>Invite links</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
          <TextField size="small" label="Label" value={newInvite.label}
            onChange={(e) => setNewInvite((s) => ({ ...s, label: e.target.value }))} fullWidth />
          <TextField size="small" label="Max uses (empty=∞)" value={newInvite.max_uses}
            onChange={(e) => setNewInvite((s) => ({ ...s, max_uses: e.target.value }))} sx={{ width: 160 }} />
          <Button variant="contained" onClick={onCreate}>Create</Button>
        </Stack>
      </Paper>
      {invLoading ? <CircularProgress /> : (
        <Paper sx={{ overflow: "auto" }}>
          <Table size="small" sx={{ minWidth: 520 }}>
            <TableHead>
              <TableRow>
                <TableCell>Label</TableCell>
                <TableCell>Token</TableCell>
                <TableCell>Uses</TableCell>
                <TableCell>Active</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {slice.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.label || "—"}</TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: "monospace" }}>{inv.token}</Typography>
                  </TableCell>
                  <TableCell>{inv.uses_count}{inv.max_uses != null ? ` / ${inv.max_uses}` : " / ∞"}</TableCell>
                  <TableCell>
                    <Chip size="small" label={inv.is_active ? "active" : "off"} color={inv.is_active ? "success" : "default"} />
                  </TableCell>
                  <TableCell align="right">
                    {inv.is_active && (
                      <Button size="small" color="warning" onClick={() => onDeactivate(inv.token)}>Deactivate</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!slice.length && (
                <TableRow><TableCell colSpan={5} align="center"><Typography color="text.secondary" py={3}>No invites</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {pages > 1 && (
            <Box display="flex" justifyContent="center" p={2}>
              <Pagination page={page} count={pages} onChange={(_, v) => setPage(v)}
                showFirstButton showLastButton color="primary" />
            </Box>
          )}
        </Paper>
      )}
    </>
  );
}
