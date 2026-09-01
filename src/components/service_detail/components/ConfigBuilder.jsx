import React, { useMemo } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { parseDeployConfig } from "../utils";

const PLATFORM_META = {
  laravel: {
    title: "Laravel runtime",
    fields: [
      ["php_version", "PHP version", "8.4"],
      ["document_root", "Document root", "public"],
      ["public_url_mode", "Public URL handling", "auto"],
      ["public_url", "Public URL", ""],
      ["asset_url", "Asset URL", ""],
      ["static_dir", "Static directory", "public/build"],
      ["media_dir", "Media directory", "storage/app/public"],
    ],
  },
  php: {
    title: "PHP runtime",
    fields: [
      ["php_version", "PHP version", "8.4"],
      ["document_root", "Document root", "public"],
      ["port", "Port", "80"],
    ],
  },
  django: {
    title: "Django runtime",
    fields: [
      ["python_version", "Python version", "3.11"],
      ["server_type", "Server type", "gunicorn"],
      ["entry_point", "Entry point", ""],
      ["django_settings_module", "Settings module", ""],
      ["static_dir", "Static directory", "/app/static"],
      ["media_dir", "Media directory", "/app/media"],
      ["worker_count", "Worker count", "1"],
    ],
  },
  python: {
    title: "Python runtime",
    fields: [
      ["python_version", "Python version", "3.11"],
      ["entry_point", "Entry point", ""],
      ["worker_count", "Worker count", "1"],
      ["port", "Port", "8000"],
    ],
  },
  flask: {
    title: "Flask runtime",
    fields: [
      ["python_version", "Python version", "3.11"],
      ["entry_point", "Entry point", "app:app"],
      ["worker_count", "Worker count", "1"],
      ["port", "Port", "5000"],
    ],
  },
  react: {
    title: "React build",
    fields: [
      ["node_version", "Node version", "20"],
      ["package_manager", "Package manager", "npm"],
      ["build_command", "Build command", "npm run build"],
      ["build_dir", "Build directory", "dist"],
      ["public_url_mode", "Public URL handling", "auto"],
      ["public_url", "Public URL", ""],
    ],
  },
  vuejs: {
    title: "Vue build",
    fields: [
      ["node_version", "Node version", "20"],
      ["package_manager", "Package manager", "npm"],
      ["build_command", "Build command", "npm run build"],
      ["build_dir", "Build directory", "dist"],
    ],
  },
  angular: {
    title: "Angular build",
    fields: [
      ["node_version", "Node version", "20"],
      ["package_manager", "Package manager", "npm"],
      ["build_command", "Build command", "npm run build"],
      ["build_dir", "Build directory", "dist"],
    ],
  },
  nextjs: {
    title: "Next.js runtime",
    fields: [
      ["node_version", "Node version", "20"],
      ["package_manager", "Package manager", "npm"],
      ["port", "Port", "3000"],
      ["start_command", "Start command", "npm start"],
    ],
  },
  nodejs: {
    title: "Node.js runtime",
    fields: [
      ["node_version", "Node version", "20"],
      ["package_manager", "Package manager", "npm"],
      ["port", "Port", "3000"],
      ["start_command", "Start command", "npm start"],
    ],
  },
  go: {
    title: "Go runtime",
    fields: [
      ["go_version", "Go version", "1.21"],
      ["port", "Port", "8080"],
    ],
  },
  dotnet: {
    title: ".NET runtime",
    fields: [
      ["dotnet_version", ".NET version", "8.0"],
      ["port", "Port", "5000"],
      ["start_command", "Start command", ""],
    ],
  },
  docker: {
    title: "Docker runtime",
    fields: [
      ["port", "Port", "80"],
      ["start_command", "Start command", ""],
    ],
  },
};

const COMMON_FIELDS = [
  ["port", "Port", ""],
  ["healthcheck_path", "Health check path", "/"],
  ["working_dir", "Working directory", ""],
];

