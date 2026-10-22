import { randomUUID } from 'node:crypto';
// Invoked by the test-project harness after the office-document migration is applied.
export async function checkDocumentWorkflow({request,requireOk,check,a,b,staff,serverKey}) {
  const ready=await request('/rest/v1/rpc/office_document_workflow_available',a.token,'POST',{});
  if (!ready.ok && ready.data?.code==='PGRST202') {
    console.log(JSON.stringify({documentWorkflow:'not installed; document checks skipped'}));
    return;
  }
  requireOk(ready,'Check document workflow');
  const ids=[];
  const objectPath=`${a.id}/document-evidence/test-${randomUUID()}.png`;
  const base={user_id:a.id,resident_id:a.id,resident_name:'Synthetic applicant',
    certificate_key:'barangay_clearance',certificate_title:'Synthetic clearance',
    address:'Synthetic test address',purpose:'Integration test only',payment_method:'office',status:'pending',
    workflow_version:2,requester_capacity:'self',requester_name:'Synthetic requester',
    identity_evidence_method:'in_person',residency_evidence_method:'in_person'};
  async function insert(payload,token=a.token) {
    const result=await request('/rest/v1/document_requests',token,'POST',payload);
    if(result.ok && result.data?.[0]?.id) ids.push(result.data[0].id);
    return result;
  }
  try {
    check('Document rejects online payment method',!(await insert({...base,payment_method:'GCash'})).ok);
    check('Document rejects missing identity arrangements',!(await insert({...base,identity_evidence_method:null})).ok);
    check('Document rejects client-provided identity approval',!(await insert({...base,identity_checked:true})).ok);
    check('Representative requires authorization arrangements',!(await insert({...base,requester_capacity:'representative'})).ok);
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
    requireOk(await request(`/storage/v1/object/resident-files/${objectPath}`,a.token,'POST',png,true),'Upload synthetic identity evidence');
    const evidence={identity_evidence_method:'upload',evidence_id_type:'Synthetic test ID',identity_evidence_url:`resident-files/${objectPath}`};
    check('Resident cannot attach another resident identity file',!(await insert({...base,...evidence,user_id:b.id,resident_id:b.id},b.token)).ok);
    const row=requireOk(await insert({...base,...evidence}),'Submit office document')[0];
    check('Document submission accepts private evidence and office payment',row.status==='pending' && row.payment_method==='office' && row.identity_checked===false);
    const other=await request(`/rest/v1/document_requests?id=eq.${row.id}&select=id`,b.token);
    check('Other resident cannot read document application',other.ok && other.data.length===0);
    check('Staff cannot bypass audited review via direct table update',!(await request(`/rest/v1/document_requests?id=eq.${row.id}`,staff.token,'PATCH',{status:'completed'})).ok);
    const login=await fetch('http://localhost:3011/api/admin/session',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:3011'},body:JSON.stringify({accessToken:staff.token,expectedRole:'staff'})});
    const cookie=login.headers.get('set-cookie')?.split(';')[0];
    if(!login.ok || !cookie) throw Error('Cannot create staff session for document checks');
    let status='pending';
    const review={identityChecked:false,residencyChecked:false,authorizationChecked:false,paymentStatus:'pending',feeAmount:null,receipt:'',noFeeReason:'',pickupConfirmed:false,collectedBy:''};
    async function update(next,patch={}) {
      const response=await fetch(`http://localhost:3011/api/admin/document-requests/${row.id}`,{method:'PATCH',headers:{'Content-Type':'application/json',Origin:'http://localhost:3011',Cookie:cookie},body:JSON.stringify({expectedStatus:status,status:next,review:{...review,...patch}})});
      if(response.ok){status=next;Object.assign(review,patch);}
      return response;
    }
    check('Request cannot skip processing and become ready',!(await update('ready_for_release')).ok);
    check('Staff can begin document processing',(await update('processing')).ok);
    check('Ready status requires identity and residency checks',!(await update('ready_for_release')).ok);
    check('Checked request can become ready',(await update('ready_for_release',{identityChecked:true,residencyChecked:true})).ok);
    check('Completion requires office settlement and pickup',!(await update('completed')).ok);
    check('Unpaid request cannot complete even with pickup',!(await update('completed',{pickupConfirmed:true,collectedBy:'Synthetic recipient'})).ok);
    check('No-fee decision and checked physical pickup allow completion',(await update('completed',{paymentStatus:'no_fee',noFeeReason:'Synthetic free-service decision',pickupConfirmed:true,collectedBy:'Synthetic recipient'})).ok);
    const audit=requireOk(await request(`/rest/v1/document_request_reviews?request_id=eq.${row.id}&select=actor_id`,serverKey),'Read fixture audit');
    check('Office reviews create attributable audit records',audit.length>=3 && audit.every(event=>event.actor_id===staff.id));
    check('Closed document requests cannot be rewritten',!(await update('processing')).ok);
  } finally {
    for(const id of ids) requireOk(await request(`/rest/v1/document_requests?id=eq.${id}`,serverKey,'DELETE'),'Clean synthetic document');
    requireOk(await request('/storage/v1/object/resident-files',serverKey,'DELETE',{prefixes:[objectPath]}),'Clean synthetic document evidence');
  }
}
