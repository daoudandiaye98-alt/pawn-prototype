ALTER TABLE public.contract_versions ADD COLUMN IF NOT EXISTS body_markdown_en text;

UPDATE public.contract_versions SET body_markdown_en =
$MD$**Draft version — legal review pending.**

## 1. Parties
Between the PAWN platform (operator: see legal notice at pawn.vision/impressum) and the independent designer ("house").

## 2. Services provided by PAWN
- **Stage**: curated presentation in the PAWN catalogue (fashion / interior / art).
- **Doors**: automated matching of press, collection, and collaboration opportunities.
- **Campaign Studio**: browser-based video rendering plus an optional AI motion mode.
- **AI assistance (PAWN)**: personalised recommendations, trend report, Studio companion.
- **Payment processing**: Stripe Connect — sale proceeds flow directly to the house, PAWN receives only the commission.

## 3. Economic terms
- **Commission**: 7% of the gross sale price per item sold, per § 4 of the Terms & Conditions. Commission changes are announced at least 30 days in advance and never apply retroactively to already-paid orders.
- **Plans**: Free (€0/month, basic access) and Paid (price visible at /studio/plan). Existing Atelier subscriptions continue unchanged at their original price. Cancellable at any time via /vertrag-kuendigen, no minimum term.
- **Payout**: ongoing via Stripe Connect, once a purchase is completed and the statutory withdrawal period has been accounted for.

## 4. Amendments to this agreement (P2B Regulation)
PAWN announces material changes to this agreement at least **15 days** in advance (longer for more significant changes); the change is deemed accepted from the announced date if the house does not object or terminate beforehand. Changes appear as a consent notice in the Studio (no obligation to confirm immediately, see § 8).

## 5. Suspension and termination by PAWN (P2B Regulation)
PAWN may restrict, suspend, or terminate a house account for good cause (e.g. legal violation, deception, repeated customer complaints). In such a case the house receives, in advance, a **statement of reasons in text form** and, unless immediate suspension is legally required, a **reasonable opportunity to respond**. Permanent termination is announced with at least 30 days' notice, unless good cause requires immediate termination.

## 6. Complaints procedure
A house may at any time raise complaints about ranking, suspension, termination, or contract interpretation via a Studio message (Contact / message centre). PAWN acknowledges receipt and responds within a reasonable period. Independently of this, mediation remains available (see § 12 of the Terms & Conditions, EU dispute resolution platform).

## 7. Image rights
The house grants PAWN a non-exclusive, worldwide right to use uploaded images/videos for presentation and marketing purposes. **Revocable** by deleting the Studio account or by message request — PAWN removes affected assets within 14 days. Details on AI-assisted image use: see the "AI Usage Rights" agreement (kind ai_marketing).

## 8. Term & termination
Indefinite. The house may terminate at any time at the end of the current billing period via /vertrag-kuendigen. PAWN may terminate with 30 days' notice to the end of the month, except in the cases under § 5. The Studio remains active until the end of the respective notice period.

## 9. Data processing
Processing under GDPR. Details at /datenschutz. Customer data (order/message data) is shared with the house only in pseudonymised form (e.g. "User 3") — real names only where necessary for fulfilment.

## 10. Miscellaneous
Place of jurisdiction Germany, German law. Should any clause be invalid, the remainder stays valid.
$MD$
WHERE kind = 'designer' AND version = 3;

UPDATE public.contract_versions SET body_markdown_en =
$MD$**Draft version — legal review pending.**

PAWN does not order houses randomly or for payment, but by a traceable ranking — the "rank" (pawn → bishop → rook → queen).

## What feeds into the ranking
- **Profile completeness**: brand story, photos, product information.
- **Activity**: how regularly new pieces, campaigns, or updates appear.
- **Sales and interaction signals**: clicks, dwell time, completed purchases — aggregated, never individual customer data.
- **Fit with customer demand**: how well a house matches what visitors are currently looking for (see privacy policy, section 4).

## What does NOT feed into it
**No parameter of this ranking can be purchased.** A higher plan (Paid instead of Free) does not buy a better rank — it unlocks additional tools (more videos, more AI quota) that may indirectly lead to more activity, but the evaluation itself remains independent of the booked plan.

## Weighting
The relative weighting of the individual signals is an evolving system (`ai_config.matching_weights`), not a fixed point scheme — PAWN continuously adjusts it to reflect quality and genuine fit, not sheer volume.

## Your rights
You can see at any time in the Studio under "Proof" how your house is currently performing, and ask questions about your ranking via a message.
$MD$
WHERE kind = 'ranking' AND version = 1;

UPDATE public.contract_versions SET body_markdown_en =
$MD$**Draft version — legal review pending.**

PAWN retains **7% of the gross sale price** per order as an intermediation commission (`ai_config.platform_commission`). The remaining amount flows via Stripe Connect directly to the house — PAWN never holds the money itself.

**Payout**: ongoing, as soon as a purchase is completed, less the commission and any refunds/cancellations.

**Changes** to the commission rate are announced at least 30 days in advance (P2B Regulation) and never apply retroactively to already-completed orders.

**Subscription payments** (Paid plan) are independent of the sales commission and flow directly to PAWN as platform operator.
$MD$
WHERE kind = 'commission' AND version = 2;

UPDATE public.contract_versions SET body_markdown_en =
$MD$**Draft version — legal review pending.**

You permit PAWN to use the images and videos you submit for exhibition, editorial, and promotional purposes on pawn.vision as well as in official PAWN communication channels (social media, press inquiries, Première section). Image rights themselves remain with you.

This consent is separate from consent to **AI-assisted generation** of new images from your product photos (try-on images, product shots, campaign videos) — see the "AI Usage Rights" agreement (kind ai_marketing).

You can revoke this consent at any time in the Studio under Settings; running campaigns using these images will then be paused.
$MD$
WHERE kind = 'image_usage' AND version = 2;

UPDATE public.contract_versions SET body_markdown_en =
$MD$**Draft version — legal review pending.**

## What PAWN generates with AI from your images
From the product photos you upload, PAWN generates, at your request: try-on renderings (via fal.ai), background-removed product shots, and short campaign videos (via fal.ai or WAN). The generated results never depict a real, existing person — try-on models are either synthetically generated or drawn from a licensed model pool.

## Purpose limitation
Generated imagery is intended first for presenting your own house. Whether PAWN may additionally use selected imagery to promote the platform itself (landing page, PAWN channels, with credit and a link to your house) is a separate decision you make via the one-time media rights consent in the Studio (`designers.media_rights_granted_at`).

## Revocation
Both consents (own use / platform promotion) are separately revocable at any time in the Studio. Revocation does not apply retroactively to already-published material but prevents any future use.

## Labelling
All AI-generated depictions featuring synthetic persons carry a visible notice ("AI-generated") in the player and in shared placements — see the privacy policy and the "How PAWN Uses AI" help page for details.
$MD$
WHERE kind = 'ai_marketing' AND version = 2;

UPDATE public.contract_versions SET body_markdown_en =
$MD$**Draft version — legal review pending.**

As a house on PAWN you commit to:
- present your work honestly (real photos, correct measurements/materials, no misleading statements),
- process customer inquiries and orders within a reasonable time,
- meet the delivery times stated on the product page or actively communicate delays,
- use the AI quotas allotted to you (videos, shots, signatures) fairly within your plan — automated mass generation to circumvent quotas is not permitted.

PAWN reserves the right to remove content that violates this code of conduct, applicable law, or third-party rights — with a statement of reasons, see § 5 of the Designer Agreement.
$MD$
WHERE kind = 'designer_terms' AND version = 2;