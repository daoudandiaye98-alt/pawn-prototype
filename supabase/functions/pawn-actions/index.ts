// PAWN Actions — the AI's hands. Admin-only whitelisted mutations with before/after log + undo.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const CONFIG_WHITELIST = new Set([
  "plan_limits", "platform_commission", "directives", "help_topics",
  "video_provider", "image_edit_provider", "model_tiers",
  "ausgabe_nummer", "show_seed_content", "provider_priority",
]);

interface ActionRequest { action: string; params: Record<string, unknown>; source?: "admin_chat" | "system" }

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function jwtSub(auth: string | null): string | null {
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const [, p] = auth.slice(7).split(".");
    return JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")))?.sub ?? null;
  } catch { return null; }
}

async function requireAdmin(admin: SupabaseClient, user_id: string | null): Promise<boolean> {
  if (!user_id) return false;
  const { data } = await admin.from("user_roles").select("role").eq("user_id", user_id).eq("role", "admin").maybeSingle();
  return !!data;
}

async function logAction(admin: SupabaseClient, actor: string | null, source: string, action: string, params: unknown, before: unknown, after: unknown, status: "done" | "failed" = "done", error?: string) {
  const { data } = await admin.from("ai_actions_log").insert({
    actor, source, action,
    params: params as never, before: before as never, after: after as never,
    status, error: error ?? null,
  }).select("id").single();
  return (data as { id: string } | null)?.id ?? null;
}

async function execute(admin: SupabaseClient, actor: string, source: string, req: ActionRequest) {
  const { action, params } = req;
  try {
    switch (action) {
      case "set_content": {
        const key = String(params.key ?? ""); const value = String(params.value ?? "");
        if (!key) throw new Error("key required");
        const { data: prev } = await admin.from("site_content").select("value").eq("key", key).maybeSingle();
        await admin.from("site_content").upsert({ key, value, updated_by: actor });
        const id = await logAction(admin, actor, source, action, params, prev ?? null, { key, value });
        return { ok: true, id };
      }
      case "set_image": {
        const key = String(params.key ?? ""); const url = String(params.url ?? "");
        if (!key || !url) throw new Error("key + url required");
        const { data: prev } = await admin.from("site_content").select("value").eq("key", key).maybeSingle();
        await admin.from("site_content").upsert({ key, value: url, updated_by: actor });
        const id = await logAction(admin, actor, source, action, params, prev ?? null, { key, value: url });
        return { ok: true, id };
      }
      case "upsert_ontology_term": {
        const term = String(params.term ?? "").toLowerCase().trim();
        const kind = String(params.kind ?? "attribute");
        const world = Array.isArray(params.world) ? params.world as string[] : [];
        const synonyms = Array.isArray(params.synonyms) ? params.synonyms as string[] : [];
        const learned = Boolean(params.learned ?? false);
        if (!term) throw new Error("term required");
        const { data: prev } = await admin.from("fashion_ontology").select("*").eq("term", term).maybeSingle();
        const row = { term, kind, world, synonyms, learned };
        if (prev) await admin.from("fashion_ontology").update(row).eq("term", term);
        else await admin.from("fashion_ontology").insert(row);
        const id = await logAction(admin, actor, source, action, params, prev ?? null, row);
        return { ok: true, id };
      }
      case "merge_ontology_terms": {
        const from = String(params.from_term ?? "").toLowerCase().trim();
        const to = String(params.to_term ?? "").toLowerCase().trim();
        if (!from || !to || from === to) throw new Error("from/to required and different");
        const { data: fromRow } = await admin.from("fashion_ontology").select("*").eq("term", from).maybeSingle();
        const { data: toRow } = await admin.from("fashion_ontology").select("*").eq("term", to).maybeSingle();
        if (!toRow) throw new Error("target term missing");
        const mergedSyn = Array.from(new Set([...(toRow.synonyms ?? []), from, ...(fromRow?.synonyms ?? [])]));
        await admin.from("fashion_ontology").update({ synonyms: mergedSyn }).eq("term", to);
        // rewrite products tags
        const { data: prods } = await admin.from("products").select("id, tags").contains("tags", [from]);
        for (const p of prods ?? []) {
          const tags = ((p.tags as string[] | null) ?? []).map((t) => t === from ? to : t);
          const dedup = Array.from(new Set(tags));
          await admin.from("products").update({ tags: dedup }).eq("id", (p as { id: string }).id);
        }
        if (fromRow) await admin.from("fashion_ontology").delete().eq("term", from);
        const id = await logAction(admin, actor, source, action, params, { from: fromRow, to: toRow }, { to_synonyms: mergedSyn, moved_products: (prods ?? []).length });
        return { ok: true, id, moved: (prods ?? []).length };
      }
      case "set_config": {
        const key = String(params.key ?? "");
        if (!CONFIG_WHITELIST.has(key)) throw new Error(`config key '${key}' not whitelisted`);
        const value = params.value;
        const { data: prev } = await admin.from("ai_config").select("value").eq("key", key).maybeSingle();
        await admin.from("ai_config").upsert({ key, value: value as never, updated_by: actor });
        const id = await logAction(admin, actor, source, action, params, prev ?? null, { key, value });
        return { ok: true, id };
      }
      case "create_campaign_proposal": {
        const dSlug = String(params.designer_slug ?? "");
        const pSlug = String(params.product_slug ?? "");
        const prompt = String(params.prompt ?? "");
        const { data: d } = await admin.from("designers").select("id, brand_name").eq("slug", dSlug).maybeSingle();
        const { data: p } = await admin.from("products").select("id, name").eq("slug", pSlug).maybeSingle();
        if (!d || !p) throw new Error("designer/product not found");
        const { data: created } = await admin.from("campaigns").insert({
          designer_id: (d as { id: string }).id,
          product_id: (p as { id: string }).id,
          title: `${(p as { name: string }).name} · von PAWN vorgeschlagen`,
          kind: "text", status: "proposed",
          content: { prompt, source: "admin_chat" },
          created_by: actor,
        }).select("id").single();
        const id = await logAction(admin, actor, source, action, params, null, created);
        return { ok: true, id, campaign_id: (created as { id: string } | null)?.id ?? null };
      }
      case "send_notification": {
        const target = String(params.target ?? "");
        const title = String(params.title ?? "");
        const body = String(params.body ?? "");
        const link = params.link ? String(params.link) : null;
        if (!title || !body) throw new Error("title + body required");
        let targetIds: string[] = [];
        if (target === "admins") {
          const { data } = await admin.from("user_roles").select("user_id").eq("role", "admin");
          targetIds = ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
        } else if (target === "designers") {
          const { data } = await admin.from("user_roles").select("user_id").eq("role", "designer");
          targetIds = ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
        } else {
          targetIds = [target];
        }
        for (const uid of targetIds) {
          await admin.from("notifications").insert({ user_id: uid, type: "pawn.broadcast", title, body, link });
        }
        const id = await logAction(admin, actor, source, action, params, null, { count: targetIds.length });
        return { ok: true, id, count: targetIds.length };
      }
      case "recompute_trends": {
        try { await admin.functions.invoke("compute-trends", { body: {} }); } catch { /* soft */ }
        const id = await logAction(admin, actor, source, action, params, null, { triggered: true });
        return { ok: true, id };
      }
      case "set_plan": {
        const slug = String(params.designer_slug ?? "");
        const plan = String(params.plan ?? "");
        if (!["haus","atelier","maison"].includes(plan)) throw new Error("plan invalid");
        const { data: prev } = await admin.from("designers").select("id, plan").eq("slug", slug).maybeSingle();
        if (!prev) throw new Error("designer not found");
        await admin.from("designers").update({ plan }).eq("slug", slug);
        const id = await logAction(admin, actor, source, action, params, prev, { slug, plan });
        return { ok: true, id };
      }
      default:
        throw new Error(`unknown action: ${action}`);
    }
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    await logAction(admin, actor, source, action, req.params, null, null, "failed", msg);
    return { ok: false, error: msg };
  }
}

