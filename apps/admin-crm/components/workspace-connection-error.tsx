import Image from "next/image";
import Link from "next/link";

export function WorkspaceConnectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="workspace-connection-error">
      <section aria-labelledby="connection-error-title">
        <Image
          src="/assets/connection-lost.webp"
          width={670}
          height={450}
          alt=""
          priority
          sizes="(max-width: 380px) 85vw, 320px"
        />
        <div role="alert">
          <h1 id="connection-error-title">Connection lost</h1>
          <p>We couldn’t connect to your workspace.<br />Check your connection and try again.</p>
        </div>
        <button type="button" onClick={onRetry}>Try again</button>
        <Link href="/admin/login">Back to sign in</Link>
      </section>
    </main>
  );
}
