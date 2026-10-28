import { test, expect } from "@playwright/test";
import { getAdminServerSession } from "../lib/workspace-session";

test.afterEach(() => { globalThis.fetch = originalFetch; });
const originalFetch = globalThis.fetch;

test("accepts verified office access and forwards abort signal without caching", async () => {
  const controller = new AbortController();
  globalThis.fetch = async (input, options) => {
    expect(input).toBe("/api/admin/session");
    expect(options?.cache).toBe("no-store");
    expect(options?.signal).toBe(controller.signal);
    return Response.json({ role: "admin", userId: "test-office" });
  };
  expect(await getAdminServerSession(controller.signal)).toEqual({ role: "admin", userId: "test-office" });
});

test("only explicit authentication denials return no session", async () => {
  for (const status of [401, 403]) {
    globalThis.fetch = async () => new Response(null, { status });
    expect(await getAdminServerSession()).toBeNull();
  }
});

test("temporary HTTP failures remain retryable instead of becoming logout", async () => {
  for (const status of [429, 500, 503]) {
    globalThis.fetch = async () => new Response(null, { status });
    await expect(getAdminServerSession()).rejects.toThrow("unavailable");
  }
});

test("network failures and timeouts propagate to the recovery screen", async () => {
  for (const error of [new TypeError("Failed to fetch"), new DOMException("Timeout", "AbortError")]) {
    globalThis.fetch = async () => { throw error; };
    await expect(getAdminServerSession()).rejects.toBe(error);
  }
});

test("malformed and non-office responses never grant access", async () => {
  for (const payload of [null, {}, { role: "resident", userId: "resident" }, { role: "staff", userId: " " }]) {
    globalThis.fetch = async () => Response.json(payload);
    await expect(getAdminServerSession()).rejects.toThrow("Invalid");
  }
});
