# Bancao Connect — Project Analysis Report

**Review date:** 20 October 2026  
**Scope:** `barangay_admin_next` and sibling `barangay_mobile_app`  
**Method:** Read-only source inspection

The analysis covered application source, configuration, SQL scripts, platform setup, and test implementations. Generated files, dependencies, caches, and build outputs were excluded. No project files were changed during the analysis, packages installed, builds or tests executed, or live database operations performed. This Markdown document was subsequently created at the user's request.

“Implemented” means an actual code path exists; it does not certify production behavior. Hosted configuration, database policies, deployed environment alignment, and device integrations remain unverified. No secrets or credentials are reproduced here.

Paths below are relative to the web project root. Mobile references use `../barangay_mobile_app/` so this report remains portable when both folders remain siblings.

## 1. Project Overview

**Bancao Connect is a barangay service management system** for Barangay Bancao-Bancao, Puerto Princesa City. It consists of:

- A **Flutter mobile application** for resident registration, community reports, document requests, announcements, and personal activity.
- A **Next.js staff/admin workspace** for reviewing and managing those submissions.
- A separate **public website** explaining services and distributing the Android APK.
- A **Supabase backend** providing authentication, PostgreSQL data, and file storage.

## 2. Technology Stack

| Technology | Actual role |
|---|---|
| Dart / Flutter | Mobile interface, navigation, forms, device interactions |
| TypeScript / React 19 / Next.js 15 | Public website, admin interface, server API routes |
| Supabase Auth | Email/password accounts and sessions |
| Supabase PostgreSQL | Resident, report, announcement, and document records |
| Supabase Storage | Identification, profile, report, announcement, and payment images |
| Leaflet / React Leaflet | Web complaint maps |
| Flutter Map / Geolocator | Mobile maps, GPS, and location selection |
| OpenStreetMap / Nominatim | Map tiles and mobile address searches |
| Image Picker / Camera / image compression and cropping | Mobile image capture and processing |
| DOMPurify | Sanitization of announcement HTML in the web app |
| Playwright / axe-core | Browser workflow, responsive layout, and accessibility tests |
| Flutter Test | Widget, interaction, model, and visual checks |
| npm workspaces / ESLint / TypeScript / Flutter lints | Development organization and static checks |

The mobile app principally uses `StatefulWidget` and `setState`; the README's Provider/GetX description does not match the implementation reviewed.

Evidence: [web dependencies](apps/admin-crm/package.json) and [mobile dependencies](../barangay_mobile_app/pubspec.yaml).

## 3. Folder Structure

| Folder | Responsibility |
|---|---|
| `apps/admin-crm/app` | Admin routes, feature screens, layouts, and server API handlers |
| `apps/admin-crm/components` | Navigation shell, dialogs, dropdowns, maps, image viewers, shared interface elements |
| `apps/admin-crm/lib` | Authentication, session verification, roles, data access, normalization, search, and metrics |
| `apps/admin-crm/scripts` | Administrator account provisioning utility |
| `apps/admin-crm/tests` | Playwright tests and isolated backend fixtures |
| `apps/resident-web/app` | Public information page, metadata, styling |
| `apps/resident-web/components` | Navigation and animated presentation |
| `apps/resident-web/public` | Public assets and downloadable APK |
| `supabase` | Document-request schema and authorization hardening SQL |
| `docs` | Branding, interface decisions, and historical QA notes |
| `../barangay_mobile_app/lib/core` | Backend initialization, theme, interaction behavior |
| `../barangay_mobile_app/lib/screens/auth` | Login, registration, identification capture and verification |
| `../barangay_mobile_app/lib/screens/residents` | Resident dashboard, reports, documents, announcements, profile/security |
| `../barangay_mobile_app/lib/screens/admin` | Basic mobile report and resident administration |
| `../barangay_mobile_app/lib/services` and `lib/models` | Authentication, announcement operations, announcement parsing |
| `../barangay_mobile_app/lib/widgets` | Shared controls, feedback, startup and selection components |
| `../barangay_mobile_app/test` | Mobile model, widget, interaction, and visual tests |
| Mobile platform folders | Android, iOS, desktop, and web launchers, permissions, packaging configuration |
| `../barangay_mobile_app/assets` | Images and bundled fonts |

