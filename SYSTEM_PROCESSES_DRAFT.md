# Bancao Connect — Website and Mobile Processes

**Status:** Draft for review  
**Date:** 20 October 2026  
**Scope:** Public website, staff/admin website, and resident mobile app

### Implementation update — 21 October 2026

**Document workflow:** A staged mobile/CRM change now removes online payment from new document applications and collects per-request evidence arrangements (private upload or originals at the office). The accompanying SQL requires staff identity/residency/representative checks before readiness, and office payment/no-fee plus physical pickup before completion, with an office audit trail. Hosted migration and new integration tests are pending. See `docs/office-document-test-rollout.md`; historical payment records are retained.

A shorter basic-registration preview is prepared in the designated mobile test build, with a separate staged account-access SQL migration. It removes ID/demographic collection and blanket approval for new basic test accounts. SMS remains deferred: phone and identity are explicitly unverified, and email is temporarily required for test authentication. Existing accounts are not automatically converted. Hosted migration and new-flow integration testing remain pending. See `docs/basic-account-test-rollout.md` for activation steps and limits; document verification and physical-payment changes remain separate work.

## 1. Purpose and scope

Bancao Connect connects Barangay Bancao-Bancao residents with barangay services. The public website introduces the system and distributes the Android app. Residents use the mobile app to read announcements, report community concerns, and request official documents. Personnel use the staff/admin website to review and process submissions.

This draft combines the implementation reviewed with the account-process direction agreed in discussion. It does not claim that proposed changes are already implemented or approved by the barangay. Capstone requirements will be checked separately when the paper is provided.

### Status labels

- **Current:** A code path exists in the reviewed source; live operation is not certified.
- **Agreed direction:** Selected by the project owner for planning; implementation is still required.
- **Proposed detail:** A supporting workflow requiring further decisions or validation.

## 2. Agreed account and verification direction

**Remove blanket manual approval of resident accounts. Allow immediate access after phone verification. Verify identity, residency, and authorization during document processing when those checks are required.**

A resident should not need to finish a separate account approval queue before submitting a document application. Staff reviews the applicant and the document requirements as part of the same request.

### Decisions to preserve

| Decision | Meaning |
|---|---|
| Immediate phone-verified account | SMS verification activates ordinary resident access without staff approval |
| SMS provider | Twilio SMS connected to Supabase Auth; Twilio Verify is a separate product and is not selected by this decision |
| Returning-user login | Phone number and password; normal login does not require an SMS code |
| Persistent sessions | Opening the app with a valid session does not send another SMS |
| Community reporting available | Phone-verified residents can submit reports and track their own submissions |
| Document requests accepted immediately | Residents can submit an application and its requirements without prior account approval |
| Verification during processing | Required identity, residency, and representative checks occur before sensitive disclosure or release |
| Reuse verification appropriately | Previous checks can reduce repeated work, subject to changes, service requirements, and warning signs |
| No automatic record linking | Names, birthdays, addresses, and uploaded IDs alone must not unlock another person's existing records |
| No automatic document approval | Phone verification or previous identity verification does not authorize every document |
| No online document payments | Per the client's/barangay captain's instruction, residents pay applicable fees physically at the barangay office |
| Physical document collection | Residents or authorized representatives receive requested documents at the barangay office after required checks and applicable payment |
| No initial dependency on face matching | Automated remote identity verification may be evaluated later; it is not part of the agreed initial requirement |

These decisions reduce routine account-review work. They do not promise zero fraud or eliminate the time needed to process official documents.

### Current implementation versus agreed direction

| Area | Current | Agreed direction |
|---|---|---|
| Registration credentials | Email and password | Phone number and password, with SMS verification through Twilio at signup |
| Identification collection | Front/back ID images during registration | Collect evidence when a service requires it |
| Account activation | Pending resident record and manual approval | Immediate after phone verification |
| Basic services | Normal login checks approval | Available to phone-verified accounts |
| Document submission | Part of the approved-resident experience | Available without a separate identity-approval queue |
| Applicant checks | Account review plus document handling | Required checks consolidated into document processing |

