# Database and private-file security rollout

Status: prepared locally; NOT applied to hosted Supabase. Based on the supplied
inspection dated 20 October 2026. This is a coordinated web/mobile/database change.

## Included changes

- Remove ordinary clients' effective TRUNCATE/TRIGGER privileges on app tables;
  revoke access to the old RLS backup table; tighten postgres default table grants.
- Require approved office profiles in database role helpers and document policies.
- Protect new profile/resident/report/document records against client-supplied
  approval or processing decisions. Preserve the current pending-account model;
  Twilio signup is a later change, not enabled by this migration.
- Use user_id as canonical resident ownership, with id only as a legacy fallback.
  Protect linkage and verification fields on owner updates, including null user_id.
- Make resident-files/report-images private and remove public object reads.
  Owner and approved office users can obtain signed links. Announcement files
  remain public. Apply a 10 MiB JPEG/PNG/WebP limit to new sensitive uploads.
- Web and mobile fetch adapters convert existing public/authenticated/signed
  object locators into one-hour signed links without rewriting stored records.
  Unavailable or denied images resolve to an empty value; there is no public-URL
  fallback. Refresh/reload records to renew links after expiry. Already displayed
  images or downloaded copies cannot be recalled by changing bucket access.

## Important compatibility points

1. Old mobile versions using public image URLs will lose image access after the
   bucket change. Distribute/test updated clients and plan the upgrade cutover.
2. The current app may still write legacy public URLs as stable storage locators.
   This does not make a private object public. Do not save the temporary signed
   URLs to the database. Avoid exposing object locators in unauthenticated APIs.
3. Fee fields on new resident document requests are cleared by the insert guard:
   client amounts are not authoritative. Existing fees are not changed. Office fee
   assignment and the physical payment workflow still need their separate change.
4. awaiting_payment remains an allowed initial value temporarily for old-client
   compatibility. It is not permission to mark a request paid/completed. Remove it
   from new submissions when the online payment UI is removed.
5. The inspected database lacks columns still sent by the old GCash submission
   flow. That pre-existing incompatibility is not fixed by this security migration.
   Payment removal is the next functional task; do not enable that flow for users.
6. Previously uploaded payment proofs remain intact. Owners can read the legacy
   document-payment-proofs/<user-id>/ path; new uploads there are not enabled.
7. Role helpers require profiles.status='approved', matching the inspected check
   constraint. The existing server's additional acceptance of 'active' does not
   change that database constraint. Reconcile office profiles before deployment.
8. No table content is transformed or deleted. Existing suspicious/mismatched
   resident links require reconciliation, not automatic ownership reassignment.

## Staging-first sequence

1. Restore schema/policies and synthetic records into a known staging project.
   Export the current definitions and take a recoverable backup before rollout.
2. Review security_followup.sql against the actual staging schema and any policies
   added since the supplied inspection. Unexpected permissive policies can widen
   access; the migration only replaces the known policy names.
3. Deploy the updated web and mobile readers to staging, then apply
   supabase/security_followup.sql there. Run database_security_checks.sql and the
   full read-only inspection again. All acceptance rows must pass.
4. Perform the access tests below using separate synthetic Auth identities.
5. Confirm new private uploads meet the file-size/type restrictions on a device.
6. After staging passes and the concrete migration/diffs are reviewed, schedule
   the production client upgrade and database change together. No hosted change
   has been made by the agent.

## Required access tests (not executed locally)

| Identity/action | Expected result |
|---|---|
| Anonymous fetch of a known resident ID/report photo URL | Denied after cutover |
| Anonymous listing of sensitive storage objects | Denied |
| Resident A reads their evidence | Signed read allowed |
| Resident A reads/signs Resident B's evidence | Denied |
| Approved staff/admin reads evidence | Allowed |
| Staff changed to pending/rejected, using existing JWT | Office-wide database/storage access denied; own-record permissions may remain |
| Resident inserts profile/resident with approved status | Denied |
| Resident inserts resolved report or staff note | Denied |
| Resident inserts completed/rejected document request | Denied |
| Resident supplies another person's resident_id | Denied |
| Resident changes own verification status/linkage (including legacy null user_id) | Denied |
| Ordinary client has effective TRUNCATE/TRIGGER grant | Must be false |
| Legitimate registration, profile edit, report upload, office approval | Pass with synthetic records |
| Public announcement image | Remains readable |

SQL Editor owner/service-role execution bypasses ordinary RLS. Do not use a
service-role test request to claim that resident authorization has been tested.
Do not perform destructive TRUNCATE probes: inspect effective privileges instead.

## Rollback and limitations

The transaction rolls back if migration execution fails. If clients fail after
cutover, diagnose signing/authentication and pause rollout. Reverting a client
does not restore its ability to read private buckets. Do not make sensitive
buckets public as a convenience rollback; restore a previously working private
access implementation or fix forward. Keep exports for reviewed policy rollback.

The migration has not been executed against a local PostgreSQL/Supabase engine:
the Docker engine is unavailable in this environment. SQL compilation, effective
RLS behavior, and device/network behavior must be verified in staging. Automated
client tests mock delivery and prove URL resolution/failure behavior, not RLS.

Local validation: 21 Flutter tests passed; static analysis of all changed Dart
sources/tests reported no issues. Four web private-file service tests passed;
TypeScript checking and lint checking of the changed web files passed. No hosted
database, real resident account, or real uploaded file was used for these tests.
