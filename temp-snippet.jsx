const x = (
      <Box sx={{ width: 360, p: 2 }}>
        {/* START/STOP buttons moved above tabs and styled */}
        <Box sx={{ display: "flex", gap: 1, mb: 1, justifyContent: "flex-end" }}>
          <Button variant="contained" onClick={startService} disabled={!service || serviceLoading || (service && ["queued","deploying","stopping"].includes(String(service.status)))} sx={{ bgcolor: theme.palette.success.main, '&:hover': { bgcolor: theme.palette.success.dark } }} startIcon={<PlayArrowIcon />}>Start</Button>
          <Button variant="contained" onClick={stopService} disabled={!service || serviceLoading || (service && ["queued","deploying","stopping"].includes(String(service.status)))} sx={{ bgcolor: theme.palette.error.main, '&:hover': { bgcolor: theme.palette.error.dark } }} startIcon={<StopIcon />}>Stop</Button>
        </Box>

        <Tabs value={drawerTab} onChange={(e, v) => setDrawerTab(v)}>
          <Tab label="Info" icon={<InfoIcon />} iconPosition="start" />
          <Tab label="Network" icon={<SettingsEthernetIcon />} iconPosition="start" />
        </Tabs>

        <Box role="tabpanel" hidden={drawerTab !== 0} sx={{ mt: 1 }}>
          <Typography variant="h6">Service</Typography>
          <Typography variant="body2" color="text.secondary">{service?.name ?? "—"}</Typography>
          <Divider sx={{ my: 1 }} />

          <Typography variant="caption">URL</Typography>
          <Box sx={{ mb: 1 }}>
            {service ? (
              <Button size="small" startIcon={<LinkIcon />} onClick={openServiceInNewTab} sx={{ textTransform: "none" }}>{service.service_name}.local</Button>
            ) : <Typography color="text.secondary">—</Typography>}
          </Box>

          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Button variant="outlined" onClick={() => checkServiceRunning(false)} disabled={!service || serviceStatusLoadingManual}>{serviceStatusLoadingManual ? "Checking..." : "Check running"}</Button>
          </Stack>

          <Typography variant="body2" sx={{ mt: 1 }}><strong>Status:</strong> {service?.status ?? "-"}</Typography>

          {serviceRunning !== null && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{serviceRunning ? "Service appears to be running." : "Service is not running."}</Typography>

              <Typography variant="caption">CPU {serviceCpu !== null ? `${serviceCpu}%` : "-"}</Typography>
              <LinearProgress variant="determinate" value={Math.min(Math.max(serviceCpu || 0, 0), 100)} sx={{ height: 10, borderRadius: 2, mb: 1, bgcolor: "grey.200", "& .MuiLinearProgress-bar": { bgcolor: colorForPercent(serviceCpu) } }} />

              <Typography variant="caption">RAM {serviceRam !== null ? `${serviceRam}%` : "-"}</Typography>
              <LinearProgress variant="determinate" value={Math.min(Math.max(serviceRam || 0, 0), 100)} sx={{ height: 10, borderRadius: 2, "& .MuiLinearProgress-bar": { bgcolor: colorForPercent(serviceRam) } }} />
            </Box>
          )}

          <Divider sx={{ my: 2 }} />
          <Box sx={{ fontSize: 13, color: "text.secondary" }}>
            {(planDetail?.name ?? service?.plan?.name) && <Box sx={{ mb: 1 }}><strong>Plan name:</strong> {planDetail?.name ?? service?.plan?.name}</Box>}
            {(planDetail?.platform ?? service?.plan?.platform) && <Box sx={{ mb: 1 }}><strong>Platform:</strong> {planDetail?.platform ?? service?.plan?.platform}</Box>}
            {(planDetail?.max_cpu ?? service?.plan?.max_cpu) && <Box sx={{ mb: 0.5 }}><strong>max_cpu:</strong> {planDetail?.max_cpu ?? service?.plan?.max_cpu}</Box>}
            {(planDetail?.max_ram ?? service?.plan?.max_ram) && <Box sx={{ mb: 0.5 }}><strong>max_ram:</strong> {planDetail?.max_ram ?? service?.plan?.max_ram}</Box>}
            {(planDetail?.max_storage ?? service?.plan?.max_storage) && <Box sx={{ mb: 0.5 }}><strong>max_storage:</strong> {planDetail?.max_storage ?? service?.plan?.max_storage}</Box>}
            {(planDetail?.price_per_hour ?? service?.plan?.price_per_hour) && <Box sx={{ mt: 1 }}><strong>price_per_hour:</strong> {planDetail?.price_per_hour ?? service?.plan?.price_per_hour}</Box>}
          </Box>
        </Box>

        <Box role="tabpanel" hidden={drawerTab !== 1} sx={{ mt: 1 }}>
          <Typography variant="h6">Network</Typography>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ fontSize: 13, color: "text.secondary" }}>
            {(service?.network?.name ?? networkDetail?.network?.name ?? networkDetail?.name) && <Box sx={{ mb: 1 }}><strong>Network name:</strong> {service?.network?.name ?? networkDetail?.network?.name ?? networkDetail?.name}</Box>}
            {networkDetail ? (
              <>
                {(networkDetail?.network?.cidr ?? networkDetail?.cidr) && <Box sx={{ mb: 0.5 }}><strong>cidr:</strong> {networkDetail?.network?.cidr ?? networkDetail?.cidr}</Box>}
                {(networkDetail?.network?.driver ?? networkDetail?.driver) && <Box sx={{ mb: 0.5 }}><strong>driver:</strong> {networkDetail?.network?.driver ?? networkDetail?.driver}</Box>}
                {Array.isArray(networkDetail?.services) && <Box sx={{ mt: 1 }}><strong>services_count:</strong> {networkDetail.services.length}</Box>}
              </>
            ) : (
              <>
                {service?.network?.created_at && <Box sx={{ mb: 0.5 }}><strong>created_at:</strong> {new Date(service.network.created_at).toLocaleString()}</Box>}
                {service?.network?.description && <Box sx={{ mb: 0.5 }}><strong>description:</strong> {service.network.description}</Box>}
              </>
            )}
          </Box>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Manage Network</Typography>
          <Box sx={{ display: "grid", gap: 12, gridTemplateColumns: "1fr", mb: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Network</InputLabel>
              <Select
                label="Network"
                value={selectedNetworkId || ""}
                onChange={(e) => setSelectedNetworkId(e.target.value)}
              >
                <MenuItem value="">Select a network</MenuItem>
                {availableNetworks.map((network) => (
                  <MenuItem key={network.id} value={network.id}>
                    {network.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="contained" onClick={handleAttachNetwork} disabled={!selectedNetworkId || networkActionLoading}>
                {service?.network ? "Change Network" : "Attach Network"}
              </Button>
              {service?.network && (
                <Button variant="outlined" color="error" onClick={handleDetachNetwork} disabled={networkActionLoading}>
                  Detach Network
                </Button>
              )}
            </Stack>
          </Box>
        </Box>
      </Box>

      <Box role="tabpanel" hidden={drawerTab !== 2} sx={{ mt: 1 }}>
        <Typography variant="h6">Live Logs</Typography>
        <Divider sx={{ my: 1 }} />
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
          <Button variant="contained" onClick={handleDownloadLogs} disabled={!displayedLogLines.length}>
            Download Logs
);
