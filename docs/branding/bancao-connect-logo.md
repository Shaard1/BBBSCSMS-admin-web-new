# BancaoConnect — Community Emblem (Concept 01)

The selected mark uses three people arranged around an open center. Two figures
are civic blue (#006BB6); the third is teal (#66D9CE). This replaces the former
conversation-C app brand. It does not replace the official barangay seal.

The canonical SVG is in
`apps/admin-crm/public/assets/brand/concept-01/bancaoconnect-symbol.svg`.
Its paths follow the user-confirmed Concept 01 color sheet, with simplified
curves for vector reproduction. It contains no embedded bitmap or remote assets.

Shared CRM and public website assets use `bancao-connect-mark-community.svg`.
Flutter uses `lib/assets/bancao-connect-mark.svg`. White variants are used on blue
backgrounds. Launcher icons use a padded white emblem on civic blue. Native
splash images show the colored emblem on the existing light splash background.

Keep the symbol square and preserve its open spaces. The logo and official seal
remain separate. Existing wordmark typography in the applications is retained.

Native launcher and splash changes require rebuilding and reinstalling the app.
The APK offered by the public website must be replaced with a newly built APK
separately; changing source assets does not update that binary automatically.
