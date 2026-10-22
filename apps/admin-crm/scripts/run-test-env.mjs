import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const configurationPath = new URL("../.env.test.local", import.meta.url);
let configuration;
try {
  configuration = parseEnv(readFileSync(configurationPath, "utf8"));
} catch {
  console.error("Missing .env.test.local. Follow docs/test-project-setup.md.");
  process.exit(1);
}
if (configuration.NEXT_PUBLIC_SUPABASE_URL !== "https://xvpyskemxgspttzjokiu.supabase.co") {
  console.error("Refusing test startup: URL is not the designated test project.");
  process.exit(1);
}
if (!configuration.NEXT_PUBLIC_SUPABASE_ANON_KEY?.startsWith("sb_publishable_") ||
    !configuration.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    (configuration.ADMIN_SESSION_SECRET?.length ?? 0) < 32) {
  console.error("Complete the test public key, server-only key, and session secret in .env.test.local.");
  process.exit(1);
}
const require = createRequire(import.meta.url);
// Separate output and port prevent sharing compiled configuration with main dev.
const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "--port", "3011"], {
  cwd: appRoot,
  stdio: "inherit",
  env: { ...process.env, ...configuration, NEXT_BUILD_DIR: ".next-test" },
});
child.on("error", () => { console.error("Unable to start the test server."); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
