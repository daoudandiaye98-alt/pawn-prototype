import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { RoleGate } from "@/features/access/RoleGate";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Loader2, X, Check, FileText, Archive, Ban } from "lucide-react";

type Status = "all" | "submitted" | "in_review" | "approved" | "rejected" | "archived";

interface Application {
  id: string;
  user_id: string;
  brand_name: string;
  legal_name: string | null;
  location: string | null;
  country: string | null;
  website: string | null;
  instagram: string | null;
  story: string | null;
  tags: string[] | null;
  production_status: string | null;
  portfolio_paths: string[] | null;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  rejection_reason: string | null;
  created_at: string;
}

const TABS: { key: Status; label: string }[] = [
  { key: "submitted", label: "Neu" },
  { key: "in_review", label: "In Prüfung" },
  { key: "approved", label: "Angenommen" },
  { key: "rejected", label: "Abgelehnt" },
  { key: "archived", label: "Archiviert" },
  { key: "all", label: "Alle" },
];

function AdminApplicationsBody() {
  const [tab, setTab] = useState<Status>("submitted");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Application | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("designer_applications")
      .select("*")
      .order("submitted_at", { ascending: false, nullsFirst: false });
    if (tab !== "all") q = q.eq("status", tab);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data as Application[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      r.brand_name?.toLowerCase().includes(s) ||
      r.location?.toLowerCase().includes(s) ||
      r.country?.toLowerCase().includes(s) ||
      (r.tags ?? []).some((t) => t.toLowerCase().includes(s))
    );
  }, [rows, search]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => { m[r.status] = (m[r.status] ?? 0) + 1; });
    return m;
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "border px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.22em] transition-colors",
              tab === t.key ? "border-accent text-foreground" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.key !== "all" && counts[t.key] !== undefined && (
              <span className="ml-2 text-muted-foreground">({counts[t.key]})</span>
            )}
          </button>
        ))}
        <div className="ml-auto w-full sm:w-64">
          <Input
            placeholder="Suchen (Brand, Ort, Tag)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-none"
          />
        </div>
      </div>

      <div className="border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center p-16 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Lade Bewerbungen…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 h-6 w-6" />
            Keine Bewerbungen in dieser Ansicht.
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-border text-left text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3 hidden md:table-cell">Ort</th>
                <th className="px-4 py-3 hidden lg:table-cell">Tags</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 hidden md:table-cell">Eingereicht</th>
                <th className="px-4 py-3 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium">{r.brand_name}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {[r.location, r.country].filter(Boolean).join(", ")}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    {(r.tags ?? []).slice(0, 3).join(" · ")}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("de-DE") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelected(r)}
                      className="text-[0.7rem] uppercase tracking-[0.22em] underline-offset-4 hover:underline"
                    >
                      Öffnen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {selected && (
        <DetailDrawer app={selected} onClose={() => setSelected(null)} onChange={load} />
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    submitted: "border-accent text-foreground",
    in_review: "border-amber-500/60 text-amber-600 dark:text-amber-300",
    approved: "border-emerald-500/60 text-emerald-600 dark:text-emerald-300",
    rejected: "border-red-500/60 text-red-600 dark:text-red-300",
    archived: "border-border text-muted-foreground",
    draft: "border-border text-muted-foreground",
  };
  return (
    <span className={cn("border px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.22em]", map[status] ?? "border-border")}>
      {status.replace("_", " ")}
    </span>
  );
}

interface NoteRow {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
}

interface ConsentRow {
  id: string;
  accepted_at: string;
  contract_version_id: string;
  contract_versions: { kind: string; version: number; title: string } | null;
}