function normalizeValue(value) {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function readConfig(text) {
  const parsed = parseDeployConfig(text);
  return parsed && typeof parsed === "object" ? parsed : {};
}

function toOutputObject(config) {
  const next = {};
  Object.entries(config || {}).forEach(([key, value]) => {
    if (value === "" || value == null) return;
    next[key] = value;
  });
  return next;
}

function detectInitialFields(config, metaFields = []) {
  const seen = new Set();
  const rows = [];
  [...metaFields, ...COMMON_FIELDS].forEach(([key]) => {
    if (seen.has(key)) return;
    if (!(key in config)) return;
    seen.add(key);
    rows.push(key);
  });
  return rows;
}

function ConfigField({ field, config, updateField, removeField }) {
  const [key, label, placeholder] = field;
  const value = config[key];
  const isSelect = ["public_url_mode", "server_type", "package_manager"].includes(key);
  const options = key === "public_url_mode" ? ["auto", "disabled", "custom"]
    : key === "server_type" ? ["gunicorn", "uvicorn", "uwsgi", "daphne"]
    : ["npm", "yarn", "pnpm"];

  return (
    <Grid item xs={12} md={6} key={key}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          fullWidth
          size="small"
          label={label}
          placeholder={placeholder || undefined}
          select={isSelect}
          value={normalizeValue(value)}
          onChange={(e) => updateField(key, e.target.value)}
          helperText={key === "public_url_mode" ? "Controls only automatic public/asset URL generation." : undefined}
        >
          {isSelect && options.map((option) => <MenuItem value={option} key={option}>{option}</MenuItem>)}
        </TextField>
        <Tooltip title="Remove this setting">
          <IconButton size="small" onClick={() => removeField(key)} sx={{ mt: 0.5 }}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Grid>
  );
}

export default function ConfigBuilder({
  platform = "docker",
  configText,
  onChange,
  inspectResult = null,
  disabled = false,
}) {
  const config = useMemo(() => readConfig(configText), [configText]);
  const meta = PLATFORM_META[platform] || {
    title: `${platform || "Docker"} configuration`,
    fields: [],
  };

  const inferredFields = useMemo(() => {
    const configured = detectInitialFields(config, meta.fields);
    const excluded = new Set([
      "platform", "env", "frontend", "celery", "celery_beat", "celery-beat",
    ]);
    const extras = Object.keys(config).filter((key) => !excluded.has(key) && !configured.includes(key));
    return [...configured, ...extras];
  }, [config, meta.fields]);

  const updateConfig = (updater) => {
    const next = typeof updater === "function" ? updater({ ...config }) : updater;
    if (next.platform == null) next.platform = platform || "docker";
    onChange(JSON.stringify(toOutputObject(next), null, 2));
  };

  const updateField = (key, value) => {
    updateConfig((next) => ({ ...next, [key]: value }));
  };

  const removeField = (key) => {
    updateConfig((next) => {
      delete next[key];
      return next;
    });
  };

  const env = config.env && typeof config.env === "object" && !Array.isArray(config.env) ? config.env : {};
  const envRows = Object.entries(env).map(([key, value]) => ({ key, value: normalizeValue(value) }));
  const updateEnv = (rows) => updateConfig((next) => ({ ...next, env: Object.fromEntries(rows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value])) }));

  const addEnv = () => updateEnv([...envRows, { key: "", value: "" }]);
  const removeEnv = (index) => updateEnv(envRows.filter((_, i) => i !== index));
  const patchEnv = (index, patch) => updateEnv(envRows.map((row, i) => i === index ? { ...row, ...patch } : row));

  const suggested = inspectResult?.suggested_config || null;
  const applyDetected = () => {
    if (!suggested || typeof suggested !== "object") return;
    const merged = { ...config, ...suggested, platform: platform || suggested.platform || config.platform || "docker" };
    onChange(JSON.stringify(toOutputObject(merged), null, 2));
  };

  return (
    <Stack spacing={1.5}>
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: "background.paper" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{meta.title}</Typography>
              <Chip size="small" label={platform || "docker"} color="primary" variant="outlined" />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Configure only what you need. Everything else stays automatic.
            </Typography>
          </Box>
          {suggested && (
            <Button size="small" variant="outlined" startIcon={<AutoFixHighIcon />} onClick={applyDetected} disabled={disabled} sx={{ textTransform: "none", borderRadius: 1.5 }}>
              Apply detected values
            </Button>
          )}
        </Stack>
      </Paper>

      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box>
            <Typography sx={{ fontWeight: 750 }}>Runtime & build</Typography>
            <Typography variant="caption" color="text.secondary">Version, ports, build/output and platform-specific settings</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={1.5}>
            {(inferredFields.length ? inferredFields : meta.fields.map((item) => item[0])).map((key) => {
              const metaField = meta.fields.find((item) => item[0] === key) || COMMON_FIELDS.find((item) => item[0] === key) || [key, key.replace(/_/g, " "), ""];
              return <ConfigField key={key} field={metaField} config={config} updateField={updateField} removeField={removeField} />;
            })}
            {inferredFields.length === 0 && (
              <Grid item xs={12}><Typography variant="body2" color="text.secondary">No optional settings detected for this platform.</Typography></Grid>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box>
            <Typography sx={{ fontWeight: 750 }}>Environment variables</Typography>
            <Typography variant="caption" color="text.secondary">Add key/value pairs with no JSON syntax. Values are shown as plain text.</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.25}>
            {envRows.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No environment variables yet.</Typography>
            ) : envRows.map((row, index) => (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} key={`${index}-${row.key}`} alignItems="center">
                <TextField size="small" fullWidth label="Variable" value={row.key} onChange={(e) => patchEnv(index, { key: e.target.value })} />
                <TextField size="small" fullWidth label="Value" value={row.value} onChange={(e) => patchEnv(index, { value: e.target.value })} />
                <IconButton onClick={() => removeEnv(index)} color="error"><DeleteOutlineIcon /></IconButton>
              </Stack>
            ))}
            <Box>
              <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={addEnv} disabled={disabled} sx={{ textTransform: "none", borderRadius: 1.5 }}>
                Add variable
              </Button>
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {(platform === "django" || platform === "python" || platform === "flask") && (
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box>
              <Typography sx={{ fontWeight: 750 }}>Workers & jobs</Typography>
              <Typography variant="caption" color="text.secondary">Enable optional background services without editing JSON</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControlLabel control={<Checkbox checked={Boolean(config.celery)} onChange={(e) => updateField("celery", e.target.checked)} />} label="Celery worker" />
              <FormControlLabel control={<Checkbox checked={Boolean(config.celery_beat)} onChange={(e) => updateField("celery_beat", e.target.checked)} />} label="Celery Beat" />
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}

      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box>
            <Typography sx={{ fontWeight: 750 }}>Advanced settings</Typography>
            <Typography variant="caption" color="text.secondary">Only use this for supported documented keys; automation remains enabled for everything else.</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.25}>
            {Object.keys(config).filter((key) => key !== "platform" && key !== "env" && !inferredFields.includes(key)).length === 0 ? (
              <Typography variant="body2" color="text.secondary">No additional settings.</Typography>
            ) : Object.entries(config).filter(([key]) => key !== "platform" && key !== "env" && !inferredFields.includes(key)).map(([key, value]) => (
              <Stack direction="row" spacing={1} alignItems="center" key={key}>
                <TextField size="small" fullWidth label={key.replace(/_/g, " ")} value={normalizeValue(value)} onChange={(e) => updateField(key, e.target.value)} />
                <IconButton onClick={() => removeField(key)} color="error"><DeleteOutlineIcon /></IconButton>
              </Stack>
            ))}
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Divider />
      <Typography variant="caption" color="text.secondary">
        Changes are serialized automatically when you save. No raw JSON editing is required.
      </Typography>
    </Stack>
  );
}
