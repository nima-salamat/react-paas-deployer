import React, { useMemo, useState, useEffect } from "react";
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

/**
 * Platform field catalog.
 * Keys must match the backend tenant config contract
 * (deployments/common/config.py TENANT_CONFIG_KEYS).
 *
 * Intentionally excluded from editable UI:
 *   - worker_count  → server-owned (derived from plan CPU/RAM)
 *   - resource_*    → blocked by sanitize_tenant_config
 */
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
      ["install_command", "Install command", "composer install --no-dev --optimize-autoloader"],
      ["front_build_platform", "Frontend build kind", "vite"],
      ["package_manager", "Package manager", "npm"],
      ["build_command", "Frontend build command", "npm run build"],
      ["db_connection", "DB connection", "sqlite"],
      ["working_directory", "Working directory", "/var/www/html"],
      ["start_command", "Start command override", ""],
    ],
  },
  php: {
    title: "PHP runtime",
    fields: [
      ["php_version", "PHP version", "8.4"],
      ["document_root", "Document root", "public"],
      ["port", "Port", "80"],
      ["install_command", "Install command", "composer install --no-dev"],
      ["working_directory", "Working directory", "/var/www/html"],
      ["start_command", "Start command override", ""],
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
      ["install_command", "Install command", "pip install -r requirements.txt"],
      ["working_directory", "Working directory", "/app"],
      ["port", "Port", "8000"],
      ["start_command", "Start command override", ""],
      ["celery_app", "Celery app module", ""],
    ],
  },
  python: {
    title: "Python runtime",
    fields: [
      ["python_version", "Python version", "3.11"],
      ["entry_point", "Entry point", ""],
      ["install_command", "Install command", "pip install -r requirements.txt"],
      ["working_directory", "Working directory", "/app"],
      ["port", "Port", "8000"],
      ["start_command", "Start command override", ""],
      ["celery_app", "Celery app module", ""],
    ],
  },
  flask: {
    title: "Flask runtime",
    fields: [
      ["python_version", "Python version", "3.11"],
      ["entry_point", "Entry point", "app:app"],
      ["install_command", "Install command", "pip install -r requirements.txt"],
      ["working_directory", "Working directory", "/app"],
      ["port", "Port", "5000"],
      ["start_command", "Start command override", ""],
      ["celery_app", "Celery app module", ""],
    ],
  },
  fastapi: {
    title: "FastAPI runtime",
    fields: [
      ["python_version", "Python version", "3.11"],
      ["entry_point", "Entry point", "main:app"],
      ["server_type", "Server type", "uvicorn"],
      ["install_command", "Install command", "pip install -r requirements.txt"],
      ["working_directory", "Working directory", "/app"],
      ["port", "Port", "8000"],
      ["start_command", "Start command override", ""],
    ],
  },
  react: {
    title: "React build",
    fields: [
      ["node_version", "Node version", "20"],
      ["package_manager", "Package manager", "npm"],
      ["install_command", "Install command", ""],
      ["build_command", "Build command", "npm run build"],
      ["build_dir", "Build directory", "dist"],
      ["public_url_mode", "Public URL handling", "auto"],
      ["public_url", "Public URL", ""],
      ["static_dir", "Static directory", "dist"],
    ],
  },
  vuejs: {
    title: "Vue build",
    fields: [
      ["node_version", "Node version", "20"],
      ["package_manager", "Package manager", "npm"],
      ["install_command", "Install command", ""],
      ["build_command", "Build command", "npm run build"],
      ["build_dir", "Build directory", "dist"],
      ["static_dir", "Static directory", "dist"],
      ["public_url_mode", "Public URL handling", "auto"],
      ["public_url", "Public URL", ""],
    ],
  },
  angular: {
    title: "Angular build",
    fields: [
      ["node_version", "Node version", "20"],
      ["package_manager", "Package manager", "npm"],
      ["install_command", "Install command", ""],
      ["build_command", "Build command", "npm run build"],
      ["build_dir", "Build directory", "dist"],
      ["static_dir", "Static directory", "dist"],
      ["public_url_mode", "Public URL handling", "auto"],
      ["public_url", "Public URL", ""],
    ],
  },
  nextjs: {
    title: "Next.js runtime",
    fields: [
      ["node_version", "Node version", "20"],
      ["package_manager", "Package manager", "npm"],
      ["install_command", "Install command", ""],
      ["build_command", "Build command", "npm run build"],
      ["port", "Port", "3000"],
      ["start_command", "Start command", "npm start"],
      ["working_directory", "Working directory", "/app"],
    ],
  },
  nodejs: {
    title: "Node.js runtime",
    fields: [
      ["node_version", "Node version", "20"],
      ["package_manager", "Package manager", "npm"],
      ["install_command", "Install command", ""],
      ["port", "Port", "3000"],
      ["start_command", "Start command", "npm start"],
      ["working_directory", "Working directory", "/app"],
      ["entry_point", "Entry point", ""],
    ],
  },
  go: {
    title: "Go runtime",
    fields: [
      ["go_version", "Go version", "1.21"],
      ["port", "Port", "8080"],
      ["build_command", "Build command", ""],
      ["start_command", "Start command", ""],
      ["working_directory", "Working directory", "/app"],
    ],
  },
  dotnet: {
    title: ".NET runtime",
    fields: [
      ["dotnet_version", ".NET version", "8.0"],
      ["port", "Port", "5000"],
      ["start_command", "Start command", ""],
      ["working_directory", "Working directory", "/app"],
    ],
  },
  statichtmlcss: {
    title: "Static site",
    fields: [
      ["static_dir", "Static directory", "."],
      ["public_url_mode", "Public URL handling", "auto"],
      ["public_url", "Public URL", ""],
      ["port", "Port", "80"],
    ],
  },
  docker: {
    title: "Docker runtime",
    fields: [
      ["port", "Port", "80"],
      ["start_command", "Start command", ""],
      ["working_directory", "Working directory", "/app"],
      ["entry_point", "Entry point", ""],
    ],
  },
};

