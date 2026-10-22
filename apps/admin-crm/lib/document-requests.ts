import { supabase } from "@/lib/supabase";
import { resolvePrivateFiles } from "@/lib/private-files";
import type { DocumentRequest, DocumentRequestStatus } from "@/lib/types";
import type { DocumentReview } from "@/lib/document-workflow";

type FetchDocumentRequestsOptions = {
  limit?: number;
  images?: boolean;
};

type RawDocumentRequestRecord = Record<string, unknown>;

export async function fetchDocumentRequests(options: FetchDocumentRequestsOptions = {}) {
  let query = supabase
    .from("document_requests")
    .select<string>(options.images === false ? 'id,status,certificate_title,resident_name,created_at' : '*')
    .order("created_at", { ascending: false }).returns<RawDocumentRequestRecord[]>();

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) throw error;

  const records = (data ?? []).map((record) =>
    normalizeDocumentRequestRecord(record as RawDocumentRequestRecord)
  );
  return options.images === false ? records : resolvePrivateFiles(records);
}

export async function updateDocumentRequestStatus(
  id: string,
  status: DocumentRequestStatus,
  expectedStatus: DocumentRequestStatus,
  rejectionReason?: string,
  review?: DocumentReview,
) {
  const response = await fetch(`/api/admin/document-requests/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      expectedStatus,
      status,
      review,
      rejectionReason: rejectionReason?.trim() || null
    })
  });

  const body = (await response.json().catch(() => null)) as
    | {
        message?: string;
        updated?: boolean;
      }
    | null;

  if (!response.ok || !body?.updated) {
    throw new Error(body?.message ?? "Unable to update document request.");
  }
}

export function summarizeDocumentRequests(requests: DocumentRequest[]) {
  return requests.reduce(
    (summary, request) => {
      summary.total += 1;

      switch (request.status) {
        case "pending":
          summary.pending += 1;
          break;
        case "awaiting_payment":
          summary.awaitingPayment += 1;
          break;
        case "processing":
          summary.processing += 1;
          break;
        case "ready_for_release":
          summary.readyForRelease += 1;
          break;
        case "completed":
          summary.completed += 1;
          break;
        case "rejected":
          summary.rejected += 1;
          break;
      }

      return summary;
    },
    {
      total: 0,
      pending: 0,
      awaitingPayment: 0,
      processing: 0,
      readyForRelease: 0,
      completed: 0,
      rejected: 0
    }
  );
}

function normalizeDocumentRequestRecord(record: RawDocumentRequestRecord): DocumentRequest {
  const formData = record.form_data;

  return {
    workflow_version: numberValue(record.workflow_version),
    requester_capacity: stringValue(record.requester_capacity),
    requester_name: stringValue(record.requester_name),
    identity_evidence_method: stringValue(record.identity_evidence_method),
    residency_evidence_method: stringValue(record.residency_evidence_method),
    authorization_evidence_method: stringValue(record.authorization_evidence_method),
    identity_evidence_url: stringValue(record.identity_evidence_url),
    residency_evidence_url: stringValue(record.residency_evidence_url),
    authorization_evidence_url: stringValue(record.authorization_evidence_url),
    evidence_id_type: stringValue(record.evidence_id_type),
    review: {
      identityChecked: record.identity_checked === true,
      residencyChecked: record.residency_checked === true,
      authorizationChecked: record.authorization_checked === true,
      paymentStatus: record.office_payment_status === 'paid' ? 'paid' : record.office_payment_status === 'no_fee' ? 'no_fee' : 'pending',
      feeAmount: numberValue(record.fee_amount) ?? null,
      receipt: stringValue(record.office_receipt_reference) ?? '',
      noFeeReason: stringValue(record.office_no_fee_reason) ?? '',
      pickupConfirmed: record.pickup_confirmed === true,
      collectedBy: stringValue(record.collected_by) ?? '',
    },
    id: stringValue(record.id) || "",
    user_id: stringValue(record.user_id),
    resident_id: stringValue(record.resident_id),
    resident_name: stringValue(record.resident_name) || "Unnamed resident",
    certificate_key: stringValue(record.certificate_key) || "",
    certificate_title: stringValue(record.certificate_title) || "Document Request",
    certificate_variant: stringValue(record.certificate_variant),
    contact_number: stringValue(record.contact_number),
    email: stringValue(record.email),
    address: stringValue(record.address),
    payment_method: stringValue(record.payment_method),
    payment_receiver_name: stringValue(record.payment_receiver_name),
    payment_receiver_number: stringValue(record.payment_receiver_number),
    payment_reference: stringValue(record.payment_reference),
    payment_proof_url: stringValue(record.payment_proof_url),
    payment_submitted_at: stringValue(record.payment_submitted_at),
    fee_label: stringValue(record.fee_label),
    fee_amount: numberValue(record.fee_amount),
    purpose: stringValue(record.purpose),
    additional_notes: stringValue(record.additional_notes),
    form_data:
      formData && typeof formData === "object" && !Array.isArray(formData)
        ? (formData as Record<string, unknown>)
        : stringValue(formData),
    rejection_reason: stringValue(record.rejection_reason),
    status: normalizeDocumentRequestStatus(record.status),
    created_at: stringValue(record.created_at) || "",
    updated_at: stringValue(record.updated_at)
  };
}

function normalizeDocumentRequestStatus(value: unknown): DocumentRequestStatus {
  const normalizedValue = stringValue(value)?.toLowerCase();

  if (normalizedValue === "awaiting_payment") return "awaiting_payment";
  if (normalizedValue === "processing") return "processing";
  if (normalizedValue === "ready_for_release") return "ready_for_release";
  if (normalizedValue === "completed") return "completed";
  if (normalizedValue === "rejected") return "rejected";

  return "pending";
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export type DocumentReviewEvent = {id:string;actor_id:string;actor_name?:string;reviewed_at:string;review:Record<string,unknown>};
export async function fetchDocumentReviewHistory(requestId:string):Promise<DocumentReviewEvent[]>{
 const {data,error}=await supabase.from('document_request_reviews').select('id,actor_id,reviewed_at,review').eq('request_id',requestId).order('reviewed_at',{ascending:false}).limit(20);
 if(error)throw error;
 const events=(data??[]) as DocumentReviewEvent[];
 const actors=[...new Set(events.map(event=>event.actor_id))];
 if(!actors.length)return events;
 const {data:profiles}=await supabase.from('profiles').select('id,full_name').in('id',actors);
 const names=new Map((profiles??[]).map(p=>[p.id,p.full_name]));
 return events.map(event=>({...event,actor_name:names.get(event.actor_id)||undefined}));
}
