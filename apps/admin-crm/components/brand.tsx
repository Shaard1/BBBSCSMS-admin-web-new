import Image from "next/image";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="bancao-brand">
      <Image
        src="/assets/bancao-connect-mark-community.svg"
        width={48}
        height={48}
        alt={compact ? "Bancao-Connect" : ""}
        priority
      />
      {!compact ? (
        <div>
          <strong>
            Bancao<br />Connect.
          </strong>
        </div>
      ) : null}
    </div>
  );
}