const COMMON_FIELDS = [
  ["port", "Port", ""],
  ["healthcheck_path", "Health check path", "/"],
  ["working_directory", "Working directory", ""],
  ["install_command", "Install command", ""],
  ["start_command", "Start command", ""],
  ["entry_point", "Entry point", ""],
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

/**
 * Normalize aliases before serializing so backend always sees canonical keys.
 */
function toOutputObject(config) {
  const next = {};
  Object.entries(config || {}).forEach(([key, value]) => {
    if (value === "" || value == null) return;
    next[key] = value;
  });

  // working_dir → working_directory
  if (
    (next.working_directory == null || next.working_directory === "") &&
    next.working_dir != null &&
    next.working_dir !== ""
  ) {
    next.working_directory = next.working_dir;
  }
  delete next.working_dir;

  // celery-beat → celery_beat
  if (next["celery-beat"] != null && next.celery_beat == null) {
    next.celery_beat = Boolean(next["celery-beat"]);
  }
  delete next["celery-beat"];

  // celery_module → celery_app
  if (
    (next.celery_app == null || next.celery_app === "") &&
    next.celery_module
  ) {
    next.celery_app = next.celery_module;
  }

  // public_url_mode → url_handling.mode (backend also normalizes this)
  if (next.public_url_mode) {
    const uh =
      next.url_handling && typeof next.url_handling === "object"
        ? { ...next.url_handling }
        : {};
    if (!uh.mode) uh.mode = String(next.public_url_mode).toLowerCase();
    if (next.public_url && !uh.public_url) uh.public_url = next.public_url;
    if (next.asset_url && !uh.asset_url) uh.asset_url = next.asset_url;
    next.url_handling = uh;
  }

  // django_settings_module → env.DJANGO_SETTINGS_MODULE
  if (next.django_settings_module) {
    const env =
      next.env && typeof next.env === "object" && !Array.isArray(next.env)
        ? { ...next.env }
        : {};
    if (!env.DJANGO_SETTINGS_MODULE) {
      env.DJANGO_SETTINGS_MODULE = String(next.django_settings_module).trim();
    }
    next.env = env;
  }

  // worker_count is server-owned — never persist from UI
  delete next.worker_count;

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

function ConfigField({ field, config, updateField, removeField, disabled = false }) {
  const [key, label, placeholder] = field;
  const value = config[key];
  const isSelect = [
    "public_url_mode",
    "server_type",
    "package_manager",
    "front_build_platform",
    "db_connection",
  ].includes(key);

  const options =
    key === "public_url_mode"
      ? ["auto", "disabled", "custom"]
      : key === "server_type"
        ? ["gunicorn", "uvicorn", "uwsgi", "daphne", "asgi", "wsgi"]
        : key === "package_manager"
          ? ["npm", "yarn", "pnpm", "bun"]
          : key === "front_build_platform"
            ? ["vite", "react", "mix", "nextjs", "nuxt", "node"]
            : key === "db_connection"
              ? ["sqlite", "mysql", "pgsql", "sqlsrv"]
              : [];

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
          disabled={disabled}
          helperText={
            key === "public_url_mode"
              ? "Controls only automatic public/asset URL generation."
              : key === "celery_app"
                ? "Dotted path, e.g. myproject.celery"
                : key === "install_command"
                  ? "Override auto install (composer/pip/npm)."
                  : key === "django_settings_module"
                    ? "Also sets DJANGO_SETTINGS_MODULE in env."
                    : undefined
          }
        >
          {isSelect &&
            options.map((option) => (
              <MenuItem value={option} key={option}>
                {option}
              </MenuItem>
            ))}
        </TextField>
        <Tooltip title="Remove this setting">
          <IconButton
            size="small"
            onClick={() => removeField(key)}
            disabled={disabled}
            sx={{ mt: 0.5 }}
          >
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
      "platform",
      "env",
      "frontend",
      "celery",
      "celery_beat",
      "celery-beat",
      "worker_count",
      "url_handling",
    ]);
    const extras = Object.keys(config).filter(
      (key) => !excluded.has(key) && !configured.includes(key)
    );
    const metaKeys = meta.fields.map((f) => f[0]);
    const ordered = [];
    const seen = new Set();
    for (const k of configured) {
      if (!seen.has(k)) {
        ordered.push(k);
        seen.add(k);
      }
    }
    for (const k of [
      "install_command",
      "start_command",
      "entry_point",
      "celery_app",
      "working_directory",
      "django_settings_module",
    ]) {
      if (metaKeys.includes(k) && !seen.has(k)) {
        ordered.push(k);
        seen.add(k);
      }
    }
    for (const k of extras) {
      if (!seen.has(k)) {
        ordered.push(k);
        seen.add(k);
      }
    }
    return ordered;
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

  const suggested = inspectResult?.suggested_config || null;
  const applyDetected = () => {
    if (!suggested || typeof suggested !== "object") return;
    const merged = {
      ...config,
      ...suggested,
      platform: platform || suggested.platform || config.platform || "docker",
    };
    onChange(JSON.stringify(toOutputObject(merged), null, 2));
  };

  const envFromConfig =
    config.env && typeof config.env === "object" && !Array.isArray(config.env)
      ? config.env
      : {};

  const [envRows, setEnvRows] = useState(() =>
    Object.entries(envFromConfig).map(([key, value]) => ({
      key,
      value: normalizeValue(value),
    }))
  );

  useEffect(() => {
    const next = Object.entries(envFromConfig).map(([key, value]) => ({
      key,
      value: normalizeValue(value),
    }));
    setEnvRows((prev) => {
      const prevSerialized = JSON.stringify(
        Object.fromEntries(
          prev.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value])
        )
      );
      const nextSerialized = JSON.stringify(envFromConfig);
      if (prevSerialized === nextSerialized) {
        const emptyDrafts = prev.filter((r) => !r.key.trim());
        return [...next, ...emptyDrafts];
      }
      return next;
    });
  }, [configText]); // eslint-disable-line react-hooks/exhaustive-deps

  const commitEnvRows = (rows) => {
    setEnvRows(rows);
    const envObj = Object.fromEntries(
      rows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value])
    );
    updateConfig((next) => {
      const out = { ...next };
      if (Object.keys(envObj).length === 0) {
        delete out.env;
      } else {
        out.env = envObj;
      }
      return out;
    });
  };

  const addEnv = () => commitEnvRows([...envRows, { key: "", value: "" }]);
  const removeEnv = (index) =>
    commitEnvRows(envRows.filter((_, i) => i !== index));
  const patchEnv = (index, patch) =>
    commitEnvRows(
      envRows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );

  const showCelery =
    platform === "django" ||
    platform === "python" ||
    platform === "flask" ||
    platform === "fastapi";

  return (
    <Stack spacing={1.5}>
      <Paper
        variant="outlined"
        sx={{ p: 1.5, borderRadius: 2, bgcolor: "background.paper" }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                {meta.title}
              </Typography>
              <Chip
                size="small"
                label={platform || "docker"}
                color="primary"
                variant="outlined"
              />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Configure only what you need. Everything else stays automatic.
            </Typography>
          </Box>
          {suggested && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<AutoFixHighIcon />}
              onClick={applyDetected}
              disabled={disabled}
              sx={{ textTransform: "none", borderRadius: 1.5 }}
            >
              Apply detected values
            </Button>
          )}
        </Stack>
      </Paper>

      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box>
            <Typography sx={{ fontWeight: 750 }}>Runtime & build</Typography>
            <Typography variant="caption" color="text.secondary">
              Version, ports, install/build commands and platform settings
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={1.5}>
            {(inferredFields.length
              ? inferredFields
              : meta.fields.map((item) => item[0])
            ).map((key) => {
              const metaField =
                meta.fields.find((item) => item[0] === key) ||
                COMMON_FIELDS.find((item) => item[0] === key) || [
                  key,
                  key.replace(/_/g, " "),
                  "",
                ];
              return (
                <ConfigField
                  key={key}
                  field={metaField}
                  config={config}
                  updateField={updateField}
                  removeField={removeField}
                  disabled={disabled}
                />
              );
            })}
            {inferredFields.length === 0 && meta.fields.length === 0 && (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  No optional settings detected for this platform.
                </Typography>
              </Grid>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box>
            <Typography sx={{ fontWeight: 750 }}>
              Environment variables
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Add key/value pairs with no JSON syntax. Values are shown as plain
              text.
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.25}>
            {envRows.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No environment variables yet.
              </Typography>
            ) : (
              envRows.map((row, index) => (
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  key={`env-${index}`}
                  alignItems="center"
                >
                  <TextField
                    size="small"
                    fullWidth
                    label="Variable"
                    value={row.key}
                    onChange={(e) =>
                      patchEnv(index, { key: e.target.value })
                    }
                    disabled={disabled}
                  />
                  <TextField
                    size="small"
                    fullWidth
                    label="Value"
                    value={row.value}
                    onChange={(e) =>
                      patchEnv(index, { value: e.target.value })
                    }
                    disabled={disabled}
                  />
                  <IconButton
                    onClick={() => removeEnv(index)}
                    color="error"
                    disabled={disabled}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
              ))
            )}
            <Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={addEnv}
                disabled={disabled}
                sx={{ textTransform: "none", borderRadius: 1.5 }}
              >
                Add variable
              </Button>
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {showCelery && (
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box>
              <Typography sx={{ fontWeight: 750 }}>Workers & jobs</Typography>
              <Typography variant="caption" color="text.secondary">
                Optional background processes (Celery). Set celery_app above if
                needed.
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={Boolean(config.celery)}
                    onChange={(e) => updateField("celery", e.target.checked)}
                    disabled={disabled}
                  />
                }
                label="Celery worker"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={Boolean(config.celery_beat)}
                    onChange={(e) =>
                      updateField("celery_beat", e.target.checked)
                    }
                    disabled={disabled || !config.celery}
                  />
                }
                label="Celery Beat"
              />
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}

      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box>
            <Typography sx={{ fontWeight: 750 }}>Advanced settings</Typography>
            <Typography variant="caption" color="text.secondary">
              Extra keys from inspect or custom overrides. Worker count is set
              by the plan automatically.
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.25}>
            {Object.keys(config).filter(
              (key) =>
                key !== "platform" &&
                key !== "env" &&
                key !== "worker_count" &&
                !inferredFields.includes(key)
            ).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No additional settings.
              </Typography>
            ) : (
              Object.entries(config)
                .filter(
                  ([key]) =>
                    key !== "platform" &&
                    key !== "env" &&
                    key !== "worker_count" &&
                    !inferredFields.includes(key)
                )
                .map(([key, value]) => (
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    key={key}
                  >
                    <TextField
                      size="small"
                      fullWidth
                      label={key.replace(/_/g, " ")}
                      value={normalizeValue(value)}
                      onChange={(e) => updateField(key, e.target.value)}
                      disabled={disabled}
                    />
                    <IconButton
                      onClick={() => removeField(key)}
                      color="error"
                      disabled={disabled}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Stack>
                ))
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Divider />
      <Typography variant="caption" color="text.secondary">
        Changes are serialized automatically when you save. No raw JSON editing
        is required.
      </Typography>
    </Stack>
  );
}
