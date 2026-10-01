import { describe, expect, it } from 'vitest';
import { calculateProjectedMargin, decideSubmission } from './pricing.js';

describe('commercial pricing', () => {
  it('uses decimal arithmetic and half-up monetary rounding', () => {
    expect(
      calculateProjectedMargin({
        purchasePricePerSc: '60.105',
        saleReferencePerSc: '72.205',
        costs: [
          { code: 'FREIGHT', amountPerSc: '4.015' },
          { code: 'STORAGE', amountPerSc: '1.005' },
        ],
      }),
    ).toEqual({
      purchasePricePerSc: '60.11',
      saleReferencePerSc: '72.21',
      totalCostsPerSc: '5.02',
      projectedMarginPerSc: '7.08',
    });
  });

  it('routes a margin between floor and automatic threshold to approval', () => {
    expect(decideSubmission('2.50', '4.00', '1.00')).toEqual({
      kind: 'APPROVAL_REQUIRED',
    });
  });

  it('blocks a margin below the absolute floor', () => {
    expect(decideSubmission('0.99', '4.00', '1.00')).toEqual({
      kind: 'BLOCKED_BELOW_FLOOR',
    });
  });
});
