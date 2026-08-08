# Known gaps / future work

Living doc for things shipped intentionally incomplete — noticed during
implementation, deferred for cost/scope reasons, not forgotten. Add an entry
whenever you cut a corner on purpose. Move to "Resolved" (don't delete) once fixed.

---

## Open

### Merge doesn't touch deal_history, emails, calls, or WhatsApp threads
**Where:** `mergeDeals()` in `src/hooks/use-crm-mutations.ts`
**What:** Transfers `deal_notes`, `activities`, `deal_products`, `appointments`
from the archived deal to the survivor. Does **not** transfer `deal_history` rows
(the archived deal keeps its own history — arguably correct, it's an audit log,
not app data) and never touches emails/calls/WhatsApp because those features
don't persist against `deal_id` yet in this codebase.
**Fix:** when Email/Ligações/WhatsApp get real per-deal tables, add them to the
same `Promise.all([...])` reassignment block, same pattern as the four already there.
**Priority:** low — follows naturally once those features exist, not before.

### No stable deal number (`#1`, `#2`, ...)
**Where:** `deals` table / `MergeDealModal` comparison table
**What:** The merge modal reference design showed a "Número" row (#1/#2). Schema
has no sequential/display number column, so that row was dropped rather than
faked. Not a bug, just an intentionally missing field.
**Fix:** add a `bigserial`/sequence column if the product actually wants stable
deal numbers shown to users (ticket-number style).
**Priority:** low — cosmetic, nobody's asked for it directly yet.

---

## Resolved

### Soft-deleted deals still counted in Dashboard / Forecast
**Where:** `src/app/page.tsx`, `src/app/forecast/page.tsx`
**What was wrong:** Dashboard stats/pipeline-stage memos and Forecast's `activeDeals`
computed straight off `state.deals` with no `!d.deletedAt` guard — a same-session
delete (which updates the record in place rather than removing it from local
state) could double-count until the next reload. `src/app/metas/page.tsx` was
audited too but never reads `state.deals` directly, so it needed no change.
**Fix applied:** dashboard now derives a memoized `deals = state.deals.filter(d
=> !d.deletedAt)` once and uses it everywhere the page used to read
`state.deals`; forecast's `activeDeals` filter gained `&& !d.deletedAt`.
**Date:** 2026-08-08.

### Restore banner only worked within the session that deleted the deal
**Where:** `src/app/negocios/[id]/page.tsx`
**What was wrong:** `crm-loader.ts` excludes soft-deleted deals from the initial
fetch, so `state.deals` never contains them after a fresh page load. The restore
banner only ever rendered because the in-session `deleteDeal()` mutation updates
the record in place instead of removing it from local state. Navigating directly
to `/negocios/{deletedId}` in a new session/tab gave "Negócio não encontrado"
instead of the restore banner.
**Fix applied:** when `state.deals.find()` misses and `loading` is done, fetch
the row directly via `supabase.from("deals").select(...).eq("id", id).maybeSingle()`
(ignoring the `deleted_at` filter) and, if it comes back with `deleted_at` set,
render a dedicated read-only orphan card (title, delete reason/note, who/when,
company/contact, value) with its own Restore button. Restore calls the existing
`restoreDeal()` mutation then does a full `window.location.reload()`, since the
orphan record isn't part of `CrmProvider`'s tracked state and can't be patched
in-place after the server update.
**Date:** 2026-08-08.

### `deal_notes` / `deal_products` / `appointments` RLS was owner-only, not workspace-aware
**Migration:** `supabase/migrations/20260808170000_workspace_rls_deal_notes_products_appointments.sql`
**What was wrong:** these 3 tables only had a single `ALL` policy gated on
`deals.user_id = auth.uid()`. `deals` and `activities` already had the
workspace-aware 4-way split (`workspace_member(d.user_id)` OR own). Since this
app is built multi-user-first (workspace/team_members, "Time" scope in
Conversas) even though only one real user exists today, any cross-owner
transfer — e.g. `mergeDeals()` merging a deal you own with a teammate's deal —
would silently fail to move notes/products/appointments under RLS (rows just
wouldn't match, no error surfaced to the UI).
**Fix applied:** mirrored `activities`' exact select/insert/update/delete policy
split onto all three tables. Verified via `pg_policies` before and after.
**Date:** 2026-08-08.
