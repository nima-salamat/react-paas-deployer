import React from "react";
import { Paper, Typography, Box, Stack, Chip, Button, TextField, Alert } from "@mui/material";
import DeployCard from "./DeployCard";
import { isDbPlatform } from "../utils";

export default function CreateDeployPanel({
  formState,
  formActions,
  editState,
  editActions,
  deployState,
  deployActions,
  planPlatform,
  service,
  error,
}) {
  const { name, version, config, zipFile, createPlatform, createDbFields, submitting, zipInputRef } = formState;
  const { setName, setVersion, setConfig, setZipFile, setCreatePlatform, setCreateDbFields, handleCreate } = formActions;
  
  const { editingDeployId, editData, editDbFields, editOriginalName, editZipFile, editZipInputRef } = editState;
  const { setEditData, setEditDbFields, setEditZipFile, handleUpdateDeploy, handleCancelEdit } = editActions;

  const { deploys, deploysLoading, pageInfo, selectedDeployId, actionState } = deployState;
  const { handleSelectDeploy, handleUnselectDeploy, handleEditClick, openConfirm, handlePrev, handleNext } = deployActions;

  const deploysGrid = (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
        },
        gap: { xs: 1.25, sm: 1.75 },
        maxWidth: 960,
      }}
    >
      {deploys.map((deploy) => {
        const isSelected = selectedDeployId !== "" && String(selectedDeployId) === String(deploy.id);
        const cannotSelect = service && ["queued", "deploying", "stopping"].includes(String(service.status));

        return (
          <DeployCard
            key={deploy.id ?? deploy.pk}
            deploy={deploy}
            isSelected={isSelected}
            cannotSelect={cannotSelect}
            actionState={actionState[deploy.id] ?? {}}
            onEdit={handleEditClick}
            onSelect={handleSelectDeploy}
            onUnselect={handleUnselectDeploy}
            onDelete={(d) => openConfirm("delete", d.id, "Delete deploy", `Delete deploy "${d.name}"?`)}
          />
        );
      })}
    </Box>
  );

  return (
    <Stack spacing={{ xs: 1.5, sm: 2 }} sx={{ maxWidth: 960 }}>
      <Paper elevation={1} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: 3 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {editingDeployId ? "Edit deploy" : "Create deploy"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Keep the form simple, clear, and fast.
            </Typography>
          </Box>
          <Chip label={editingDeployId ? "Editing mode" : "New deploy"} color={editingDeployId ? "warning" : "primary"} size="small" />
        </Box>

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
            onChange={(e) => editingDeployId ? setEditData((d) => ({ ...d, name: e.target.value })) : setName(e.target.value)}
            helperText="At least 4 characters."
            sx={{ mb: 1.25 }}
          />

          <TextField
            fullWidth
            label="Version"
            size="small"
            value={editingDeployId ? editData.version : version}
            onChange={(e) => editingDeployId ? setEditData((d) => ({ ...d, version: e.target.value })) : setVersion(e.target.value)}
            sx={{ mb: 1.25 }}
          />

          <Box sx={{ mb: 1.25 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
              Platform (from service plan)
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip
                label={(planPlatform || createPlatform || "docker") + (isDbPlatform(planPlatform || createPlatform) ? " · database" : " · app")}
                color={isDbPlatform(planPlatform || createPlatform) ? "info" : "default"}
                size="small"
              />
              {!planPlatform ? (
                <Typography variant="caption" color="warning.main">
                  Plan has no platform — defaulting to docker. Assign a plan on the service.
                </Typography>
              ) : null}
            </Stack>
          </Box>

          {(editingDeployId ? isDbPlatform(editData.platform || planPlatform || createPlatform) : isDbPlatform(planPlatform || createPlatform)) ? (
            <Box sx={{ mb: 1.25 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                DB credentials (stored in deploy config). After changing a running DB, call Rebuild to apply — volumes/data are preserved.
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.25 }}>
                {["username", "password", "root_password", "database", "port"].map((field) => (
                  <TextField
                    key={field}
                    fullWidth
                    size="small"
                    type={field.includes("password") ? "password" : "text"}
                    label={field.replace(/_/g, " ")}
                    value={editingDeployId ? editDbFields[field] || "" : createDbFields[field] || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (editingDeployId) {
                        setEditDbFields((f) => ({ ...f, [field]: val }));
                      } else {
                        setCreateDbFields((f) => ({ ...f, [field]: val }));
                      }
                    }}
                  />
                ))}
              </Box>
              <TextField
                fullWidth
                size="small"
                multiline
                rows={2}
                label="Extra env (JSON object)"
                sx={{ mt: 1.25 }}
                value={editingDeployId ? editDbFields.env || "" : createDbFields.env || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (editingDeployId) setEditDbFields((f) => ({ ...f, env: val }));
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
                rows={4}
                value={editingDeployId ? editData.config : config}
                onChange={(e) => editingDeployId ? setEditData((d) => ({ ...d, config: e.target.value })) : setConfig(e.target.value)}
                helperText='Optional JSON. "platform" is set automatically for app deploys.'
                sx={{ mb: 1.25 }}
              />

              <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1.25, flexWrap: "wrap" }}>
                {!editingDeployId ? (
                  <>
                    <Button variant="outlined" component="label" size="small">
                      Choose .zip
                      <input type="file" hidden accept=".zip" ref={zipInputRef} onChange={(e) => setZipFile(e.target.files?.[0] || null)} />
                    </Button>
                    <Typography variant="body2" color="text.secondary">
                      {zipFile ? `${zipFile.name} (${Math.round(zipFile.size / 1024)} KB)` : "Required for app deploys"}
                    </Typography>
                  </>
                ) : (
                  <>
                    <Button variant="outlined" component="label" size="small">
                      Replace .zip
                      <input type="file" hidden accept=".zip" ref={editZipInputRef} onChange={(e) => setEditZipFile(e.target.files?.[0] || null)} />
                    </Button>
                    <Typography variant="body2" color="text.secondary">
                      {editZipFile ? editZipFile.name : "Optional — leave empty to keep current"}
                    </Typography>
                  </>
                )}
              </Box>
            </>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end">
            {!editingDeployId ? (
              <>
                <Button variant="contained" type="submit" disabled={submitting}>
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
                    setCreateDbFields({ root_password: "", password: "", username: "", database: "", port: "", env: "" });
                    if (zipInputRef.current) zipInputRef.current.value = "";
                  }}
                >
                  Reset
                </Button>
              </>
            ) : (
              <>
                <Button variant="contained" onClick={() => handleUpdateDeploy(editingDeployId)} disabled={actionState[editingDeployId]?.updating}>
                  {actionState[editingDeployId]?.updating ? "Updating..." : "Update"}
                </Button>
                <Button variant="outlined" color="error" onClick={handleCancelEdit}>
                  Cancel edit
                </Button>
              </>
            )}
          </Stack>

          {error ? (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              {error}
            </Alert>
          ) : null}
        </Box>
      </Paper>

      <Paper elevation={1} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: 3 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Deploys
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Latest deploys first.
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {deploysLoading ? "Loading..." : `${pageInfo.count ?? 0} total`}
          </Typography>
        </Box>

        {deploysLoading ? (
          <Box sx={{ py: 4 }}>
            <Typography>Loading...</Typography>
          </Box>
        ) : deploys.length === 0 ? (
          <Typography color="text.secondary">No deploys found for this service.</Typography>
        ) : (
          deploysGrid
        )}

        <Box sx={{ display: "flex", justifyContent: "center", gap: 1, mt: 2, flexWrap: "wrap" }}>
          <Button onClick={handlePrev} disabled={!pageInfo.previous}>Prev</Button>
          <Typography variant="body2" sx={{ alignSelf: "center" }}>
            Page {pageInfo.page} — {pageInfo.count} total
          </Typography>
          <Button onClick={handleNext} disabled={!pageInfo.next}>Next</Button>
        </Box>
      </Paper>
    </Stack>
  );
}