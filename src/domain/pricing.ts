import Decimal from 'decimal.js';

export type DecimalString = string;

export interface CostInput {
  code: string;
  amountPerSc: DecimalString;
}

export interface PricingInput {
  purchasePricePerSc: DecimalString;
  saleReferencePerSc: DecimalString;
  costs: readonly CostInput[];
}

export interface PricingResult {
  purchasePricePerSc: DecimalString;
  saleReferencePerSc: DecimalString;
  totalCostsPerSc: DecimalString;
  projectedMarginPerSc: DecimalString;
}

function money(value: Decimal.Value): DecimalString {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function calculateProjectedMargin(input: PricingInput): PricingResult {
  const purchase = new Decimal(input.purchasePricePerSc);
  const sale = new Decimal(input.saleReferencePerSc);
  const costs = input.costs.reduce(
    (sum, item) => sum.plus(new Decimal(item.amountPerSc)),
    new Decimal(0),
  );

  if (!purchase.isPositive() || !sale.isPositive()) {
    throw new Error('Purchase price and sale reference must be positive.');
  }
  if (input.costs.some((item) => new Decimal(item.amountPerSc).isNegative())) {
    throw new Error('Costs cannot be negative.');
  }

  return {
    purchasePricePerSc: money(purchase),
    saleReferencePerSc: money(sale),
    totalCostsPerSc: money(costs),
    projectedMarginPerSc: money(sale.minus(purchase).minus(costs)),
  };
}

export type SubmissionDecision =
  | { kind: 'AUTO_APPROVED' }
  | { kind: 'APPROVAL_REQUIRED' }
  | { kind: 'BLOCKED_BELOW_FLOOR' };

export function decideSubmission(
  projectedMarginPerSc: DecimalString,
  autoApprovalMarginPerSc: DecimalString,
  absoluteFloorMarginPerSc: DecimalString,
): SubmissionDecision {
  const margin = new Decimal(projectedMarginPerSc);
  const automatic = new Decimal(autoApprovalMarginPerSc);
  const floor = new Decimal(absoluteFloorMarginPerSc);

  if (automatic.lessThan(floor)) {
    throw new Error('Invalid margin policy: automatic threshold is below the floor.');
  }
  if (margin.greaterThanOrEqualTo(automatic)) return { kind: 'AUTO_APPROVED' };
  if (margin.greaterThanOrEqualTo(floor)) return { kind: 'APPROVAL_REQUIRED' };
  return { kind: 'BLOCKED_BELOW_FLOOR' };
}