## 3. System users and interfaces

| User | Interface and responsibilities |
|---|---|
| Visitor | Public website: learn about services, registration, and the Android download |
| Resident | Mobile app: manage own account, read notices, report concerns, request documents, and track own submissions |
| Staff | Web workspace: process resident services, update reports and documents, and manage announcements |
| Administrator | Staff capabilities plus analytics, office accounts, and administrator-restricted actions |
| Authorized representative | Proposed document workflow: a requester acting for another person with independently established authorization |

The mobile source also contains basic administrator screens. Their continued role and consistency with the main web workspace need review.

## 4. Public website

### What it does

**Current:** A public information and Android download website. It does not process registrations or service applications and does not connect to the application database.

### What it contains

- Introduction to Bancao Connect and Barangay Bancao-Bancao.
- Guides for document requests, community concerns, announcements, and progress tracking.
- Getting-started instructions.
- Barangay location and assistance information.
- Registration and service FAQs.
- Privacy/access information.
- Download link for the Bancao Connect Android APK.
- Responsive navigation and animated presentation.

### Visitor process

1. Open the website.
2. Read service descriptions and requirements.
3. Review FAQs or assistance information.
4. Download the Android app.
5. Complete registration and service interactions inside the mobile app.

**Required future alignment:** Update public registration instructions when the new phone-verification process is implemented. The site must not continue telling residents that all accounts require manual approval.

## 5. Resident mobile app

### Main sections

| Section | Contents |
|---|---|
| Home | Welcome information, announcements, quick actions, and recent report activity |
| Services | Community reporting and document application forms |
| Activity | Own reports and document requests, statuses, and details |
| Profile | Resident information, profile photo, account security, help, and preferences |

### 5.1 Account creation

**Agreed direction:**

1. Resident provides a mobile number, basic account details, and a password.
2. Supabase Auth initiates phone verification and Twilio delivers the SMS code.
3. Resident enters the code in the app; the backend verifies it.
4. After successful verification, the system activates ordinary resident access without a manual account-approval queue.
5. Resident immediately accesses announcements, service information, reports, and document application submission.

Phone verification establishes control of the number. It does not establish legal identity, current residency, or authorization to act for a family member.

### Returning-user login and SMS usage

**Agreed direction:** Use phone number and password for normal login. Maintain secure sessions so opening the app does not require a new login or SMS while the session remains valid. Logout and invalid sessions require authentication again. Persistent sessions do not remove backend access checks.

| Situation | SMS behavior |
|---|---|
| Account signup | Send a code to verify phone ownership |
| Open app with a valid session | No SMS |
| Normal phone/password login | No routine SMS |
| Forgotten-password recovery | Use SMS as part of a controlled recovery process; exact recovery rules remain to be designed |
| Change registered number | Verify the new number by SMS and independently authorize the change; new-number verification alone must not transfer the account |
| Suspicious login or sensitive account change | Additional verification when warranted; rules and fallback procedures remain to be designed |
| Submit a report or document request | No routine SMS code |
| Document or report progress update | Use in-app status tracking; SMS alerts are a separate optional feature |

**Provider responsibilities:** Flutter collects the number and entered code. Supabase Auth coordinates authentication and verification. Twilio SMS delivers verification texts. Provider secrets stay in backend configuration, not in the mobile app. Use the supported integration rather than generating or checking codes in the client.

**Operational requirements:** Configure expiring, single-use codes, resend cooldowns, attempt and sending limits, abuse protection, and delivery-failure handling. Complete applicable Philippine sender onboarding and test delivery across resident mobile networks. Monitor usage and balance; resends and recovery messages also incur usage. No fixed price is recorded here because provider rates and account-specific charges can change.

**Important distinction:** Signup SMS verifies control of a number, not identity, residency, or permission to request another person's documents. Twilio is the selected provider for planning; it has not yet been configured or integrated by this document update.

