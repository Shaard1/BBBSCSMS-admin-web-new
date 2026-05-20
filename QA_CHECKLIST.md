# Bancao Connect Next.js QA Checklist

## Access

- [ ] `/admin/dashboard` redirects to `/admin/login` when signed out.
- [ ] Admin login accepts only accounts with `profiles.role = admin`.
- [ ] Logout clears access and returns to `/admin/login`.
- [ ] Refreshing a protected admin route keeps a valid admin signed in.

## Dashboard

- [ ] Summary cards load real Supabase counts.
- [ ] Recent reports and pending residents display correctly.
- [ ] Empty states appear when no records are available.

## Residents

- [ ] Pending, approved, and flagged filters work.
- [ ] Search finds residents by name, ID, address, or contact number.
- [ ] Approve updates the resident status.
- [ ] Reject requires a reason and saves it.
- [ ] Profile and ID images open in the full-screen viewer.

## Reports

- [ ] Status and category updates save to Supabase.
- [ ] Admin notes save and reload correctly.
- [ ] Report evidence opens in the full-screen viewer.
- [ ] Reports with coordinates open correctly in OpenStreetMap.
- [ ] Delete confirmation prevents accidental deletion.

## Complaint Map

- [ ] Report pins render for records with valid latitude and longitude.
- [ ] Pin popups show report context and status.
- [ ] Search and status filters update the map list.

## Announcements

- [ ] New announcement saves title, content, publish status, and images.
- [ ] Thumbnail upload stores files in `announcement-files/thumbnails`.
- [ ] Gallery upload stores files in `announcement-files/gallery`.
- [ ] Edit mode keeps existing images and allows new images.
- [ ] Posted announcement images open in the full-screen viewer.

## Analytics

- [ ] Report totals, status breakdowns, and resident metrics load.
- [ ] Analytics page handles empty datasets without crashing.

## Responsive

- [ ] Landing page works on desktop, tablet, and mobile.
- [ ] Admin sidebar opens and closes on mobile.
- [ ] Tables/cards remain readable at mobile widths.
- [ ] Modals fit within the viewport and scroll internally.

## Deployment

- [ ] Production environment variables match `.env.production.example`.
- [ ] `npm run build` succeeds locally.
- [ ] Supabase Storage bucket `announcement-files` exists and is public.
- [ ] Supabase RLS policies allow only intended admin operations.
