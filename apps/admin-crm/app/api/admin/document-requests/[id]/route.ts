import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  adminSessionCookieName,
  getActiveSignedAdminSession
} from "@/lib/admin-session";
import { canApproveResidents } from "@/lib/roles";
import { rejectCrossOriginMutation } from "@/lib/request-security";
import { parseDocumentReview } from "@/lib/document-workflow";
import type { DocumentRequestStatus } from "@/lib/types";

type DocumentRequestActionPayload = {
  action?: string;
  reason?: unknown;
  expectedUpdatedAt?: unknown;
  expectedStatus?: DocumentRequestStatus;
  status?: DocumentRequestStatus;
  rejectionReason?: string | null;
  review?: unknown;
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

  const { client, actorId, role } = adminClientResponse;
  const { id } = await context.params;
  const requestId = id?.trim() ?? "";

  if (!isUuid(requestId)) {
    return NextResponse.json({ message: "Invalid document request id." }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as DocumentRequestActionPayload | null;
  if (payload?.action === 'reopen') {
    if (role !== 'admin') return NextResponse.json({message:'Only administrators can reopen requests.'},{status:403});
    const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
    const expected = payload.expectedUpdatedAt;
    if (reason.length < 10 || reason.length > 1000 || typeof expected !== 'string' || !Number.isFinite(Date.parse(expected))) {
      return NextResponse.json({message:'Provide a reason of 10 to 1000 characters and refresh the request before reopening.'},{status:400});
    }
    const {error} = await client.rpc('reopen_office_document', {
      p_request_id:requestId,p_actor_id:actorId,p_expected_updated_at:expected,p_reason:reason,
    });
    if (error) return NextResponse.json({message:error.code==='PGRST202'?'Reopening is not available yet. Ask the administrator to apply the reopening migration.':error.message},{status:error.code==='40001'?409:error.code==='42501'?403:400});
    return NextResponse.json({updated:true});
  }
  if (payload?.action !== undefined) return NextResponse.json({message:'Unknown document action.'},{status:400});
  const expectedStatus = payload?.expectedStatus;
  const status = payload?.status;
  const review = parseDocumentReview(payload?.review);

  if (
    !review ||
    !status ||
    (status === "awaiting_payment" && expectedStatus !== "awaiting_payment") ||
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

  const { data, error } = await client.rpc("review_office_document", {
    p_request_id: requestId, p_actor_id: actorId,
    p_expected_status: expectedStatus, p_status: status,
    p_identity_checked: review.identityChecked, p_residency_checked: review.residencyChecked,
    p_authorization_checked: review.authorizationChecked, p_payment_status: review.paymentStatus,
    p_fee_amount: review.feeAmount, p_receipt: review.receipt, p_no_fee_reason: review.noFeeReason,
    p_pickup_confirmed: review.pickupConfirmed, p_collected_by: review.collectedBy,
    p_rejection_reason: rejectionReason,
  });

  if (error) {
    return NextResponse.json(
      { message: error.message || "Unable to update document request." },
      { status: error.code === '40001' ? 409 : 400 }
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
    role: session.role,
    actorId: session.userId,
    client: createClient(supabaseUrl, serviceRoleKey, {
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
