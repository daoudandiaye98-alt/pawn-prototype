# PAWN — Backend Architecture (Roadmap)

Status: **Not implemented.** This document defines the target Supabase schema and
backend boundaries for the post-prototype build. The current app is frontend-only
mock data; every admin and AI control surface has been typed and laid out to drop
cleanly onto these tables.

## 1. Principles

- **Lovable Cloud (Supabase)** for database, auth, storage, edge functions.
- **Lovable AI Gateway** for every model call. No provider keys in the client.
- **RLS everywhere.** Roles in a dedicated `user_roles` table — never on profiles.
- **Audit by default.** Every admin mutation writes `admin_audit_logs`.

## 2. Core tables

### Identity
- `profiles` — public profile, FK to `auth.users`.
- `user_roles` — `(user_id, role)` where `role ∈ {admin, moderator, designer, user}`.
  Roles checked via `public.has_role(uid, role)` security-definer function.

### Designers & Brands
- `designers` — house identity, slug, status, payout connection.
- `brands` — sub-labels under a designer (optional).
- `designer_applications` — onboarding flow; moves to `designers` on approval.

### Catalog
- `products`, `collections`, `product_images`
- `products.designer_id → designers.id`

### Commerce
- `orders`, `order_items`
- Order status lifecycle: `processing → shipped → delivered → returned`.

### DNA / Intelligence
- `dna_profiles` — per-user vector + the six Style Genome axes
  (`structure, edge, elegance, darkness, sensuality, utility`).
- `dna_reports` — versioned snapshots; report PDF in Storage.

### AI Control Plane
- `ai_settings` — provider, model, temperature, max_tokens, top_p (singleton per env).
- `ai_prompts` — versioned system prompts; `is_active` flag.
- `ai_knowledge_sources` — URLs / files / DB views the AI may read.
- `ai_tools` — capability flags (`enabled`, `requires_role`).
- `ai_logs` — request, response, latency_ms, tokens, actor.

### Plugins
- `plugin_connections` — `(slug, status, config_json, created_by)`.

### Auditing
- `admin_audit_logs` — `(actor, action, entity, entity_id, diff_json, at)`.

## 3. RLS sketch (must be re-validated at implementation time)

```sql
-- Public read of active products
create policy "public read products" on public.products
  for select to anon, authenticated using (status = 'Active');

-- Designers manage only their own catalog
create policy "designer writes own products" on public.products
  for all to authenticated
  using (public.has_role(auth.uid(), 'designer') and designer_id = (
    select id from public.designers where owner_id = auth.uid()
  ));

-- Admin full access
create policy "admin all products" on public.products
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'));
```

Every new public-schema table must include `GRANT` to `authenticated` and
`service_role` in the same migration (Supabase's Data API does not auto-grant).

## 4. Edge Functions

- `chat` — streams `streamText` via Lovable AI Gateway; persists to `ai_logs`.
- `dna-generate` — computes Style Genome from interactions; writes `dna_reports`.
- `apply-designer` — moderates `designer_applications`, notifies admin.
- `webhook-stripe` — payment lifecycle into `orders`.

## 5. Admin governance — what the platform owner controls

- Approve / reject designers
- Edit brands, products, collections
- Configure AI: provider, model, system prompt, personality, knowledge, tools
- Enable / disable plugins
- Inspect `ai_logs` and `admin_audit_logs`
- Marketplace settings (currency, regions, commission)

## 6. What is NOT in this prototype

- Real auth, RLS, or tables
- Real AI calls (mocked responses only)
- Real plugin integrations (catalog UI only)
- File storage / image uploads

When Lovable Cloud is enabled, migrate frontend mock data → real tables in the
order: `profiles → user_roles → designers → products → orders → dna_* → ai_*`.
