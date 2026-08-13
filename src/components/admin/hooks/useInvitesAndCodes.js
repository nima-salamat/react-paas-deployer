import { useCallback, useEffect, useState } from "react";
import apiRequest from "../../customHooks/apiRequest";
import { hostBase } from "../adminUtils";
import { useToast } from "../components/ToastContext";

const AUTH = () => `${hostBase()}/auth/api`;

/**
 * useInvitesAndCodes — owns the invites + auth-code state.
 *
 * Returns state + action callbacks used by InvitesPanel and AuthCodesPanel.
 */
export function useInvitesAndCodes() {
  const pushToast = useToast();

  // invites
  const [invites, setInvites] = useState([]);
  const [invLoading, setInvLoading] = useState(false);
  const [newInvite, setNewInvite] = useState({ label: "", max_uses: "1" });

  // auth codes
  const [codes, setCodes] = useState([]);
  const [codeCount, setCodeCount] = useState(0);
  const [codePage, setCodePage] = useState(1);
  const [codeSearch, setCodeSearch] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);

  const loadInvites = useCallback(async () => {
    setInvLoading(true);
    try {
      const res = await apiRequest({ method: "GET", url: `${AUTH()}/invite/list/` });
      const body = res.data || {};
      const list = body.invites || body.data?.invites || body.results || body.data || [];
      setInvites(Array.isArray(list) ? list : []);
    } catch (e) {
      setInvites([]);
      pushToast(e?.response?.data?.message || "Failed to load invites");
    } finally {
      setInvLoading(false);
    }
  }, [pushToast]);

  const loadCodes = useCallback(async () => {
    setCodeLoading(true);
    try {
      const params = { page: codePage };
      if (codeSearch) params.search = codeSearch;
      const res = await apiRequest({ method: "GET", url: `${AUTH()}/admin/auth-codes/`, params });
      const d = res.data?.data || res.data;
      setCodes(d?.results || []);
      setCodeCount(d?.count || 0);
    } catch {
      setCodes([]);
    } finally {
      setCodeLoading(false);
    }
  }, [codePage, codeSearch]);

  const createInvite = useCallback(async () => {
    try {
      const body = {
        label: newInvite.label,
        max_uses: newInvite.max_uses === "" ? null : Number(newInvite.max_uses),
      };
      await apiRequest({ method: "POST", url: `${AUTH()}/invite/create/`, data: body });
      pushToast("Invite created");
      setNewInvite({ label: "", max_uses: "1" });
      loadInvites();
    } catch (e) {
      pushToast(e?.response?.data?.message || "Failed");
    }
  }, [newInvite, loadInvites, pushToast]);

  const deactivateInvite = useCallback(async (token) => {
    try {
      await apiRequest({ method: "POST", url: `${AUTH()}/invite/deactivate/`, data: { token } });
      pushToast("Invite deactivated");
      loadInvites();
    } catch (e) {
      pushToast(e?.response?.data?.message || "Failed");
    }
  }, [loadInvites, pushToast]);

  const deleteCode = useCallback(async (id) => {
    try {
      await apiRequest({ method: "DELETE", url: `${AUTH()}/admin/auth-codes/${id}/` });
      loadCodes();
    } catch (e) {
      pushToast(e?.response?.data?.message || "Failed");
    }
  }, [loadCodes, pushToast]);

  const purgeCodes = useCallback(async () => {
    try {
      const res = await apiRequest({ method: "POST", url: `${AUTH()}/admin/auth-codes/purge/` });
      pushToast(`Purged ${res.data?.data?.deleted ?? res.data?.deleted ?? 0} codes`);
      loadCodes();
    } catch (e) {
      pushToast(e?.response?.data?.message || "Failed");
    }
  }, [loadCodes, pushToast]);

  // Initial loads
  useEffect(() => { loadInvites(); }, [loadInvites]);
  useEffect(() => { loadCodes(); }, [loadCodes]);

  return {
    // invites
    invites, invLoading, newInvite, setNewInvite,
    createInvite, deactivateInvite, loadInvites,
    // codes
    codes, codeCount, codePage, setCodePage, codeSearch, setCodeSearch, codeLoading,
    deleteCode, purgeCodes, loadCodes,
  };
}
