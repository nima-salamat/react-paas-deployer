import React, { useState, useCallback } from "react";
import {
  Paper,
  Typography,
  Box,
  Stack,
  Chip,
  Button,
  TextField,
  Alert,
  Divider,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import DeployCard from "./DeployCard";
import {
  isDbPlatform,
  generateDbCredentials,
  buildDjangoConfigSuggestion,
} from "../utils";
import { DEPLOY_BASE } from "../constants";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import SearchIcon from "@mui/icons-material/Search";
import axios from "axios";

export default function CreateDeployPanel({
  formState,
  formActions,
  editState,
  editActions,
  deployState,
  deployActions,
  deployPermissions: deployPermissionsProp = null,
  isServiceOwner: isServiceOwnerProp = true,
  meId: meIdProp = null,
  planPlatform,
  planCpu,
  planRam,
  service,
  error,
}) {
  const {
    name,
    version,
    config,
    zipFile,
    createPlatform,
    createDbFields,
    submitting,
    zipInputRef,
  } = formState;
  const {
    setName,
    setVersion,
    setConfig,
    setZipFile,
    setCreatePlatform,
    setCreateDbFields,
    handleCreate,
  } = formActions;

  const {
    editingDeployId,
    editData,
    editDbFields,
    editOriginalName,
    editZipFile,
    editZipInputRef,
  } = editState;
  const {
    setEditData,
    setEditDbFields,
    setEditZipFile,
    handleUpdateDeploy,
    handleCancelEdit,
  } = editActions;

  const { deploys, deploysLoading, pageInfo, selectedDeployId, actionState } =
    deployState;
  const {
    handleSelectDeploy,
    handleUnselectDeploy,
    handleEditClick,
    openConfirm,
    handlePrev,
    handleNext,
    handleDownloadZip,
  } = deployActions;
  const deployPermissions = deployPermissionsProp || {};
  const isServiceOwner = Boolean(isServiceOwnerProp);
  const meId = meIdProp;

  const effectivePlatform = planPlatform || createPlatform || "docker";
  const isDb = editingDeployId
    ? isDbPlatform(editData.platform || planPlatform || createPlatform)
    : isDbPlatform(effectivePlatform);

  // --- Fill automatically (DB credentials) ---
  // Generates a random, DB-safe set of credentials client-side (no API
  // round-trip — secrets never leave the browser) and fills them into
  // whichever field-set is active (create or edit).
  const [filling, setFilling] = useState(false);
  const handleFillAutomatically = useCallback(() => {
    const platform = editingDeployId
      ? (editData.platform || planPlatform || createPlatform || "")
      : effectivePlatform;
    const creds = generateDbCredentials(platform);
    setFilling(true);
    // Tiny delay so the spinner is visible (otherwise it flickers too fast).
    setTimeout(() => {
      if (editingDeployId) {
        setEditDbFields((f) => ({ ...f, ...creds }));
      } else {
        setCreateDbFields((f) => ({ ...f, ...creds }));
      }
      setFilling(false);
    }, 150);
  }, [editingDeployId, editData.platform, planPlatform, createPlatform, effectivePlatform, setEditDbFields, setCreateDbFields]);

  // --- Inspect & suggest config (Django JSON config helper) ---
  // Uploads the selected zip to /deploy/inspect_zip/ which reuses the
  // existing platform_bridge.enrich_config_from_project() to auto-detect
  // platform, server_type (WSGI/ASGI), entry_point, etc.  The returned
  // suggested_config is formatted as JSON and pasted into the config
  // textarea.  Only available for new deploys (not edit mode).
  const [inspecting, setInspecting] = useState(false);
  const [inspectResult, setInspectResult] = useState(null);
  const [inspectError, setInspectError] = useState(null);

  const handleInspectZip = useCallback(async () => {
    const file = zipFile;
    if (!file) return;
    setInspecting(true);
    setInspectError(null);
    setInspectResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // Plan resources → backend suggests worker_count from CPU/RAM.
      if (planCpu != null && planCpu !== "") fd.append("max_cpu", String(planCpu));
      if (planRam != null && planRam !== "") fd.append("max_ram", String(planRam));
      const access = localStorage.getItem("access");
      const headers = access ? { Authorization: `Bearer ${access}` } : {};
      const resp = await axios.post(`${DEPLOY_BASE}inspect_zip/`, fd, { headers });
      if (resp.data?.result === "success") {
        setInspectResult(resp.data);
      } else {
        setInspectError(resp.data?.detail || "Inspection failed.");
      }
    } catch (e) {
      setInspectError(e?.response?.data?.detail || e?.message || "Inspection failed.");
    } finally {
      setInspecting(false);
    }
  }, [zipFile, planCpu, planRam]);

  const handleApplySuggestedConfig = useCallback(() => {
    if (!inspectResult) return;
    const jsonStr = buildDjangoConfigSuggestion(inspectResult);
    if (jsonStr) setConfig(jsonStr);
  }, [inspectResult, setConfig]);

  const deploysGrid = (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
        },
        gap: { xs: 1.5, sm: 2 },
        maxWidth: 960,
      }}
    >
      {deploys.map((deploy) => {
        const isSelected =
          selectedDeployId !== "" &&
          String(selectedDeployId) === String(deploy.id);
        const cannotSelect =
          service &&
          ["queued", "deploying", "stopping"].includes(
            String(service.status)
          );

        return (
          <DeployCard
            key={deploy.id ?? deploy.pk}
            deploy={deploy}
            isSelected={isSelected}
            cannotSelect={cannotSelect}
            actionState={actionState[deploy.id] ?? {}}
            canSelect={isServiceOwner || !!deployPermissions.can_deploy_select}
            canEdit={
              isServiceOwner
              || !!deployPermissions.can_deploy_edit_others
              || (
                !!deployPermissions.can_deploy_edit
                && String(deploy.created_by ?? deploy.created_by_id ?? "") === String(meId ?? "")
              )
            }
            canDelete={
              isServiceOwner
              || !!deployPermissions.can_deploy_remove_others
              || (
                !!deployPermissions.can_deploy_remove
                && String(deploy.created_by ?? deploy.created_by_id ?? "") === String(meId ?? "")
              )
            }
            canDownload={isServiceOwner || !!deployPermissions.can_deploy_download}
            onEdit={handleEditClick}
            onSelect={handleSelectDeploy}
            onUnselect={handleUnselectDeploy}
            onDelete={(d) =>
              openConfirm(
                "delete",
                d.id,
                "Delete deploy",
                `Delete deploy "${d.name}"?`
              )
            }
            onDownload={handleDownloadZip}
          />
        );
      })}
    </Box>
  );

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 960 }}>
      {/* Create / Edit form */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: 2.5,
          border: "1px solid",
          borderColor: "divider",
          backgroundImage: (t) =>
            t.palette.mode === "dark"
              ? "linear-gradient(145deg, rgba(30,41,59,0.4), rgba(15,23,42,0.6))"
              : "linear-gradient(145deg, #ffffff, #f8fafc)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 1,
            flexWrap: "wrap",
            mb: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {editingDeployId ? (
              <EditIcon color="warning" fontSize="small" />
            ) : (
              <AddIcon color="primary" fontSize="small" />
            )}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                {editingDeployId ? "Edit deploy" : "Create deploy"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {editingDeployId
                  ? "Update name, version, config or package."
                  : "Fill the form and create a new deploy."}
              </Typography>
            </Box>
          </Box>
          <Chip
            label={editingDeployId ? "Editing" : "New"}
            color={editingDeployId ? "warning" : "primary"}
            size="small"
            sx={{ fontWeight: 700 }}
          />
        </Box>

        <Divider sx={{ mb: 2 }} />

        <Box
          component="form"
          className="create-deploy-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (editingDeployId) handleUpdateDeploy(editingDeployId);
            else handleCreate(e);
          }}
        >
          <TextField
            fullWidth
            label="Name"
            size="small"
            value={editingDeployId ? editData.name : name}
            onChange={(e) =>
              editingDeployId
                ? setEditData((d) => ({ ...d, name: e.target.value }))
                : setName(e.target.value)
            }
            helperText="At least 4 characters."
            sx={{ mb: 1.5 }}
          />

          <TextField
            fullWidth
            label="Version"
            size="small"
            value={editingDeployId ? editData.version : version}
            onChange={(e) =>
              editingDeployId
                ? setEditData((d) => ({ ...d, version: e.target.value }))
                : setVersion(e.target.value)
            }
            sx={{ mb: 1.5 }}
          />

          <Box sx={{ mb: 1.5 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 0.75, fontWeight: 600 }}
            >
              Platform (from service plan)
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
            >
              <Chip
                label={
                  (planPlatform || createPlatform || "docker") +
                  (isDbPlatform(planPlatform || createPlatform)
                    ? " · database"
                    : " · app")
                }
                color={
                  isDbPlatform(planPlatform || createPlatform)
                    ? "info"
                    : "default"
                }
                size="small"
                sx={{ fontWeight: 600 }}
              />
              {!planPlatform ? (
                <Typography variant="caption" color="warning.main">
                  Plan has no platform — defaulting to docker.
                </Typography>
              ) : null}
            </Stack>
          </Box>

          {isDb ? (
            <Box sx={{ mb: 1.5 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 1.25 }}
              >
                DB credentials (stored in deploy config). After changing a
                running DB, call Rebuild to apply — volumes/data are preserved.
              </Typography>

              {/* Fill automatically — generates a random, DB-safe username +
                  password + database name.  Saves the user from having to
                  invent secure credentials manually. */}
              <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
                <Tooltip title="Generate a random username, password, and database name. You can still edit them after.">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={filling ? <CircularProgress size={14} /> : <AutoFixHighIcon fontSize="small" />}
                    onClick={handleFillAutomatically}
                    disabled={filling}
                    sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 600 }}
                  >
                    Fill automatically
                  </Button>
                </Tooltip>
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 1.5,
                }}
              >
                {["username", "password", "root_password", "database", "port"].map(
                  (field) => {
                    const isPasswordField = field === "password" || field === "root_password";
                    const editing = Boolean(editingDeployId);
                    return (
                      <TextField
                        key={field}
                        fullWidth
                        size="small"
                        type={isPasswordField ? "password" : "text"}
                        label={field.replace(/_/g, " ")}
                        placeholder={
                          (isPasswordField && editing)
                            ? "Leave empty to keep current"
                            : ""
                        }
                        value={
                          editing
                            ? editDbFields[field] || ""
                            : createDbFields[field] || ""
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (editing) {
                            setEditDbFields((f) => ({ ...f, [field]: val }));
                          } else {
                            setCreateDbFields((f) => ({ ...f, [field]: val }));
                          }
                        }}
                      />
                    );
                  }
                )}
              </Box>
              <TextField
                fullWidth
                size="small"
                multiline
                rows={2}
                label="Extra env (JSON object)"
                sx={{ mt: 1.5 }}
                value={
                  editingDeployId
                    ? editDbFields.env || ""
                    : createDbFields.env || ""
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (editingDeployId)
                    setEditDbFields((f) => ({ ...f, env: val }));
                  else setCreateDbFields((f) => ({ ...f, env: val }));
                }}
              />
            </Box>
          ) : (
            <>
              <TextField
                fullWidth
                label="Config (JSON)"
                size="small"
                multiline
                rows={6}
                value={
                  editingDeployId
                    ? typeof editData.config === "object" &&
                      editData.config !== null
                      ? JSON.stringify(editData.config, null, 2)
                      : editData.config || ""
                    : config
                }
                onChange={(e) =>
                  editingDeployId
                    ? setEditData((d) => ({ ...d, config: e.target.value }))
                    : setConfig(e.target.value)
                }
                helperText='Optional JSON. "platform" is set automatically for app deploys.'
                sx={{ mb: 1.5 }}
              />

              <Box
                sx={{
                  display: "flex",
                  gap: 1.25,
                  alignItems: "center",
                  mb: 1.5,
                  flexWrap: "wrap",
                }}
              >
                {!editingDeployId ? (
                  <>
                    <Button
                      variant="outlined"
                      component="label"
                      size="small"
                      sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 600 }}
                    >
                      Choose .zip
                      <input
                        type="file"
                        hidden
                        accept=".zip"
                        ref={zipInputRef}
                        onChange={(e) => {
                          setZipFile(e.target.files?.[0] || null);
                          // Reset previous inspection result when a new file is picked.
                          setInspectResult(null);
                          setInspectError(null);
                        }}
                      />
                    </Button>
                    <Typography variant="body2" color="text.secondary">
                      {zipFile
                        ? `${zipFile.name} (${Math.round(zipFile.size / 1024)} KB)`
                        : "Required for app deploys"}
                    </Typography>
                    {/* Inspect & suggest config — uploads the zip to the
                        backend, which reuses platform_bridge to auto-detect
                        Django/Flask/Node/etc. and suggests a config JSON.
                        Only available for new deploys (not edit mode) and
                        only when a zip is selected. */}
                    {zipFile && (
                      <Tooltip title="Inspect the uploaded zip and auto-fill the config JSON based on detected framework (Django/Flask/Node/etc.).">
                        <Button
                          size="small"
                          variant="outlined"
                          color="secondary"
                          startIcon={inspecting ? <CircularProgress size={14} /> : <SearchIcon fontSize="small" />}
                          onClick={handleInspectZip}
                          disabled={inspecting}
                          sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 600 }}
                        >
                          {inspecting ? "Inspecting…" : "Inspect & suggest config"}
                        </Button>
                      </Tooltip>
                    )}
                  </>
                ) : (
                  <>
                    <Button
                      variant="outlined"
                      component="label"
                      size="small"
                      sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 600 }}
                    >
                      Replace .zip
                      <input
                        type="file"
                        hidden
                        accept=".zip"
                        ref={editZipInputRef}
                        onChange={(e) =>
                          setEditZipFile(e.target.files?.[0] || null)
                        }
                      />
                    </Button>
                    <Typography variant="body2" color="text.secondary">
                      {editZipFile
                        ? editZipFile.name
                        : "Optional — leave empty to keep current"}
                    </Typography>
                  </>
                )}
              </Box>

              {/* Inspect result banner — shows detected platform/framework
                  and offers to apply the suggested config JSON. */}
              {inspectError && (
                <Alert severity="warning" sx={{ mb: 1.5 }} onClose={() => setInspectError(null)}>
                  {inspectError}
                </Alert>
              )}
              {inspectResult && (
                <Alert
                  severity="success"
                  sx={{ mb: 1.5 }}
                  onClose={() => setInspectResult(null)}
                  action={
                    <Button
                      size="small"
                      color="inherit"
                      variant="outlined"
                      onClick={handleApplySuggestedConfig}
                      sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 600 }}
                    >
                      Apply suggested config
                    </Button>
                  }
                >
                  <Box component="div" sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Detected:
                    </Typography>
                    {inspectResult.platform && (
                      <Chip label={inspectResult.platform} size="small" color="primary" />
                    )}
                    {inspectResult.framework && (
                      <Chip label={inspectResult.framework} size="small" variant="outlined" />
                    )}
                    {inspectResult.server_type && (
                      <Chip label={inspectResult.server_type.toUpperCase()} size="small" variant="outlined" />
                    )}
                    {inspectResult.django_settings_module && (
                      <Chip label={inspectResult.django_settings_module} size="small" variant="outlined" />
                    )}
                  </Box>
                  {inspectResult.markers && inspectResult.markers.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                      Markers: {inspectResult.markers.join(", ")}
                    </Typography>
                  )}
                </Alert>
              )}
            </>
          )}

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            justifyContent="flex-end"
          >
            {!editingDeployId ? (
              <>
                <Button
                  variant="contained"
                  type="submit"
                  disabled={submitting}
                  sx={{
                    borderRadius: 1.5,
                    fontWeight: 700,
                    textTransform: "none",
                    px: 3,
                  }}
                >
                  {submitting ? "Submitting..." : "Create deploy"}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setName("");
                    setVersion("");
                    setConfig("");
                    setZipFile(null);
                    setCreatePlatform("docker");
                    setCreateDbFields({
                      root_password: "",
                      password: "",
                      username: "",
                      database: "",
                      port: "",
                      env: "",
                    });
                    if (zipInputRef.current) zipInputRef.current.value = "";
                  }}
                  sx={{
                    borderRadius: 1.5,
                    fontWeight: 600,
                    textTransform: "none",
                  }}
                >
                  Reset
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="contained"
                  onClick={() => handleUpdateDeploy(editingDeployId)}
                  disabled={actionState[editingDeployId]?.updating}
                  sx={{
                    borderRadius: 1.5,
                    fontWeight: 700,
                    textTransform: "none",
                    px: 3,
                  }}
                >
                  {actionState[editingDeployId]?.updating
                    ? "Updating..."
                    : "Update"}
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleCancelEdit}
                  sx={{
                    borderRadius: 1.5,
                    fontWeight: 600,
                    textTransform: "none",
                  }}
                >
                  Cancel edit
                </Button>
              </>
            )}
          </Stack>

          {error ? (
            <Alert severity="error" sx={{ mt: 2, borderRadius: 1.5 }}>
              {error}
            </Alert>
          ) : null}
        </Box>
      </Paper>

      {/* Deploys list */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: 2.5,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 1,
            flexWrap: "wrap",
            mb: 2,
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Deploys
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Latest deploys first.
            </Typography>
          </Box>
          <Chip
            label={
              deploysLoading
                ? "Loading..."
                : `${pageInfo.count ?? 0} total`
            }
            size="small"
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
        </Box>

        {deploysLoading ? (
          <Box sx={{ py: 5, textAlign: "center" }}>
            <Typography color="text.secondary">Loading deploys...</Typography>
          </Box>
        ) : deploys.length === 0 ? (
          <Box sx={{ py: 5, textAlign: "center" }}>
            <Typography color="text.secondary">
              No deploys found for this service.
            </Typography>
          </Box>
        ) : (
          deploysGrid
        )}

        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            gap: 1.5,
            mt: 2.5,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Button
            onClick={handlePrev}
            disabled={!pageInfo.previous}
            size="small"
            variant="outlined"
            sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 600 }}
          >
            Prev
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            Page {pageInfo.page} — {pageInfo.count} total
          </Typography>
          <Button
            onClick={handleNext}
            disabled={!pageInfo.next}
            size="small"
            variant="outlined"
            sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 600 }}
          >
            Next
          </Button>
        </Box>
      </Paper>
    </Stack>
  );
}