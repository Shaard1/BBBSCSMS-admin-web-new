/* eslint-disable @next/next/no-img-element */
"use client";
import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import {useSearchParams} from 'next/navigation';
import { Eye, RefreshCw, Search, UserRound, X } from 'lucide-react';
import { Modal } from '@/components/modal';
import { ImageViewer } from '@/components/image-viewer';
import { PageHeader } from '@/components/workspace-ui';
import { useAdminRole } from '@/components/admin-role-context';
import { fetchResidentDirectory, fetchResidentDetails, fetchResidentHistory, setResidentAccess, approveResident, rejectResident, type ResidentDirectory, type ResidentHistory } from '@/lib/residents';
import { residentAccess, residentPhoneState, accessLabels, summarizeResidents } from '@/lib/resident-state';
import type { Resident } from '@/lib/types';
const empty: ResidentDirectory = { items: [], filteredTotal: 0, summary: summarizeResidents([]), testAccess: false, serverPaged: true };
export default function ResidentsPage() {
 return <Suspense fallback={<p role="status">Loading resident accounts…</p>}><ResidentDirectoryPage/></Suspense>;
}
function ResidentDirectoryPage() {
    const targetId=useSearchParams().get("resident");
    const { role } = useAdminRole();
    const [directory, setDirectory] = useState(empty);
    const [search, setSearch] = useState('');
    const [access, setAccess] = useState('all');
    const [phone, setPhone] = useState('all');
    const [page, setPage] = useState(0);
    const [revision, setRevision] = useState(0);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [message, setMessage] = useState('');
    const [selected, setSelected] = useState<Resident | null>(null);
    const [history, setHistory] = useState<ResidentHistory | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailsReady, setDetailsReady] = useState(false);
    const [action, setAction] = useState<'access' | 'approve' | 'reject' | null>(null);
    const [reason, setReason] = useState('');
    const [image, setImage] = useState<{
        title: string;
        url: string;
    } | null>(null);
    const detailRequest = useRef(0);
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        const timer = setTimeout(() => {
            fetchResidentDirectory({ search, access, phone, page }).then(data => { if (!cancelled)
                setDirectory(data); })
                .catch(error => { if (!cancelled)
                setMessage(error instanceof Error ? error.message : 'Unable to load resident accounts.'); })
                .finally(() => { if (!cancelled)
                setLoading(false); });
        }, 200);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [search, access, phone, page, revision]);
    useEffect(() => {
        const id = targetId;
        if (!id)
            return;
        let cancelled = false;
        void fetchResidentDirectory({ search: id }).then(data => { const resident = data.items.find(r => r.id === id); if (!cancelled && resident)
            void openResident(resident); }).catch(error => { if (!cancelled)
            setMessage(error instanceof Error ? error.message : "Unable to open resident account."); });
        return () => { cancelled = true; };
    }, [targetId]);
    async function openResident(resident: Resident) {
        const request = ++detailRequest.current;
        setSelected(resident);
        setHistory(null);
        setDetailLoading(true);
        setDetailsReady(false);
        setAction(null);
        setMessage('');
        try {
            const [full, events] = await Promise.all([fetchResidentDetails(resident), fetchResidentHistory(resident.user_id || resident.id)]);
            if (request === detailRequest.current) {
                setSelected(full);
                setHistory(events);
                setDetailsReady(true);
            }
        }
        catch (error) {
            if (request === detailRequest.current)
                setMessage(error instanceof Error ? error.message : 'Unable to load account details.');
        }
        finally {
            if (request === detailRequest.current)
                setDetailLoading(false);
        }
    }
    function closeResident() { detailRequest.current++; setSelected(null); setAction(null); setReason(''); }
    async function submitAction() {
        if (!selected || !action || working || !detailsReady)
            return;
        if (action !== 'approve' && !reason.trim())
            return;
        setWorking(true);
        try {
            if (action === 'access')
                await setResidentAccess(selected, reason.trim());
            else if (action === 'approve') {
                const result = await approveResident(selected.id);
                if (result.warning) {
                    setMessage(result.warning);
                    closeResident();
                    setRevision(r => r + 1);
                    return;
                }
            }
            else
                await rejectResident(selected.id, reason.trim());
            setMessage(action === 'access' ? 'Account access updated. Phone and document checks were unchanged.' : 'Legacy registration updated.');
            closeResident();
            setRevision(r => r + 1);
        }
        catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to update account.');
        }
        finally {
            setWorking(false);
        }
    }
    const s = directory.summary;
    return <section className="admin-page residents-page" aria-busy={loading}>
    <PageHeader title="Resident accounts" description="Manage resident access and view phone ownership separately from document checks."/>
    <div className="resident-account-metrics">
      {([['Total accounts', s.total], ['Active', s.active], ['Suspended', s.suspended], ['Phone verified', s.phoneVerified]] as const).map(([label, count]) => <article className="resident-summary-card" key={label}><span>{label}</span><strong>{count}</strong></article>)}
    </div>
    {directory.testAccess ? <p className="account-context-note">Test preview: unverified accounts may use basic services. This does not verify a phone or authorize document release.</p> : null}
    {!directory.serverPaged ? <p className="admin-message">Account-management migration is pending. Showing the legacy-compatible directory; server pagination, service history and access actions require the new migration.</p> : null}
    <div className="resident-account-toolbar">
      <label className="resident-search"><Search size={18}/><input aria-label="Search resident accounts" placeholder="Search name, contact, email or ID…" value={search} maxLength={150} onChange={e => { setSearch(e.target.value); setPage(0); }}/></label>
      <label>Account access<select value={access} onChange={e => { setAccess(e.target.value); setPage(0); }}><option value="all">All accounts</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="legacy_pending">Legacy review pending</option><option value="legacy_rejected">Legacy registration rejected</option></select></label>
      <label>Phone ownership<select value={phone} onChange={e => { setPhone(e.target.value); setPage(0); }}><option value="all">All phone states</option><option value="verified">Verified</option><option value="unverified">Not verified</option><option value="unknown">Not recorded (legacy)</option></select></label>
    </div>
    {message ? <div className="admin-message" role="status"><span>{message}</span><button type="button" onClick={() => setMessage('')}>Dismiss</button></div> : null}
    <div className="resident-panel">
      <div className="resident-panel-heading"><div><h3>Resident directory</h3><p>Phone ownership is verified by SMS in the mobile app when SMS is enabled. Staff review identity and residency within document applications.</p></div><button type="button" disabled={loading} onClick={() => setRevision(r => r + 1)}><RefreshCw size={16}/> Refresh</button></div>
      <div className="resident-directory-scroll" role="region" aria-label="Resident directory table" tabIndex={0}><table className="resident-directory-table"><thead><tr><th>Resident</th><th>Contact</th><th>Phone ownership</th><th>Account access</th><th>Actions</th></tr></thead><tbody>
        {directory.items.map(resident => <tr key={resident.id}><td><div className="resident-person">{resident.profile_image ? <img className="resident-avatar" alt="" src={resident.profile_image}/> : <span className="resident-avatar fallback"><UserRound size={19}/></span>}<div><strong>{resident.full_name}</strong><small>Joined {new Date(resident.created_at).toLocaleDateString('en-PH')}</small></div></div></td><td>{resident.basic_account?.declared_phone || resident.contact_number || 'Not provided'}</td><td><PhoneBadge resident={resident}/></td><td><AccessBadge resident={resident}/></td><td><button aria-label={`View ${resident.full_name}`} type="button" onClick={() => void openResident(resident)}><Eye size={18}/></button></td></tr>)}
      </tbody></table></div>
      {!directory.items.length ? <p className="empty-state" role="status">{loading ? 'Loading resident accounts…' : 'No resident accounts match these filters.'}</p> : null}
      <div className="resident-directory-pagination"><span>{directory.filteredTotal} matching accounts · Page {page + 1} of {Math.max(1, Math.ceil(directory.filteredTotal / 25))}</span><button type="button" disabled={loading || page === 0} onClick={() => setPage(p => p - 1)}>Previous</button><button type="button" disabled={loading || (page + 1) * 25 >= directory.filteredTotal} onClick={() => setPage(p => p + 1)}>Next</button></div>
    </div>
    {selected ? <Modal title="Resident account details" onClose={closeResident}>
      <div className="resident-modal resident-account-details"><div className="modal-header"><div><h2>{selected.full_name}</h2><p>Resident account · {selected.id}</p></div><button aria-label="Close" onClick={closeResident} type="button"><X size={20}/></button></div>
        {detailLoading ? <p role="status">Loading account details…</p> : null}
        <div className="account-state-grid"><section><h3>Account access</h3><AccessBadge resident={selected}/><p>{selected.basic_account ? 'Basic accounts do not need manual account approval.' : 'This account uses the legacy registration process.'}</p></section><section><h3>Phone ownership</h3><PhoneBadge resident={selected}/><p>{selected.basic_account?.declared_phone || 'Sign-in phone is not available.'}</p><p>Verified by an SMS code through the mobile app when available. Staff cannot manually mark SMS verification complete.</p></section></div>
        <section className="account-detail-section"><h3>Contact details</h3><dl><dt>Email</dt><dd>{selected.email || 'Not provided'}</dd><dt>Contact number (self-declared)</dt><dd>{selected.contact_number || 'Not provided'}</dd></dl></section>
        <section className="account-detail-section"><h3>Service history and document checks</h3><p>Checks apply to the application reviewed. There is no blanket document approval for this account.</p>
          {history ? <><p>{history.reportCount} community reports. Showing up to 20 recent document applications.</p>{history.documents.length ? <ul>{history.documents.map(doc => <li key={doc.id}><Link href={`/admin/documents?request=${doc.id}`}>{doc.certificate_title}</Link> — {doc.status.replaceAll('_', ' ')}<br /><small>Identity {doc.identity_checked ? 'checked' : 'not yet checked'} · Residency {doc.residency_checked ? 'checked' : 'not yet checked'}{doc.reviewed_at ? ` · Reviewed ${new Date(doc.reviewed_at).toLocaleString('en-PH')}` : ''}</small></li>)}</ul> : <p>No document applications yet. No document identity review is waiting for staff.</p>}</> : <p>{detailLoading ? 'Loading service history…' : 'Service history requires the account-management migration.'}</p>}
        </section>
        {!selected.basic_account ? <details className="account-detail-section"><summary>Legacy registration details</summary><dl>{([['Birthdate', selected.birthdate], ['Address', selected.address], ['Gender', selected.gender], ['Civil status', selected.civil_status], ['ID type', selected.id_type], ['Rejection reason', selected.rejection_reason]] as const).filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="account-evidence-grid">{([['Profile image', selected.profile_image_original || selected.profile_image], ['ID front', selected.id_image_front || selected.id_image], ['ID back', selected.id_image_back]] as const).filter(([, url]) => url).map(([title, url]) => <button type="button" key={title} onClick={() => setImage({ title, url: url! })}><img src={url} alt={title}/><span>{title}</span></button>)}</div></details> : null}
        <section className="account-detail-section"><h3>Account access history</h3>{history?.events.length ? <ul>{history.events.map((event, index) => <li key={index}><strong>{event.previous_state} → {event.next_state}</strong> · {new Date(event.created_at).toLocaleString('en-PH')}<p>{event.reason}</p><small>{event.actor_name || 'Authorized administrator'}</small></li>)}</ul> : <p>{history?"No account suspension/reactivation events recorded.":"Account access history is currently unavailable."}</p>}</section>
        {selected.basic_account && role === 'admin' ? <button className="secondary-admin-button" type="button" disabled={!directory.serverPaged || !detailsReady || working} onClick={() => { setReason(''); setAction('access'); }}>{residentAccess(selected) === 'active' ? 'Suspend account' : 'Reactivate account'}</button> : null}
        {!selected.basic_account && selected.status === 'pending' ? <div className="modal-actions"><button type="button" disabled={!detailsReady || working} onClick={() => { setReason(''); setAction('reject'); }}>Reject legacy registration</button><button type="button" disabled={!detailsReady || working} onClick={() => setAction('approve')}>Approve legacy registration</button></div> : null}
        {action ? <form className="account-access-form" onSubmit={e => { e.preventDefault(); void submitAction(); }}><h3>{action === 'access' ? (residentAccess(selected) === 'active' ? 'Suspend basic access' : 'Restore basic access') : action === 'approve' ? 'Approve legacy registration' : 'Reject legacy registration'}</h3><p>Phone ownership and document verification will not be changed.</p>{action !== 'approve' ? <label>Reason<textarea required maxLength={500} value={reason} onChange={e => setReason(e.target.value)}/></label> : null}<div className="modal-actions"><button type="button" disabled={working} onClick={() => setAction(null)}>Cancel</button><button type="submit" disabled={working || !detailsReady}>{working ? 'Saving…' : 'Confirm'}</button></div></form> : null}
        {message ? <p role="status" className="admin-message">{message}</p> : null}
      </div>
    </Modal> : null}
    {image ? <ImageViewer title={image.title} imageUrl={image.url} onClose={() => setImage(null)}/> : null}
  </section>;
}
function AccessBadge({ resident }: {
    resident: Resident;
}) { const access = residentAccess(resident); return <span className={`status-badge ${access === 'active' ? 'approved' : access === 'suspended' ? 'flagged' : 'pending'}`}>{accessLabels[access]}</span>; }
function PhoneBadge({ resident }: {
    resident: Resident;
}) { const state = residentPhoneState(resident); return <span className={`status-badge ${state === 'verified' ? 'approved' : 'neutral'}`}>{state === 'verified' ? 'Verified' : state === 'unverified' ? 'Not verified' : 'Not recorded (legacy)'}</span>; }
