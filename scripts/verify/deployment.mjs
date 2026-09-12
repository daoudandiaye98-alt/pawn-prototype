import { bypassOrigin } from "./bypass.mjs";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function sichereAdresse(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password ||
      !(url.hostname === "pawn.vision" || url.hostname === "www.pawn.vision" || url.hostname.endsWith(".vercel.app"))) {
    throw new Error("Pruefziel muss pawn.vision oder eine Vercel-Vorschau sein.");
  }
  return url.origin;
}

export function gleicherBau(marker, sha) {
  return /^[a-f0-9]{40}$/i.test(sha) && marker?.commit === sha && marker?.dirty === false;
}

export function fertigesDeployment(deployments, statuses, sha, production) {
  for (const d of deployments) {
    if (d.sha !== sha || d.production_environment !== production) continue;
    // Nur der NEUESTE Status gilt. Ein alter Erfolg vor einem Fehler reicht nicht.
    const latest = [...(statuses[d.id] || [])].sort((a, b) =>
      Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id)[0];
    if (latest?.state === "success" && latest.environment_url) return sichereAdresse(latest.environment_url);
  }
  return null;
}

export async function warteAufBau({ adresse, sha, fetcher = fetch, pause = ms => new Promise(r => setTimeout(r, ms)), versuche = 45, headers = {} }) {
  const origin = sichereAdresse(adresse);
  for (let i = 0; i < versuche; i++) {
    try {
      const r = await fetcher(origin + "/pawn-build.json?commit=" + sha + "&probe=" + i, {
        headers: { ...headers, "Cache-Control": "no-cache" }, redirect: "error", signal: AbortSignal.timeout(15000),
      });
      if (r.ok && gleicherBau(await r.json(), sha)) return origin;
    } catch { /* Noch nicht veroeffentlicht, gesperrt oder die SPA statt JSON. */ }
    if (i + 1 < versuche) await pause(20000);
  }
  throw new Error("Kein erreichbarer Bau dieses Commits. Kein Urteil ueber eine andere Version.");
}

async function main() {
  const { GITHUB_SHA: sha, GITHUB_REPOSITORY: repo, GH_TOKEN: token, GITHUB_REF_NAME: branch,
    HAUPTZWEIG: mainBranch, EINGETRAGEN: explicit, VERCEL_AUTOMATION_BYPASS_SECRET: bypass } = process.env;
  if (!/^[a-f0-9]{40}$/i.test(sha || "")) throw new Error("Commit fehlt.");
  let adresse = explicit ? sichereAdresse(explicit) : null;
  if (!adresse && branch === mainBranch) adresse = "https://pawn.vision";
  if (!adresse) {
    if (!repo || !token) throw new Error("GitHub-Zugang fuer die Vorschau fehlt.");
    const api = async path => {
      const r = await fetch("https://api.github.com/repos/" + repo + path, {
        headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error("GitHub-Deploymentabfrage: HTTP " + r.status);
      return r.json();
    };
    for (let i = 0; i < 45 && !adresse; i++) {
      const ds = await api("/deployments?sha=" + sha + "&per_page=100");
      const statuses = {};
      for (const d of ds.filter(d => d.sha === sha && !d.production_environment)) {
        statuses[d.id] = await api("/deployments/" + d.id + "/statuses?per_page=100");
      }
      adresse = fertigesDeployment(ds, statuses, sha, false);
      if (!adresse && i < 44) await new Promise(r => setTimeout(r, 20000));
    }
  }
  if (!adresse) throw new Error("Keine fertige Vorschau fuer diesen Commit.");
  // Eine manuell eingetragene fremde Vercel-App bekommt niemals das Projektgeheimnis.
  // Geschuetzte Vorschauen deshalb automatisch aus den GitHub-Deployments bestimmen.
  const trustedTarget = bypassOrigin(adresse, explicit);
  const headers = bypass && trustedTarget ? { "x-vercel-protection-bypass": bypass } : {};
  await warteAufBau({ adresse, sha, headers });
  console.log("Bau bestaetigt: " + sha + " auf " + adresse);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, "adresse=" + adresse + "\nbypass_origin=" + trustedTarget + "\ngatet=ja\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e.message); process.exitCode = 1; });
}
