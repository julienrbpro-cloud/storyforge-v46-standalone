import { useEffect } from "react";
import { CLOUD_EVENT, cloudConsumeLoginRedirect, cloudIsSignedIn, cloudLink, cloudSyncActiveProject, cloudSyncInProgress } from "@/lib/cloud";
import { useStudio } from "@/lib/store";

/** Bidirectional sync only for explicitly linked projects. An outage never removes local work. */
export function CloudSyncAgent() {
  const ready = useStudio((s) => s.ready);
  useEffect(() => { try { cloudConsumeLoginRedirect(); } catch { /* The login panel exposes any invalid session. */ } }, []);
  useEffect(() => {
    if (!ready) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;
    const sync = () => {
      if (!alive) return;
      const state = useStudio.getState();
      if (!cloudIsSignedIn() || !cloudLink(state.activeProjectId) || state.recoveryRequired || document.visibilityState === "hidden") return;
      if (cloudSyncInProgress() || state.saveState === "saving") { schedule(1500); return; }
      // Errors and conflicts are persistent in the panel, not repeated toast notifications.
      void cloudSyncActiveProject().catch(() => {});
    };
    function schedule(delay = 1800) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(sync, delay);
    }
    const unsubscribe = useStudio.subscribe((next, prev) => {
      if (next.revision !== prev.revision || next.activeProjectId !== prev.activeProjectId) schedule();
    });
    let connection = cloudIsSignedIn();
    const onCloud = () => {
      const next = cloudIsSignedIn();
      if (next && !connection) schedule(300);
      connection = next;
    };
    const onVisible = () => { if (document.visibilityState === "visible") schedule(300); };
    const onOnline = () => schedule(300);
    window.addEventListener(CLOUD_EVENT, onCloud);
    window.addEventListener("storage", onCloud);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const poll = setInterval(sync, 12000);
    schedule(300);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      clearInterval(poll); unsubscribe();
      window.removeEventListener(CLOUD_EVENT, onCloud);
      window.removeEventListener("storage", onCloud);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready]);
  return null;
}
