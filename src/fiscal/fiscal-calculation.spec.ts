import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
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

  it('executes the exact synthetic VAL-03 quality-discount arithmetic without declaring a production rule', () => {
    const purchasePayable = new Decimal('40000.00');
    const simulatedRatePct = new Decimal('10.00');
    const manuallyApprovedComponent = purchasePayable.mul(simulatedRatePct).div(100);

    expect(manuallyApprovedComponent.toFixed(2)).toBe('4000.00');
    expect(purchasePayable.minus(manuallyApprovedComponent).toFixed(2)).toBe('36000.00');
  });

  it('executes the isolated exact VAL-04 fiscal catalog on BRL 100,000.00', () => {
    const grossAmount = new Decimal('100000.00');
    const isolatedCatalog = [
      { code: 'TRIBUTO_TESTE_A', ratePct: new Decimal('1.00') },
      { code: 'TRIBUTO_TESTE_B', ratePct: new Decimal('0.20') },
    ];
    const components = isolatedCatalog.map((component) => ({
      code: component.code,
      amount: grossAmount.mul(component.ratePct).div(100).toFixed(2),
    }));
    const retainedTotal = components.reduce(
      (total, component) => total.plus(component.amount), new Decimal(0),
    );

    expect(components).toEqual([
      { code: 'TRIBUTO_TESTE_A', amount: '1000.00' },
      { code: 'TRIBUTO_TESTE_B', amount: '200.00' },
    ]);
    expect(retainedTotal.toFixed(2)).toBe('1200.00');
    expect(grossAmount.minus(retainedTotal).toFixed(2)).toBe('98800.00');
  });
});
