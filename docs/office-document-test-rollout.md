# Office document processing — test rollout

Local implementation prepared on 21 October 2026. Hosted migration and document integration checks are pending. Existing reports, accounts and historical payment data are retained.

## Resident process

1. Choose a document and enter its application details. The document subject's name is a declaration, not automatic linking to any existing barangay record.
2. Continue to requirements. Declare whether applying for self or as a representative.
3. Choose a private upload or presentation of originals at the barangay office for identity and residency checks. Representatives must also arrange authorization evidence. The office determines which evidence is acceptable; this implementation does not invent a universal list of accepted IDs or claim uploads prove identity.
4. Submit as Pending. No GCash, online payment reference, receiver, or payment-proof upload is part of new submissions. Staff establishes any applicable fee.
5. Staff reviews; the resident follows request status. Original evidence may require a visit before the request can become ready. Applicable payment and document pickup occur at the office.

## Office process

The CRM records identity and residency checks, plus authorization checks for representatives. New status progression is Pending → Processing → Ready for Release → Completed, or rejection with a reason. Legacy Awaiting Payment requests may proceed to Processing or Rejected; new requests cannot enter that legacy status.

Ready for Release requires the relevant checks. Completion additionally requires confirmed physical collection and recipient name, plus either a positive office payment with receipt reference or a documented no-fee/authorized-waiver decision. These entries record staff actions; they do not independently establish whether a payment or identity document is genuine.

Review changes are saved in an append-only, office-readable audit table with the verified staff account and server timestamp. The server obtains the actor from the active signed CRM session; clients cannot choose another actor. Residents cannot invoke the office review RPC. Direct authenticated table updates are revoked so staff cannot bypass the audit path. Server-only maintenance credentials remain trusted.

## Apply in test only

1. Confirm Supabase project **xvpyskemxgspttzjokiu**. Earlier schema, security and basic-account migrations must already exist.
2. Run **`supabase/office_document_workflow.sql`** in that project's SQL Editor. No prior approval/check/payment state is fabricated; existing rows keep legacy workflow version 1.
3. Verify:

```sql
select public.office_document_workflow_available();
```

Expected true. The migration is transactional. Do not apply to the main project until integration checks pass and coordinated client rollout is ready; older clients' online-payment inserts are deliberately rejected after this migration.

4. Run the test CRM with `npm run dev:admin:test`. From the mobile folder, rebuild using `flutter run --dart-define-from-file=config/supabase.test.json`.
5. Rerun `node apps/admin-crm/scripts/test-access-controls.mjs` from the web repository. It includes synthetic document checks when the migration is present; a missing migration is explicitly reported as skipped, never counted as a document pass.
6. Manually verify self and representative applications, upload and in-person options, cancellation, status tracking, CRM evidence access and review fields. Test at least one paid-at-office completion and one no-fee completion.

## Security and limitations

Evidence is stored under `resident-files/<user-id>/document-evidence/` and signed at read time. The database checks uploaded object existence and requester ownership and rejects external/signed evidence URLs. Residents see only their own requests; approved office personnel can review evidence. Uploaded evidence never marks a resident account's global identity status verified.

The backend restricts processing transitions, prevents residents from supplying verified/paid/collected flags, and records office decisions atomically with an audit entry. A status concurrency check prevents overwriting another staff member's update. Existing signed links remain valid until expiry.

Uploads may become unattached when submission fails or the resident leaves the flow. They remain private; define and implement a reviewed retention/cleanup policy before production. No automatic deletion of user evidence is introduced. Existing historical payment fields are retained and may appear on old mobile request details; they are not payment instructions for new requests.

Local checks at preparation: 28 Flutter tests passed and CRM TypeScript/private-file/review validation checks passed. SQL has not been exercised by a local PostgreSQL runtime or against Supabase yet. The previous basic-account security results do not validate this migration.

Provider delivery, OTP controls and Twilio remain deferred. The public capstone draft remains a mixture of current and planned behavior; the new workflow is not production-certified. Accepted evidence rules, fee schedules, official receipt procedures, authorization exceptions, retention and assisted access need confirmation with the barangay before launch.
