# Test-project access checks — 2026-10-21

Target: designated test Supabase project `xvpyskemxgspttzjokiu` and local test CRM on port 3011. No production requests or changes.

Executed with `node apps/admin-crm/scripts/test-access-controls.mjs`. Three synthetic accounts (two pending residents, one approved staff), one pending report, and one tiny PNG were created. Fixture setup and cleanup used the server credential; assertions used ordinary resident/staff access tokens or unauthenticated requests. Credentials were neither printed nor saved by the test script.

| Check | Result |
| --- | --- |
| Resident A submits a pending report | PASS |
| A signs and downloads their private PNG | PASS |
| Approved staff signs and downloads A's PNG | PASS |
| B cannot select A's report | PASS — empty result |
| B cannot obtain a signed URL for A's image | PASS |
| B cannot download A's image through authenticated storage endpoint | PASS — HTTP 400 |
| Logged-out public image URL cannot retrieve PNG | PASS — HTTP 400 |
| Resident cannot create an already-resolved report | PASS — HTTP 403, PostgreSQL 42501 |
| Approved staff creates a CRM server session | PASS — HTTP 200 |
| Rejected staff loses access to A's report using the existing token | PASS — empty result |
| Rejected staff cannot obtain a new signed image URL | PASS |
| Existing rejected staff CRM session is denied | PASS — HTTP 401 |
| Rejected staff dashboard request redirects to login | PASS — HTTP 307 |

Run exited successfully with zero failed assertions. All three synthetic accounts, their profiles, the report, and the image were cleaned up. Existing user accounts were unchanged.

## Scope and limits

These are direct backend and CRM HTTP integration checks, not an exhaustive security audit or a mobile UI test. Existing signed URLs intentionally remain usable until expiry. Resident rejection does not imply blocking their own basic services; the revocation check concerns office-wide staff privileges. Current registration, document verification, and physical-payment workflow changes remain separate work.

The user separately reported successful mobile report submission, owner viewing of image/location, and approved staff viewing of report details/image/location. This automated run independently checks backend authorization with synthetic fixtures; it does not control or verify the installed phone build.
