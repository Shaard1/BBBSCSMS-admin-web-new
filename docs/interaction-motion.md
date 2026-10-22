# Interaction motion — 2026-10-22

## Changes

CRM: 100–180 ms button feedback, color/focus transitions, modal entrance/backdrop fades and document-section/history fades. Document dialog dismissal takes 140 ms for a visual fade; mutations and navigation do not wait for decorative motion. Shared modal callers with existing unsaved-change guards retain their synchronous close behavior. Document sections remount only when selected so their one-shot fade restarts, while controlled review values stay in the parent dialog state.

Mobile: reused existing 180 ms page/content fades and native Material button ink. Shared cards add a 100 ms press transform; requirement choices animate color/border over 140 ms. Resident dialogs and expandable sections use 180 ms open / 140 ms reverse timing. Outgoing content excludes pointer/semantic input, and its nested ticker work is disabled during the existing switch transition.

Reduced-motion settings disable the added decorative animation. There is no new animation library, whole-list entrance sequence, scroll interception, continuous animation, animated blur, animated shadow or permanent `will-change` layer promotion.

## Evidence

- 37 mobile regression tests passed, including immediate tap callbacks, reduced-motion duration/scale and animation tickers settling after interaction.
- Six production-build CRM browser checks passed: all eight pages at 1440/768/390px, document review/rejection, closed/read-only modal layout, and normal/reduced motion with focus restoration.
- The web motion test checks entrance duration <=200 ms, reduced-motion animation suppression, and zero running animations in the tested dialog after settling. These are interaction/lifecycle checks, not a frame-rate benchmark.
- TypeScript and lint checks passed. Flutter static analysis covers the changed motion code.

## Performance limits and verification

No matched before/after target-device frame trace was captured. Desktop synthetic fixtures and Flutter widget tests cannot establish smoothness on every phone, GPU or thermal condition. Lower-end physical-device acceptance remains pending. No universal zero-lag or measured speedup claim is made.

To check Android performance, use a physical test device with `flutter run --profile --dart-define-from-file=config/supabase.test.json`. Repeat tab switching, card taps, dialog open/close, detail expansion and normal/fast scrolling. Observe frame timing in Flutter DevTools. Compare normal/reduced-motion settings with the same data; investigate recurring frame misses rather than relying on debug-mode impressions.

Reload the test CRM and hot restart/rebuild the test mobile app. No database migration is required for these motion changes. Previous pending database validation remains a separate rollout step. Nothing was committed or pushed.
