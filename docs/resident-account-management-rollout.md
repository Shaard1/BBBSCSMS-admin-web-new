# Resident account management — test rollout

## What changed

The CRM Resident Accounts page separates active/suspended access from SMS phone ownership. Legacy registrations keep their own review actions. New basic accounts never acquire a generic approval or an SMS verification override.

The directory has search, independent access/phone filters and 25-row server pagination. Details load registration images only when opened. Service history shows recent document checks per application, report count and administrator access events. Document details also show recent staff review entries. Global search uses UUID equality instead of unsupported UUID text matching and opens the matching resident or document.

Suspension/reactivation requires an active administrator, a reason and an unchanged expected account state. The server obtains the administrator from its signed session. The SQL locks the account, updates access and appends an audit entry atomically. Staff cannot call this server-only function. Phone confirmation and document checks are untouched.

Mobile now separates phone ownership from account access, applies the signup password policy to password changes, preserves password whitespace, rejects invalid/overlong Philippine contact numbers and allows an incomplete address. Editing contact details does not change the authentication phone. Fake office contact details and nonpersistent notification switches were removed. Two report screens were removed only after confirming neither was reachable from app navigation. Legacy signup remains for non-preview builds.

## Required next step

1. Select the **test** Supabase project `xvpyskemxgspttzjokiu`.
2. Earlier schema, security, basic-account and office-document migrations must already exist.
3. Run the complete `supabase/resident_account_management.sql` in its SQL Editor. This migration has **not** been executed by the coding agent. It does not bulk approve residents or confirm phone numbers.
4. Run the checks below. All results should be true.
5. Refresh the test CRM. The migration-pending banner should disappear. Directory filters, service history and administrator access actions should be available.
6. Rebuild the mobile test app with `flutter run --dart-define-from-file=config/supabase.test.json`.

```sql
select
  to_regprocedure('public.get_resident_directory(text,text,text,integer,integer)') is not null as directory_ready,
  to_regprocedure('public.get_resident_summary()') is not null as summary_ready,
  to_regprocedure('public.get_resident_metrics(integer)') is not null as metrics_ready,
  to_regprocedure('public.get_resident_service_history(uuid)') is not null as history_ready,
  not has_function_privilege('authenticated', 'public.set_resident_account_access(uuid,uuid,text,text,text)', 'execute') as clients_cannot_change_access_directly,
  not has_function_privilege('anon', 'public.get_resident_directory(text,text,text,integer,integer)', 'execute') as anonymous_directory_denied,
  (select relrowsecurity from pg_class where oid='public.resident_account_events'::regclass) as audit_rls_enabled;
```

Use disposable synthetic accounts for subsequent hosted access tests. Confirm administrator suspension denies that resident's basic service access, staff cannot reactivate them, administrator reactivation restores access, and each change has a reason and actor. Recheck document ownership and private-image access. These are **pending hosted integration checks**, not results established by UI fixtures.

## Validation and limits

Local validation: CRM TypeScript and lint checks; 11 service/unit tests; 28 Flutter tests and clean Flutter analysis; browser checks across all eight tabs at 1440px, 768px and 390px with accessibility/overflow checks; legacy evidence/approval and basic-account suspension/audit/staff-denial UI journeys passed against isolated synthetic fixtures. The initial 390px run found a keyboard-focus issue in the scrolling resident table; it was corrected and the phone-width check passed on rerun.

The new SQL has not been executed against PostgreSQL. The existing hosted test project currently uses a migration-compatible fallback directory; suspension is disabled there until migration. Its fallback is subject to the existing Supabase row limit and is not the scalable production path. SQL-backed filtering/counts must be verified after applying the migration.

Optimizations reduce transferred account fields, sign only displayed directory avatars, defer registration evidence and use aggregate counts for shell notifications. Report/document summaries skip image signing. These are structural reductions; no before/after production performance benchmark is claimed. Report/document list pagination and production load testing remain separate work.

Twilio, real SMS delivery, identity-proofing automation and production rollout remain deferred. No manual SMS override was added. The main Supabase project was not changed, and no changes were committed or pushed.
