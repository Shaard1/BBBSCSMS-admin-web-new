# Bancao-Connect CRM redesign

Date: 22 September 2026

## Design direction

A calm blue-and-slate service workspace with compact navigation, clear page headings, readable status labels, and controls placed next to the work they affect. Each screen has a distinct job; the dashboard no longer repeats the analytics page.

References reviewed:

- [Awwwards sidebar navigation reference](https://www.awwwards.com/inspiration/sidebar-menus-e-comm-43-shopify-experience): navigation hierarchy and a consistent workspace frame.
- [IBM Carbon data-table guidance](https://carbondesignsystem.com/components/data-table/usage/): searchable directories, filters, clear row actions, and restrained information density.
- [Atlassian panel guidance](https://atlassian.design/components/panel/usage): keeping record details and related actions together.

These informed the layout; no reference site's artwork or source code was copied. Coding-excellence guided reusable components and regression checks. Adaptive-dynamic guided responsive layouts, keyboard navigation, focus handling, and reduced-motion support. No offline cache or service worker was added for sensitive CRM records.

## Screen decisions

| Screen | Primary job | Result |
| --- | --- | --- |
| Dashboard | Decide what to work on next | Four service metrics, actionable review queues, recent reports, oldest pending registrations, links to map and notices |
| Analytics | Understand demand and progress | All-time snapshot, year-specific monthly activity, exact-value data table, status and category distributions |
| Staff accounts | Manage office access | Searchable directory, role guidance, separate creation dialog, clear account status and deletion confirmation |
| Community reports | Triage and follow up | Evidence-led case cards, status/category controls, searchable inbox, keyboard-accessible details, resident-visible staff notes |
| Document requests | Move applications through processing | Status filters, readable request list, current-status summary, one explicit update action, required rejection reason |
| Complaint map | Locate concerns and inspect field context | Large map beside a synchronized queue/details panel, compact filters, explicit count of reports without valid coordinates |
| Resident verification | Review evidence before making a decision | Registration queue, clear pending/approved/rejected labels, identity evidence, review guidance, approval/rejection dialogs |
| Announcements | Prepare and manage public notices | Library-first layout, published/draft filters, separate composer, draft by default, upload-aware save controls |

## Functional and accessibility fixes

- Standalone login now offers both staff and administrator access. Role selection does not grant a role; the server still validates the account.
- Passwords are no longer trimmed during login.
- Login errors and access-check failures no longer leave an indefinite submitting/checking state.
- Analytics counts months within the selected year. Zero values render as zero rather than minimum-height bars.
- Shared coordinate validation excludes out-of-range, non-finite, and placeholder coordinates.
- Document details derive the selected record from its ID, so successive updates send the current expected status.
- Document rejection uses a labeled form rather than a browser prompt.
- Report and map details refresh the selected record instead of retaining an outdated object.
- Staff status no longer calls every unrecognized state “Approved.”
- Native selects replace the custom dropdown's incomplete keyboard behavior.
- Native dialogs provide focus containment, Escape handling, inert background content, and focus restoration.
- Action errors are visible inside the relevant dialogs.
- Mobile navigation supports keyboard containment and Escape; closed navigation is hidden from keyboard access.
- A skip link, one main landmark, current-page navigation state, labeled inputs, pressed filter states, visible focus, and reduced-motion rules are included.
- Announcement thumbnails are contained in their image frame and saving is disabled during uploads.
- OpenStreetMap attribution remains visible, including in report details.
- The old overlapping CRM stylesheet was replaced by `apps/admin-crm/app/workspace.css`; the original is recoverable from Git history.

## Custom logo

Original vector mark: a neighborhood roof and two connected people/nodes inside a blue rounded square. The mint connection provides a recognizable small-size accent.

- Mark / favicon: [bancao-connect-mark.svg](../apps/admin-crm/public/assets/bancao-connect-mark.svg)
- Horizontal wordmark: [bancao-connect-logo.svg](../apps/admin-crm/public/assets/bancao-connect-logo.svg)
- Shared UI component: `apps/admin-crm/components/brand.tsx`

Used on the login screen, sidebar, and favicon. The barangay seal is retained as an existing asset and is not represented as this product logo.

## Reproducible QA

```sh
npm run lint:admin
npm run typecheck:admin
npm --workspace apps/admin-crm run test:ui
npm run build:admin
```

The browser suite uses installed Google Chrome, Playwright, and axe-core. It builds a separate `.next-qa` application, serves it on localhost:3217, and uses an in-memory Supabase-compatible fixture on loopback port 3218. Both ports must be available.

All service credentials are replaced with dummy fixture values for the QA process. Browser traffic to other hosts is blocked; map tiles and evidence images are synthetic. No production authentication shortcut was added. Actual middleware/session/document/resident handlers run against the fixture service; staff provisioning and upload UI tests mock their API responses.

Screenshots and the HTML report are generated under `apps/admin-crm/test-results` and `apps/admin-crm/playwright-report` and are ignored by Git.

Final validation:

- `npm run lint`: passed for both applications.
- `npm run build`: production builds passed for both applications, including their type checks.
- Browser suite: **15 tests passed** in 1.8 minutes.

Browser coverage includes:

- All eight routes at 1440px, 768px, and 390px; one main landmark, no page-level horizontal overflow, screenshots, and zero axe violations for the selected WCAG A/AA rule tags.
- Keyboard navigation and mobile drawer behavior at 360px.
- Staff login, unchanged password input, restricted admin pages, and logout.
- Calendar-year aggregation, real zero values, and coordinate validation.
- Consecutive document status updates, rejection validation, failed-update feedback, and retry.
- Report search, keyboard details, staff note saving, and status changes.
- Resident evidence review and approval confirmation against local fixtures.
- Staff search, creation-form contract, and the last-administrator UI guard.
- Announcement draft saving, preview, thumbnail containment, and upload/save interlocks.
- Map filtering and queue/detail synchronization.
- Empty lists, failed requests, and refresh recovery.

Automated accessibility checks are not a full WCAG certification or a substitute for testing with actual assistive technology.

## Scope and remaining release checks

- Resident-web, the mobile app, production environment variables, and the live database were not changed.
- No deployment, commit, live approval, publication, staff provisioning, or database migration was performed.
- The existing RLS and storage-policy release blockers in [SECURITY_AUDIT.md](../SECURITY_AUDIT.md) remain. Synthetic UI tests do not validate hosted database policies or bucket access.
- The dependency audit still reports five advisory paths: four high and one moderate, including existing transitive PostCSS/nanoid and development-tool findings. No forced major-version upgrade or blanket dependency override was applied.
- Before deployment, validate real staff/admin sessions, storage uploads, resident/mobile synchronization, and policy boundaries in a controlled staging Supabase project.
- Large-dataset pagination, full screen-reader testing, and non-Chrome browser coverage remain follow-up work.
