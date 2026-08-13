import { useEffect, useRef, useState } from "react";
import apiRequest from "../../customHooks/apiRequest";
import {
  hostBase, adminMeUrl, setSessionPermissions, clearSessionPermissions,
} from "../adminUtils";

/**
 * useAdminIdentity — loads the staff identity + permission catalog on mount.
 *
 * Order of preference:
 *   1. /api/users/admin/me/permissions/  → authoritative rules + all_permissions
 *   2. /auth/api/validateToken/          → fallback user object
 *
 * If the user is not staff, the consumer should redirect away.
 *
 * Returns: { me, loading }
 */
export function useAdminIdentity({ onNotStaff } = {}) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const onNotStaffRef = useRef(onNotStaff);
  useEffect(() => { onNotStaffRef.current = onNotStaff; }, [onNotStaff]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // First, the dedicated admin/me/permissions endpoint
        try {
          const res = await apiRequest({ method: "GET", url: adminMeUrl() });
          const d = res.data?.data || res.data || {};
          if (cancelled) return;
          setSessionPermissions({
            rules: d.rules || [],
            isSuperuser: Boolean(d.is_superuser),
            isStaff: Boolean(d.is_staff || d.is_superuser),
            allPermissions: d.all_permissions || [],
          });
          setMe(d);
          if (!d.is_staff && !d.is_superuser) {
            onNotStaffRef.current?.();
          }
          return;
        } catch {
          /* fall through to legacy */
        }

        // Legacy fallback: validateToken → user object
        let u = null;
        try {
          const res = await apiRequest({ method: "GET", url: `${hostBase()}/auth/api/validateToken/` });
          u = res.data?.user || res.data;
        } catch { /* */ }

        if (!u) {
          const res = await apiRequest({ method: "GET", url: `${hostBase()}/api/users/user/` });
          u = res.data?.user || res.data;
        }
        if (cancelled) return;
        const staff = Boolean(u?.is_staff || u?.is_superuser);
        setSessionPermissions({
          rules: u?.rules || u?.rule?.rules || [],
          isSuperuser: Boolean(u?.is_superuser),
          isStaff: staff,
          allPermissions: [],
        });
        setMe(u);
        if (!staff) onNotStaffRef.current?.();
      } catch {
        clearSessionPermissions();
        onNotStaffRef.current?.();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { me, loading };
}