The web folder is an npm monorepo containing two apps. The Flutter project is maintained separately.

## 4. System Architecture

**Architecture:** A client-server system using a managed backend, with a hybrid web backend. It is not a microservice architecture.

```text
Public website --------------------> Service information and APK download

Flutter mobile --------------------> Supabase Auth / Database / Storage
Admin browser ---------------------> Supabase Auth / Database
Admin browser -> Next.js APIs ------> Supabase privileged operations
```

The public website has no application database integration. The other clients are designed to share Supabase, although their currently deployed environment alignment was not verified.

### Frontend and backend communication

- Mobile screens frequently perform Supabase operations directly.
- Web feature screens call functions in `lib`, many of which access Supabase from the browser.
- Selected sensitive operations use Next.js route handlers: session creation, resident approval/rejection, document status changes, staff provisioning/deletion, and announcement uploads.
- There is no separate conventional controller/service backend. Next.js route handlers provide the server endpoints.

### Authentication and authorization

- Web office roles are `admin` and `staff`.
- Both handle resident services; analytics, office accounts, and report deletion have additional administrator restrictions.
- The web app combines Supabase login with a signed, HttpOnly office-session cookie. Protected requests recheck the current Auth user and profile.
- Mobile login checks resident approval, but mobile session restoration uses a different path.
- Database row-level security remains essential because clients can directly access Supabase.

Sources: [server sessions](apps/admin-crm/lib/admin-session.ts), [roles](apps/admin-crm/lib/roles.ts), and [mobile authentication](../barangay_mobile_app/lib/services/auth_service.dart).

### Database model

Code accesses `profiles`, `residents`, `reports`, `announcements`, `announcement_reads`, and `document_requests`.

Ownership generally uses Auth user IDs. Announcements track creators; read records connect users to announcements. Most relationships are inferred from application queries: the repository does **not** contain a complete schema proving all foreign keys and constraints.

The supplied document schema explicitly links `user_id` to `auth.users`; `resident_id` has no declared foreign key. See [document-request SQL](supabase/document_requests.sql).

### Important workflows traced

| Workflow | Actual implementation |
|---|---|
| Registration | Create Auth account → upload identification → insert pending resident |
| Verification | Web API updates resident → separately synchronizes profile |
| Reporting | Mobile uploads photos → inserts report → web changes status/category/note → mobile fetches activity |
| Documents | Mobile validates form/uploads payment proof → inserts request → office updates status |
| Announcements | Office uploads images and stores content → mobile fetches published notices and records reads |
| Office accounts | Administrator invokes server API → creates/deletes Auth account and profile |

### Configuration and deployment

- The web root uses npm workspaces and separate development/build/check commands for both apps.
- The documented deployment uses two Vercel projects, one per web application. This is deployment intent, not verification of live hosting.
- CRM configuration uses environment variables for Supabase and its server-only service key and session secret. The public website needs no Supabase configuration.
- Mobile configuration reads compile-time Dart definitions and also contains fallback public Supabase configuration. A public publishable key is not a server service-role secret.
- Android and iOS permissions cover camera, photo access, and location as applicable. The presence of other platform folders does not establish that those platforms have been validated.

Sources: [web setup](README.md), [root scripts](package.json), and [mobile configuration](../barangay_mobile_app/lib/core/supabase_config.dart).

## 5. Existing Features

### Resident application

Registration with identification photos; approval messages; profile editing; password changes/reset-email requests; reports with up to ten photos and map/GPS locations; report and document activity; announcement galleries and read tracking.