**Details still to define:** Optional verified email recovery, number changes, lost-phone recovery, duplicate-account handling, password policy, session lifecycle, SMS expiration and retry settings, and assisted access. Verification-code recovery alone is insufficient where phone ownership or identity is disputed.

### 5.2 Announcements

**Current process:**

1. Staff or administrator publishes a notice through the web workspace.
2. Mobile app fetches published announcements.
3. Resident opens a notice to view its text and images.
4. System records read status for the account.

Draft notices are not included in the resident published-announcement query. Published notices are fetched through authenticated app services; anonymous mobile access would require a separate decision and implementation.

### 5.3 Community reports

**Community reports are submissions to barangay personnel, not social media posts.** Examples in the code include road damage, garbage collection, broken streetlights, drainage issues, noise complaints, and other concerns.

The reviewed implementation has no public social feed, likes, or public comment threads. Residents view their own submissions and staff updates.

**Agreed access:** Phone-verified residents can report concerns without waiting for account approval.

**Current submission workflow to preserve:**

1. Select a category.
2. Enter a description.
3. Attach report photos; the current form requires at least one and supports up to ten.
4. Choose a map location or use GPS.
5. Submit the report.
6. Follow its status and staff notes in Activity.

Office report statuses are Pending, In Progress, and Resolved. Category labels and status values must be consistent across clients; the review identified an existing mismatch in the mobile ongoing-report filter.

Reports are not an emergency-response channel. Abuse limits and handling for duplicate or malicious reports are proposed additions, not confirmed existing controls.

### 5.4 Official document services

**Current catalog:**

- Certificate of Indigency.
- Good Moral / Residency.
- Barangay Clearance for Loan.
- Barangay ID.
- Special Certification.
- Store Business Clearance.
- Tricycle Clearance.
- Banca Clearance.

The catalog, required fields, fees, and release requirements must be confirmed with the barangay and later compared against the capstone paper. Existing forms explicitly describe themselves as draft.

**Agreed request process:**

1. Phone-verified resident selects a document.
2. Resident completes the relevant form and provides required supporting evidence.
3. System accepts the application without a separate account-verification queue.
4. Staff reviews identity, residency, service eligibility, and supporting information together.
5. Missing or inconsistent information is resolved before release. A structured correction/resubmission workflow is a proposed enhancement.
6. The app displays the confirmed applicable fee and instructions to pay at the barangay office; it does not collect money or payment screenshots.
7. Staff prepares the document according to the barangay's procedure and updates the request with collection instructions when appropriate.
8. Resident or authorized representative visits the barangay office for any applicable payment and physical document collection. Staff checks identity/authorization and confirms required payment before release. Free documents require no payment.
9. Staff marks the request Completed after actual release; the resident tracks its progress in Activity.

**Current statuses:** Pending, Awaiting Payment, Processing, Ready for Release, Completed, and Rejected.

These are existing labels, not an enforced sequential state machine. **Proposed resident-facing statuses:** Pending Review, Processing, Ready for Pickup, Completed, and Rejected. Ready for Pickup must mean the document is actually available for collection. No online-payment status or screenshot-verification stage is part of the agreed flow. Whether a separate office-payment stage is needed depends on the barangay's preparation/payment order, which remains to be confirmed. A separate account status called “fully approved” is not required by the agreed process.

**Agreed payment policy:** There will be no online payment for document requests. Applicable payments and document collection happen physically at the barangay office, as instructed by the client/barangay captain. Remove GCash receiver details and instructions, payment-reference entry, payment-proof uploads, and the online/over-the-counter payment selector from the resident flow. Show the confirmed fee and “Pay at the barangay office” instructions instead. Clearly label free documents and skip payment for them. Do not treat application submission or Ready for Pickup as proof of payment.

**Current implementation gap:** Mobile code still contains demo GCash information, payment-reference fields, screenshot uploads, and a payment-method selector. These are existing behaviors to remove, not planned features to complete. Any internal record of physical payment must be entered/confirmed by authorized personnel; its exact fields and procedure remain to be agreed.

