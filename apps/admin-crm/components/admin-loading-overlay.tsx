import { RingLoader } from "@/components/ring-loader";

type AdminLoadingOverlayProps = {
  label?: string;
};

export function AdminLoadingOverlay({ label = "Loading..." }: AdminLoadingOverlayProps) {
  return (
    <div className="admin-loading-overlay" role="status" aria-live="polite" aria-label={label}>
      <RingLoader label={label} />
    </div>
  );
}
