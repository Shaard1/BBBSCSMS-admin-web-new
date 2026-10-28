import { expect, test } from '@playwright/test';
import { pageLoadedReports, readReportQueueResult, type ReportQueueFilters } from '../lib/report-queue';
import type { CommunityReport } from '../lib/types';

const filters: ReportQueueFilters = { search: '', status: 'all', category: 'all', sort: 'newest', page: 0 };
const reports: CommunityReport[] = Array.from({ length: 61 }, (_, i) => ({
  id: String(i).padStart(3, '0'), created_at: '2026-10-01T08:00:00Z',
  reporter_name: i === 60 ? 'Resident Example' : 'Test resident',
  description: i === 60 ? 'Drainage at 100% _ north (gate)' : 'Road needs repair',
  category: i === 60 ? 'flooding' : 'Road Damage',
  status: i % 3 === 0 ? 'pending' : i % 3 === 1 ? 'in_process' : 'completed',
}));

test('paging does not repeat equal-date records and keeps summary totals independent of the page', () => {
  const first = pageLoadedReports(reports, filters);
  const second = pageLoadedReports(reports, { ...filters, page: 1 });
  const last = pageLoadedReports(reports, { ...filters, page: 2 });
  expect(first.items).toHaveLength(25);
  expect(second.items).toHaveLength(25);
  expect(last.items).toHaveLength(11);
  expect(new Set([...first.items, ...second.items, ...last.items].map(r => r.id)).size).toBe(61);
  expect(last.summary).toEqual({ total: 61, pending: 21, progress: 20, resolved: 20 });
});

test('name search combines with category and status aliases before pagination', () => {
  const result = pageLoadedReports(reports, { ...filters, search: 'resident example', category: 'Drainage Issue', status: 'pending' });
  expect(result.items.map(r => r.id)).toEqual(['060']);
  expect(result.filteredTotal).toBe(1);
  expect(result.summary.total).toBe(61);
});

test('search punctuation is literal and date ordering is stable', () => {
  expect(pageLoadedReports(reports, { ...filters, search: '100% _ north (gate)' }).filteredTotal).toBe(1);
  const dated = [{ ...reports[0], created_at: '2026-10-02T00:00:00Z' }, reports[1]];
  expect(pageLoadedReports(dated, filters).items.map(r => r.id)).toEqual(['000', '001']);
  expect(pageLoadedReports(dated, { ...filters, sort: 'oldest' }).items.map(r => r.id)).toEqual(['001', '000']);
});

test('queue response rejects malformed counts, oversized pages and inconsistent totals', () => {
  const valid = pageLoadedReports(reports, filters);
  expect(readReportQueueResult(valid).filteredTotal).toBe(61);
  expect(() => readReportQueueResult({ ...valid, filteredTotal: -1 })).toThrow();
  expect(() => readReportQueueResult({ ...valid, items: reports })).toThrow();
  expect(() => readReportQueueResult({ ...valid, summary: { total: 61 } })).toThrow();
  expect(() => readReportQueueResult({ ...valid, filteredTotal: 100 })).toThrow();
});