**Preparation timing still open:** Confirm whether the barangay prepares the document before payment or only after the resident pays. This draft does not promise a single visit or require advance payment. The app's statuses and pickup instructions must reflect the confirmed procedure.

**Release scope:** Document collection is physical at the barangay office. Resident digital delivery or downloading issued documents is not part of the agreed release flow. Office document preparation/printing and required signatures still need a confirmed procedure; marking a request Completed alone does not establish that it was securely issued.

### 5.5 Requests on behalf of another person

**Proposed detail supporting the agreed fraud safeguards:**

1. Requester uses their own account.
2. They identify the document subject and disclose that they are acting as a representative.
3. Required authorization is established independently under the barangay's rules for that document.
4. Staff checks the representative, authorization, and release recipient.
5. Records show who requested and who received the document.

The requester cannot establish authorization merely by entering another person's details or supplying a contact number claimed to belong to them. Family relationship alone is insufficient. Exact accepted evidence and assistance procedures remain to be confirmed.

### 5.6 Profile and security

**Current:** Residents can edit personal details and profile images, change passwords, and request password-reset emails. Notification preference switches exist, but no persistence or delivery integration was found.

**Required under the agreed direction:** Redesign security settings for phone number/password login, Twilio-delivered phone verification, persistent sessions, and controlled recovery. A phone change or recovery request must not transfer sensitive access based only on knowledge of personal details. Lost-phone and identity-dispute cases need an assisted recovery path rather than simply sending a code to a newly supplied number.

### 5.7 Notifications and progress

**Current:** Residents fetch announcement and activity updates. Announcement read tracking exists. No mobile push-notification implementation or live database subscription was found.

Status tracking must not be described as instant push notification delivery until that feature is implemented and tested. Decisions about SMS service alerts, push notifications, and preference persistence remain open.

## 6. Staff and administrator website

### 6.1 Office login

**Current:** Office users sign in through Supabase email/password authentication. The server validates the office role and active profile and creates a signed session cookie. Protected operations revalidate the current account.

Resident SMS signup does not automatically replace office authentication. Stronger office authentication is recommended, but is not part of the implemented flow documented here.

### 6.2 Dashboard

**Current:** Presents work queues, service metrics, recent reports, pending registrations, and navigation to service areas.

**Required change:** Remove routine registration approval from the workload. Prioritize reports, document requests, and verification exceptions if such a queue is implemented.

### 6.3 Community reports

**Current process:**

1. Search and filter submitted reports.
2. Inspect descriptions, photographs, and location.
3. Update category or status.
4. Add resident-visible staff notes.
5. Resolve the concern when appropriate.

Report deletion is restricted to administrators in the web role model. Actual authorization must also be enforced by database policies.

### 6.4 Complaint map

**Current:** Shows reports with valid coordinates. Personnel can filter the queue, select map markers, and inspect report details. It supports location-based assessment; it does not establish dispatch, route planning, or heatmap functionality.

### 6.5 Document requests

**Current:** Personnel search/filter applications, inspect submitted fields and payment evidence, update status, and provide rejection reasons. Status updates include conflict detection to prevent silently overwriting a changed request.

**Agreed direction:** Include applicant verification in request handling rather than requiring earlier account approval. Remove online-payment evidence review from the target workflow. Personnel confirm any applicable physical payment under the office procedure and release documents in person only after identity/authorization and service requirements are satisfied. Clearly record processing, pickup readiness, and actual release. These structured checks are not all implemented today.

### 6.6 Resident records and verification

**Current:** A resident-verification screen supports approval and rejection of registrations.

**Required change:** Its role must be redesigned around resident records, verification outcomes, and exceptions associated with actual services. It should not remain a mandatory gateway for every new account.

Previous verification may be reused appropriately, but it must not silently authorize a new representative, changed identity, or unrelated document entitlement.

### 6.7 Announcements

**Current:** Create, edit, preview, publish, unpublish, and delete notices; manage drafts and images. Mobile residents fetch published content. Web content rendering uses sanitization, and announcement uploads have server-side size/type limits.

