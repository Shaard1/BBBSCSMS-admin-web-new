import type { Resident } from './types';
export type ResidentAccess = 'active' | 'suspended' | 'legacy_pending' | 'legacy_rejected';
export function residentAccess(resident: Resident): ResidentAccess {
    if (resident.basic_account)
        return resident.basic_account.account_state === 'active' ? 'active' : 'suspended';
    return resident.status === 'approved' ? 'active' : resident.status === 'rejected' ? 'legacy_rejected' : 'legacy_pending';
}
export function isLegacyPending(resident: Resident) { return residentAccess(resident) === 'legacy_pending'; }
export function residentPhoneState(resident: Resident) {
    return !resident.basic_account ? 'unknown' : resident.basic_account.phone_verified ? 'verified' : 'unverified';
}
export const accessLabels: Record<ResidentAccess, string> = {
    active: 'Active', suspended: 'Suspended', legacy_pending: 'Legacy review pending', legacy_rejected: 'Legacy registration rejected',
};
export function summarizeResidents(residents: Resident[]) {
    return { total: residents.length, active: residents.filter(r => residentAccess(r) === 'active').length,
        suspended: residents.filter(r => residentAccess(r) === 'suspended').length,
        legacyPending: residents.filter(isLegacyPending).length,
        phoneVerified: residents.filter(r => residentPhoneState(r) === 'verified').length };
}
