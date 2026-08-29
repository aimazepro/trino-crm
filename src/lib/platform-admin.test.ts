import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesAdminAllowlist, tokenMatches } from "./platform-admin.ts";

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