### 6.8 Analytics

**Current, administrator-only:** Report and resident-registration totals, monthly activity, status/category distributions, resolution rate, and reports remaining open over seven days.

These metrics describe stored records. They should not be presented as complete official population statistics or full service-performance measures without checking definitions and data completeness.

### 6.9 Office accounts

**Current, administrator-only:** View office accounts, create staff accounts, change roles, and delete accounts, with safeguards such as blocking deletion of the active administrator account.

### 6.10 Search and notifications

**Current:** Global search spans supported records and pages. Header notification counts for pending reports and resident registrations are polled every 15 seconds.

**Required change:** Replace pending-registration alerts with actionable queues appropriate to the revised process. A persistent audit trail or full notification-delivery system should not be assumed from these counters.

## 7. Access and privacy rules

**Proposed access model:**

| Capability | Visitor | Phone-verified resident | Staff | Administrator |
|---|---|---|---|---|
| Public website information | Yes | Yes | Yes | Yes |
| Mobile published announcements | Not part of current anonymous flow | Yes | Office management | Office management |
| Submit community reports | No | Yes | Review/update | Review/update/delete |
| View resident report history | No | Own only | Operational access | Operational access |
| Submit document application | No | Yes | Review/process | Review/process |
| Access another person's existing records | No | No automatic access | Authorized work only | Authorized work only |
| Receive official documents | No | Only after required checks | Release under procedure | Release under procedure |
| Manage announcements | No | No | Yes | Yes |
| Manage office accounts / analytics | No | No | No | Yes |

Phone verification must not confer verified identity or ownership of an existing resident record. Account ownership, identity, residency, representative authorization, and document eligibility are separate concepts.

The database and storage policies must enforce these boundaries. Interface visibility alone is insufficient. Identification images should use restricted access; current public-URL patterns require review. Stop collecting new payment-proof images under the revised flow. Any historical payment evidence must remain protected and follow an agreed retention policy; removing the feature does not authorize deleting historical records or files.

## 8. Example: impersonation by a family member

If a son registers using his mother's name and his own number:

1. Phone verification establishes control of his number only.
2. The account receives no automatic link to the mother's existing records.
3. He may submit an application, but it cannot reveal existing private records or authorize release.
4. Before issuance, staff checks the applicant or establishes valid representative authorization.
5. If he cannot establish the required identity or authorization, the document is not released.

If he controls her phone as well, another SMS code alone does not resolve the identity or consent issue. The assisted verification and dispute procedures must address that case.

No process guarantees that fraud cannot occur. The goal is to reduce impersonation and prevent a submitted claim from automatically becoming access to sensitive information.

## 9. Backend and shared records

Both the mobile app and office workspace are designed to use Supabase Auth, PostgreSQL, and Storage. The public website has no database integration.

| Record area | Purpose |
|---|---|
| `profiles` | Role and account profile information |
| `residents` | Resident details and current verification-related fields |
| `reports` | Community concerns, evidence, location, status, staff note |
| `announcements` | Notice content, images, authorship, publication state |
| `announcement_reads` | Account-specific read tracking |
| `document_requests` | Currently includes applications, submitted fields, payment evidence, and processing status; target use removes resident online-payment collection and supports physical payment/release procedures as defined by the barangay |

Mobile and browser clients access Supabase directly for many operations. Selected privileged web operations use Next.js server routes. Revised permissions therefore require coordinated changes to both clients and the backend policies.

The checked-in SQL does not establish the full hosted schema or prove that the proposed access rules are active. Verification history, representative authorization, consent, audit events, and recovery may need additional data structures; their final design is not specified in this draft.

## 10. Implementation work and open decisions

### Required to deliver the agreed direction

