import { test, expect } from '@playwright/test';
import { parseDocumentReview, documentStatusChoices, type DocumentReview } from '../lib/document-workflow';
import { resolvePrivateFiles } from '../lib/private-files';

const pending: DocumentReview = { identityChecked:false, residencyChecked:false,
  authorizationChecked:false,paymentStatus:'pending',feeAmount:null,receipt:'',
  noFeeReason:'',pickupConfirmed:false,collectedBy:'' };

test('status choices require processing and keep closed requests terminal', () => {
  expect(documentStatusChoices('pending')).toEqual(['pending','processing','rejected']);
  expect(documentStatusChoices('processing')).not.toContain('completed');
  expect(documentStatusChoices('completed')).toEqual(['completed']);
});

test('requires explicit boolean checks, rejecting forged truthy strings', () => {
  expect(parseDocumentReview(pending)).toEqual(pending);
  expect(parseDocumentReview({...pending,identityChecked:'true'})).toBeNull();
});
test('paid office transactions require a positive finite amount and receipt', () => {
  expect(parseDocumentReview({...pending,paymentStatus:'paid',feeAmount:50,receipt:'TEST-RECEIPT'})).not.toBeNull();
  for (const feeAmount of [0,-1,Infinity,NaN]) {
    expect(parseDocumentReview({...pending,paymentStatus:'paid',feeAmount,receipt:'TEST'})).toBeNull();
  }
  expect(parseDocumentReview({...pending,paymentStatus:'paid',feeAmount:50})).toBeNull();
});
test('no-fee and collection decisions need explicit supporting entries', () => {
  expect(parseDocumentReview({...pending,paymentStatus:'no_fee'})).toBeNull();
  expect(parseDocumentReview({...pending,paymentStatus:'no_fee',noFeeReason:'Service is free'})).not.toBeNull();
  expect(parseDocumentReview({...pending,pickupConfirmed:true})).toBeNull();
  expect(parseDocumentReview({...pending,pickupConfirmed:true,collectedBy:'Synthetic recipient'})).not.toBeNull();
});
test('private evidence bucket paths are signed without changing stored locators', async () => {
  const stored = [{identity_evidence_url:'resident-files/owner/document-evidence/id.png'}];
  const calls: string[] = [];
  const result=await resolvePrivateFiles(stored,{baseUrl:'https://test.supabase.co',sign:async(bucket,path)=>{calls.push(`${bucket}/${path}`);return 'https://test.supabase.co/signed';}});
  expect(calls).toEqual(['resident-files/owner/document-evidence/id.png']);
  expect(result[0].identity_evidence_url).toBe('https://test.supabase.co/signed');
  expect(stored[0].identity_evidence_url).toBe('resident-files/owner/document-evidence/id.png');
});
test('inactive payment and unconfirmed collection values are cleared at the API boundary',()=>{
 const result=parseDocumentReview({identityChecked:true,residencyChecked:true,authorizationChecked:false,paymentStatus:'no_fee',feeAmount:50,receipt:'OLD RECEIPT',noFeeReason:'Free service',pickupConfirmed:false,collectedBy:'Old name'});
 expect(result).toMatchObject({feeAmount:0,receipt:'',noFeeReason:'Free service',collectedBy:''});
});
