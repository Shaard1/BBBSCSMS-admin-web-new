# Bancao Connect — Production-Readiness Audit

Audit date: 2026-09-21  
Scope: resident landing website, staff/admin CRM, supplied schema/RLS snapshot, local build and runtime checks.

## Executive summary

The application builds successfully and has a coherent Next.js App Router structure, but the supplied RLS snapshot contains critical authorization weaknesses. Several permissive policies (`USING (true)` / `WITH CHECK (true)`) overlap the intended policies, which means authenticated users can read or mutate records outside their role. The most serious example is the profile update policy: a resident can update their own profile row while the permissive policy does not protect the `role` column.

Application hardening completed in this work:

- Admin session cookies now require `ADMIN_SESSION_SECRET` with at least 32 characters; public Supabase values are no longer used as a fallback signing secret.
- Every privileged API request revalidates the signed session against the Supabase Auth user and current `profiles.role` / `profiles.status`.
- Disabled or deleted office accounts are rejected on the next request.
- Cookie-authenticated mutations reject cross-origin `Origin` headers.
- Security headers were added, including CSP, clickjacking protection, `nosniff`, referrer policy, permissions policy, and production-only HSTS.
- Announcement HTML is sanitized with DOMPurify and uploads are validated server-side, size-limited, type-limited, and assigned random server-generated names.
- Document status writes use an expected-status compare-and-swap to prevent lost concurrent updates.
- Next.js was updated from the resolved 15.5.18 to 15.5.24 within the existing major line.
- `supabase/rls_hardening.sql` was added but deliberately not applied to any database.

The RLS migration and storage-policy verification remain release blockers. The connected Supabase URL is a hosted Supabase project and the repository contains Vercel metadata, but no reliable staging/production marker was available; it was treated as production and no database mutation or destructive security test was run.

## Findings

### Critical — overlapping RLS policies permit cross-user access and role escalation

Affected components: `profiles`, `residents`, `reports`, `announcements`.

The supplied policy snapshot contains broad permissive policies such as:

- `profiles` readable by every authenticated user.
- `reports` readable by every authenticated user.
- `residents` readable by every authenticated user.
- `announcements` manageable by every authenticated user.
- `profiles` own-row update with a `WITH CHECK` that validates only `id = auth.uid()`.

PostgreSQL combines permissive policies with OR semantics. The broad policies therefore defeat the narrower role/ownership policies. Impact includes PII enumeration, report disclosure, unauthorized announcement changes, and resident role escalation.

Fix: review and apply `supabase/rls_hardening.sql` in local/staging first. It removes the broad policies, restores ownership/office-role boundaries, and adds database triggers preventing self-service changes to protected role, status, verification, and report workflow fields.

Verification: not applied or executed because the environment could not be established as non-production.

### High — stale or weak custom admin sessions

Affected components: `apps/admin-crm/lib/admin-session.ts`, middleware, admin API routes.

The previous implementation accepted a signed cookie until expiry without checking whether the Auth user or profile still existed. It also fell back to a public anon key or a development string when `ADMIN_SESSION_SECRET` was absent.

Fix: require a server-only secret, validate its minimum length, cap token size, revalidate Auth and profile state for every protected request, and require an approved/active office profile.

Verification: unauthenticated session requests return 401; full authenticated role tests require a controlled test account and were not run against the hosted project.

### High — stored XSS in announcement rendering

Affected component: `apps/admin-crm/app/admin/(protected)/announcements/page.tsx`.

The editor stored HTML and rendered it through `dangerouslySetInnerHTML`; the previous regex filtering was not a complete HTML sanitizer.

Fix: DOMPurify is now used with a strict formatting-only allowlist. Links, source URLs, event handlers, styles, SVG, and embedded content are not allowed.

Verification: production build passes. Browser-level malicious-content tests remain to be added in a controlled test environment.

### High — unsafe client-controlled announcement uploads

Affected components: announcement storage flow.

The previous browser upload accepted any `image/*` MIME type, including SVG, had no size limit, and derived names from the client filename.

Fix: uploads now go through `/api/admin/announcements/upload`; only JPEG, PNG, and WebP up to 5 MB are accepted, and the server generates a UUID path.

Remaining risk: the bucket visibility and Storage RLS policies were not available in the supplied schema. The `announcement-files` bucket must be reviewed before release.

### High — privileged browser writes depend on database RLS

Affected components: reports, announcements, office profile role updates.

Several mutations still use the browser Supabase client. This is acceptable only after the database RLS migration is applied and tested; the browser must never be considered a trusted authorization boundary.

Fix: the RLS hardening migration is included. Staff provisioning and resident/document privileged workflows use server routes with live admin-session validation.

### Medium — CSRF and session-cache hardening

Cookie-authenticated mutation routes now validate same-origin `Origin` headers. The admin session response is marked `Cache-Control: no-store`. SameSite=Lax, HttpOnly, Secure-in-production, and narrow path settings remain enabled.

### Medium — concurrent document status updates

The status API now requires the caller’s current status and updates with `WHERE id = ... AND status = ...`. A stale concurrent writer receives HTTP 409 instead of silently overwriting another administrator’s change.

### Informational — CSP uses inline allowances

The current CSP uses `unsafe-inline` for scripts/styles because the existing Next.js/Leaflet UI has no nonce pipeline. It includes `frame-ancestors 'none'`, `object-src 'none'`, explicit Supabase and OpenStreetMap sources, and no wildcard CORS policy. A nonce-based CSP should be considered in a future iteration.

