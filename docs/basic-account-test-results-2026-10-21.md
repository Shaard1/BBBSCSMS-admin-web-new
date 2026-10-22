# Basic registration test results — 21 October 2026

Target: isolated Supabase test project `xvpyskemxgspttzjokiu` and test CRM on localhost:3011. No production changes.

The user confirmed the mobile preview removes demographic/ID collection, temporarily requires email for authentication, allows new accounts without manual barangay approval, and displays Phone unverified / Identity unverified. Their screenshot shows the separate labels.

After the signup function's CURRENT_ROLE variable collision was corrected, `node apps/admin-crm/scripts/test-access-controls.mjs` completed successfully: **23 passing assertions, zero failures**. Four checks were exercised independently for each of the two resident accounts.

| Area | Verified outcome |
| --- | --- |
| Provisioning | Both new residents were blocked from submitting reports before completing account provisioning |
| Account state | Both provisioned accounts were active with phone/identity unverified; access depended on the explicit test exception |
| Protected writes | Both residents were denied changes to account/identity flags and backend test-access settings |
| Reports | Owner could submit a pending report; another resident could not retrieve it |
| Private images | Owner and approved staff could retrieve the image; another resident could neither obtain a signed URL nor download directly |
| Public images | Unauthenticated public URL was blocked |
| Workflow manipulation | Resident insert with resolved status was rejected (403 / PostgreSQL 42501) |
| Staff revocation | Existing staff token lost report and new image access; existing CRM session was rejected (401), dashboard redirected to login (307) |
| Resident suspension | Existing resident token lost report and new image access |

Cleanup succeeded for all three synthetic accounts, their fixture profiles/resident rows, the report, and image. Existing user accounts were unchanged. The test script used server credentials only for fixture setup/administrative changes/cleanup; access assertions used ordinary user tokens or anonymous requests.

These results cover the tested backend/CRM paths and user-reported mobile behavior, not an exhaustive audit. Real SMS delivery, production rollout, legacy account conversion, document-specific identity checks, and physical-payment workflow changes remain unverified or unfinished. Existing issued signed URLs remain valid until expiration.
