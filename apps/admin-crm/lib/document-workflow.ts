export type DocumentReview = {
  identityChecked: boolean;
  residencyChecked: boolean;
  authorizationChecked: boolean;
  paymentStatus: 'pending' | 'paid' | 'no_fee';
  feeAmount: number | null;
  receipt: string;
  noFeeReason: string;
  pickupConfirmed: boolean;
  collectedBy: string;
};

export function documentStatusChoices(current: string): string[] {
  const next: Record<string, string[]> = {
    pending: ['processing','rejected'], awaiting_payment: ['processing','rejected'],
    processing: ['ready_for_release','rejected'], ready_for_release: ['completed','rejected'],
    completed: [], rejected: [],
  };
  return [current, ...(next[current] ?? [])];
}

export function parseDocumentReview(input: unknown): DocumentReview | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (['identityChecked','residencyChecked','authorizationChecked','pickupConfirmed']
      .some((key) => typeof value[key] !== 'boolean')) return null;
  if (!['pending','paid','no_fee'].includes(String(value.paymentStatus))) return null;
  if (['receipt','noFeeReason','collectedBy'].some((key) => typeof value[key] !== 'string' || (value[key] as string).length > 500)) return null;
  if (value.feeAmount !== null && (typeof value.feeAmount !== 'number' || !Number.isFinite(value.feeAmount) || value.feeAmount < 0 || value.feeAmount > 99999999.99)) return null;
  const review = value as DocumentReview;
  if (review.paymentStatus === 'paid' && (!(Number(review.feeAmount) > 0) || !review.receipt.trim())) return null;
  if (review.paymentStatus === 'no_fee' && !review.noFeeReason.trim()) return null;
  if (review.pickupConfirmed && !review.collectedBy.trim()) return null;
  return {...review,feeAmount:review.paymentStatus==='paid'?review.feeAmount:review.paymentStatus==='no_fee'?0:null,
    receipt:review.paymentStatus==='paid'?review.receipt.trim():'',
    noFeeReason:review.paymentStatus==='no_fee'?review.noFeeReason.trim():'',
    collectedBy:review.pickupConfirmed?review.collectedBy.trim():''};
}
