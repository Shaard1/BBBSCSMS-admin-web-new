import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

loadLocalEnv();

const [emailArg, passwordArg, ...fullNameParts] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase() ?? "";
const password = passwordArg?.trim() ?? "";
const fullName = fullNameParts.join(" ").trim();

if (!email || !password || !fullName) {
  console.error(
    'Usage: npm run bootstrap:admin -- "admin@example.com" "Password123!" "Admin Name"'
  );
  process.exit(1);
}

if (password.length < 8) {
  console.error("Admin password must be at least 8 characters.");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const existingUser = await findUserByEmail(email);
const user = existingUser ?? (await createAdminAuthUser(email, password, fullName));

if (existingUser) {
  const { error } = await adminClient.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  });

  if (error) {
    console.error(`Unable to update existing auth user: ${error.message}`);
    process.exit(1);
  }
}

const { error: profileError } = await adminClient.from("profiles").upsert({
  id: user.id,
  full_name: fullName,
  email,
  role: "admin",
  status: "approved"
});

if (profileError) {
  console.error(`Auth user exists, but admin profile failed: ${profileError.message}`);
  if (profileError.message.toLowerCase().includes("permission denied")) {
    console.error(
      "Run SUPABASE_PUBLIC_GRANTS_REPAIR.sql in the Supabase SQL Editor, then run this command again."
    );
  }
  process.exit(1);
}

console.log(`Admin account is ready: ${email}`);
console.log(`Auth/Profile ID: ${user.id}`);

async function createAdminAuthUser(userEmail, userPassword, userFullName) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email: userEmail,
    password: userPassword,
    email_confirm: true,
    user_metadata: { full_name: userFullName }
  });

  if (error || !data.user) {
    console.error(`Unable to create admin auth user: ${error?.message ?? "Unknown error"}`);
    process.exit(1);
  }

  return data.user;
}

async function findUserByEmail(userEmail) {
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 100
    });

    if (error) {
      console.error(`Unable to check existing auth users: ${error.message}`);
      process.exit(1);
    }

    const match = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === userEmail
    );
    if (match) return match;

    if (data.users.length < 100) return null;
    page += 1;
  }
}

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    process.env[key] ??= value;
  }
}
