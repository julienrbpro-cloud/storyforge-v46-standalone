import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CLOUD_EVENT, cloudIsSignedIn, cloudLink, cloudListProjects, cloudRestoreProject,
  cloudSaveActiveProject, cloudSaveActiveProjectAsCopy, cloudSetPassword,
  cloudSignInWithPassword, cloudSignOut, cloudStatus, cloudSyncInProgress, cloudUser,
  type CloudProject, type CloudStatus,
} from "@/lib/cloud";
import { useStudio } from "@/lib/store";

export function CloudSyncPanel() {
  const activeId = useStudio((s) => s.activeProjectId);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [linked, setLinked] = useState<ReturnType<typeof cloudLink>>(null);
  const [sync, setSync] = useState<CloudStatus>({ state: "idle", message: "" });
  const refreshVersion = useRef(0);
  const invalidateRefresh = useCallback(() => { refreshVersion.current++; }, []);

  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    const connected = cloudIsSignedIn();
    setSignedIn(connected); setLinked(cloudLink(activeId)); setSync(cloudStatus(activeId));
    if (!connected) { setAccount(""); setProjects([]); return; }
    try {
      const [user, rows] = await Promise.all([cloudUser(), cloudListProjects()]);
      if (version !== refreshVersion.current || !cloudIsSignedIn()) return;
      setAccount(user.email || "Compte StoryForge"); setProjects(rows);
    } catch (error) {
      if (version === refreshVersion.current) setMessage((error as Error).message);
    }
  }, [activeId]);

  useEffect(() => {
    try { setEmail(localStorage.getItem("storyforge.cloud.email.v1") || ""); } catch { /* Optional convenience. */ }
    void refresh();
    let last = JSON.stringify(cloudLink(activeId));
    let connected = cloudIsSignedIn();
    const update = () => {
      const nextConnected = cloudIsSignedIn(), next = cloudLink(activeId);
      setLinked(next); setSignedIn(nextConnected); setSync(cloudStatus(activeId));
      if (nextConnected !== connected || JSON.stringify(next) !== last) void refresh();
      last = JSON.stringify(next); connected = nextConnected;
    };
    window.addEventListener(CLOUD_EVENT, update);
    window.addEventListener("storage", update);
    return () => { invalidateRefresh(); window.removeEventListener(CLOUD_EVENT, update); window.removeEventListener("storage", update); };
  }, [activeId, refresh, invalidateRefresh]);

  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await action(); await refresh(); }
    catch (error) { setMessage((error as Error).message); toast.error((error as Error).message); }
    finally { setBusy(false); }
  }
  const working = busy || cloudSyncInProgress();
  const inputClass = "w-full rounded-lg border border-line bg-panel-2 p-2 text-sm text-cream";
  const buttonClass = "rounded-full border border-line bg-panel-2 px-3 py-2 text-xs font-bold disabled:opacity-40";

  return (
    <section className="rounded-2xl border border-line bg-panel p-4" aria-label="Sauvegarde cloud">
      <h5 className="mb-1 text-xs font-bold tracking-wide text-accent-2 uppercase">Mes sauvegardes cloud</h5>
      <p className="mb-3 text-[12px] leading-relaxed text-cream-2">Tes projets sont privés. Une copie reste enregistrée sur cet appareil.</p>
      {!signedIn ? (
        <form className="space-y-2" onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          void run(async () => {
            await cloudSignInWithPassword(email, password);
            localStorage.setItem("storyforge.cloud.email.v1", email.trim());
            setPassword(""); toast.success("Connecté à tes projets StoryForge");
          });
        }}>
          <label className="block text-xs text-cream-2" htmlFor="cloud-email">Courriel StoryForge</label>
          <input id="cloud-email" type="email" autoComplete="username" required value={email}
            onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="ton@courriel.com" />
          <label className="block text-xs text-cream-2" htmlFor="cloud-password-login">Mot de passe StoryForge</label>
          <input id="cloud-password-login" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="Ton mot de passe StoryForge" />
          <label className="flex items-center gap-2 text-xs text-cream-2"><input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />Afficher le mot de passe</label>
          <button type="submit" disabled={busy || !email || !password} className={buttonClass}>{busy ? "Connexion…" : "Se connecter"}</button>
          <p className="text-[12px] leading-relaxed text-cream-2">Ce compte est distinct de ta connexion Google à ChatGPT. Aucun lien ni code à recevoir par courriel.</p>
        </form>
      ) : (
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-cream-2">{account || "Compte StoryForge connecté"}</span>
            <button type="button" disabled={busy} className={buttonClass} onClick={() => void run(() => cloudSignOut())}>Déconnexion</button>
          </div>
          <p role="status" className="text-cream-2">{sync.message || (linked ? "Synchronisation automatique activée" : "Sauvegarde ce projet une première fois pour activer sa synchronisation.")}</p>
          <button type="button" disabled={working} className={buttonClass} onClick={() => void run(async () => {
            await cloudSaveActiveProject(); toast.success("Projet et images à jour dans le cloud");
          })}>Sauvegarder maintenant</button>
          {sync.state === "conflict" ? (
            <button type="button" disabled={working} className={buttonClass} onClick={() => void run(async () => {
              await cloudSaveActiveProjectAsCopy(); toast.success("Ta version est sauvegardée séparément. L’autre version est conservée.");
            })}>Sauvegarder ma version comme autre projet</button>
          ) : null}
          <div className="space-y-2 border-t border-line pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold">Mes projets cloud</p>
              <button type="button" disabled={busy} className={buttonClass} onClick={() => void run(async () => { setProjects(await cloudListProjects()); })}>Actualiser</button>
            </div>
            {projects.length === 0 ? <p className="text-cream-2">Aucun projet sauvegardé dans ce compte.</p> : null}
            {projects.map((project) => (
              <div key={project.id} className="flex items-center justify-between gap-2 rounded-lg border border-line p-2">
                <span className="min-w-0 flex-1 truncate">{project.title}</span>
                <button type="button" disabled={working} className={buttonClass} onClick={() => void run(async () => {
                  await cloudRestoreProject(project.id); toast.success("Projet et images récupérés. Tes autres projets locaux sont conservés.");
                })}>Ouvrir</button>
              </div>
            ))}
          </div>
          <details className="border-t border-line pt-3">
            <summary className="cursor-pointer font-bold">Changer mon mot de passe</summary>
            <form className="mt-3 space-y-2" onSubmit={(e) => {
              e.preventDefault();
              if (busy) return;
              void run(async () => {
                if (newPassword !== confirmPassword) throw new Error("Les deux mots de passe doivent être identiques.");
                await cloudSetPassword(newPassword); setNewPassword(""); setConfirmPassword("");
                setMessage("Mot de passe enregistré. Utilise-le sur tes autres appareils."); toast.success("Mot de passe enregistré");
              });
            }}>
              <label className="block text-cream-2" htmlFor="cloud-password-create">Nouveau mot de passe</label>
              <input id="cloud-password-create" type="password" autoComplete="new-password" required minLength={6} value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} className={inputClass} placeholder="Au moins 6 caractères" />
              <label className="block text-cream-2" htmlFor="cloud-password-confirm">Confirmer le mot de passe</label>
              <input id="cloud-password-confirm" type="password" autoComplete="new-password" required minLength={6} value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
              <button type="submit" disabled={busy || newPassword.length < 6 || newPassword !== confirmPassword} className={buttonClass}>Enregistrer mon mot de passe</button>
            </form>
          </details>
        </div>
      )}
      {message ? <p role="alert" className="mt-3 text-xs leading-relaxed text-cream-2">{message}</p> : null}
    </section>
  );
}
