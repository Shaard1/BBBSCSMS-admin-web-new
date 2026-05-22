import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminSessionCookieName, getSignedOfficeRole } from "@/lib/admin-session";
import { canApproveResidents } from "@/lib/roles";

type ResidentActionPayload = {
  action?: "approve" | "reject";
  reason?: string;
};

type RawResidentRecord = Record<string, unknown>;
type LooseDatabase = {
  public: {
    Tables: Record<
      string,
      {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: never[];
      }
    >;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
type LooseServiceClient = ReturnType<typeof createClient<LooseDatabase>>;
type MinimalAdminClient = {
  auth: LooseServiceClient["auth"];
  from: LooseServiceClient["from"];
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const adminClientResponse = await getAdminClientForResidentRequest(request);

  if ("error" in adminClientResponse) {
    return adminClientResponse.error;
  }

  const { client } = adminClientResponse;
  const { id } = await context.params;
  const residentId = id?.trim() ?? "";

  if (!residentId) {
    return NextResponse.json(
      { message: "Missing resident id." },
      { status: 400 }
    );
  }

  const payload = (await request.json().catch(() => null)) as ResidentActionPayload | null;
  const action = payload?.action;

  if (action === "approve") {
    return approveResident(client, residentId);
  }

  if (action === "reject") {
    const reason = payload?.reason?.trim() ?? "";

    if (!reason) {
      return NextResponse.json(
        { message: "A rejection reason is required." },
        { status: 400 }
      );
    }

    return rejectResident(client, residentId, reason);
  }

  return NextResponse.json(
    { message: "Invalid resident action." },
    { status: 400 }
  );
}

async function approveResident(client: MinimalAdminClient, residentId: string) {
  const { error: updateError } = await client
    .from("residents")
    .update({ status: "approved", rejection_reason: null })
    .eq("id", residentId);

  if (updateError) {
    return NextResponse.json(
      { message: updateError.message || "Unable to approve resident." },
      { status: 400 }
    );
  }

  const { data: resident, error: residentError } = await client
    .from("residents")
    .select("*")
    .eq("id", residentId)
    .single();

  if (residentError || !resident) {
    return NextResponse.json({
      approved: true,
      profileSynced: false,
      warning: "Resident approved, but profile sync failed. Verify resident data."
    });
  }

  const residentRecord = resident as RawResidentRecord;
  const authUserId = stringValue(residentRecord.user_id) || stringValue(residentRecord.id) || residentId;

  let email = resolveResidentEmail(residentRecord);

  if (!email) {
    const { data: authUserData, error: authUserError } = await client.auth.admin.getUserById(authUserId);
    if (!authUserError) {
      email = authUserData.user?.email?.trim();
    }
  }

  const { error: profileError } = await client.from("profiles").upsert({
    id: authUserId,
    email: email ?? null,
    full_name: stringValue(residentRecord.full_name) ?? "",
    role: "resident",
    status: "approved"
  });

  if (profileError) {
    return NextResponse.json({
      approved: true,
      profileSynced: false,
      warning: "Resident approved, but profile sync failed. Verify profile permissions."
    });
  }

  return NextResponse.json({ approved: true, profileSynced: true });
}

async function rejectResident(
  client: MinimalAdminClient,
  residentId: string,
  reason: string
) {
  const { error } = await client
    .from("residents")
    .update({ status: "rejected", rejection_reason: reason })
    .eq("id", residentId);

  if (error) {
    return NextResponse.json(
      { message: error.message || "Unable to reject resident." },
      { status: 400 }
    );
  }

  return NextResponse.json({ rejected: true });
}

async function getAdminClientForResidentRequest(request: NextRequest) {
  const adminSessionToken = request.cookies.get(adminSessionCookieName)?.value ?? "";
  const officeRole = await getSignedOfficeRole(adminSessionToken);

  if (!officeRole || !canApproveResidents(officeRole)) {
    return {
      error: NextResponse.json(
        { message: "Only staff or administrators can manage resident approvals." },
        { status: 403 }
      )
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      error: NextResponse.json(
        { message: "Missing server configuration for resident approval." },
        { status: 500 }
      )
    };
  }

  return {
    client: createClient<LooseDatabase>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  };
}

function resolveResidentEmail(record: RawResidentRecord) {
  return firstString(record, ["email", "user_email", "email_address", "resident_email"]);
}

function firstString(record: RawResidentRecord, keys: string[]) {
  for (const key of keys) {
    const value = stringValue(record[key]);
    if (value) return value;
  }

  return undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
