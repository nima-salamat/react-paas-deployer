import React from "react";
import {
  Box, Button, Chip, CircularProgress, FormControl, IconButton, InputLabel,
  MenuItem, Pagination, Paper, Select, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

const PAGE_SIZE = 20;

export default function UsersPanel({
  users, userCount, userPage, setUserPage, userSearch, setUserSearch,
  userStaffOnly, setUserStaffOnly, userActive, setUserActive,
  userLoading, isAdmin, isStaff, onEdit, onDeactivate, onCreate,
}) {
  const pages = Math.max(1, Math.ceil((userCount || 0) / PAGE_SIZE));
  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Users & access</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage accounts, staff flags, and permission rules
          </Typography>
        </Box>
        {(isAdmin || isStaff) && (
          <Button variant="contained" onClick={onCreate}>New user</Button>
        )}
      </Stack>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
          <TextField size="small" label="Search username / email" value={userSearch}
            onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }} fullWidth />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Staff</InputLabel>
            <Select label="Staff" value={userStaffOnly} onChange={(e) => { setUserStaffOnly(e.target.value); setUserPage(1); }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="1">Staff</MenuItem>
              <MenuItem value="0">Users</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Active</InputLabel>
            <Select label="Active" value={userActive} onChange={(e) => { setUserActive(e.target.value); setUserPage(1); }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="1">Active</MenuItem>
              <MenuItem value="0">Inactive</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>
      {userLoading ? <CircularProgress /> : (
        <Paper sx={{ overflow: "auto" }}>
          <Table size="small" sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                <TableCell>Username</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Flags</TableCell>
                <TableCell>Rules</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>{u.username}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Stack direction="row" gap={0.5} flexWrap="wrap">
                      {u.is_superuser && <Chip size="small" color="error" label="super" />}
                      {u.is_staff && <Chip size="small" color="primary" label="staff" />}
                      {!u.is_active && <Chip size="small" label="inactive" />}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" gap={0.5} flexWrap="wrap" useFlexGap>
                      {(u.rules || []).length === 0 ? (
                        <Typography variant="caption" color="text.secondary">—</Typography>
                      ) : (
                        (u.rules || []).slice(0, 4).map((r) => (
                          <Chip key={r} size="small" variant="outlined" label={r.split(".").pop()} sx={{ height: 22, fontSize: 11 }} />
                        ))
                      )}
                      {(u.rules || []).length > 4 && (
                        <Chip size="small" label={`+${u.rules.length - 4}`} sx={{ height: 22, fontSize: 11 }} />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => onEdit(u)}>Edit</Button>
                    <IconButton size="small" color="error" onClick={() => onDeactivate(u.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!users.length && (
                <TableRow><TableCell colSpan={5} align="center"><Typography color="text.secondary" py={3}>No users</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {pages > 1 && (
            <Box display="flex" justifyContent="center" p={2}>
              <Pagination page={userPage} count={pages} onChange={(_, v) => setUserPage(v)}
                showFirstButton showLastButton color="primary" />
            </Box>
          )}
        </Paper>
      )}
    </>
  );
}
