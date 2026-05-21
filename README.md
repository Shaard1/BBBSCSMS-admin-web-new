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

## Auth Notes

Admin pages use a layered guard:

- Middleware checks for the admin gate cookie before opening `/admin/*` routes.
- `AdminShell` verifies the active Supabase user has `profiles.role = admin`.
- Logout and failed admin verification clear the gate cookie.

The Supabase database policies should still enforce the final source of truth.
