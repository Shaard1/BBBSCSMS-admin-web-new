import { isOfficeRole, type OfficeRole } from "@/lib/roles";

type SupabaseConfig = {
  anonKey: string;
  serviceRoleKey: string;
  url: string;
};

function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  if (!url || !anonKey) {
    return null;
  }

  return { anonKey, serviceRoleKey, url };
}

type SupabaseUserResponse = {
  id?: string;
};

type ProfileRoleResponse = {
  role?: string;
};

export const adminSessionCookieName = "bc_admin_token";

type AdminSessionPayload = {
  exp: number;
  role: OfficeRole;
  userId: string;
};

const adminSessionSecret =
  process.env.ADMIN_SESSION_SECRET ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "development-admin-session-secret";

export async function getVerifiedOfficeUser(accessToken: string) {
  const trimmedToken = accessToken.trim();
  if (!trimmedToken) return null;
  const supabaseConfig = getSupabaseConfig();

  if (!supabaseConfig) {
    return null;
  }

  const userResponse = await fetch(`${supabaseConfig.url}/auth/v1/user`, {
    headers: {
      apikey: supabaseConfig.anonKey,
      Authorization: `Bearer ${trimmedToken}`
    },
    cache: "no-store"
  });

  if (!userResponse.ok) return null;

  const user = (await userResponse.json()) as SupabaseUserResponse;
  const userId = user.id?.trim();
  if (!userId) return null;

  if (supabaseConfig.serviceRoleKey) {
    const serviceRoleProfileResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role&limit=1`,
      {
        headers: {
          apikey: supabaseConfig.serviceRoleKey,
          Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`
        },
        cache: "no-store"
      }
    );

    if (serviceRoleProfileResponse.ok) {
      const serviceProfiles = (await serviceRoleProfileResponse.json()) as ProfileRoleResponse[];
      const serviceRole = serviceProfiles[0]?.role?.toLowerCase().trim();
      if (isOfficeRole(serviceRole)) {
        return { role: serviceRole, userId };
      }
    }
  }

  const profileResponse = await fetch(
    `${supabaseConfig.url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role&limit=1`,
    {
      headers: {
        apikey: supabaseConfig.anonKey,
        Authorization: `Bearer ${trimmedToken}`
      },
      cache: "no-store"
    }
  );

  if (!profileResponse.ok) return null;

  const profiles = (await profileResponse.json()) as ProfileRoleResponse[];
  const role = profiles[0]?.role?.toLowerCase().trim();

  return isOfficeRole(role) ? { role, userId } : null;
}

export async function createSignedAdminSession(
  userId: string,
  role: OfficeRole,
  maxAgeSeconds: number
) {
  const payload: AdminSessionPayload = {
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
    role,
    userId
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = await signValue(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export async function verifySignedAdminSession(sessionToken: string) {
  return Boolean(await getSignedOfficeRole(sessionToken));
}

export async function getSignedOfficeRole(sessionToken: string) {
  const payload = await getSignedAdminSession(sessionToken);
  return payload?.role ?? null;
}

export async function getSignedAdminSession(sessionToken: string) {
  const [encodedPayload, signature] = sessionToken.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = await signValue(encodedPayload);
  if (!timingSafeEqual(signature, expectedSignature)) return null;

  const payload = parseAdminSessionPayload(encodedPayload);
  if (!payload) return null;

  return isOfficeRole(payload.role) && payload.exp > Math.floor(Date.now() / 1000)
    ? payload
    : null;
}

function parseAdminSessionPayload(encodedPayload: string) {
  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as Partial<AdminSessionPayload>;
    if (
      typeof payload.exp !== "number" ||
      !isOfficeRole(payload.role) ||
      typeof payload.userId !== "string" ||
      !payload.userId.trim()
    ) {
      return null;
    }

    return payload as AdminSessionPayload;
  } catch {
    return null;
  }
}

async function signValue(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(adminSessionSecret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );

  return encodeBytesBase64Url(new Uint8Array(signature));
}

function encodeBase64Url(value: string) {
  return btoa(value)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const paddedValue = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (paddedValue.length % 4)) % 4);

  return atob(`${paddedValue}${padding}`);
}

function encodeBytesBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return encodeBase64Url(binary);
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}