- Integrate Twilio SMS with Supabase Auth for signup phone verification.
- Implement phone number/password login and secure persistent sessions without routine login SMS.
- Define and implement recovery, phone-change authorization, and additional verification for warranted security events.
- Remove blanket approval checks consistently from registration, login, and restored sessions.
- Keep unverified personal claims separate from trusted identity/residency records.
- Allow document submission without prior account approval.
- Define and record required applicant checks during document processing.
- Define representative authorization and secure release procedures.
- Enforce ownership and sensitive-access restrictions in database/storage policies.
- Update office queues, public instructions, and mobile guidance.
- Correct status inconsistencies and align resident-facing collection statuses with the physical release procedure.
- Remove GCash/demo receiver instructions, payment-reference entry, payment-proof uploads, and resident payment-method selection.
- Display confirmed fees, free-document labels, and physical payment/collection instructions.
- Update the office interface to remove online-payment review and support the agreed physical payment/release procedure.
- Review legacy payment fields and evidence retention before any schema cleanup; do not delete historical data as part of removing the resident feature.
- Test legitimate use, failed verification, impersonation, unauthorized record access, and recovery.

### Decisions still requiring confirmation

- Accepted identity and residency evidence for each service.
- Document preparation/printing, identity checks at pickup, and recording actual physical release; physical collection is already decided.
- Rules for representatives, minors, and residents needing assistance.
- Official document fees, exemptions, and whether preparation occurs before or after physical payment; online payment is excluded.
- How verification is reused and when rechecking is required.
- Phone change, lost-device, duplicate-account, and identity-dispute handling.
- Notification channels and service expectations.
- Sensitive-data retention, access logging, and deletion procedures.
- Continued scope of mobile administrator screens.

## 11. Source baseline

The current-behavior descriptions derive from source inspection, including:

- [Project analysis report](PROJECT_ANALYSIS_REPORT.md).
- [Public website](apps/resident-web/app/page.tsx).
- [Mobile registration](../barangay_mobile_app/lib/screens/auth/register_screen.dart).
- [ID submission](../barangay_mobile_app/lib/screens/auth/register_verification_screen.dart).
- [Mobile login](../barangay_mobile_app/lib/services/auth_service.dart).
- [Session restoration](../barangay_mobile_app/lib/screens/intro/app_intro_screen.dart).
- [Resident services and activity](../barangay_mobile_app/lib/screens/residents/resident_dashboard_screen.dart).
- [Office navigation and notifications](apps/admin-crm/components/admin-shell.tsx).
- [Office role model](apps/admin-crm/lib/roles.ts).
- [Document processing screen](apps/admin-crm/app/admin/%28protected%29/documents/page.tsx).
- [Document update API](apps/admin-crm/app/api/admin/document-requests/%5Bid%5D/route.ts).
- [Document schema](supabase/document_requests.sql).
- [Supplied authorization hardening](supabase/rls_hardening.sql).

## 12. Draft summary

Bancao Connect provides a public information website, an office service workspace, and a resident mobile app. The agreed direction is immediate account access after signup verification using Twilio SMS through Supabase Auth, including community reporting and document application submission. Returning residents use phone number/password login and secure persistent sessions without routine SMS on each login or app opening. Staff checks identity, residency, authorization, and service requirements during document processing before sensitive disclosure or release. Document applications are submitted online, but applicable payment and document collection happen physically at the barangay office. There is no resident online-payment or digital document-delivery flow.

This draft records the direction for review. It does not implement the changes or establish compliance with the capstone paper.

### Implementation checkpoint — 2026-10-21

The test mobile build now supports basic registration without blanket account approval; SMS remains deferred and the test exception does not establish phone ownership. Document-specific requirements and office payment/collection review have been prepared separately.

The CRM Resident Accounts redesign now separates access state from phone ownership, preserves legacy registration review, and provides service history and audited administrator suspension/reactivation. Staff cannot manually mark a phone SMS-verified. Directory pagination, aggregate counts and access history require the new test-project SQL migration. They are not yet confirmed in the hosted database.

See [resident account management rollout](docs/resident-account-management-rollout.md) for implemented changes, validation results, limitations and the migration order. This checkpoint does not change the agreed future Twilio process or claim production readiness.
