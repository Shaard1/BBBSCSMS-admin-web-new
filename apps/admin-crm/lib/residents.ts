import { supabase } from "@/lib/supabase";
import { resolvePrivateFiles } from "@/lib/private-files";
import type { Resident } from "@/lib/types";
import { residentAccess, residentPhoneState, summarizeResidents } from './resident-state';
type FetchResidentsOptions = {
    limit?: number;
    images?: boolean;
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
        .select<string>(options.images === false ? 'id,user_id,full_name,email,address,contact_number,status,rejection_reason,created_at' : 'id,user_id,full_name,email,address,contact_number,status,rejection_reason,created_at,profile_image')
        .order("created_at", { ascending: false }).returns<RawResidentRecord[]>();
    if (options.limit) {
        query = query.limit(options.limit);
    }
    const { data, error } = await query;
    if (error)
        throw error;
    const { data: accounts, error: accountError } = await supabase.rpc('get_office_resident_accounts');
    // Older deployments have not received the staged account migration yet.
    if (accountError && accountError.code !== 'PGRST202')
        throw accountError;
    const byUser = new Map<string, NonNullable<Resident['basic_account']>>(((accounts ?? []) as Array<NonNullable<Resident['basic_account']> & {
        user_id: string;
    }>)
        .map((account) => [account.user_id, account]));
    const records = (data ?? []).map((row) => {
        const resident = normalizeResidentRecord(row as RawResidentRecord);
        return { ...resident, basic_account: byUser.get(resident.user_id || resident.id) };
    });
    return options.images === false ? records : resolvePrivateFiles(records);
}
export type ResidentDirectory = {
    items: Resident[];
    filteredTotal: number;
    summary: ReturnType<typeof summarizeResidents>;
    testAccess: boolean;
    serverPaged: boolean;
};
export async function fetchResidentDirectory(options: {
    search?: string;
    access?: string;
    phone?: string;
    page?: number;
} = {}): Promise<ResidentDirectory> {
    const { data, error } = await supabase.rpc('get_resident_directory', {
        p_search: options.search ?? '', p_access: options.access ?? 'all', p_phone: options.phone ?? 'all', p_page: options.page ?? 0, p_page_size: 25,
    });
    if (error && error.code !== 'PGRST202')
        throw error;
    if (!error) {
        return { ...data, items: await resolvePrivateFiles(data.items as Resident[]), serverPaged: true };
    }
    const all = await fetchResidents();
    const search = options.search?.trim().toLowerCase() ?? '';
    const filtered = all.filter(r => (!search || [r.full_name, r.email, r.contact_number, r.id].join(' ').toLowerCase().includes(search)) &&
        (!options.access || options.access === 'all' || residentAccess(r) === options.access) &&
        (!options.phone || options.phone === 'all' || residentPhoneState(r) === options.phone));
    return { items: filtered.slice((options.page ?? 0) * 25, (options.page ?? 0) * 25 + 25), filteredTotal: filtered.length,
        summary: summarizeResidents(all), testAccess: false, serverPaged: false };
}
export async function fetchResidentDetails(resident: Resident) {
    const { data, error } = await supabase.from('residents').select('*').eq('id', resident.id).single();
    if (error)
        throw error;
    const records = await resolvePrivateFiles([{ ...normalizeResidentRecord(data), basic_account: resident.basic_account }]);
    return records[0];
}
export type ResidentHistory = {
    documents: Array<{
        id: string;
        certificate_title: string;
        status: string;
        identity_checked: boolean;
        residency_checked: boolean;
        reviewed_at?: string;
    }>;
    reportCount: number;
    events: Array<{
        previous_state: string;
        next_state: string;
        reason: string;
        created_at: string;
        actor_name?: string;
    }>;
};
export async function fetchResidentHistory(userId: string): Promise<ResidentHistory | null> {
    const { data, error } = await supabase.rpc('get_resident_service_history', { p_user_id: userId });
    if (error?.code === 'PGRST202')
        return null;
    if (error)
        throw error;
    return data as ResidentHistory;
}
export async function setResidentAccess(resident: Resident, reason: string) {
    const response = await fetch(`/api/admin/residents/${resident.id}/access`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedState: resident.basic_account?.account_state, nextState: residentAccess(resident) === 'active' ? 'suspended' : 'active', reason }) });
    const body = await response.json();
    if (!response.ok)
        throw new Error(body.message ?? 'Unable to change account access');
}
export async function fetchResidentSummary() {
    const { data, error } = await supabase.rpc('get_resident_summary');
    if (error && error.code !== 'PGRST202')
        throw error;
    if (!error)
        return data as {
            total: number;
            pending: number;
        };
    const residents = await fetchResidents({ images: false });
    const summary = summarizeResidents(residents);
    return { total: summary.total, pending: summary.legacyPending };
}
export async function fetchResidentMetrics(year = new Date().getFullYear()) {
    const { data, error } = await supabase.rpc('get_resident_metrics', { p_year: year });
    if (error && error.code !== 'PGRST202')
        throw error;
    if (!error)
        return data as {
            summary: ReturnType<typeof summarizeResidents>;
            legacyQueue: Resident[];
            availableYears?: number[];
            months: Array<{
                month: number;
                residents: number;
            }>;
        };
    const residents = await fetchResidents({ images: false });
    const counts = Array.from({ length: 12 }, (_, month) => ({ month, residents: 0 }));
    for (const resident of residents) {
        const date = new Date(resident.created_at);
        if (date.getFullYear() === year)
            counts[date.getMonth()].residents++;
    }
    return { summary: summarizeResidents(residents), legacyQueue: residents.filter(r => residentAccess(r) === 'legacy_pending').slice(0, 5), months: counts, availableYears: [...new Set(residents.map(r => new Date(r.created_at).getFullYear()))].filter(Number.isFinite) };
}
export async function approveResident(id: string) {
    const response = await fetch(`/api/admin/residents/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" })
    });
    const body = (await response.json().catch(() => null)) as {
        message?: string;
        approved?: boolean;
        profileSynced?: boolean;
        warning?: string;
    } | null;
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
    if (normalizedValue === "approved")
        return "approved";
    if (normalizedValue === "rejected")
        return "rejected";
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
    if (directBirthdate)
        return directBirthdate;
    const day = firstString(record, ["birth_day", "day_of_birth", "dob_day", "day"]);
    const month = firstString(record, ["birth_month", "month_of_birth", "dob_month", "month"]);
    const year = firstString(record, ["birth_year", "year_of_birth", "dob_year", "year"]);
    if (!day || !month || !year)
        return undefined;
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
        if (value)
            return value;
    }
    return undefined;
}
function stringValue(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
