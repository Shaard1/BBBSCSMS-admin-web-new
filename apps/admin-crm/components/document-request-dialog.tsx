"use client";
import {useEffect,useRef,useState} from 'react';
import {Modal} from './modal';
import {UiDropdown} from './ui-dropdown';
import {PrivateEvidenceButton} from './private-evidence-button';
import {fetchDocumentReviewHistory,type DocumentReviewEvent} from '@/lib/document-requests';
import {documentStatusChoices,type DocumentReview} from '@/lib/document-workflow';
import type {DocumentRequest,DocumentRequestStatus} from '@/lib/types';

const labels:Record<string,string>={pending:'Pending',processing:'Processing',ready_for_release:'Ready for release',completed:'Completed',rejected:'Rejected',awaiting_payment:'Legacy payment pending',in_person:'Present originals at office',upload:'Uploaded photo',self:'Applying for myself',representative:'Applying for someone else',paid:'Paid at office',no_fee:'No fee required'};
const readable=(value?:string)=>value?labels[value]??value:'Not provided';
const fieldLabel=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
function Detail({label,value}:{label:string;value?:string}){return <div className="document-detail-item"><span>{label}</span><strong>{value||'Not provided'}</strong></div>;}
const emptyReview:DocumentReview={identityChecked:false,residencyChecked:false,authorizationChecked:false,paymentStatus:'pending',feeAmount:null,receipt:'',noFeeReason:'',pickupConfirmed:false,collectedBy:''};

