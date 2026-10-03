import { describe, expect, it } from 'vitest';
import { calculateFiscalMemory } from './fiscal-calculation.js';

describe('calculateFiscalMemory', () => {
  it('uses decimal arithmetic, the configured rounding and a separate retained total', () => {
    const result = calculateFiscalMemory({
      grossAmount: '45000.00', roundingMode: 'HALF_UP', roundingScale: 2,
      components: [
        { tax: 'FUNRURAL', treatment: 'TAXED', basis: 'DOCUMENT_TOTAL', ratePct: '0.200000', retained: true },
        { tax: 'PIS', treatment: 'SUSPENDED', basis: 'DOCUMENT_TOTAL', ratePct: null, retained: false },
      ],
    });

    expect(result).toMatchObject({
      grossAmount: '45000', taxTotal: '90.00', retainedTotal: '90.00', netAmount: '44910.00',
      rounding: { mode: 'HALF_UP', scale: 2 },
      components: [
        { tax: 'FUNRURAL', taxableBase: '45000', unroundedAmount: '90.000000000000', amount: '90.00' },
        { tax: 'PIS', amount: '0.00' },
      ],
    });
  });

  it('distinguishes HALF_UP from HALF_EVEN at the configured scale', () => {
    const component = {
      tax: 'ICMS' as const, treatment: 'TAXED' as const, basis: 'DOCUMENT_TOTAL' as const,
      ratePct: '0.500000', retained: false,
    };
    const halfUp = calculateFiscalMemory({
      grossAmount: '1.00', roundingMode: 'HALF_UP', roundingScale: 2, components: [component],
    });
    const halfEven = calculateFiscalMemory({
      grossAmount: '1.00', roundingMode: 'HALF_EVEN', roundingScale: 2, components: [component],
    });

    expect(halfUp.taxTotal).toBe('0.01');
    expect(halfEven.taxTotal).toBe('0.00');
  });
});
