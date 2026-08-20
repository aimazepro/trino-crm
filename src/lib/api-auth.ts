import { NextResponse } from "next/server";
import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface ApiKeyContext {
  workspaceId: string;
  apiKeyId: string;
  defaultOwnerId: string | null;
  permissions: string[];
  rateLimitPerMin: number;
}

export function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function apiSuccess(data: unknown, warnings?: { field: string; message: string }[], status = 200) {
  const body: Record<string, unknown> = { data };
  if (warnings && warnings.length > 0) body.warnings = warnings;
  return NextResponse.json(body, { status });
}

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function hasPermission(permissions: string[], needed: string): boolean {
  return permissions.includes("all") || permissions.includes(needed);
}

/**
 * Resolves the Bearer key, checks the rate limit, checks the permission.
 * One call per route -- returns either a ready-to-use admin client + context,
 * or a NextResponse the route should return as-is.
 */
export async function authenticateApiRequest(
  request: Request,
  admin: SupabaseClient<Database>,
  requiredPermission: string | null
): Promise<{ ok: true; ctx: ApiKeyContext } | { ok: false; response: NextResponse }> {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, response: apiError("AUTH_REQUIRED", "Missing Authorization: Bearer header", 401) };
  }
  const raw = match[1].trim();
  const keyHash = hashKey(raw);

  const { data: key } = await admin
    .from("api_keys")
    .select("id, workspace_id, default_owner_id, permissions, rate_limit_per_min, revoked")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (!key || key.revoked) {
    return { ok: false, response: apiError("INVALID_API_KEY", "API key inválida ou revogada", 401) };
  }

  const permissions = (key.permissions as string[] | null) ?? ["all"];
  const ctx: ApiKeyContext = {
    workspaceId: key.workspace_id,
    apiKeyId: key.id,
    defaultOwnerId: key.default_owner_id,
    permissions,
    rateLimitPerMin: key.rate_limit_per_min,
  };

  const rate = await checkAndIncrementRateLimit(admin, ctx.apiKeyId, ctx.rateLimitPerMin);
  if (!rate.ok) {
    const response = apiError("RATE_LIMIT_EXCEEDED", "Limite de requisições excedido", 429);
    response.headers.set("Retry-After", String(rate.retryAfterSeconds));
    response.headers.set("X-RateLimit-Limit", String(ctx.rateLimitPerMin));
    response.headers.set("X-RateLimit-Remaining", "0");
    response.headers.set("X-RateLimit-Reset", String(rate.resetAt));
    return { ok: false, response };
  }

  if (requiredPermission && !hasPermission(permissions, requiredPermission)) {
    return { ok: false, response: apiError("INSUFFICIENT_SCOPE", `API key sem permissão '${requiredPermission}'`, 403) };
  }

  // Best-effort; a failed update here must never block the request.
  admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", ctx.apiKeyId).then(() => {});

  return { ok: true, ctx };
}

async function checkAndIncrementRateLimit(
  admin: SupabaseClient<Database>,
  apiKeyId: string,
  limitPerMin: number
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number; resetAt: number }> {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / 60000) * 60000);

  const { data } = await admin.rpc("increment_api_rate_limit", {
    p_api_key_id: apiKeyId,
    p_window_start: windowStart.toISOString(),
  });

  const count = (data as number | null) ?? 1;
  if (count > limitPerMin) {
    const resetAt = Math.floor((windowStart.getTime() + 60000) / 1000);
    return { ok: false, retryAfterSeconds: Math.max(1, resetAt - Math.floor(now.getTime() / 1000)), resetAt };
  }
  return { ok: true };
}

/**
 * Wraps a POST handler with generic Idempotency-Key support. If the header is
 * present and (workspaceId, key, method, path) was seen within the retention
 * window, replays the stored response instead of calling handler().
 */
export async function withIdempotency(
  admin: SupabaseClient<Database>,
  workspaceId: string,
  request: Request,
  method: string,
  path: string,
  handler: () => Promise<{ status: number; body: unknown }>
): Promise<NextResponse> {
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey) {
    const result = await handler();
    return NextResponse.json(result.body, { status: result.status });
  }

  const keyFilter = { workspace_id: workspaceId, idempotency_key: idempotencyKey, method, path };

  // Atomically claim this idempotency key before running the handler. The
  // table's primary key is (workspace_id, idempotency_key, method, path), so
  // if a concurrent request already claimed it, this insert fails with a
  // unique-violation instead of silently letting both requests run the
  // handler. response_status starts at 0 ("still in flight") and gets
  // updated once the handler completes.
  const { error: claimError } = await admin
    .from("api_idempotency_keys")
    .insert({ ...keyFilter, response_status: 0, response_body: {} });

  if (claimError) {
    // Someone else holds this key. Poll briefly for their result -- most
    // requests finish in well under a second. If it's still in flight after
    // ~2s, ask the client to retry rather than block indefinitely.
    for (let attempt = 0; attempt < 10; attempt++) {
      const { data: existing } = await admin
        .from("api_idempotency_keys")
        .select("response_status, response_body")
        .match(keyFilter)
        .maybeSingle();
      if (existing && existing.response_status !== 0) {
        return NextResponse.json(existing.response_body, { status: existing.response_status });
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return apiError("VALIDATION_ERROR", "Requisição com esta Idempotency-Key ainda está em processamento, tente novamente em instantes", 409);
  }

  let result: { status: number; body: unknown };
  try {
    result = await handler();
  } catch (err) {
    // handler() threw before returning a result -- release the claim so a
    // retry with the same Idempotency-Key can actually re-run, instead of
    // permanently 409ing against a claim row stuck at response_status: 0.
    await admin.from("api_idempotency_keys").delete().match(keyFilter);
    throw err;
  }

  if (result.status >= 200 && result.status < 300) {
    // Only a real success is safe to replay verbatim on a retry.
    const { error } = await admin
      .from("api_idempotency_keys")
      .update({ response_status: result.status, response_body: result.body as never })
      .match(keyFilter);
    if (error) console.error("withIdempotency: failed to persist result", error);
  } else {
    // Don't let a 4xx/5xx poison the key -- release the claim so a retry
    // (e.g. after the client fixes its request body) actually re-runs.
    const { error } = await admin.from("api_idempotency_keys").delete().match(keyFilter);
    if (error) console.error("withIdempotency: failed to release claim after non-2xx", error);
  }

  return NextResponse.json(result.body, { status: result.status });
}