function DetailDrawer({ app, onClose, onChange }: { app: Application; onClose: () => void; onChange: () => void }) {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [newNote, setNewNote] = useState("");
  const [consents, setConsents] = useState<ConsentRow[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<null | "approve" | "reject" | "archive" | "note">(null);
  const [portfolioUrls, setPortfolioUrls] = useState<string[]>([]);

  async function loadNotes() {
    const { data } = await supabase
      .from("application_notes")
      .select("id, body, created_at, author_id")
      .eq("application_id", app.id)
      .order("created_at", { ascending: false });
    setNotes((data as NoteRow[]) ?? []);
  }

  async function loadConsents() {
    const { data } = await supabase
      .from("designer_consents")
      .select("id, accepted_at, contract_version_id, contract_versions(kind, version, title)")
      .eq("application_id", app.id);
    setConsents((data as unknown as ConsentRow[]) ?? []);
  }

  useEffect(() => {
    (async () => {
      if (app.portfolio_paths?.length) {
        const urls: string[] = [];
        for (const path of app.portfolio_paths) {
          const { data } = await supabase.storage
            .from("designer-applications")
            .createSignedUrl(path, 3600);
          if (data?.signedUrl) urls.push(data.signedUrl);
        }
        setPortfolioUrls(urls);
      }
      await loadNotes();
      await loadConsents();
      if (app.status === "submitted") {
        const { error } = await supabase.rpc("mark_application_in_review", { _application_id: app.id });
        if (!error) onChange();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.id]);

  async function addNote() {
    if (!newNote.trim()) return;
    setBusy("note");
    const { error } = await supabase.rpc("add_application_note", {
      _application_id: app.id,
      _body: newNote.trim(),
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    setNewNote("");
    toast.success("Notiz gespeichert.");
    loadNotes();
  }

  async function approve() {
    setBusy("approve");
    const { error } = await supabase.rpc("approve_designer", { _application_id: app.id });
    setBusy(null);
    if (error) toast.error(error.message);
    else { toast.success(`${app.brand_name} angenommen.`); onClose(); onChange(); }
  }

  async function reject() {
    if (!reason.trim()) { toast.error("Bitte einen Grund angeben."); return; }
    setBusy("reject");
    const { error } = await supabase.rpc("reject_designer", { _application_id: app.id, _reason: reason });
    setBusy(null);
    if (error) toast.error(error.message);
    else { toast.success("Abgelehnt."); onClose(); onChange(); }
  }

  async function archive() {
    setBusy("archive");
    const { error } = await supabase.rpc("archive_application", { _application_id: app.id });
    setBusy(null);
    if (error) toast.error(error.message);
    else { toast.success("Archiviert."); onClose(); onChange(); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
          <div>
            <p className="editorial-eyebrow">Bewerbung</p>
            <h2 className="font-serif text-2xl">{app.brand_name}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-8 p-6">
          <section>
            <p className="editorial-eyebrow mb-3">Portfolio</p>
            {portfolioUrls.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Portfolio-Bilder.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {portfolioUrls.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noreferrer" className="block border border-border">
                    <img src={u} alt="" loading="lazy" className="h-32 w-full object-cover" />
                  </a>
                ))}
              </div>
            )}
          </section>

          <section>
            <p className="editorial-eyebrow mb-3">Details</p>
            <dl className="divide-y divide-border text-sm">
              {[
                ["Status", app.status],
                ["Rechtsname", app.legal_name],
                ["Ort", [app.location, app.country].filter(Boolean).join(", ")],
                ["Website", app.website],
                ["Instagram", app.instagram],
                ["Tags", (app.tags ?? []).join(", ")],
                ["Produktion", app.production_status],
                ["Eingereicht", app.submitted_at ? new Date(app.submitted_at).toLocaleString("de-DE") : "—"],
              ].map(([k, v]) => (
                <div key={k as string} className="grid grid-cols-3 py-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="col-span-2 break-words">{v || <em className="text-muted-foreground">—</em>}</dd>
                </div>
              ))}
            </dl>
          </section>

          {app.story && (
            <section>
              <p className="editorial-eyebrow mb-3">Story</p>
              <p className="whitespace-pre-line text-sm text-foreground/80">{app.story}</p>
            </section>
          )}

          <section>
            <p className="editorial-eyebrow mb-3">Admin-Notizen · append-only</p>
            <div className="flex gap-2">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={2}
                className="rounded-none"
                placeholder="Neue Notiz hinzufügen…"
              />
              <Button
                onClick={addNote}
                disabled={busy === "note" || !newNote.trim()}
                className="rounded-none"
              >
                {busy === "note" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Notiz"}
              </Button>
            </div>
            {notes.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Noch keine Notizen.</p>
            ) : (
              <ul className="mt-4 divide-y divide-border border border-border">
                {notes.map((n) => (
                  <li key={n.id} className="px-3 py-2 text-sm">
                    <p className="whitespace-pre-line text-foreground/90">{n.body}</p>
                    <p className="mt-1 text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
                      {new Date(n.created_at).toLocaleString("de-DE")} · {n.author_id.slice(0, 8)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <p className="editorial-eyebrow mb-3">Zustimmungen</p>
            {consents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Zustimmungen erfasst.</p>
            ) : (
              <ul className="divide-y divide-border border border-border text-sm">
                {consents.map((c) => (
                  <li key={c.id} className="flex items-center justify-between px-3 py-2">
                    <span>
                      {c.contract_versions?.title ?? c.contract_version_id}
                      <span className="ml-2 text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
                        v{c.contract_versions?.version ?? "?"}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.accepted_at).toLocaleDateString("de-DE")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {app.status !== "approved" && app.status !== "archived" && (
            <section className="space-y-4 border-t border-border pt-6">
              <p className="editorial-eyebrow">Entscheidung</p>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={approve}
                  disabled={busy !== null}
                  className="rounded-none bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {busy === "approve" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  Annehmen
                </Button>
                <Button onClick={archive} disabled={busy !== null} variant="outline" className="rounded-none">
                  <Archive className="mr-2 h-4 w-4" /> Archivieren
                </Button>
              </div>

              <div className="border border-border p-4">
                <Label className="editorial-eyebrow">Grund für Ablehnung</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Kurzer, respektvoller Grund…"
                  className="mt-2 rounded-none"
                />
                <Button
                  onClick={reject}
                  disabled={busy !== null || !reason.trim()}
                  variant="destructive"
                  className="mt-3 rounded-none"
                >
                  {busy === "reject" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
                  Ablehnen
                </Button>
              </div>
            </section>
          )}

          {app.status === "rejected" && app.rejection_reason && (
            <section className="border-t border-border pt-6">
              <p className="editorial-eyebrow mb-2">Abgelehnt mit Grund</p>
              <p className="text-sm text-muted-foreground">{app.rejection_reason}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

const AdminApplications = () => (
  <RoleGate role="admin">
    <AdminShell eyebrow="Governance" title="Bewerbungen">
      <AdminApplicationsBody />
    </AdminShell>
  </RoleGate>
);

export default AdminApplications;