export function DocumentRequestDialog({request,message,isWorking,onClose,onStatusChange}:{request:DocumentRequest;message:string;isWorking:boolean;onClose:()=>void;onStatusChange:(request:DocumentRequest,status:DocumentRequestStatus,reason?:string,review?:DocumentReview)=>void}){
 const [pane,setPane]=useState('Overview');
 const contentRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{contentRef.current?.scrollTo({top:0});},[pane,request.status]);
 const [audit,setAudit]=useState<DocumentReviewEvent[]>([]);
 const [auditMessage,setAuditMessage]=useState('Loading review history…');
 const [nextStatus,setNextStatus]=useState(request.status);
 const [reason,setReason]=useState('');
 const [review,setReview]=useState<DocumentReview>(request.review??emptyReview);
 const closed=['completed','rejected'].includes(request.status);
 useEffect(()=>{setReview(request.review??emptyReview);setNextStatus(request.status);},[request]);
 useEffect(()=>{let cancelled=false;setAuditMessage('Loading review history…');
  void fetchDocumentReviewHistory(request.id).then(events=>{if(!cancelled){setAudit(events);setAuditMessage(events.length?'':'No reviews recorded yet.');}}).catch(()=>{if(!cancelled)setAuditMessage('Review history could not be loaded. Reopen the request to try again.');});
  return()=>{cancelled=true;};
 },[request.id,request.updated_at]);
 const mainFields:Record<string,string|undefined>={full_name:request.resident_name,email:request.email,address:request.address,contact_number:request.contact_number,purpose:request.purpose,additional_notes:request.additional_notes};
 const extras=Object.entries(typeof request.form_data==='object'&&request.form_data?request.form_data:{}).filter(([key,value])=>value!=null&&String(value).trim()&&!(mainFields[key]&&String(value).trim()===mainFields[key]?.trim()));
 function paymentDecision(value:DocumentReview['paymentStatus']){setReview(current=>({...current,paymentStatus:value,feeAmount:value==='paid'?current.feeAmount:value==='no_fee'?0:null,receipt:value==='paid'?current.receipt:'',noFeeReason:value==='no_fee'?current.noFeeReason:''}));}
 const summaryReview=request.review??emptyReview;
 return <Modal title="Document request details" onClose={onClose} className="document-detail-dialog">{close=>(
  <div className="document-detail-layout">
   <header className="modal-header"><div><h2>{request.certificate_title}</h2><p>{request.resident_name}</p></div><button type="button" aria-label="Close" onClick={close}>×</button></header>
   <div className="document-request-current"><span>Current status</span><strong className={`status-badge ${request.status==='rejected'?'flagged':request.status==='completed'?'approved':'pending'}`}>{readable(request.status)}</strong><p>{closed?'This request is closed. Details and recorded reviews are read-only.':'Review the evidence before changing the request status.'}</p></div>
   <nav className="document-detail-tabs" aria-label="Request sections">{['Overview','Review','History'].map(name=><button type="button" key={name} aria-pressed={pane===name} onClick={()=>setPane(name)}>{name}</button>)}</nav>
   {message?<div className="document-detail-feedback" role="status">{message}</div>:null}
   <div data-dropdown-scroll-container key={pane} ref={contentRef} className="document-detail-content" tabIndex={0} role="region" aria-label={`${pane} details`}>
    {pane==='Overview'?<>
     {request.status==='rejected'?<div className="document-request-reason"><strong>Reason for rejection</strong><p>{request.rejection_reason||'No reason recorded.'}</p></div>:null}
     <h3>Applicant and application</h3><div className="document-request-grid">{Object.entries(mainFields).map(([key,value])=><Detail key={key} label={fieldLabel(key)} value={value}/>)}
      <Detail label="Submitted" value={new Date(request.created_at).toLocaleString('en-PH')}/><Detail label="Applying as" value={readable(request.requester_capacity)}/>
      {request.requester_name&&request.requester_name!==request.resident_name?<Detail label="Submitted by" value={request.requester_name}/>:null}
      {request.certificate_variant?<Detail label="Document variant" value={request.certificate_variant}/>:null}
     </div>
     {extras.length?<section><h3>Document-specific answers</h3><div className="document-request-grid">{extras.map(([key,value])=><Detail key={key} label={key in mainFields?`${fieldLabel(key)} (submitted form differs)`:fieldLabel(key)} value={String(value)}/>)}</div></section>:null}
     <details><summary>Request reference</summary><p className="document-reference">{request.id}</p></details>
    </>:null}
    {pane==='History'?<section><h3>Review history</h3><p>Up to 20 recent entries. Expand a review to see the recorded snapshot.</p>{auditMessage?<p role="status">{auditMessage}</p>:audit.map(event=><details className="document-history-entry" key={event.id}><summary>{new Date(event.reviewed_at).toLocaleString('en-PH')} · {readable(String(event.review.status??'Review saved'))}</summary><p>Recorded by {event.actor_name||event.actor_id}</p><dl className="document-request-grid">{Object.entries(event.review).map(([key,value])=><div key={key}><dt>{fieldLabel(key)}</dt><dd>{typeof value==='boolean'?(value?'Yes':'No'):value==null||value===''?'Not recorded':readable(String(value))}</dd></div>)}</dl></details>)}</section>:null}
    <div hidden={pane!=='Review'}>
     <h3>Requirements and evidence</h3><div className="document-request-grid">{(['identity','residency','authorization'] as const).map(kind=>{const applicable=kind!=='authorization'||request.requester_capacity==='representative';const method=request[`${kind}_evidence_method`];const url=request[`${kind}_evidence_url`];return <section className="document-evidence-card" key={kind}><h4>{kind==='identity'?'Proof of identity':kind==='residency'?'Proof of address':'Representative permission'}</h4><p>{applicable?readable(method):'Not applicable — self-application'}</p>{kind==='identity'&&request.evidence_id_type?<p>{request.evidence_id_type}</p>:null}{applicable&&url?<PrivateEvidenceButton source={url} kind={kind}/>:null}</section>;})}</div>
     {closed?<section className="account-detail-section"><h3>Recorded checks and collection</h3><div className="document-request-grid"><Detail label="Identity" value={summaryReview.identityChecked?'Checked':'Not checked'}/><Detail label="Residency" value={summaryReview.residencyChecked?'Checked':'Not checked'}/>{request.requester_capacity==='representative'?<Detail label="Authorization" value={summaryReview.authorizationChecked?'Checked':'Not checked'}/>:null}<Detail label="Office payment decision" value={readable(summaryReview.paymentStatus)}/>{summaryReview.paymentStatus==='paid'?<><Detail label="Amount received" value={`PHP ${summaryReview.feeAmount??0}`}/><Detail label="Receipt reference" value={summaryReview.receipt}/></>:summaryReview.paymentStatus==='no_fee'?<Detail label="No-fee reason" value={summaryReview.noFeeReason}/>:null}<Detail label="Physical collection" value={summaryReview.pickupConfirmed?'Confirmed':'Not confirmed'}/>{summaryReview.pickupConfirmed?<Detail label="Collected by" value={summaryReview.collectedBy}/>:null}</div></section>:<form id="document-review-form" className="document-request-actions" onSubmit={event=>{event.preventDefault();onStatusChange(request,nextStatus,reason.trim(),review);}}>
      <fieldset disabled={isWorking}><legend>Checks for this request</legend><p>Record checks actually performed. A phone number or uploaded ID does not automatically establish identity.</p>
       {(['identityChecked','residencyChecked',...(request.requester_capacity==='representative'?['authorizationChecked']:[])] as Array<'identityChecked'|'residencyChecked'|'authorizationChecked'>).map(key=><label key={key}><input type="checkbox" checked={review[key]} onChange={e=>setReview({...review,[key]:e.target.checked})}/>{key==='identityChecked'?'Applicant identity checked':key==='residencyChecked'?'Residency checked':'Representative authorization checked'}</label>)}
       <div className="field-group"><span className="field-label">Office payment decision</span><UiDropdown placement="below" ariaLabel="Office payment decision" disabled={isWorking} value={review.paymentStatus} options={[{label:'Not yet settled at office',value:'pending'},{label:'Paid at office',value:'paid'},{label:'No fee required / authorized waiver',value:'no_fee'}]} onChange={value=>paymentDecision(value as DocumentReview['paymentStatus'])}/></div>
       {review.paymentStatus==='paid'?<><label>Amount received at office<input type="number" min="0.01" step="0.01" required value={review.feeAmount??''} onChange={e=>setReview({...review,feeAmount:e.target.value===''?null:Number(e.target.value)})}/></label><label>Official receipt reference<input required maxLength={500} value={review.receipt} onChange={e=>setReview({...review,receipt:e.target.value})}/></label></>:null}
       {review.paymentStatus==='no_fee'?<label>Reason no fee applies<input required maxLength={500} value={review.noFeeReason} onChange={e=>setReview({...review,noFeeReason:e.target.value})}/></label>:null}
       <label><input type="checkbox" checked={review.pickupConfirmed} onChange={e=>setReview({...review,pickupConfirmed:e.target.checked,collectedBy:e.target.checked?review.collectedBy:''})}/>Document physically collected after recipient check</label>
       {review.pickupConfirmed?<label>Collected by<input required maxLength={500} value={review.collectedBy} onChange={e=>setReview({...review,collectedBy:e.target.value})}/></label>:null}
      </fieldset>
      <div className="field-group"><span className="field-label">Update status</span><UiDropdown placement="below" ariaLabel="Update status" value={nextStatus} disabled={isWorking} options={documentStatusChoices(request.status).map(value=>({label:readable(value),value}))} onChange={value=>setNextStatus(value as DocumentRequestStatus)}/></div>
      {nextStatus==='rejected'?<label className="rejection-field">Reason shown to the resident<textarea required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>:null}
      <p className="document-status-preview" aria-live="polite">{nextStatus!==request.status?<>Saving will change the status to <strong>{readable(nextStatus)}</strong>.</>:null}</p>
     </form>}
    </div>
   </div>
   <footer className="document-detail-footer"><button type="button" className="secondary-admin-button" disabled={isWorking} onClick={close}>{closed?'Close':'Cancel'}</button>{!closed?(pane==='Review'?<button key="save-review" type="submit" form="document-review-form" className="primary-admin-button" disabled={isWorking||(nextStatus==='rejected'&&!reason.trim())}>{isWorking?'Updating…':'Update request'}</button>:<button key="open-review" type="button" className="primary-admin-button" onClick={()=>setPane('Review')}>Review request</button>):null}</footer>
  </div>)}
 </Modal>;
}
