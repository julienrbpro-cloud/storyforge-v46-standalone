import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CLOUD_EVENT, cloudConsumeLoginRedirect, cloudIsSignedIn, cloudLink,
  cloudListProjects, cloudRestoreProject, cloudSaveActiveProject,
  cloudSetPassword, cloudSignInWithPassword, cloudSignOut, cloudSyncInProgress, cloudUser,
  type CloudProject,
} from "@/lib/cloud";
import { useStudio } from "@/lib/store";

export function CloudSyncPanel() {
  const activeId = useStudio((s) => s.activeProjectId);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [linked, setLinked] = useState<ReturnType<typeof cloudLink>>(null);

  const refresh = useCallback(async () => {
    setSignedIn(cloudIsSignedIn());
    setLinked(cloudLink(activeId));
    if (!cloudIsSignedIn()) { setAccount(""); setProjects([]); return; }
    try {
      const user = await cloudUser();
      setAccount(user.email || user.id);
      const rows = await cloudListProjects();
      setProjects(rows);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }, [activeId]);

  useEffect(() => {
    try { cloudConsumeLoginRedirect(); }
    catch (error) { setMessage((error as Error).message); }
    void refresh();
    const update = () => { setLinked(cloudLink(activeId)); setSignedIn(cloudIsSignedIn()); };
    window.addEventListener(CLOUD_EVENT, update);
    return () => window.removeEventListener(CLOUD_EVENT, update);
  }, [activeId, refresh]);

  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await action(); await refresh(); }
    catch (error) { setMessage((error as Error).message); toast.error((error as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-4">
      <h5 className="mb-1 text-xs font-bold tracking-wide text-accent-2 uppercase">Sauvegarde cloud · Supabase</h5>
      <p className="mb-3 text-[12px] leading-relaxed text-cream-2">
        Facultative. Les données continuent d'être sauvegardées sur cet appareil. Les projets cloud sont privés.
      </p>
      {!signedIn ? (
        <div className="space-y-2">
          <label className="block text-xs text-cream-2" htmlFor="cloud-email">Ton adresse courriel</label>
          <input id="cloud-email" type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-line bg-panel-2 p-2 text-sm text-cream"
            placeholder="Courriel pour te connecter" />
          <label className="block text-xs text-cream-2" htmlFor="cloud-password-login">Mot de passe</label>
          <input id="cloud-password-login" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-line bg-panel-2 p-2 text-sm text-cream"
            placeholder="Ton mot de passe" />
          <button type="button" disabled={busy || !email.includes("@") || !password}
            className="rounded-full border border-line bg-panel-2 px-3 py-2 text-xs font-bold disabled:opacity-40"
            onClick={() => void run(async () => {
              await cloudSignInWithPassword(email, password);
              setPassword("");
              toast.success("Connecté à tes projets cloud");
            })}>Se connecter</button>
          <p className="text-[12px] leading-relaxed text-cream-2">
            Pas de courriel ni de code à recevoir. Pour la première connexion,
            crée ton mot de passe depuis le navigateur déjà connecté.
          </p>
        </div>
      ) : (
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-cream-2">{account || "Connecté à Supabase"}</span>
            <button type="button" className="shrink-0 rounded-full border border-line px-3 py-2"
              onClick={() => { cloudSignOut(); void refresh(); }}>Déconnexion</button>
          </div>
          <div className="space-y-2 rounded-lg border border-line p-3">
            <p className="font-bold">Accès simple depuis tous tes navigateurs</p>
            <p className="text-cream-2">Choisis ton mot de passe une seule fois ici. Dans l'autre navigateur, utilise simplement ton courriel et ce mot de passe. Aucun code à recevoir.</p>
            <label className="block text-cream-2" htmlFor="cloud-password-create">Créer ou changer mon mot de passe</label>
            <input id="cloud-password-create" type="password" autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-line bg-panel-2 p-2 text-sm text-cream"
              placeholder="Au moins 6 caractères" />
            <button type="button" disabled={busy || password.length < 6}
              className="rounded-full border border-line bg-panel-2 px-3 py-2 font-bold disabled:opacity-40"
              onClick={() => void run(async () => {
                await cloudSetPassword(password);
                setPassword("");
                setMessage("Mot de passe enregistré. Tu peux ouvrir StoryForge dans ton autre navigateur et te connecter directement.");
                toast.success("Mot de passe enregistré");
              })}>Enregistrer mon mot de passe</button>
          </div>
          <p className="text-cream-2">
            {linked ? "Synchronisation automatique activée pour le projet ouvert." :
              "Projet local uniquement. La première sauvegarde cloud active la synchronisation automatique."}
          </p>
          <button type="button" disabled={busy || cloudSyncInProgress()}
            className="rounded-full border border-line bg-panel-2 px-3 py-2 font-bold disabled:opacity-40"
            onClick={() => void run(async () => {
              await cloudSaveActiveProject();
              toast.success("Projet et images sauvegardés dans Supabase");
            })}>Sauvegarder maintenant dans le cloud</button>
          <div className="space-y-2 border-t border-line pt-3">
            <p className="font-bold">Mes projets cloud</p>
            <button type="button" disabled={busy} className="rounded-full border border-line px-3 py-2"
              onClick={() => void run(async () => { setProjects(await cloudListProjects()); })}>Actualiser</button>
            {projects.length === 0 ? <p className="text-cream-2">Aucun projet dans le cloud.</p> : null}
            {projects.map((project) => (
              <div key={project.id} className="flex items-center justify-between gap-2 rounded-lg border border-line p-2">
                <span className="min-w-0 flex-1 truncate">{project.title} · v{project.revision}</span>
                <button type="button" disabled={busy || cloudSyncInProgress()}
                  className="shrink-0 rounded-full border border-line px-3 py-2 font-bold disabled:opacity-40"
                  onClick={() => {
                    if (!window.confirm("Remplacer le projet ouvert sur cet appareil par cette sauvegarde cloud ? Exporte d'abord ta session locale si tu souhaites la conserver.")) return;
                    void run(async () => {
                      await cloudRestoreProject(project.id);
                      toast.success("Projet restauré sur cet appareil");
                    });
                  }}>Restaurer</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {message ? <p role="status" className="mt-3 text-xs leading-relaxed text-cream-2">{message}</p> : null}
    </section>
  );
}
