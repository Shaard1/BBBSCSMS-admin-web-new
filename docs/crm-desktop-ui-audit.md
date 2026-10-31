# CRM desktop UI audit — 31 October 2026

Reviewed at 1440 × 900 in the browser and 1440 × 1000 in automated page checks.

## Coverage

| Area | Reviewed interactions |
| --- | --- |
| Dashboard | Workload links, action queues, refresh, recent reports and registrations |
| Analytics | Year menu, monthly data disclosure, chart and distribution layouts |
| Staff Accounts | Search/clear, refresh, create dialog, role dropdown and guard, delete confirmation |
| Community Reports | Search, category/sort/status controls, details, evidence, resident updates, status confirmation |
| Certificates Request | Search/status/reset, overview/review/history, review validation, payment, collection and reopening |
| Complaint Map | Filters/reset, empty state, report queue/selection, evidence zoom/reset, delete confirmation, map wheel zoom |
| Resident Accounts | Search, access/phone filters, directory, details, previous registration evidence, access-history states |
| Announcements | Library filters/search, preview/edit, composer/uploads, publication preview, deletion confirmation |
| Shared UI | Global search, notifications, modal focus/Escape, dropdown positioning, loading/error recovery, login/logout in fixtures |

Live records were not deleted, published, approved, or assigned new permissions. Mutation paths were exercised using isolated synthetic fixtures.

## Changes

- Report details: independently scrolling content, visible footer actions, top close button, separated destructive action, and a collapsed location preview that mounts its map when opened.
- Analytics: combine the snapshot caption and refresh in one row.
- Resident Accounts: reuse the shared keyboard-accessible dropdowns, group filters with the directory, remove doubled margins, and replace migration jargon with an understandable availability notice.
- Announcements: group filters/counts and search in one toolbar; align card actions; replace browser confirmation with an accessible dialog supporting busy/error states.
- Shared dropdown: rotate only the chevron, preserving category-icon orientation.
- Regression suite: update outdated page/action names, wait for debounced search results, confirm status changes, and cover announcement cancellation plus resident filters.

## Validation

- All eight desktop tabs passed accessibility and horizontal-overflow checks.
- Broad isolated suite: 32 passing scenarios; the two remaining failures referenced the earlier status-change flow and were corrected.
- Final affected regression run: seven scenarios passed, including both corrected report flows, all desktop tabs, announcements, residents and map.
- TypeScript and full source ESLint checks passed.

## Existing limitation

The live resident directory reports that its account-management migration is unavailable. Service history and access changes remain dependent on that backend migration; this audit preserves that restriction and explains it in the UI.
