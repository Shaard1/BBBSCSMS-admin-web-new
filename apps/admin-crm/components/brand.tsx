import Image from "next/image";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="bancao-brand">
      <Image
        src="/assets/bancao-connect-mark.svg"
        width={40}
        height={40}
        alt={compact ? "Bancao-Connect" : ""}
        priority
      />
      {!compact ? (
        <div>
          <strong>
            Bancao<span>-Connect</span>
          </strong>
          <small>Community, connected.</small>
        </div>
      ) : null}
    </div>
  );
}
