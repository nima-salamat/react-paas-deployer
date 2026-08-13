import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Autocomplete, Box, Button, Chip, CircularProgress, IconButton,
  InputAdornment, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import apiRequest from "../../customHooks/apiRequest";
import { adminTableFKSearchUrl } from "../adminUtils";

/**
 * FKPicker — autocomplete input for picking a foreign-key row.
 *
 * Calls `GET /api/users/admin/tables/<relatedModelKey>/fk-search/?q=&limit=`
 * debounced as the user types, then lets them pick a row from a dropdown.
 * The selected row is shown as a chip with an "open" button that navigates
 * to that row's table (in the TablesPanel context).
 *
 * Props:
 *   relatedModelKey: string  — "users.User", "services.Service", etc.
 *   relatedLabel: string     — human label for the related table
 *   value: {pk, str} | null  — current value
 *   onChange: (val | null) => void
 *   onNavigateToRow: (modelKey, pk) => void  — opens the related row
 *   disabled: boolean
 *   field: string            — optional: restrict search to a single field
 */
export default function FKPicker({
  relatedModelKey,
  relatedLabel,
  value,
  onChange,
  onNavigateToRow,
  disabled = false,
  field,
}) {
  const [inputValue, setInputValue] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const search = useCallback(async (q) => {
    if (!relatedModelKey) return;
    setLoading(true);
    try {
      const params = { q, limit: 25 };
      if (field) params.field = field;
      const res = await apiRequest({
        method: "GET",
        url: adminTableFKSearchUrl(relatedModelKey),
        params,
      });
      const d = res.data?.data || res.data || {};
      setOptions(d.results || []);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [relatedModelKey, field]);

  // Initial load: when value is set externally, ensure it appears as an option
  useEffect(() => {
    if (value && !options.find((o) => String(o.pk) === String(value.pk))) {
      setOptions((prev) => [value, ...prev]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const onInputChange = (event, newInputValue, reason) => {
    setInputValue(newInputValue);
    if (reason === "reset" || reason === "clear") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(newInputValue);
    }, 250);
  };

  return (
    <Stack direction="row" alignItems="center" gap={1} sx={{ width: "100%" }}>
      <Autocomplete
        size="small"
        fullWidth
        disabled={disabled || !relatedModelKey}
        value={value || null}
        options={options}
        getOptionLabel={(opt) => (opt ? `#${opt.pk} · ${opt.str || ""}` : "")}
        isOptionEqualToValue={(opt, val) => String(opt.pk) === String(val.pk)}
        inputValue={inputValue}
        onInputChange={onInputChange}
        onChange={(_, val) => onChange(val || null)}
        loading={loading}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={relatedModelKey ? `Search ${relatedLabel || relatedModelKey}…` : "No related model"}
            variant="outlined"
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 0 } }}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
                </InputAdornment>
              ),
              endAdornment: (
                <React.Fragment>
                  {loading ? <CircularProgress size={16} /> : null}
                  {params.InputProps.endAdornment}
                </React.Fragment>
              ),
            }}
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props} sx={{ fontSize: 12 }}>
            <Stack direction="row" alignItems="center" gap={1} sx={{ width: "100%" }}>
              <code style={{ fontSize: 10, color: "text.secondary" }}>#{option.pk}</code>
              <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                {option.str || "(no str)"}
              </Typography>
            </Stack>
          </Box>
        )}
        noOptionsText={relatedModelKey ? "Type to search…" : "No related model registered"}
        clearOnEscape
        clearOnBlur={false}
      />
      {value && onNavigateToRow && (
        <Tooltip title={`Open ${relatedLabel || relatedModelKey} #${value.pk}`}>
          <IconButton
            size="small"
            onClick={() => onNavigateToRow(relatedModelKey, value.pk)}
          >
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
}