async function undo(admin: SupabaseClient, actor: string, action_id: string) {
  const { data: row } = await admin.from("ai_actions_log").select("*").eq("id", action_id).maybeSingle();
  if (!row) return { ok: false, error: "not found" };
  const r = row as { id: string; action: string; params: Record<string, unknown>; before: unknown; status: string };
  if (r.status !== "done") return { ok: false, error: "not undoable" };
  try {
    switch (r.action) {
      case "set_content":
      case "set_image": {
        const key = String(r.params.key ?? "");
        const prev = r.before as { value?: string } | null;
        if (prev && prev.value !== undefined) await admin.from("site_content").upsert({ key, value: prev.value, updated_by: actor });
        else await admin.from("site_content").delete().eq("key", key);
        break;
      }
      case "set_config": {
        const key = String(r.params.key ?? "");
        const prev = r.before as { value?: unknown } | null;
        if (prev && prev.value !== undefined) await admin.from("ai_config").upsert({ key, value: prev.value as never, updated_by: actor });
        else await admin.from("ai_config").delete().eq("key", key);
        break;
      }
      case "upsert_ontology_term": {
        const term = String(r.params.term ?? "");
        const prev = r.before as Record<string, unknown> | null;
        if (prev) await admin.from("fashion_ontology").update(prev as never).eq("term", term);
        else await admin.from("fashion_ontology").delete().eq("term", term);
        break;
      }
      default:
        return { ok: false, error: `action '${r.action}' not undoable` };
    }
    await admin.from("ai_actions_log").update({ status: "undone", undone_at: new Date().toISOString() }).eq("id", action_id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supaUrl, supaKey, { auth: { persistSession: false } });
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!(await requireAdmin(admin, user_id))) return ok({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const mode = url.searchParams.get("mode") ?? body.mode ?? "execute";

    if (mode === "undo") {
      const action_id = String(body.action_id ?? "");
      if (!action_id) return ok({ error: "action_id required" }, 400);
      return ok(await undo(admin, user_id!, action_id));
    }
    if (mode === "execute") {
      const request: ActionRequest = { action: String(body.action ?? ""), params: (body.params ?? {}) as Record<string, unknown>, source: (body.source ?? "admin_chat") as "admin_chat" | "system" };
      if (!request.action) return ok({ error: "action required" }, 400);
      return ok(await execute(admin, user_id!, request.source ?? "admin_chat", request));
    }
    return ok({ error: "unknown mode" }, 400);
  } catch (e) {
    return ok({ error: (e as Error).message }, 500);
  }
});
