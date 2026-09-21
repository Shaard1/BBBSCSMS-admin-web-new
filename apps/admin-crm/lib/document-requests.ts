import { supabase } from "@/lib/supabase";
import type { DocumentRequest, DocumentRequestStatus } from "@/lib/types";

type FetchDocumentRequestsOptions = {
  limit?: number;
};

type RawDocumentRequestRecord = Record<string, unknown>;

export async function fetchDocumentRequests(options: FetchDocumentRequestsOptions = {}) {
  let query = supabase
    .from("document_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []).map((record) =>
    normalizeDocumentRequestRecord(record as RawDocumentRequestRecord)
  );
}

export async function updateDocumentRequestStatus(
  id: string,
  status: DocumentRequestStatus,
  expectedStatus: DocumentRequestStatus,
  rejectionReason?: string
) {
  const response = await fetch(`/api/admin/document-requests/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      expectedStatus,
      status,
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
