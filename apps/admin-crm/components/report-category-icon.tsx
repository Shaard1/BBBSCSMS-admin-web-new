import { normalizeReportCategory } from '@/lib/report-utils';
import { Category } from '@/components/crm-icons';

const categoryPaths: Record<string, string[]> = {
  'Road Damage': ['M6 3 3 21M18 3l3 18M12 3v4m0 10v4M10 9l4 2-4 2 4 2'],
  'Garbage Collection': ['M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7'],
  'Broken Streetlight': ['M8 21h8M12 21V7a4 4 0 0 1 4-4h3M16 3v4h5V3M17 10l-1 3m5-3 1 3'],
  'Drainage Issue': ['M4 3h16v7H4zM8 3v7m4-7v7m4-7v7M3 15q3-3 6 0t6 0 6 0M3 20q3-3 6 0t6 0 6 0'],
  'Noise Complaint': ['M11 4 6 8H3v8h3l5 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14'],
  Others: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M7 12h.01M12 12h.01M17 12h.01'],
  all: ['M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'],
};

export function reportCategoryPaths(category?: string) {
  return categoryPaths[category === 'all' ? 'all' : normalizeReportCategory(category)];
}

export function ReportCategoryIcon({ category, size = 18 }: { category?: string; size?: number }) {
  if (category === 'all') return <Category size={size} />;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{reportCategoryPaths(category).map((d, index) => <path key={index} d={d} />)}</svg>;
}
