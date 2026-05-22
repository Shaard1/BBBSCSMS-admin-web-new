import { supabase } from "@/lib/supabase";
import type { Resident } from "@/lib/types";

type FetchResidentsOptions = {
  limit?: number;
};

type ResidentApprovalResponse = {
  approved: boolean;
  profileSynced: boolean;
  warning?: string;
};

type RawResidentRecord = Record<string, unknown>;

export async function fetchResidents(options: FetchResidentsOptions = {}) {
  let query = supabase
    .from("residents")
    .select("*")
    .order("created_at", { ascending: false });

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []).map((resident) => normalizeResidentRecord(resident as RawResidentRecord));
}

export async function fetchResidentSummary() {
  const { data, error } = await supabase.from("residents").select("status");

  if (error) throw error;

  return (data ?? []).reduce(
    (summary, resident) => {
      summary.total += 1;
      if (resident.status === "pending") summary.pending += 1;

      return summary;
    },
    { pending: 0, total: 0 }
  );
}

export async function approveResident(id: string) {
  const response = await fetch(`/api/admin/residents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "approve" })
  });

  const body = (await response.json().catch(() => null)) as
    | {
        message?: string;
        approved?: boolean;
        profileSynced?: boolean;
        warning?: string;
      }
    | null;

  if (!response.ok || !body?.approved) {
    throw new Error(body?.message ?? "Approval failed.");
  }

  return {
    approved: true,
    profileSynced: body.profileSynced ?? false,
    warning: body.warning
  } satisfies ResidentApprovalResponse;
}

export async function rejectResident(id: string, reason: string) {
  const response = await fetch(`/api/admin/residents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reject", reason })
  });

  const body = (await response.json().catch(() => null)) as {
    message?: string;
    rejected?: boolean;
  } | null;

  if (!response.ok || !body?.rejected) {
    throw new Error(body?.message ?? "Rejection failed.");
  }
}

function normalizeResidentRecord(record: RawResidentRecord): Resident {
  const resident = record as Partial<Resident>;

  return {
    id: stringValue(record.id) || "",
    user_id: stringValue(record.user_id),
    email: resolveResidentEmail(record),
    full_name: stringValue(record.full_name) || "Unnamed resident",
    birthdate: resolveResidentBirthdate(record),
    address: stringValue(record.address),
    contact_number: stringValue(record.contact_number),
    civil_status: stringValue(record.civil_status),
    gender: stringValue(record.gender),
    id_type: stringValue(record.id_type),
    id_image: stringValue(record.id_image),
    id_image_front: stringValue(record.id_image_front),
    id_image_back: stringValue(record.id_image_back),
    profile_image: stringValue(record.profile_image),
    profile_image_original: stringValue(record.profile_image_original),
    status: normalizeResidentStatus(resident.status),
    rejection_reason: stringValue(record.rejection_reason),
    created_at: stringValue(record.created_at) || ""
  };
}

function normalizeResidentStatus(value?: unknown): Resident["status"] {
  const normalizedValue = stringValue(value)?.toLowerCase();

  if (normalizedValue === "approved") return "approved";
  if (normalizedValue === "rejected") return "rejected";

  return "pending";
}

function resolveResidentEmail(record: RawResidentRecord) {
  return firstString(record, ["email", "user_email", "email_address", "resident_email"]);
}

function resolveResidentBirthdate(record: RawResidentRecord) {
  const directBirthdate = firstString(record, [
    "birthdate",
    "birth_date",
    "date_of_birth",
    "dob"
  ]);

  if (directBirthdate) return directBirthdate;

  const day = firstString(record, ["birth_day", "day_of_birth", "dob_day", "day"]);
  const month = firstString(record, ["birth_month", "month_of_birth", "dob_month", "month"]);
  const year = firstString(record, ["birth_year", "year_of_birth", "dob_year", "year"]);

  if (!day || !month || !year) return undefined;

  const normalizedDay = day.padStart(2, "0");
  const normalizedMonth = normalizeBirthMonth(month);
  const normalizedYear = year.trim();

  if (!normalizedMonth || normalizedYear.length !== 4) {
    return `${normalizedDay}/${month}/${normalizedYear}`;
  }

  return `${normalizedYear}-${normalizedMonth}-${normalizedDay}`;
}

function normalizeBirthMonth(value: string) {
  const trimmedValue = value.trim().toLowerCase();
  const monthMap: Record<string, string> = {
    "1": "01",
    "01": "01",
    january: "01",
    jan: "01",
    "2": "02",
    "02": "02",
    february: "02",
    feb: "02",
    "3": "03",
    "03": "03",
    march: "03",
    mar: "03",
    "4": "04",
    "04": "04",
    april: "04",
    apr: "04",
    "5": "05",
    "05": "05",
    may: "05",
    "6": "06",
    "06": "06",
    june: "06",
    jun: "06",
    "7": "07",
    "07": "07",
    july: "07",
    jul: "07",
    "8": "08",
    "08": "08",
    august: "08",
    aug: "08",
    "9": "09",
    "09": "09",
    september: "09",
    sept: "09",
    sep: "09",
    "10": "10",
    october: "10",
    oct: "10",
    "11": "11",
    november: "11",
    nov: "11",
    "12": "12",
    december: "12",
    dec: "12"
  };

  return monthMap[trimmedValue];
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
