type RingLoaderProps = {
  label?: string;
  className?: string;
};

export function RingLoader({ label = "Loading...", className = "" }: RingLoaderProps) {
  return (
    <div className={`ring-loader-wrap ${className}`.trim()} role="status" aria-live="polite" aria-label={label}>
      <div className="spinner" aria-hidden="true">
        <div />
        <div />
        <div />
        <div />
        <div />
        <div />
      </div>
      <p>{label}</p>
    </div>
  );
}
