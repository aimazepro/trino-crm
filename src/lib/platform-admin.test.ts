import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesAdminAllowlist, tokenMatches, can, isPlatformRole, PLATFORM_ROLES } from "./platform-admin.ts";

test("matches exact email in single-entry allowlist", () => {
  assert.equal(matchesAdminAllowlist("tools@trinocompany.com.br", "tools@trinocompany.com.br"), true);
});

test("case and whitespace insensitive", () => {
  assert.equal(matchesAdminAllowlist(" Tools@TrinoCompany.com.br ", "tools@trinocompany.com.br"), true);
});

test("matches one entry among several, comma separated", () => {
  assert.equal(matchesAdminAllowlist("b@x.com", "a@x.com, b@x.com ,c@x.com"), true);
});

test("rejects email not in allowlist", () => {
  assert.equal(matchesAdminAllowlist("evil@x.com", "tools@trinocompany.com.br"), false);
});

test("rejects when email is null", () => {
  assert.equal(matchesAdminAllowlist(null, "tools@trinocompany.com.br"), false);
});

test("rejects when allowlist env var is unset", () => {
  assert.equal(matchesAdminAllowlist("tools@trinocompany.com.br", undefined), false);
});

test("tokenMatches accepts identical strings", () => {
  assert.equal(tokenMatches("abc123", "abc123"), true);
});

test("tokenMatches rejects different strings", () => {
  assert.equal(tokenMatches("abc123", "abc124"), false);
});

test("tokenMatches rejects different-length strings without throwing", () => {
  assert.equal(tokenMatches("short", "a-much-longer-token"), false);
});

test("tokenMatches rejects when either side is missing", () => {
  assert.equal(tokenMatches(null, "abc123"), false);
  assert.equal(tokenMatches("abc123", undefined), false);
});

test("owner pode tudo", () => {
  for (const ability of ["read_aggregates", "read_customer_data", "block", "billing", "impersonate", "manage_operators", "hard_delete"] as const) {
    assert.equal(can("owner", ability), true, `owner deveria poder ${ability}`);
  }
});

test("support vê dado de cliente, bloqueia e impersona", () => {
  assert.equal(can("support", "read_customer_data"), true);
  assert.equal(can("support", "block"), true);
  assert.equal(can("support", "impersonate"), true);
});

test("support não mexe em plano, operador nem apaga em definitivo", () => {
  assert.equal(can("support", "billing"), false);
  assert.equal(can("support", "manage_operators"), false);
  assert.equal(can("support", "hard_delete"), false);
});

test("billing só vê agregado e mexe em plano", () => {
  assert.equal(can("billing", "read_aggregates"), true);
  assert.equal(can("billing", "billing"), true);
  assert.equal(can("billing", "read_customer_data"), false);
  assert.equal(can("billing", "block"), false);
  assert.equal(can("billing", "impersonate"), false);
  assert.equal(can("billing", "hard_delete"), false);
});

test("todo papel enxerga agregados do dashboard", () => {
  for (const role of PLATFORM_ROLES) {
    assert.equal(can(role, "read_aggregates"), true);
  }
});

test("isPlatformRole rejeita string desconhecida e não-string", () => {
  assert.equal(isPlatformRole("owner"), true);
  assert.equal(isPlatformRole("admin"), false);
  assert.equal(isPlatformRole(null), false);
  assert.equal(isPlatformRole(3), false);
});
