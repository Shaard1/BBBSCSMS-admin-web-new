# Bancao Connect Admin Web

Next.js admin web portal for Barangay Bancao-Bancao service management.

## Stack

- Next.js App Router
- React + TypeScript
- Supabase Auth, Database, and Storage
- Leaflet for the complaint map

## Setup

1. Install dependencies.

```bash
npm install
```

2. Create `.env.local` from `.env.example`.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-public-key
NEXT_PUBLIC_SUPABASE_ANNOUNCEMENT_BUCKET=announcement-files
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
ADMIN_SESSION_SECRET=replace-with-a-long-random-secret
```

`NEXT_PUBLIC_*` values are safe for browser/mobile clients. `ADMIN_SESSION_SECRET`
is server-only and must stay in the Next.js environment. The Supabase service role
key is also server-only; put the real value only in `.env.local` or your deployment
provider's private environment variables, never in Flutter/mobile code.

3. Make sure Supabase Storage has a public `announcement-files` bucket.

4. Run the development server.

```bash
npm run dev
```

5. Build for production.

```bash
npm run build
```

## Routes

- `/` Landing page
- `/admin/login` Admin login
- `/admin/dashboard` Dashboard
- `/admin/residents` Resident verification
- `/admin/reports` Community report management
- `/admin/map` Complaint map with report pins
- `/admin/announcements` Announcement management
- `/admin/analytics` Analytics overview
- `/admin/staff` Admin-only staff account management

## Resident Verification Flow

The system uses a layered resident verification flow instead of relying only on
manual approval.

1. Residents register once in the mobile app.
2. Residents confirm phone ownership through SMS OTP.
3. The account can log in as `unverified` with limited access.
4. Submitted information is checked against the barangay masterlist.
5. The system checks for possible duplicate or suspicious registrations.
6. Clean matches can move forward faster.
7. Flagged or unmatched accounts are reviewed by barangay staff or admins.
8. Only `verified` residents receive full access to services such as complaint
   reporting and certificate requests.

Suggested resident account states:

- `unverified`
- `verified`
- `review_required`
- `flagged_duplicate`
- `flagged_fraud`
- `rejected`

## Reporting Scope

The complaint reporting feature is intended only for non-emergency community
concerns.

- Supported concerns include issues such as road damage, blocked drainage,
  broken streetlights, garbage or cleanliness concerns, noise complaints, and similar barangay-manageable reports.
- Emergency incidents such as fire, medical emergencies, ambulance needs,
  and other urgent hazards should not be handled through the normal report flow.
- Residents should contact `911` immediately for emergencies because
  emergency response must be faster than app-based complaint processing.

## Auth Notes

Admin pages use a layered guard:

- Middleware checks for the admin gate cookie before opening `/admin/*` routes.
- `AdminShell` verifies the active Supabase user has `profiles.role = admin`.
- Logout and failed admin verification clear the gate cookie.

The Supabase database policies should still enforce the final source of truth.