## Authentication and authorization

The trusted path is now:

`browser Supabase login → same-origin session route → server HMAC cookie → live Auth/profile validation → role-gated API or RLS`

The current office roles are `admin` and `staff`; `resident` is a database role but not an admin-web role.

| Capability | Anonymous | Resident | Staff | Admin |
|---|---:|---:|---:|---:|
| View own profile | No | Yes | Yes | Yes |
| View all profiles/residents/reports | No | No | Yes | Yes |
| Approve/reject residents | No | No | Yes | Yes |
| Create/update report workflow fields | No | Own report only; protected workflow fields denied by trigger | Yes | Yes |
| Delete reports | No | Own report | No | Yes |
| Read published announcements | No | Yes | Yes | Yes |
| Manage announcements | No | No | Yes | Yes |
| Read/update document requests | No | Own request | All | All |
| View analytics | No | No | No | Yes |
| Manage office accounts/roles | No | No | No | Yes |

The matrix above describes the intended state after the unapplied migration. The supplied live-policy snapshot must be considered unsafe until it is replaced and negative tests pass.

## RLS and database report

Important supplied tables: `profiles`, `residents`, `reports`, `announcements`, `announcement_reads`, and `document_requests`.

- RLS is reported as present, but the policy overlap makes effective authorization too broad on the first four tables.
- `document_requests.sql` has a status check and office/owner policies; it was made transaction-wrapped and idempotent for policy recreation.
- The supplied schema has few visible foreign keys and domain checks outside document requests. Validate existing data before adding stricter constraints.
- Resident approval performs a resident update followed by a profile upsert. It can leave a partially completed workflow if the second write fails.
- Staff account provisioning has a compensating Auth-user deletion if profile creation fails, but this is not a database transaction.
- Backups, point-in-time recovery, Storage versioning, and restore drills were not verifiable from the repository.

## Security headers and cookies

Configured values:

- CSP: self plus explicit Supabase/OpenStreetMap sources; `frame-ancestors 'none'`; `object-src 'none'`.
- HSTS: `max-age=31536000` in production only.
- X-Frame-Options: `DENY`.
- X-XSS-Protection: `0`.
- X-Content-Type-Options: `nosniff`.
- Referrer-Policy: `strict-origin-when-cross-origin`.
- Permissions-Policy: camera, microphone, and geolocation denied.
- X-Permitted-Cross-Domain-Policies: `none`.
- CORS: no permissive CORS headers; mutation routes reject foreign origins.
- Admin cookie: HttpOnly, SameSite=Lax, Secure in production, Path=/, 24-hour max age.

## Dependency and quality results

Resolved versions include Next.js 15.5.24, React 19.2.6, TypeScript 5.9.3, Supabase JS 2.106.0, and DOMPurify 3.4.15. Next 15.5.24 is the supported 15.x Maintenance LTS security line as of this audit.

`npm audit --omit=dev` reports three transitive vulnerabilities: two high findings in PostCSS/nanoid and one moderate Next/PostCSS advisory path. npm only offered a fix through Next 16.3.5, which is a major upgrade. No `npm audit fix --force` or dependency override was used. These should be tracked and re-evaluated before release.

Results:

| Check | Result |
|---|---|
| `npm run lint` | Passed |
| `npx tsc --noEmit` | Passed when run after build generation completed |
| `npm run build` | Passed on Next.js 15.5.24 |
| Runtime headers | Passed: root 200 and unauthenticated session 401 contained headers |
| Cross-origin mutation check | Passed: foreign Origin returned 403 |
| Unit/component/E2E tests | Not configured in repository |
| RLS negative tests | Not run; no safe local/test database identified |
| `npm audit --omit=dev` | Failed gate with the three residual transitive findings above |
| `npm outdated` | Completed; reported available updates outside the selected security patch scope |
| `npm ci` | Blocked by a locked old SWC binary; `npm install` restored the local install from the lockfile |

## Remaining risks and required release actions

1. Apply and test `supabase/rls_hardening.sql` only in a known local/staging project, then promote through reviewed migrations.
2. Add negative RLS tests for anonymous, resident, pending resident, rejected resident, staff, and admin identities.
3. Verify Storage bucket visibility and policies; sensitive IDs and payment proofs should use private buckets and short-lived signed URLs.
4. Make resident approval and staff provisioning transactional where possible, or add durable audit/reconciliation records.
5. Add rate limiting and alerting for login/session, staff provisioning, upload, and repeated authorization failures.
6. Establish Supabase PITR/backup ownership and perform a restore drill.
7. Add Playwright security regression coverage for tampered cookies, direct API calls, IDOR, stored XSS, uploads, and role escalation.
8. Stop the process holding the old SWC binary and rerun `npm ci` in a clean workspace before release.

## Files modified or added

Audit changes include `SECURITY_AUDIT.md`, the `apps/admin-crm` security/session/API files, the isolated `apps/resident-web` landing app, root workspace metadata, `package-lock.json`, `supabase/document_requests.sql`, and `supabase/rls_hardening.sql`.

The working tree also contained pre-existing user changes to the landing/admin UI, documentation, and document-request feature; those were preserved and not reset.

## Git and environment notes

- Initial branch: `main`; it had pre-existing uncommitted changes.
- Creating an audit branch was attempted but blocked because `.git` is read-only in this workspace.
- `.env.local` is ignored and contains non-placeholder values; no secret values were printed or committed.
- No production SQL, destructive reset, user deletion, storage deletion, or destructive payload testing was performed.
