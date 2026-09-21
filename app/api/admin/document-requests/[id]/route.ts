import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  adminSessionCookieName,
  getActiveSignedAdminSession
} from "@/lib/admin-session";
import { canApproveResidents } from "@/lib/roles";
import { rejectCrossOriginMutation } from "@/lib/request-security";
import type { DocumentRequestStatus } from "@/lib/types";

type DocumentRequestActionPayload = {
  expectedStatus?: DocumentRequestStatus;
  status?: DocumentRequestStatus;
  rejectionReason?: string | null;
};

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

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const allowedStatuses: DocumentRequestStatus[] = [
  "pending",
  "awaiting_payment",
  "processing",
  "ready_for_release",
  "completed",
  "rejected"
];

export async function PATCH(request: NextRequest, context: RouteContext) {
  const crossOriginResponse = rejectCrossOriginMutation(request);
  if (crossOriginResponse) return crossOriginResponse;

  const adminClientResponse = await getAdminClientForDocumentRequest(request);

  if ("error" in adminClientResponse) {
    return adminClientResponse.error;
  }

  const { client } = adminClientResponse;
  const { id } = await context.params;
  const requestId = id?.trim() ?? "";

  if (!isUuid(requestId)) {
    return NextResponse.json({ message: "Invalid document request id." }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as DocumentRequestActionPayload | null;
  const expectedStatus = payload?.expectedStatus;
  const status = payload?.status;

  if (
    !status ||
    !allowedStatuses.includes(status) ||
    !expectedStatus ||
    !allowedStatuses.includes(expectedStatus)
  ) {
    return NextResponse.json({ message: "Invalid document request status." }, { status: 400 });
  }

  const rejectionReason =
    status === "rejected" ? payload?.rejectionReason?.trim() ?? "" : null;

  if (status === "rejected" && (!rejectionReason || rejectionReason.length > 1000)) {
    return NextResponse.json(
      { message: "A rejection reason between 1 and 1000 characters is required." },
      { status: 400 }
    );
  }

  const { data, error } = await client
    .from("document_requests")
    .update({
      status,
      rejection_reason: rejectionReason,
      updated_at: new Date().toISOString()
    })
    .eq("id", requestId)
    .eq("status", expectedStatus)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { message: error.message || "Unable to update document request." },
      { status: 400 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { message: "The document request changed before this update was applied." },
      { status: 409 }
    );
  }

  return NextResponse.json({ updated: true });
}

async function getAdminClientForDocumentRequest(request: NextRequest) {
  const adminSessionToken = request.cookies.get(adminSessionCookieName)?.value ?? "";
  const session = await getActiveSignedAdminSession(adminSessionToken);

  if (!session || !canApproveResidents(session.role)) {
    return {
      error: NextResponse.json(
        { message: "Only staff or administrators can manage document requests." },
        { status: 403 }
      )
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      error: NextResponse.json(
        { message: "Missing server configuration for document requests." },
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
