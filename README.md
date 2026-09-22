# Bancao Connect

Monorepo for the Bancao Connect resident landing website and staff/admin CRM.

## Applications

- `apps/resident-web` — public landing page, APK download, and public information. It has no database credentials.
- `apps/admin-crm` — protected staff and administrator workspace backed by Supabase Auth, Database, and Storage.
- `barangay_mobile_app` — resident mobile client maintained in the sibling workspace project.

The Supabase project is shared by the mobile app and CRM. The resident landing website is intentionally static and does not connect to Supabase.

## Local development

Install dependencies from the repository root:

```bash
npm install
```

Run the applications independently:

```bash
npm run dev:resident
npm run dev:admin
```

Run checks for both applications:

```bash
npm run lint
npm run typecheck
npm run build
```

The CRM environment file belongs at `apps/admin-crm/.env.local` and must contain:

```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-public-key
NEXT_PUBLIC_SUPABASE_ANNOUNCEMENT_BUCKET=announcement-files
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
ADMIN_SESSION_SECRET=replace-with-a-long-random-secret
```

The service-role key and `ADMIN_SESSION_SECRET` are server-only. Never place them in `apps/resident-web` or the mobile application.

## Vercel deployment

Create two Vercel projects connected to this repository:

| Project | Root directory | Production domain |
| --- | --- | --- |
| Resident web | `apps/resident-web` | `bancao.com` |
| Admin CRM | `apps/admin-crm` | `admin.bancao.com` |

Set the CRM environment variables only on the Admin CRM project. The resident project needs no Supabase environment variables.

## CRM design and browser QA

The admin workspace includes a custom Bancao-Connect logo and responsive layouts for its eight service tabs. See [redesign decisions and QA notes](docs/admin-crm-redesign.md).

Run isolated browser checks with `npm --workspace apps/admin-crm run test:ui`. The suite uses synthetic local records, not the hosted Supabase database, and requires Google Chrome.

## Supabase and security

Database migrations and RLS hardening scripts are in `supabase/`. Review and apply them in a local or staging Supabase project before production. RLS remains the final authorization boundary for both the mobile app and the CRM.

The CRM routes are protected by server-side role checks, active Supabase account validation, and database policies. Hiding a link on the resident website is not considered authorization.
