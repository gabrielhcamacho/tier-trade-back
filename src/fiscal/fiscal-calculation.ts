import Decimal from 'decimal.js';

export type FiscalRoundingMode = 'HALF_UP' | 'HALF_EVEN' | 'DOWN' | 'UP';
export type FiscalTaxTreatment = 'TAXED' | 'EXEMPT' | 'NON_TAXED' | 'DEFERRED' | 'SUSPENDED';

export type FiscalCalculationComponent = {
  tax: 'ICMS' | 'PIS' | 'COFINS' | 'FUNRURAL';
  treatment: FiscalTaxTreatment;
  basis: 'DOCUMENT_TOTAL';
  ratePct: string | null;
  retained: boolean;
};

export type FiscalCalculationInput = {
  grossAmount: string;
  roundingMode: FiscalRoundingMode;
  roundingScale: number;
  components: FiscalCalculationComponent[];
};

const decimalRoundingMode: Record<FiscalRoundingMode, Decimal.Rounding> = {
  HALF_UP: Decimal.ROUND_HALF_UP,
  HALF_EVEN: Decimal.ROUND_HALF_EVEN,
  DOWN: Decimal.ROUND_DOWN,
  UP: Decimal.ROUND_UP,
};

export function calculateFiscalMemory(input: FiscalCalculationInput) {
  const grossAmount = new Decimal(input.grossAmount);
  const rounding = decimalRoundingMode[input.roundingMode];
  const components = input.components.map((component) => {
    const taxableBase = grossAmount;
    const rate = component.ratePct === null ? new Decimal(0) : new Decimal(component.ratePct);
    const unroundedAmount = component.treatment === 'TAXED'
      ? taxableBase.mul(rate).div(100)
      : new Decimal(0);
    const amount = unroundedAmount.toDecimalPlaces(input.roundingScale, rounding);
    return {
      tax: component.tax,
      treatment: component.treatment,
      basis: component.basis,
      taxableBase: taxableBase.toFixed(),
      ratePct: component.ratePct,
      unroundedAmount: unroundedAmount.toFixed(12),
      amount: amount.toFixed(input.roundingScale),
      retained: component.retained,
      explanation: component.treatment === 'TAXED'
        ? 'Base tributável multiplicada pela alíquota da versão aplicada.'
        : 'Tratamento sem valor calculado nesta versão da regra.',
    };
  });
  const taxTotal = components.reduce((sum, component) => sum.plus(component.amount), new Decimal(0));
  const retainedTotal = components.reduce(
    (sum, component) => component.retained ? sum.plus(component.amount) : sum,
    new Decimal(0),
  );
  const netAmount = grossAmount.minus(retainedTotal);
  if (netAmount.isNegative()) throw new Error('FISCAL_RETENTION_EXCEEDS_GROSS');

  return {
    grossAmount: grossAmount.toFixed(),
    taxTotal: taxTotal.toFixed(input.roundingScale),
    retainedTotal: retainedTotal.toFixed(input.roundingScale),
    netAmount: netAmount.toDecimalPlaces(input.roundingScale, rounding).toFixed(input.roundingScale),
    rounding: { mode: input.roundingMode, scale: input.roundingScale },
    components,
  };
}
