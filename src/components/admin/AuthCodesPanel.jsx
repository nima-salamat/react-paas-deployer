import React from "react";
import {
  Box, Button, Chip, CircularProgress, IconButton, Pagination, Paper, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

const PAGE_SIZE = 25;

export default function AuthCodesPanel({
  codes, codeCount, codePage, setCodePage, codeSearch, setCodeSearch,
  codeLoading, onPurge, onDelete,
}) {
  const pages = Math.max(1, Math.ceil((codeCount || 0) / PAGE_SIZE));
  return (
    <>
      <Stack direction="row" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={700}>Auth codes (OTP)</Typography>
        <Button size="small" color="warning" onClick={onPurge}>Purge expired</Button>
      </Stack>
      <TextField size="small" fullWidth label="Search user / contact / code" value={codeSearch}
        onChange={(e) => { setCodeSearch(e.target.value); setCodePage(1); }} sx={{ mb: 2 }} />
      {codeLoading ? <CircularProgress /> : (
        <Paper sx={{ overflow: "auto" }}>
          <Table size="small" sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Purpose</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Attempts</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right"> </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {codes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.username || "—"}</TableCell>
                  <TableCell>{c.contact || "—"}</TableCell>
                  <TableCell>{c.purpose}</TableCell>
                  <TableCell><Typography variant="caption" fontFamily="monospace">{c.code}</Typography></TableCell>
                  <TableCell>{c.attempts}</TableCell>
                  <TableCell>
                    {c.is_expired ? <Chip size="small" label="expired" /> :
                      c.is_locked ? <Chip size="small" color="warning" label="locked" /> :
                        <Chip size="small" color="success" label="valid" />}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => onDelete(c.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!codes.length && (
                <TableRow><TableCell colSpan={7} align="center"><Typography color="text.secondary" py={3}>No codes</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {pages > 1 && (
            <Box display="flex" justifyContent="center" p={2}>
              <Pagination page={codePage} count={pages} onChange={(_, v) => setCodePage(v)}
                showFirstButton showLastButton color="primary" />
            </Box>
          )}
        </Paper>
      )}
    </>
  );
}
