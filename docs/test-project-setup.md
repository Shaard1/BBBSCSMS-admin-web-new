# Isolated Supabase security test project

Designated test project: `xvpyskemxgspttzjokiu`.
The existing project's environment files and mobile defaults are unchanged.
Twilio is deferred. Use synthetic email/password accounts for this test.

## Database setup

1. In Supabase, select the designated NEW TEST project. Confirm the project ref
   before opening SQL Editor.
2. Run `supabase/test_project_schema.sql` there. It creates the six application
   tables, constraints, supporting functions/triggers, and known public-schema
   policies from the supplied inspection. It refuses to run if application tables
   already exist. No real resident data, accounts, or files are copied.
3. Run `supabase/security_followup.sql` in that same TEST project.
4. Run `supabase/database_security_checks.sql` and send the resulting check rows.
   These scripts have not yet been executed against PostgreSQL locally.
5. For the CURRENT signup implementation, enable email/password and disable
   email confirmation on this TEST project only. This is test compatibility, not
   the planned Twilio registration flow or a change to production Auth settings.

The schema snapshot does not contain Storage object policies. The security
follow-up adds private reads, but owner upload/update policies are added by the
test schema setup below to match inspected paths. Buckets start private for
resident files and reports, so an interrupted setup does not expose test evidence.

## Web test configuration

Local file: `apps/admin-crm/.env.test.local` (ignored by Git).
URL and publishable key are already populated. Enter the TEST project's server
key in `SUPABASE_SERVICE_ROLE_KEY` yourself; do not paste it into chat or commit it.
An independent session secret is generated locally. The variable name is retained
for compatibility with the existing app's server client.

Run from the web repository root:

```powershell
npm run dev:admin:test
```

Open `http://localhost:3011`. The launcher refuses an unexpected project URL or
missing server key. It uses `.next-test` instead of the main `.next` directory.
Do not upload the local test configuration as production environment settings.
For synthetic office accounts, create an Auth user in the TEST dashboard, then
set/upsert its profile there with role `admin` or `staff`, status `approved`, and
the SAME Auth user id. Do not reuse a real person's credentials.

## Mobile test configuration

Local file: `barangay_mobile_app/config/supabase.test.json` (ignored by Git).
It contains only the TEST URL and publishable key; never add a server key here.
From the mobile folder:

```powershell
flutter run --dart-define-from-file=config/supabase.test.json
```

Use a separate emulator/device for test runs. A phone build still shares the
current application ID with existing installations, so do not install it over an
active resident installation. This command does not alter the main backend
defaults, but an ordinary run without the flag still uses those main defaults.

## Next

After metadata checks pass, create synthetic residents/reports/evidence, approve
test residents through the test admin, and follow the positive/negative access
matrix in `database-security-rollout.md`. Passing metadata alone is not proof of
effective permissions. Do not apply or merge test changes to the main project yet.