Document forms cover indigency, good moral/residency, loan clearance, barangay ID, special certification, store business clearance, tricycle clearance, and banca clearance.

Basic mobile administrator screens also exist for report and resident administration.

### Web workspace

Dashboard queues, resident verification, report management, complaint map, document processing, announcement drafts/publication, analytics, office accounts, global search, and polling-based header notifications.

### Public website

Service guides, FAQs, office information, responsive navigation, animated visuals, and Android download.

Sources: [mobile resident implementation](../barangay_mobile_app/lib/screens/residents/resident_dashboard_screen.dart), [admin navigation](apps/admin-crm/components/admin-shell.tsx), and [public page](apps/resident-web/app/page.tsx).

## 6. Development Status

| Functionality | Assessment |
|---|---|
| Public information website | Implemented in source |
| Resident registration and verification | Implemented, with consistency/recovery gaps |
| Reports, photos, locations, office updates | Implemented, with cross-client status inconsistency |
| Document submission and processing | Implemented; forms explicitly describe themselves as draft |
| Announcements and read tracking | Implemented |
| Dashboard, analytics, search, office accounts | Implemented |
| Mobile administration | Basic implementation; differs from web workflows |
| GCash payments | Partial: demo receiver, manual reference/screenshot submission |
| Notification preferences | Interface state only; no persistence found |
| Push notifications / live mobile subscriptions | No implementation found |
| Generated/downloadable issued certificates | No implementation found |
| OTP login, video reporting, heatmaps, offline submission | No implementation found in the reviewed source |
| Production security and device behavior | Unverified |

## 7. Technical Observations

### High priority

1. **Supplied database policies leave workflow fields insufficiently protected.** Resident insertion checks ownership without requiring pending status. Report insertion similarly does not restrict initial workflow status. Document insertion checks ownership but permits client-supplied fees and any allowed status. These are confirmed gaps in the supplied SQL; whether additional hosted controls exist is unknown. Sources: [RLS script](supabase/rls_hardening.sql) and [document SQL](supabase/document_requests.sql).

2. **Mobile approval enforcement is inconsistent.** The missing-record recovery branch creates a pending resident and returns resident success. Startup routes existing sessions through profile roles without repeating the normal approval check. Admin login also checks role without checking profile status. Database enforcement is therefore critical. Sources: [Auth service](../barangay_mobile_app/lib/services/auth_service.dart), [startup](../barangay_mobile_app/lib/screens/intro/app_intro_screen.dart), and [home routing](../barangay_mobile_app/lib/screens/home_screen.dart).

3. **Sensitive files use public-URL access patterns.** Identification images and payment proofs are stored using `getPublicUrl`. Actual exposure depends on unverified bucket settings; private buckets would also require a different retrieval flow. Sources: [registration uploads](../barangay_mobile_app/lib/screens/auth/register_screen.dart) and [payment uploads](../barangay_mobile_app/lib/screens/residents/resident_dashboard_screen.dart).

4. **Database setup is not reproducible from these folders alone.** Core table definitions, storage policies, and definitions for `is_admin()` / `is_staff_or_admin()` are absent. The historical audit reports unsafe policies, but that is not proof of the current hosted state. Sources: [SQL directory](supabase/) and [historical audit](SECURITY_AUDIT.md).

### Medium priority

5. **Registration and approval are multi-step, non-atomic operations.** Failures can leave Auth accounts/uploads without completed registration, or approved residents without synchronized profiles. Registration also requires email confirmation to be disabled. Sources: [registration](../barangay_mobile_app/lib/screens/auth/register_screen.dart) and [approval API](apps/admin-crm/app/api/admin/residents/%5Bid%5D/route.ts).

