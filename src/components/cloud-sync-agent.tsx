import { useEffect } from "react";
import { toast } from "sonner";
import {
  cloudConsumeLoginRedirect, cloudIsSignedIn, cloudLink,
  cloudSaveActiveProject, cloudSyncInProgress,
} from "@/lib/cloud";
import { useStudio } from "@/lib/store";

/** Cloud is opt-in. Local snapshots always remain the primary working copy. */
export function CloudSyncAgent() {
  const ready = useStudio((s) => s.ready);
  useEffect(() => {
    try { cloudConsumeLoginRedirect(); }
    catch (error) { toast.error("Connexion cloud : " + (error as Error).message); }
  }, []);

  useEffect(() => {
    if (!ready) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;
    const sync = () => {
      if (!alive) return;
      const state = useStudio.getState();
      if (!cloudIsSignedIn() || !cloudLink(state.activeProjectId) || state.recoveryRequired) return;
      if (cloudSyncInProgress() || state.saveState === "saving") {
        schedule(1500);
        return;
      }
      void cloudSaveActiveProject().catch((error: Error) => {
        if (alive) toast.error("Sauvegarde cloud : " + error.message);
      });
    };
    function schedule(delay = 2200) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(sync, delay);
    }
    const unsubscribe = useStudio.subscribe((next, prev) => {
      if (next.revision !== prev.revision || next.activeProjectId !== prev.activeProjectId)
        schedule();
    });
    const onVisible = () => { if (document.visibilityState === "visible") schedule(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready]);
  return null;
}
