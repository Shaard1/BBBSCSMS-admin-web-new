import {test,expect} from '@playwright/test';
import {residentAccess,residentPhoneState,summarizeResidents} from '../lib/resident-state';
import {uuidSearchClause} from '../lib/global-search';
import type {Resident} from '../lib/types';

const legacy:Resident={id:'10000000-0000-4000-8000-000000000001',full_name:'Synthetic resident',status:'pending',created_at:'2026-01-01'};
const basic:Resident={...legacy,basic_account:{account_state:'active',identity_status:'unverified',phone_verified:false}};

test('basic access is independent from legacy approval and phone ownership',()=>{
  expect(residentAccess(basic)).toBe('active');
  expect(residentPhoneState(basic)).toBe('unverified');
  expect(residentAccess({...basic,basic_account:{...basic.basic_account!,account_state:'suspended'}})).toBe('suspended');
  expect(residentAccess(legacy)).toBe('legacy_pending');
  expect(residentPhoneState({...legacy,status:'approved'})).toBe('unknown');
  expect(summarizeResidents([basic,legacy])).toEqual({total:2,active:1,suspended:0,legacyPending:1,phoneVerified:0});
});

test('UUID searches use equality and ordinary text never adds a UUID filter',()=>{
  expect(uuidSearchClause('%Carlo%')).toBe('');
  expect(uuidSearchClause('%10000000-0000-4000-8000-000000000001%')).toBe(',id.eq.10000000-0000-4000-8000-000000000001');
  expect(uuidSearchClause('%invalid,id.eq.something%')).toBe('');
});
