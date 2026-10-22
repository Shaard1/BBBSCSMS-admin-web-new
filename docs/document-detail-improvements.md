# Document detail improvements — 2026-10-22

## CRM

Document details now separate Overview, Review and History. Submitted fields are shown once when their values match; conflicting legacy form answers stay visible with an explicit label. History starts collapsed and displays the actor name when readable through existing office permissions. The modal keeps its header and action bar visible while its content scrolls. Rejected and completed applications are read-only. Evidence labels use readable wording; self-applications mark representative authorization not applicable.

The current payment policy is preserved because “no online payment” versus “all services free” has not been resolved. Inactive receipt/no-fee/collector inputs are cleared on selection and normalized again by the review API. Historical audit entries are retained.

## Mobile

Document details show status-specific next steps and move rejection reasons to the top. Rejected requests no longer tell residents to collect a document. Requirements, office payment/collection, application details and recorded updates are expandable. The owner can see a recorded amount/receipt when paid, a no-fee reason when free, and collector details only when physical collection is confirmed. These use existing owner-readable request fields; office audit history access is unchanged. Recorded updates show submission/latest update, not an invented intermediate timeline.

Birthdate entry uses a date picker and civil status uses defined choices. Optional values remain optional. Invalid calendar dates, future birthdates and unknown civil-status values are rejected before submission. Existing stored data is not rewritten.

## Additional database validation — pending

Apply `supabase/document_detail_validation.sql` only to test project `xvpyskemxgspttzjokiu`, after the existing office workflow migration. It validates new application birthdates/civil-status values, and clears inactive receipt/no-fee/collector values on subsequent updates. It does not edit existing records or delete audit history. Rebuild the test mobile app first so new dates use YYYY-MM-DD.

This SQL has not been executed by the agent or tested against a local PostgreSQL runtime. The UI and API changes are locally checked; hosted enforcement of the new validation remains pending.

Read-only installation check after applying:

```sql
select
 exists(select 1 from pg_trigger where tgrelid=to_regclass('public.document_requests') and tgname='document_application_fields_guard' and tgenabled='O' and not tgisinternal) as new_application_validation_enabled,
 exists(select 1 from pg_trigger where tgrelid=to_regclass('public.document_requests') and tgname='zz_document_review_fields_normalize' and tgenabled='O' and not tgisinternal) as review_normalization_enabled;
```

With disposable test data, verify an impossible/future date and arbitrary civil status are rejected through direct authenticated API submission as well as the app. Verify paid-to-no-fee changes retain previous values only in history, and a confirmed collection cannot be completed without its recipient. Do not change real requests for these tests.

Local verification: 35 mobile tests passed, including status guidance, no-fee wording, inactive receipt/collector suppression and birthdate/civil-status validation. CRM TypeScript/lint, 12 service/unit tests, three responsive page/accessibility checks and document workflow/detail browser journeys passed against synthetic fixtures. These are not proof of hosted PostgreSQL validation.
