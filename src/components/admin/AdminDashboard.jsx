import React, { useCallback, useEffect, useState } from "react";
import {
  Box, CircularProgress, Drawer, Stack, Typography,
  useMediaQuery, useTheme,
} from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ToastProvider } from "./components/ToastContext.jsx";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import { clearSessionPermissions, canSeeNav, adminMeUrl } from "./adminUtils";
import apiRequest from "../customHooks/apiRequest";
import { useAdminIdentity } from "./hooks/useAdminIdentity.js";
import { useTicketsData } from "./hooks/useTicketsData.js";
import { useInvitesAndCodes } from "./hooks/useInvitesAndCodes.js";
import { useTicketWebSocket } from "./hooks/useTicketWebSocket.js";

import AdminSidebar from "./layout/AdminSidebar.jsx";
import AdminTopBar from "./layout/AdminTopBar.jsx";
import TicketDetailDrawer from "./components/TicketDetailDrawer.jsx";

import OverviewPanel from "./panels/OverviewPanel.jsx";
import TicketsPanel from "./panels/TicketsPanel.jsx";
import UsersPanel from "./panels/UsersPanel.jsx";
import ServicesPanel from "./panels/ServicesPanel.jsx";
import PlansPanel from "./panels/PlansPanel.jsx";
import TablesPanel from "./panels/TablesPanel.jsx";
import LoginSettingsPanel from "./panels/LoginSettingsPanel.jsx";
import InvitesPanel from "./panels/InvitesPanel.jsx";
import AuthCodesPanel from "./panels/AuthCodesPanel.jsx";
import EmailsPanel from "./panels/EmailsPanel.jsx";
import ProfilePanel from "./panels/ProfilePanel.jsx";
import DocsPanel from "./panels/docs/DocsPanel.jsx";

const PAGE_TITLES = {
  overview: "Overview",
  tickets: "Tickets",
  users: "Users & access",
  services: "Services",
  plans: "Plans",
  tables: "Database tables",
  login: "Login system",
  invites: "Invites",
  codes: "Auth codes",
  emails: "Email",
  profile: "My profile",
  docs: "Documentation",
};

/** Alt+key → tab id */
const SHORTCUT_MAP = {
  "1": "overview",
  "2": "tickets",
  "3": "users",
  "4": "services",
  "5": "plans",
  "6": "tables",
  "7": "login",
  "8": "invites",
  "9": "codes",
  "0": "emails",
  p: "profile",
  d: "docs",
  P: "profile",
  "[": "__collapse__",
};