6. **Report statuses disagree across clients.** Web writes `in progress`, but the mobile ongoing-report filter recognizes `in_progress` and `ongoing` instead. Consequently, an in-progress report can disappear from that Home section. Sources: [web report screen](apps/admin-crm/app/admin/%28protected%29/reports/page.tsx) and `_buildStyledHomeTab` in the [mobile dashboard](../barangay_mobile_app/lib/screens/residents/resident_dashboard_screen.dart).

7. **Payment behavior needs completion.** Demo GCash details remain; fees originate in mobile constants. Even the free indigency option defaults to GCash and requires payment evidence unless another method is selected. Source: `_validateCertificateRequest` and the payment/form implementation in the [mobile dashboard](../barangay_mobile_app/lib/screens/residents/resident_dashboard_screen.dart).

8. **Android release packaging is unfinished.** Release uses debug signing and the example application ID. Source: [Android configuration](../barangay_mobile_app/android/app/build.gradle.kts).

9. **Scale and consistency risks remain.** Several screens fetch entire tables and filter/aggregate locally. Report updates lack the conflict protection implemented for document updates. Last-administrator protection during role changes exists in the interface rather than a dedicated server operation. Sources: [report access](apps/admin-crm/lib/reports.ts), [document update API](apps/admin-crm/app/api/admin/document-requests/%5Bid%5D/route.ts), [role updates](apps/admin-crm/lib/office-accounts.ts), and [staff screen](apps/admin-crm/app/admin/%28protected%29/staff/page.tsx).

### Maintainability and validation

- The mobile resident dashboard exceeds 6,000 lines and combines presentation, validation, business rules, uploads, and database access.
- Legacy `report_screen.dart` and `my_reports_screen.dart` have no references from the current application source found during this scan; equivalent functionality lives in the dashboard.
- Mobile profile operations often assume `residents.id == auth user ID`, while login also supports linkage through `user_id`.
- API payloads use TypeScript casts rather than complete runtime shape validation; malformed field types can cause exceptions.
- Several errors are silently ignored or treated as best-effort synchronization.
- The mobile README contains claims and structure descriptions that differ from actual code.
- Notification preference switches only update local widget state. No persistence or delivery integration was found. Web header notification counts are polled every 15 seconds.

### Positive controls

Web session revalidation, cross-origin mutation checks, security headers, announcement sanitization, upload limits, and conflict-aware document updates are present.

### Testing infrastructure and limits

Playwright covers office workflows, accessibility, responsive behavior, and failures against synthetic fixtures. Flutter tests cover models, startup, forms, navigation, and resident UI. These do not demonstrate live RLS, storage permissions, camera/GPS behavior, or complete cross-application integration. No coverage percentage was established. No tests were executed during this analysis.

Sources: [browser tests](apps/admin-crm/tests/workspace.spec.ts), [fixture backend](apps/admin-crm/tests/serve-fixture.mjs), [mobile widget tests](../barangay_mobile_app/test/widget_test.dart), and [mobile visual tests](../barangay_mobile_app/test/resident_visual_test.dart).

## 8. Capstone Readiness

The source provides a substantial baseline for comparison. Once the paper is supplied, the main areas to map are:

- Required actors and permissions, including mobile administrator access.
- Verification rules, identification requirements, and account lifecycle.
- Report categories, statuses, location requirements, and history.
- Exact document types, fields, fees, payment procedures, and release process.
- Notification delivery versus in-app refresh.
- Analytics definitions and expected outputs.
- Security, privacy, supported platforms, deployment, and acceptance tests.

**No compliance assessment has been made.** The paper's requirements can subsequently be classified as **implemented, partial, missing, inconsistent, or requiring runtime verification**, with supporting source references.

This report preserves the current implementation baseline for that comparison. It should be revisited if the code or hosted configuration changes.

## 9. Final Project Summary

**Bancao Connect connects resident mobile submissions with barangay office processing through Supabase.** Its core services have substantial implementations, supported by a public website and automated interface tests.

The main unresolved areas are consistent authorization, database/storage verification, payment and notification completion, production packaging, and end-to-end validation.
