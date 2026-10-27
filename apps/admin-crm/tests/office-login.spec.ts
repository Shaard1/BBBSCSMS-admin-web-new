import { test, expect } from '@playwright/test';
import { NextRequest } from 'next/server';

test('office login derives permissions from the verified profile, not a selected role', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://office-login.example';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-public-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-server-key';
  process.env.ADMIN_SESSION_SECRET = 'synthetic-office-session-test-secret-with-over-32-characters';
  try {
    const { POST } = await import('../app/api/admin/session/route');
    for (const profile of [
      { role: 'staff', status: 'approved', allowed: true },
      { role: 'admin', status: 'approved', allowed: true },
      { role: 'staff', status: 'active', allowed: true },
      { role: 'resident', status: 'approved', allowed: false },
      { role: 'staff', status: 'rejected', allowed: false },
      { role: 'admin', status: 'pending', allowed: false },
    ]) {
      globalThis.fetch = async (input) => {
        const url = String(input);
        if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'synthetic-user' });
        if (url.includes('/rest/v1/profiles?')) return Response.json([profile]);
        throw new Error('Unexpected request in isolated login test');
      };
      const response = await POST(new NextRequest('http://localhost/api/admin/session', {
        method: 'POST', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: 'synthetic-token' }),
      }));
      expect(response.status).toBe(profile.allowed ? 200 : 403);
      const cookie = response.cookies.get('bc_admin_token');
      if (profile.allowed) {
        expect(cookie).toBeDefined();
        const payload = JSON.parse(Buffer.from(cookie!.value.split('.')[0], 'base64url').toString());
        expect(payload.role).toBe(profile.role);
      } else {
        expect(cookie).toBeUndefined();
      }
    }
    const missingToken = await POST(new NextRequest('http://localhost/api/admin/session', {
      method: 'POST', body: JSON.stringify({}),
    }));
    expect(missingToken.status).toBe(400);
    const crossOrigin = await POST(new NextRequest('http://localhost/api/admin/session', {
      method: 'POST', headers: { Origin: 'https://untrusted.example' },
      body: JSON.stringify({ accessToken: 'synthetic-token' }),
    }));
    expect(crossOrigin.status).toBe(403);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
  }
});
