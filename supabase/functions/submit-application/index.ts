// submit-application — atomic designer application submission with service role.
// Bypasses RLS to save the application even when the user is not yet signed in
// (fresh signup with email confirmation pending).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

interface Body {
  email?: string;
  password?: string;
  displayName?: string;
  brandName: string;
  legalName?: string;
  location?: string;
  country?: string;
  website?: string;
  instagram?: string;
  story?: string;
  tags?: string[];
  productionStatus?: string;
  portfolioPaths?: string[];
  acceptedContractIds?: string[];
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service, { auth: { persistSession: false } });

    const auth = req.headers.get("Authorization");
    let userId: string | null = null;
    let needsEmailConfirmation = false;

    if (auth?.startsWith("Bearer ")) {
      const supa = createClient(url, anon, { global: { headers: { Authorization: auth } } });
      const { data: claims } = await supa.auth.getClaims(auth.slice(7));
      if (claims?.claims?.sub) userId = claims.claims.sub as string;
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body || !body.brandName || body.brandName.trim().length < 2) {
      return json(400, { error: "brand_name_required" });
    }
    if (!Array.isArray(body.acceptedContractIds) || body.acceptedContractIds.length === 0) {
      return json(400, { error: "contracts_required" });
    }

    // Create user if not signed in
    if (!userId) {
      if (!body.email || !body.password) return json(400, { error: "email_password_required" });

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: false,
        user_metadata: {
          display_name: body.displayName || body.brandName,
          intent: "designer",
        },
      });

      if (createErr || !created?.user) {
        // If user already exists, look them up
        const msg = createErr?.message ?? "";
        if (/already/i.test(msg) || /registered/i.test(msg)) {
          const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
          const existing = list?.users?.find((u) => u.email?.toLowerCase() === body.email!.toLowerCase());
          if (!existing) return json(409, { error: "email_in_use_signin_required" });
          userId = existing.id;
          needsEmailConfirmation = !existing.email_confirmed_at;
        } else {
          return json(400, { error: createErr?.message ?? "signup_failed" });
        }
      } else {
        userId = created.user.id;
        needsEmailConfirmation = true;
        // Trigger the confirmation email
        try {
          await admin.auth.admin.generateLink({
            type: "signup",
            email: body.email,
            password: body.password,
            options: { redirectTo: `${new URL(req.url).origin}/apply` },
          });
        } catch { /* best-effort */ }
      }
    }

    if (!userId) return json(500, { error: "no_user" });

    // Load checksums for the accepted contracts
    const { data: contracts } = await admin
      .from("contract_versions")
      .select("id, checksum")
      .in("id", body.acceptedContractIds);
    const contractMap = new Map((contracts ?? []).map((c) => [c.id as string, c.checksum as string]));

    // Upsert application
    const { data: app, error: insErr } = await admin
      .from("designer_applications")
      .upsert(
        {
          user_id: userId,
          brand_name: body.brandName,
          legal_name: body.legalName ?? null,
          location: body.location ?? null,
          country: body.country ?? null,
          website: body.website ?? null,
          instagram: body.instagram ?? null,
          story: body.story ?? null,
          tags: body.tags ?? [],
          production_status: body.productionStatus ?? null,
          portfolio_paths: body.portfolioPaths ?? [],
          status: "submitted",
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select()
      .single();

    if (insErr || !app) return json(500, { error: insErr?.message ?? "application_insert_failed" });

    // Consents
    const consentRows = body.acceptedContractIds
      .filter((cid) => contractMap.has(cid))
      .map((cid) => ({
        application_id: app.id,
        user_id: userId!,
        contract_version_id: cid,
        checksum_at_accept: contractMap.get(cid)!,
        user_agent: req.headers.get("User-Agent") ?? null,
      }));
    if (consentRows.length) {
      await admin
        .from("designer_consents")
        .upsert(consentRows, { onConflict: "application_id,contract_version_id" });
    }

    // Domain event
    await admin.from("domain_events").insert({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      type: "designer.application_submitted",
      actor: userId,
      identity_scope: userId,
      payload: { application_id: app.id, brand_name: body.brandName },
    });

    return json(200, {
      ok: true,
      application_id: app.id,
      needs_email_confirmation: needsEmailConfirmation,
    });
  } catch (e) {
    console.error("submit-application", e);
    return json(500, { error: (e as Error).message ?? "unknown" });
  }
});