function AdminDashboardInner() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";
  const [tab, setTab] = useState(initialTab === "permissions" ? "users" : initialTab);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("admin_sidebar_collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [confirmLogout, setConfirmLogout] = useState(false);

  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("admin_sidebar_collapsed", next ? "1" : "0");
      } catch { /* */ }
      return next;
    });
  }, []);

  const DRAWER_W = sidebarCollapsed ? 72 : 248;

  const { me, loading: meLoading } = useAdminIdentity({
    onNotStaff: () => navigate("/tickets"),
  });
  const [localMe, setLocalMe] = useState(null);
  const effectiveMe = localMe || me;

  useEffect(() => {
    if (me) setLocalMe(me);
  }, [me]);

  // When profile images of current user change anywhere in admin, refresh "me"
  useEffect(() => {
    const handler = async (ev) => {
      const uid = ev?.detail?.userId;
      // Always refresh me — cheap and keeps topbar/sidebar in sync
      try {
        const res = await apiRequest({ method: "GET", url: adminMeUrl() });
        const d = res.data?.data || res.data || {};
        if (d && (d.id || d.username)) setLocalMe(d);
      } catch { /* */ }
    };
    window.addEventListener("admin-profile-changed", handler);
    return () => window.removeEventListener("admin-profile-changed", handler);
  }, []);


  const ticketsApi = useTicketsData();
  const {
    stats, tickets, page, setPage, count, search, setSearch,
    status, setStatus, priority, setPriority,
    assignedFilter, setAssignedFilter, tLoading,
    selectedId, detail, detailLoading, reply, setReply,
    files, setFiles, sending,
    loadTickets, openDetail, changeStatus,
    sendReply, deleteTicket, closeDetail,
    selectedIdRef, loadTicketsRef, openDetailRef, loadStatsRef,
  } = ticketsApi;

  const {
    invites, invLoading, newInvite, setNewInvite,
    createInvite, deactivateInvite, loadInvites,
    codes, codeCount, codePage, setCodePage, codeSearch, setCodeSearch,
    codeLoading, deleteCode, purgeCodes, loadCodes,
  } = useInvitesAndCodes();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const pushNotification = useCallback((notif) => {
    const id = notif.id || `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setNotifications((prev) => [
      { ...notif, id, unread: true, ts: notif.ts || new Date().toISOString() },
      ...prev,
    ].slice(0, 50));
    setUnreadCount((c) => c + 1);
  }, []);

  const handleWsEvent = (data) => {
    if (data.type === "ticket.created") {
      loadStatsRef.current?.();
      loadTicketsRef.current?.({ silent: true });
      pushNotification({
        title: `New ticket #${data.ticket_id ?? "?"}`,
        body: data.subject || "A new ticket was created",
        kind: "ticket.created",
      });
    } else if (data.type === "ticket.message") {
      const sid = selectedIdRef.current;
      if (sid != null && String(sid) === String(data.ticket_id)) {
        openDetailRef.current?.(sid);
      }
      loadTicketsRef.current?.({ silent: true });
      pushNotification({
        title: `Reply on ticket #${data.ticket_id ?? "?"}`,
        body: data.body?.slice(0, 120) || "New message received",
        kind: "ticket.message",
      });
    } else if (data.type === "ticket.updated") {
      loadStatsRef.current?.();
      loadTicketsRef.current?.({ silent: true });
    } else if (data.type === "ticket.seen") {
      // Customer (or peer) marked messages as read — update ticks live (messenger-style)
      const sid = selectedIdRef.current;
      if (sid != null && String(sid) === String(data.ticket_id)) {
        const idsRaw = data.message_ids || data.ids || [];
        const idSet = new Set(
          (Array.isArray(idsRaw) ? idsRaw : [data.message_id || data.last_read_id])
            .filter((x) => x != null)
            .map(String)
        );
        const lastRead =
          data.last_read_id != null
            ? Number(data.last_read_id)
            : data.last_read_at
              ? null
              : null;
        // Patch open detail optimistically so ✓✓ appears without waiting for GET
        // openDetail also runs to stay authoritative with server
        openDetailRef.current?.(sid);
      } else {
        loadTicketsRef.current?.({ silent: true });
      }
      loadStatsRef.current?.();
    }
  };

  const { connected: liveConnected, events: liveEvents } = useTicketWebSocket({
    enabled: !meLoading,
    onEvent: handleWsEvent,
  });

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    if (tab === "tickets" || tab === "overview") {
      loadTickets({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab === "invites" && canSeeNav("invites")) loadInvites();
    if (tab === "codes" && canSeeNav("codes")) loadCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const doLogout = useCallback(() => {
    try {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
    } catch { /* */ }
    clearSessionPermissions();
    window.dispatchEvent(new Event("auth-changed"));
    navigate("/signin_or_signup");
  }, [navigate]);

  const requestLogout = useCallback(() => {
    setConfirmLogout(true);
  }, []);

  const backToDeployer = () => navigate("/");

  const setTabAndUrl = useCallback((id) => {
    setTab(id);
    setSearchParams(id === "overview" ? {} : { tab: id });
    setMobileNavOpen(false);
  }, [setSearchParams]);

  // Keyboard shortcuts: Alt+1..0, Alt+P, Alt+[
  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;

      const key = e.key;
      const mapped = SHORTCUT_MAP[key];
      if (!mapped) return;

      e.preventDefault();
      if (mapped === "__collapse__") {
        toggleSidebar();
        return;
      }
      if (mapped === "profile" || canSeeNav(mapped)) {
        setTabAndUrl(mapped);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTabAndUrl, toggleSidebar]);

  const handleDeleteTicket = async (id) => {
    await deleteTicket(id);
  };

  if (meLoading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          bgcolor: "background.default",
        }}
      >
        <Stack alignItems="center" gap={2}>
          <CircularProgress />
          <Typography color="text.secondary">Loading admin…</Typography>
        </Stack>
      </Box>
    );
  }

  const sidebar = (
    <AdminSidebar
      me={effectiveMe}
      tab={tab}
      onTabChange={setTabAndUrl}
      liveConnected={liveConnected}
      onLogout={requestLogout}
      onBackToDeployer={backToDeployer}
      collapsed={sidebarCollapsed}
      onToggleCollapse={toggleSidebar}
    />
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {isDesktop && (
        <Box
          component="nav"
          sx={{
            width: DRAWER_W,
            flexShrink: 0,
            position: "sticky",
            top: 0,
            height: "100vh",
            transition: "width 0.2s ease",
            overflow: "hidden",
            zIndex: 10,
          }}
        >
          {sidebar}
        </Box>
      )}

      <Drawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        ModalProps={{ keepMounted: true }}
        PaperProps={{ sx: { width: DRAWER_W } }}
      >
        {sidebar}
      </Drawer>

      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <AdminTopBar
          me={effectiveMe}
          title={PAGE_TITLES[tab] || "Admin"}
          liveConnected={liveConnected}
          onMenuClick={() => setMobileNavOpen(true)}
          showMenuButton={!isDesktop}
          onBackToDeployer={backToDeployer}
          onLogout={requestLogout}
          onNavigate={setTabAndUrl}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAllRead={markAllRead}
        />

        <Box
          component="main"
          sx={{ flex: 1, p: { xs: 1.5, sm: 2.5, md: 3 }, minWidth: 0 }}
        >
          {tab === "overview" && (
            <OverviewPanel
              me={effectiveMe}
              stats={stats}
              liveConnected={liveConnected}
              liveEvents={liveEvents}
              tickets={tickets}
              tLoading={tLoading}
              onOpenTicket={openDetail}
            />
          )}

          {tab === "tickets" && (
            <TicketsPanel
              tickets={tickets}
              count={count}
              page={page}
              setPage={setPage}
              search={search}
              setSearch={setSearch}
              status={status}
              setStatus={setStatus}
              priority={priority}
              setPriority={setPriority}
              assignedFilter={assignedFilter}
              setAssignedFilter={setAssignedFilter}
              tLoading={tLoading}
              onOpen={openDetail}
              onDelete={handleDeleteTicket}
              onRefresh={() => loadTickets()}
            />
          )}

          {tab === "users" && <UsersPanel />}

          {tab === "profile" && (
            <ProfilePanel
              me={effectiveMe}
              onMeUpdated={(updated) => setLocalMe(updated)}
            />
          )}

          {tab === "invites" && canSeeNav("invites") && (
            <InvitesPanel
              invites={invites}
              invLoading={invLoading}
              newInvite={newInvite}
              setNewInvite={setNewInvite}
              onCreate={createInvite}
              onDeactivate={deactivateInvite}
              onRefresh={loadInvites}
            />
          )}

          {tab === "codes" && canSeeNav("codes") && (
            <AuthCodesPanel
              codes={codes}
              codeCount={codeCount}
              codePage={codePage}
              setCodePage={setCodePage}
              codeSearch={codeSearch}
              setCodeSearch={setCodeSearch}
              codeLoading={codeLoading}
              onPurge={purgeCodes}
              onDelete={deleteCode}
              onRefresh={loadCodes}
            />
          )}

          {tab === "emails" && canSeeNav("emails") && <EmailsPanel />}
          {tab === "services" && canSeeNav("services") && <ServicesPanel />}
          {tab === "plans" && canSeeNav("plans") && <PlansPanel />}
          {tab === "login" && canSeeNav("login") && <LoginSettingsPanel />}
          {tab === "tables" && canSeeNav("tables") && <TablesPanel />}
          {tab === "docs" && canSeeNav("docs") && <DocsPanel />}
        </Box>
      </Box>

      <TicketDetailDrawer
        open={Boolean(selectedId)}
        detail={detail}
        detailLoading={detailLoading}
        reply={reply}
        setReply={setReply}
        files={files}
        setFiles={setFiles}
        sending={sending}
        onClose={closeDetail}
        onSend={sendReply}
        onChangeStatus={changeStatus}
        onDelete={selectedId ? () => handleDeleteTicket(selectedId) : undefined}
      />

      <ConfirmDialog
        open={confirmLogout}
        title="Sign out?"
        message="You will be signed out of the admin console and redirected to the login page."
        confirmLabel="Sign out"
        confirmColor="error"
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => {
          setConfirmLogout(false);
          doLogout();
        }}
      />
    </Box>
  );
}

export default function AdminDashboard() {
  return (
    <ToastProvider>
      <AdminDashboardInner />
    </ToastProvider>
  );
}
