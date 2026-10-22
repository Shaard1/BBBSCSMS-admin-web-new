# Basic account registration — test rollout

Status: local implementation prepared; hosted SQL has not been applied. Twilio/SMS remains deferred. Do not deploy this preview to production.

## What changes

- The designated mobile test build uses a shorter signup: full name, Philippine mobile number, password and confirmation, test email, privacy notice and terms acceptance.
- No birthdate, detailed address, gender, civil status, ID images or profile photo are collected during basic registration.
- Email is temporarily required for test authentication because phone authentication cannot work without the deferred SMS provider. It is not the final optional-email design.
- Test users are explicitly phone unverified and identity unverified. No OTP is simulated or marked successful.
- New basic accounts do not enter the legacy manual account approval queue. The CRM and mobile admin list distinguish them from legacy accounts.
- Passwords use a 15–128 character UI rule and preserve spaces at signup and login. Set the same minimum in Supabase Auth password settings before rollout; the UI alone is not server enforcement.
- Phone parsing accepts valid local/international Philippine mobile forms, rejects extra digits, and never silently truncates.

## Apply and enable in TEST only

1. Confirm the dashboard project is **xvpyskemxgspttzjokiu**. The earlier test schema and `security_followup.sql` must already be present.
2. Run `supabase/basic_resident_accounts.sql` in its SQL Editor. It creates account/access settings and RPCs, retaining existing accounts and legacy resident statuses. The migration is transactional and can be rerun without re-enabling disabled test access.
3. In that same **test** project, explicitly enable the temporary test exception:

```sql
update public.resident_access_settings
set environment = 'test', allow_unverified_test_access = true
where singleton;

select public.basic_registration_preview_available(); -- expected true
```

This setting permits unverified basic accounts to exercise services in the isolated test project. It does not make their numbers verified. Do not enable it in the main project.

4. The local ignored mobile `config/supabase.test.json` now includes `BASIC_REGISTRATION_PREVIEW: "true"`. Build/run from the mobile folder:

```powershell
flutter run --dart-define-from-file=config/supabase.test.json
```

The new screen requires both this compile-time flag and the exact designated test project URL. Other builds retain the legacy registration route until the full rollout is ready. Hot reload does not switch compile-time configuration; stop the old run and launch the test build again.

5. Create a **new fake resident account** through the new screen. Existing accounts are not automatically converted. Existing legacy pending accounts still follow their prior approval rules.
6. If Supabase email confirmation is enabled, follow its confirmation process, then sign in to complete account provisioning. No instruction to disable email confirmation is shown. Authentication can succeed before profile provisioning; login retries finish interrupted provisioning using the supplied signup details.

## Backend controls

`resident_accounts` stores access state separately from service identity checks. Clients cannot insert or update it directly. Provisioning uses `complete_basic_registration`, which requires the caller's session, validates basic details/notice versions, creates only that caller's profile/resident record, and never links another resident by name, phone or date of birth. Existing legacy residents cannot silently convert themselves.

`phone_verified` is computed from Supabase Auth's confirmed phone and its match to the declared number; editable user metadata cannot grant verification. Legacy resident approval does not grant phone verification. The `identity_status` starts unverified and has no client write permission; no new identity approval workflow is enabled here.

A server-only snapshot freezes the pre-migration legacy resident population. A new user cannot obtain legacy access by skipping the new provisioning RPC or calling the old profile/resident insert endpoints. Rerunning this migration does not expand the snapshot.

Additional restrictive policies intersect the existing table/storage ownership rules. New basic accounts need active state plus a confirmed matching phone, or the explicit backend test exception. Suspending a new account blocks subsequent application data requests and new private image access; already downloaded information or issued signed URLs are not recalled. Existing accounts keep their prior rules. Office role/status checks remain in force.

## Verification and remaining work

Local verification: 27 Flutter tests passed (including six new tests), changed-file Flutter static analysis passed, and CRM TypeScript and changed-file ESLint checks passed. The integration test script's JavaScript syntax check passed. No PostgreSQL runtime is available locally, so this SQL must still be applied and exercised in the test project; the previous 13 security results do not certify this newer migration.

After applying, verify new registration, email-confirmation continuation if enabled, normal returning login without account approval, the unverified phone/identity labels, report submission/viewing, and the CRM's separate labels with no legacy approval actions. Repeat the backend access tests and add checks that a resident cannot self-verify/reactivate their account. Also confirm existing approved residents and office logins still work.

The existing `apps/admin-crm/scripts/test-access-controls.mjs` now detects this migration and provisions temporary basic accounts. Its extra checks cover provisioning bypass, unverified status, protected account/settings writes, and resident suspension. Run it after the migration and test exception are enabled; these added checks have not yet been executed against Supabase.

Still separate work: provider configuration and SMS signup, phone/password login, optional verified email, OTP/resend/abuse/recovery controls, legacy account migration, administrative suspension UI, document-specific identity/residency/representative checks, and removal of online payment. Do not interpret the shorter registration as completed document verification.

## Disable preview

Rebuild the mobile app without `BASIC_REGISTRATION_PREVIEW` to restore the legacy route. To stop unverified access on the test backend, set `allow_unverified_test_access = false`. New unverified accounts will then be denied basic services until a genuine phone verification path exists. Keep production access settings at their defaults.
