import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomUUID, randomBytes } from 'node:crypto';
import { checkDocumentWorkflow } from './document-workflow-checks.mjs';

// Synthetic fixtures only. Never run against the live project or print credentials.
const env = parseEnv(readFileSync(new URL('../.env.test.local', import.meta.url), 'utf8'));
const base = env.NEXT_PUBLIC_SUPABASE_URL;
if (base !== 'https://xvpyskemxgspttzjokiu.supabase.co') throw Error('Wrong test project');
const publicKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serverKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!serverKey || !publicKey) throw Error('Missing test configuration');
const users = [];
const run = randomUUID();
let objectPath;
let reportId;
let basicAccountMode = false;
let failures = 0;
async function request(path, token, method = 'GET', body, binary = false) {
  const response = await fetch(base + path, {
    method,
    headers: { apikey: token === serverKey ? serverKey : publicKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': binary ? 'image/png' : 'application/json' } : {}),
      Prefer: 'return=representation' },
    body: body ? binary ? body : JSON.stringify(body) : undefined,
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = raw; }
  return { ok: response.ok, status: response.status, data };
}
function requireOk(result, step) {
  if (!result.ok) throw Error(`${step}: HTTP ${result.status}, code ${result.data?.code ?? result.data?.error ?? 'unknown'}, message ${result.data?.message ?? 'unavailable'}`);
  return result.data;
}
function check(name, passed, detail) {
  console.log(JSON.stringify({ test: name, passed, detail }));
  if (!passed) failures++;
}
async function account(role) {
  const email = `security-${run}-${users.length}@example.com`;
  const password = randomBytes(32).toString('base64url');
  const user = requireOk(await request('/auth/v1/admin/users', serverKey, 'POST',
    { email, password, email_confirm: true }), 'Create synthetic account');
  users.push(user.id);
  requireOk(await request('/rest/v1/profiles?on_conflict=id', serverKey, 'POST',
    { id: user.id, full_name: 'Synthetic access test', email, role, status: role === 'staff' ? 'approved' : 'pending' }), 'Create fixture profile');
  const session = requireOk(await request('/auth/v1/token?grant_type=password', null, 'POST',
    { email, password }), 'Sign in fixture');
  if (role === 'resident') {
    const preview = await request('/rest/v1/rpc/basic_registration_preview_available', session.access_token, 'POST', {});
    if (preview.ok) {
      if (preview.data !== true) throw Error('Enable the isolated basic-account test exception before this integration test.');
      basicAccountMode = true;
      const bypass = await request('/rest/v1/reports', session.access_token, 'POST', {
        user_id: user.id, description: 'Synthetic provisioning bypass check', status: 'pending',
      });
      check('New user cannot bypass account provisioning', !bypass.ok);
      if (bypass.ok && bypass.data?.[0]?.id) requireOk(await request(`/rest/v1/reports?id=eq.${bypass.data[0].id}`, serverKey, 'DELETE'), 'Remove bypass fixture');
      const access = requireOk(await request('/rest/v1/rpc/complete_basic_registration', session.access_token, 'POST', {
        p_full_name: 'Synthetic access test', p_phone: '+639171234567',
        p_privacy_version: '2026-10-21', p_terms_version: '2026-10-21',
      }), 'Provision synthetic basic resident');
      check('Basic account is active without phone or identity verification', access.account_state === 'active' && access.phone_verified === false && access.identity_status === 'unverified' && access.basic_access === true && access.test_access === true);
      const escalate = await request(`/rest/v1/resident_accounts?user_id=eq.${user.id}`, session.access_token, 'PATCH', { identity_status: 'verified', account_state: 'active' });
      check('Resident cannot set protected account or identity flags', !escalate.ok);
      const settings = await request('/rest/v1/resident_access_settings?singleton=eq.true', session.access_token, 'PATCH', { allow_unverified_test_access: true });
      check('Resident cannot change backend test-access settings', !settings.ok);
    } else if (preview.data?.code !== 'PGRST202') {
      throw Error('Cannot determine basic-account test configuration');
    }
  }
  return { id: user.id, token: session.access_token };
}
async function imageAccess(token) {
  const signed = await request(`/storage/v1/object/sign/report-images/${objectPath}`, token, 'POST', { expiresIn: 60 });
  if (!signed.ok || !signed.data?.signedURL) return false;
  const image = await fetch(base + '/storage/v1' + signed.data.signedURL);
  return image.ok && image.headers.get('content-type')?.includes('image/png');
}
try {
  const a = await account('resident');
  const b = await account('resident');
  const staff = await account('staff');
  objectPath = `${a.id}/security-${run}.png`;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  requireOk(await request(`/storage/v1/object/report-images/${objectPath}`, a.token, 'POST', png, true), 'Upload fixture image');
  const report = requireOk(await request('/rest/v1/reports', a.token, 'POST', {
    user_id: a.id, description: `Synthetic security test ${run}`, status: 'pending',
    image_url: `${base}/storage/v1/object/public/report-images/${objectPath}`,
  }), 'Submit fixture report');
  reportId = report[0].id;
  check('Resident A submits pending report', !!reportId);
  check('Resident A reads own private image', await imageAccess(a.token));
  check('Approved staff reads private image', await imageAccess(staff.token));
  const other = await request(`/rest/v1/reports?id=eq.${reportId}&select=id`, b.token);
  check('Resident B cannot read A report', other.ok && Array.isArray(other.data) && other.data.length === 0);
  check('Resident B cannot sign A image', !(await imageAccess(b.token)));
  const direct = await request(`/storage/v1/object/authenticated/report-images/${objectPath}`, b.token);
  check('Resident B cannot download A image directly', !direct.ok, { status: direct.status });
  const publicImage = await request(`/storage/v1/object/public/report-images/${objectPath}`, null);
  check('Logged-out public image URL blocked', !publicImage.ok, { status: publicImage.status });
  const forged = await request('/rest/v1/reports', a.token, 'POST', { user_id: a.id, description: `Synthetic forged ${run}`, status: 'resolved' });
  check('Resident cannot insert resolved report', !forged.ok, { status: forged.status, code: forged.data?.code });
  if (forged.ok && forged.data?.[0]?.id) requireOk(await request(`/rest/v1/reports?id=eq.${forged.data[0].id}`, serverKey, 'DELETE'), 'Remove forged fixture');
  const login = await fetch('http://localhost:3011/api/admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3011' }, body: JSON.stringify({ accessToken: staff.token }) });
  await checkDocumentWorkflow({request,requireOk,check,a,b,staff,serverKey});
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  check('Approved staff creates web session', login.ok && !!cookie, { status: login.status });
  requireOk(await request(`/rest/v1/profiles?id=eq.${staff.id}`, serverKey, 'PATCH', { status: 'rejected' }), 'Revoke synthetic staff');
  const revoked = await request(`/rest/v1/reports?id=eq.${reportId}&select=id`, staff.token);
  check('Revoked staff loses report access with same token', revoked.ok && Array.isArray(revoked.data) && revoked.data.length === 0);
  check('Revoked staff cannot obtain new signed image URL', !(await imageAccess(staff.token)));
  if (cookie) {
    const session = await fetch('http://localhost:3011/api/admin/session', { headers: { Cookie: cookie } });
    check('Revoked staff web session denied', session.status === 401, { status: session.status });
    const page = await fetch('http://localhost:3011/admin/dashboard', { headers: { Cookie: cookie }, redirect: 'manual' });
    check('Revoked staff dashboard redirects to login', [302, 307, 308].includes(page.status) && page.headers.get('location')?.includes('/admin/login'), { status: page.status });
  }
  if (basicAccountMode) {
    requireOk(await request(`/rest/v1/resident_accounts?user_id=eq.${a.id}`, serverKey, 'PATCH', { account_state: 'suspended' }), 'Suspend synthetic basic account');
    const suspended = await request(`/rest/v1/reports?id=eq.${reportId}&select=id`, a.token);
    check('Suspended resident loses report access with existing token', suspended.ok && Array.isArray(suspended.data) && suspended.data.length === 0);
    check('Suspended resident cannot sign their image', !(await imageAccess(a.token)));
  }
} catch (error) {
  failures++;
  console.error(error.message);
} finally {
  if (reportId) requireOk(await request(`/rest/v1/reports?id=eq.${reportId}`, serverKey, 'DELETE'), 'Clean fixture report');
  if (objectPath) requireOk(await request('/storage/v1/object/report-images', serverKey, 'DELETE', { prefixes: [objectPath] }), 'Clean fixture image');
  for (const id of users) {
    requireOk(await request(`/rest/v1/residents?user_id=eq.${id}`, serverKey, 'DELETE'), 'Clean fixture resident');
    requireOk(await request(`/rest/v1/profiles?id=eq.${id}`, serverKey, 'DELETE'), 'Clean fixture profile');
    requireOk(await request(`/auth/v1/admin/users/${id}`, serverKey, 'DELETE'), 'Clean fixture account');
  }
  console.log(JSON.stringify({ cleanup: 'completed', syntheticAccounts: users.length, failures }));
}
process.exitCode = failures ? 1 : 0;
