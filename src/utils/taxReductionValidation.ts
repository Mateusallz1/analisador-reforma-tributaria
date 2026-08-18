type DecimalValue = {
  numerator: bigint;
  denominator: bigint;
  raw: string;
};

type DecimalField =
  | { status: 'missing'; raw?: undefined; value?: undefined }
  | { status: 'invalid'; raw: string; value?: undefined }
  | { status: 'valid'; raw: string; value: DecimalValue };

type ReductionCheckStatus = 'conforme' | 'nao_conforme' | 'incompleto' | 'pendente';

interface ComponentCheck {
  component: string;
  status: ReductionCheckStatus;
  reason?: string;
}

export interface TaxReductionInput {
  expectedIBS?: number;
  expectedCBS?: number;
}

export interface TaxReductionValidationResult {
  status: ReductionCheckStatus;
  reason?: string;
}

const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:\.(\d+))?$/;
const ZERO = createDecimal(0n, 1n, '0');
const ONE_HUNDRED = createDecimal(100n, 1n, '100');

function createDecimal(numerator: bigint, denominator: bigint, raw: string): DecimalValue {
  return { numerator, denominator, raw };
}

function parseDecimal(rawValue: string | null): DecimalField {
  if (rawValue === null || rawValue.trim() === '') {
    return { status: 'missing' };
  }

  const raw = rawValue.trim();
  const match = DECIMAL_PATTERN.exec(raw);
  if (!match) {
    return { status: 'invalid', raw };
  }

  const [, sign, whole, fraction = ''] = match;
  const digits = `${whole}${fraction}`;
  const signedDigits = sign === '-' ? `-${digits}` : digits;
  const denominator = 10n ** BigInt(fraction.length);

  return {
    status: 'valid',
    raw,
    value: createDecimal(BigInt(signedDigits), denominator, raw),
  };
}

function add(left: DecimalValue, right: DecimalValue): DecimalValue {
  return createDecimal(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
    `${left.raw} + ${right.raw}`,
  );
}

function subtract(left: DecimalValue, right: DecimalValue): DecimalValue {
  return createDecimal(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator,
    `${left.raw} - ${right.raw}`,
  );
}

function multiply(left: DecimalValue, right: DecimalValue): DecimalValue {
  return createDecimal(
    left.numerator * right.numerator,
    left.denominator * right.denominator,
    `${left.raw} * ${right.raw}`,
  );
}

function divide(left: DecimalValue, right: DecimalValue): DecimalValue {
  if (right.numerator === 0n) {
    throw new Error('Divisão decimal por zero');
  }

  return createDecimal(
    left.numerator * right.denominator,
    left.denominator * right.numerator,
    `${left.raw} / ${right.raw}`,
  );
}

function compare(left: DecimalValue, right: DecimalValue): number {
  const difference = left.numerator * right.denominator - right.numerator * left.denominator;
  return difference === 0n ? 0 : difference > 0n ? 1 : -1;
}

function roundToScale(value: DecimalValue, scale: number): DecimalValue {
  const factor = 10n ** BigInt(scale);
  const numerator = value.numerator * factor;
  const denominator = value.denominator;
  const sign = numerator < 0n ? -1n : 1n;
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const quotient = absoluteNumerator / denominator;
  const remainder = absoluteNumerator % denominator;
  const rounded = quotient + (remainder * 2n >= denominator ? 1n : 0n);

  return createDecimal(sign * rounded, factor, `${value.raw} rounded to ${scale}`);
}

function decimalFromNumber(value: number): DecimalValue | null {
  return Number.isFinite(value) ? parseDecimal(String(value)).value || null : null;
}

function getElementLocalName(element: Element): string {
  return element.localName || element.tagName.split(':').pop() || element.tagName;
}

function getDirectChild(parent: Element, localName: string): Element | null {
  return Array.from(parent.children).find((child) => getElementLocalName(child) === localName) || null;
}

function getDirectDecimal(parent: Element, localName: string): DecimalField {
  return parseDecimal(getDirectChild(parent, localName)?.textContent || null);
}

function getDirectGroup(parent: Element, localName: string): Element | null {
  return getDirectChild(parent, localName);
}

function hasDescendant(parent: Element, localNames: string[]): boolean {
  const names = new Set(localNames.map((name) => name.toLowerCase()));
  return Array.from(parent.getElementsByTagName('*')).some((element) =>
    names.has(getElementLocalName(element).toLowerCase())
  );
}

function decimalLabel(field: DecimalField): string {
  return field.status === 'valid' ? field.raw : field.status === 'missing' ? 'ausente' : `inválido (${field.raw})`;
}

function isZeroOrPositive(value: DecimalValue): boolean {
  return compare(value, ZERO) >= 0;
}

function isWithinPercentRange(value: DecimalValue): boolean {
  return isZeroOrPositive(value) && compare(value, ONE_HUNDRED) <= 0;
}

function expectedEffectiveRate(baseRate: DecimalValue, reduction: DecimalValue): DecimalValue {
  return multiply(baseRate, divide(subtract(ONE_HUNDRED, reduction), ONE_HUNDRED));
}

function formatExpected(value: DecimalValue, scale: number): string {
  const rounded = roundToScale(value, scale);
  const sign = rounded.numerator < 0n ? '-' : '';
  const digits = (rounded.numerator < 0n ? -rounded.numerator : rounded.numerator).toString().padStart(scale + 1, '0');
  if (scale === 0) return `${sign}${digits}`;
  return `${sign}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

function validateComponent(
  root: Element,
  groupName: string,
  rateName: string,
  amountName: string,
  label: string,
  expectedReduction: DecimalValue | null,
): ComponentCheck | null {
  if (!expectedReduction) {
    return {
      component: label,
      status: 'pendente',
      reason: 'percentual de redução da classificação não está disponível na base oficial.',
    };
  }

  const group = getDirectGroup(root, groupName);
  if (!group) {
    if (compare(expectedReduction, ZERO) > 0) {
      return {
        component: label,
        status: 'incompleto',
        reason: `grupo ${groupName} ausente para uma redução esperada de ${expectedReduction.raw}%.`,
      };
    }
    return null;
  }

  const reductionGroup = getDirectGroup(group, 'gRed');
  const reductionExpected = compare(expectedReduction, ZERO) > 0;
  if (!reductionExpected && reductionGroup) {
    return {
      component: label,
      status: 'nao_conforme',
      reason: 'grupo gRed informado para uma classificação sem redução prevista.',
    };
  }

  const baseRate = getDirectDecimal(group, rateName);
  const amount = getDirectDecimal(group, amountName);
  const vBC = getDirectDecimal(root, 'vBC');
  const effectiveRate = reductionGroup ? getDirectDecimal(reductionGroup, 'pAliqEfet') : baseRate;
  const declaredReduction = reductionGroup ? getDirectDecimal(reductionGroup, 'pRedAliq') : { status: 'valid' as const, raw: '0', value: ZERO };

  if (reductionExpected && !reductionGroup) {
    return {
      component: label,
      status: 'incompleto',
      reason: 'grupo gRed ausente para a redução prevista na classificação.',
    };
  }

  const missingFields: string[] = [];
  if (baseRate.status !== 'valid') missingFields.push(rateName);
  if (reductionExpected && declaredReduction.status !== 'valid') missingFields.push('pRedAliq');
  if (reductionExpected && effectiveRate.status !== 'valid') missingFields.push('pAliqEfet');
  if (vBC.status !== 'valid') missingFields.push('vBC');
  if (amount.status !== 'valid') missingFields.push(amountName);

  if (missingFields.length > 0) {
    return {
      component: label,
      status: 'incompleto',
      reason: `campo(s) obrigatório(s) ausente(s) ou inválido(s): ${missingFields.join(', ')}.`,
    };
  }

  if (!isWithinPercentRange(baseRate.value) || !isWithinPercentRange(effectiveRate.value)) {
    return {
      component: label,
      status: 'nao_conforme',
      reason: `alíquota fora do intervalo permitido: base ${decimalLabel(baseRate)}, efetiva ${decimalLabel(effectiveRate)}.`,
    };
  }

  if (!isWithinPercentRange(declaredReduction.value)) {
    return {
      component: label,
      status: 'nao_conforme',
      reason: `pRedAliq fora do intervalo permitido: ${decimalLabel(declaredReduction)}%.`,
    };
  }

  if (compare(declaredReduction.value, expectedReduction) !== 0) {
    return {
      component: label,
      status: 'nao_conforme',
      reason: `pRedAliq declarado ${decimalLabel(declaredReduction)}% diverge do esperado ${expectedReduction.raw}%.`,
    };
  }

  const expectedEffective = expectedEffectiveRate(baseRate.value, declaredReduction.value);
  if (compare(roundToScale(effectiveRate.value, 4), roundToScale(expectedEffective, 4)) !== 0) {
    return {
      component: label,
      status: 'nao_conforme',
      reason: `pAliqEfet declarado ${decimalLabel(effectiveRate)}% diverge do calculado ${formatExpected(expectedEffective, 4)}%.`,
    };
  }

  const expectedAmount = divide(multiply(vBC.value, effectiveRate.value), ONE_HUNDRED);
  const declaredAmount = roundToScale(amount.value, 2);
  const calculatedAmount = roundToScale(expectedAmount, 2);
  const amountDifference = subtract(declaredAmount, calculatedAmount);
  const tolerance = parseDecimal('0.01').value as DecimalValue;
  if (compare(roundToScale(amountDifference, 2), tolerance) > 0 || compare(roundToScale(amountDifference, 2), multiply(tolerance, createDecimal(-1n, 1n, '-1'))) < 0) {
    return {
      component: label,
      status: 'nao_conforme',
      reason: `${amountName} declarado ${decimalLabel(amount)} diverge do calculado em ${formatExpected(calculatedAmount, 2)}.`,
    };
  }

  return { component: label, status: 'conforme' };
}

function getExpectedReduction(value: number | undefined): DecimalValue | null {
  return typeof value === 'number' ? decimalFromNumber(value) : null;
}

function validateAggregate(root: Element): ComponentCheck | null {
  const componentGroups = [
    ['gIBSUF', 'vIBSUF'],
    ['gIBSMun', 'vIBSMun'],
  ]
    .map(([groupName, amountName]) => ({
      group: getDirectGroup(root, groupName),
      amountName,
    }))
    .filter((entry): entry is { group: Element; amountName: string } => !!entry.group);

  if (componentGroups.length === 0) return null;

  const declaredTotal = getDirectDecimal(root, 'vIBS');
  if (declaredTotal.status !== 'valid') {
    return {
      component: 'IBS total',
      status: 'incompleto',
      reason: 'vIBS ausente ou inválido enquanto há componentes IBS estadual ou municipal informados.',
    };
  }

  const componentAmounts = componentGroups
    .map(({ group, amountName }) => getDirectDecimal(group, amountName))
    .filter((field): field is Extract<DecimalField, { status: 'valid' }> => field.status === 'valid');

  if (componentAmounts.length === 0) return null;

  const calculatedTotal = componentAmounts.reduce((total, amount) => add(total, amount.value), ZERO);
  if (compare(roundToScale(declaredTotal.value, 2), roundToScale(calculatedTotal, 2)) !== 0) {
    return {
      component: 'IBS total',
      status: 'nao_conforme',
      reason: `vIBS declarado ${declaredTotal.raw} diverge da soma calculada ${formatExpected(calculatedTotal, 2)}.`,
    };
  }

  return null;
}

export function validateTaxReductions(root: Element, input: TaxReductionInput): TaxReductionValidationResult {
  const taxGroup = getDirectGroup(root, 'gIBSCBS') || root;
  const adjustmentTags = ['vDif', 'vDevTrib', 'gCompraGov', 'gCredPres', 'gCredPresOper'];
  if (hasDescendant(taxGroup, adjustmentTags)) {
    return {
      status: 'pendente',
      reason: 'o XML contém ajustes fiscais ainda não calculados por esta etapa (diferimento, devolução, compra governamental ou crédito presumido).',
    };
  }

  const expectedIBS = getExpectedReduction(input.expectedIBS);
  const expectedCBS = getExpectedReduction(input.expectedCBS);
  const checks = [
    validateComponent(taxGroup, 'gIBSUF', 'pIBSUF', 'vIBSUF', 'IBS UF', expectedIBS),
    validateComponent(taxGroup, 'gIBSMun', 'pIBSMun', 'vIBSMun', 'IBS Município', expectedIBS),
    validateComponent(taxGroup, 'gCBS', 'pCBS', 'vCBS', 'CBS', expectedCBS),
  ].filter((check): check is ComponentCheck => !!check);

  const aggregate = validateAggregate(taxGroup);
  if (aggregate) checks.push(aggregate);

  const incomplete = checks.filter((check) => check.status === 'incompleto');
  if (incomplete.length > 0) {
    return {
      status: 'incompleto',
      reason: incomplete.map((check) => `${check.component}: ${check.reason}`).join(' '),
    };
  }

  const pending = checks.filter((check) => check.status === 'pendente');
  if (pending.length > 0) {
    return {
      status: 'pendente',
      reason: pending.map((check) => `${check.component}: ${check.reason}`).join(' '),
    };
  }

  const invalid = checks.filter((check) => check.status === 'nao_conforme');
  if (invalid.length > 0) {
    return {
      status: 'nao_conforme',
      reason: invalid.map((check) => `${check.component}: ${check.reason}`).join(' '),
    };
  }

  return { status: 'conforme' };
}

interface NfseComponentConfig {
  groupName: string;
  rateName: string;
  reductionName: string;
  effectiveRateName: string;
  totalPath: string[];
  amountName: string;
  label: string;
  expectedReduction: DecimalValue | null;
}

function getDirectPath(parent: Element, localNames: string[]): Element | null {
  let current: Element | null = parent;
  for (const localName of localNames) {
    if (!current) return null;
    current = getDirectChild(current, localName);
  }
  return current;
}

function validateNfseComponent(
  values: Element,
  totals: Element,
  vBC: DecimalField,
  config: NfseComponentConfig,
  reductor: DecimalField,
): ComponentCheck {
  if (!config.expectedReduction) {
    return {
      component: config.label,
      status: 'pendente',
      reason: 'percentual de redução da classificação não está disponível na base oficial.',
    };
  }

  const group = getDirectGroup(values, config.groupName);
  if (!group) {
    return {
      component: config.label,
      status: 'incompleto',
      reason: `grupo ${config.groupName} ausente na NFS-e emitida.`,
    };
  }

  const baseRate = getDirectDecimal(group, config.rateName);
  const declaredReduction = getDirectDecimal(group, config.reductionName);
  const effectiveRate = getDirectDecimal(group, config.effectiveRateName);
  const amount = getDirectDecimal(getDirectPath(totals, config.totalPath) || totals, config.amountName);
  const missingFields: string[] = [];

  if (baseRate.status !== 'valid') missingFields.push(config.rateName);
  if (declaredReduction.status === 'invalid' || (config.expectedReduction && compare(config.expectedReduction, ZERO) > 0 && declaredReduction.status !== 'valid')) {
    missingFields.push(config.reductionName);
  }
  if (effectiveRate.status !== 'valid') missingFields.push(config.effectiveRateName);
  if (vBC.status !== 'valid') missingFields.push('vBC');
  if (amount.status !== 'valid') missingFields.push(config.amountName);

  if (missingFields.length > 0) {
    return {
      component: config.label,
      status: 'incompleto',
      reason: `campo(s) obrigatório(s) ausente(s) ou inválido(s): ${missingFields.join(', ')}.`,
    };
  }

  const reduction = declaredReduction.status === 'valid' ? declaredReduction.value : ZERO;
  if (!isWithinPercentRange(baseRate.value) || !isWithinPercentRange(reduction) || !isWithinPercentRange(effectiveRate.value)) {
    return {
      component: config.label,
      status: 'nao_conforme',
      reason: `alíquota fora do intervalo permitido: base ${decimalLabel(baseRate)}, redução ${decimalLabel(declaredReduction)}, efetiva ${decimalLabel(effectiveRate)}.`,
    };
  }

  if (compare(reduction, config.expectedReduction) !== 0) {
    return {
      component: config.label,
      status: 'nao_conforme',
      reason: `${config.reductionName} declarado ${decimalLabel(declaredReduction)}% diverge do esperado ${config.expectedReduction.raw}%.`,
    };
  }

  if (reductor.status !== 'valid' || !isWithinPercentRange(reductor.value)) {
    return {
      component: config.label,
      status: 'incompleto',
      reason: 'pRedutor ausente ou inválido na NFS-e emitida.',
    };
  }

  const expectedEffective = expectedEffectiveRateWithReductor(baseRate.value, reduction, reductor.value);
  if (compare(roundToScale(effectiveRate.value, 4), roundToScale(expectedEffective, 4)) !== 0) {
    return {
      component: config.label,
      status: 'nao_conforme',
      reason: `${config.effectiveRateName} declarado ${decimalLabel(effectiveRate)}% diverge do calculado ${formatExpected(expectedEffective, 4)}%.`,
    };
  }

  const expectedAmount = divide(multiply(vBC.value, effectiveRate.value), ONE_HUNDRED);
  const declaredAmount = roundToScale(amount.value, 2);
  const calculatedAmount = roundToScale(expectedAmount, 2);
  const amountDifference = subtract(declaredAmount, calculatedAmount);
  const tolerance = parseDecimal('0.01').value as DecimalValue;
  if (compare(roundToScale(amountDifference, 2), tolerance) > 0 || compare(roundToScale(amountDifference, 2), multiply(tolerance, createDecimal(-1n, 1n, '-1'))) < 0) {
    return {
      component: config.label,
      status: 'nao_conforme',
      reason: `${config.amountName} declarado ${decimalLabel(amount)} diverge do calculado em ${formatExpected(calculatedAmount, 2)}.`,
    };
  }

  return { component: config.label, status: 'conforme' };
}

function expectedEffectiveRateWithReductor(
  baseRate: DecimalValue,
  reduction: DecimalValue,
  reductor: DecimalValue,
): DecimalValue {
  return multiply(
    expectedEffectiveRate(baseRate, reduction),
    divide(subtract(ONE_HUNDRED, reductor), ONE_HUNDRED),
  );
}

function validateNfseAggregate(totals: Element): ComponentCheck[] {
  const gIBS = getDirectGroup(totals, 'gIBS');
  const gIBSUFTot = gIBS ? getDirectGroup(gIBS, 'gIBSUFTot') : null;
  const gIBSMunTot = gIBS ? getDirectGroup(gIBS, 'gIBSMunTot') : null;
  const gCBS = getDirectGroup(totals, 'gCBS');
  const ufAmount = gIBSUFTot ? getDirectDecimal(gIBSUFTot, 'vIBSUF') : { status: 'missing' as const };
  const munAmount = gIBSMunTot ? getDirectDecimal(gIBSMunTot, 'vIBSMun') : { status: 'missing' as const };
  const cbsAmount = gCBS ? getDirectDecimal(gCBS, 'vCBS') : { status: 'missing' as const };
  const checks: ComponentCheck[] = [];

  if (ufAmount.status !== 'valid') {
    checks.push({ component: 'IBS UF', status: 'incompleto', reason: 'totalizador vIBSUF ausente ou inválido.' });
  }
  if (munAmount.status !== 'valid') {
    checks.push({ component: 'IBS Município', status: 'incompleto', reason: 'totalizador vIBSMun ausente ou inválido.' });
  }
  if (cbsAmount.status !== 'valid') {
    checks.push({ component: 'CBS', status: 'incompleto', reason: 'totalizador vCBS ausente ou inválido.' });
  }

  const vIBSTot = gIBS ? getDirectDecimal(gIBS, 'vIBSTot') : { status: 'missing' as const };
  if (vIBSTot.status !== 'valid') {
    checks.push({ component: 'IBS total', status: 'incompleto', reason: 'totalizador vIBSTot ausente ou inválido.' });
  } else if (ufAmount.status === 'valid' && munAmount.status === 'valid') {
    const expectedTotal = add(ufAmount.value, munAmount.value);
    if (compare(roundToScale(vIBSTot.value, 2), roundToScale(expectedTotal, 2)) !== 0) {
      checks.push({
        component: 'IBS total',
        status: 'nao_conforme',
        reason: `vIBSTot declarado ${vIBSTot.raw} diverge da soma calculada ${formatExpected(expectedTotal, 2)}.`,
      });
    }
  }

  return checks;
}

function validateNfseDifferenceFields(root: Element): ComponentCheck[] {
  const fields = [
    {
      parent: getDirectPath(root, ['totCIBS', 'gIBS', 'gIBSUFTot']),
      name: 'vDifUF',
      label: 'Diferimento IBS UF',
    },
    {
      parent: getDirectPath(root, ['totCIBS', 'gIBS', 'gIBSMunTot']),
      name: 'vDifMun',
      label: 'Diferimento IBS Município',
    },
    {
      parent: getDirectPath(root, ['totCIBS', 'gCBS']),
      name: 'vDifCBS',
      label: 'Diferimento CBS',
    },
  ];

  const declaredFields = fields.filter(({ parent, name }) => parent && getDirectChild(parent, name));
  if (declaredFields.length === 0) return [];

  return declaredFields.flatMap(({ parent, name, label }): ComponentCheck[] => {
    const value = parent ? getDirectDecimal(parent, name) : { status: 'missing' as const };
    if (value.status !== 'valid') {
      return [{
        component: label,
        status: 'incompleto' as const,
        reason: `${name} ausente ou inválido no totalizador da NFS-e.`,
      }];
    }

    if (compare(value.value, ZERO) !== 0) {
      return [{
        component: label,
        status: 'pendente' as const,
        reason: `${name} informado com valor ${value.raw}; o cálculo de diferimento ainda não é validado nesta etapa.`,
      }];
    }

    return [];
  });
}

export function validateNfseTaxReductions(root: Element, input: TaxReductionInput): TaxReductionValidationResult {
  const values = getDirectGroup(root, 'valores');
  const hasGeneratedValues = !!values && !!getDirectGroup(values, 'uf');
  if (!hasGeneratedValues) {
    return {
      status: 'pendente',
      reason: 'o XML contém apenas os dados declarados no DPS; os valores calculados da NFS-e emitida não foram informados.',
    };
  }

  const totals = getDirectGroup(root, 'totCIBS');
  if (!totals) {
    return {
      status: 'incompleto',
      reason: 'grupo totCIBS ausente na NFS-e emitida.',
    };
  }

  const adjustmentTags = ['gTribRegular', 'gTribCompraGov', 'gIBSCredPres', 'gCBSCredPres'];
  if (hasDescendant(root, adjustmentTags)) {
    return {
      status: 'pendente',
      reason: 'o XML contém grupos de tributação complementar ou ajustes ainda não calculados por esta etapa.',
    };
  }

  const expectedIBS = getExpectedReduction(input.expectedIBS);
  const expectedCBS = getExpectedReduction(input.expectedCBS);
  const vBC = getDirectDecimal(values, 'vBC');
  const reductor = getDirectDecimal(root, 'pRedutor');
  const normalizedReductor = reductor.status === 'missing'
    ? { status: 'valid' as const, raw: '0', value: ZERO }
    : reductor;
  const checks = [
    validateNfseComponent(values, totals, vBC, {
      groupName: 'uf',
      rateName: 'pIBSUF',
      reductionName: 'pRedAliqUF',
      effectiveRateName: 'pAliqEfetUF',
      totalPath: ['gIBS', 'gIBSUFTot'],
      amountName: 'vIBSUF',
      label: 'IBS UF',
      expectedReduction: expectedIBS,
    }, normalizedReductor),
    validateNfseComponent(values, totals, vBC, {
      groupName: 'mun',
      rateName: 'pIBSMun',
      reductionName: 'pRedAliqMun',
      effectiveRateName: 'pAliqEfetMun',
      totalPath: ['gIBS', 'gIBSMunTot'],
      amountName: 'vIBSMun',
      label: 'IBS Município',
      expectedReduction: expectedIBS,
    }, normalizedReductor),
    validateNfseComponent(values, totals, vBC, {
      groupName: 'fed',
      rateName: 'pCBS',
      reductionName: 'pRedAliqCBS',
      effectiveRateName: 'pAliqEfetCBS',
      totalPath: ['gCBS'],
      amountName: 'vCBS',
      label: 'CBS',
      expectedReduction: expectedCBS,
    }, normalizedReductor),
    ...validateNfseDifferenceFields(root),
    ...validateNfseAggregate(totals),
  ];

  const incomplete = checks.filter((check) => check.status === 'incompleto');
  if (incomplete.length > 0) {
    return {
      status: 'incompleto',
      reason: incomplete.map((check) => `${check.component}: ${check.reason}`).join(' '),
    };
  }

  const pending = checks.filter((check) => check.status === 'pendente');
  if (pending.length > 0) {
    return {
      status: 'pendente',
      reason: pending.map((check) => `${check.component}: ${check.reason}`).join(' '),
    };
  }

  const invalid = checks.filter((check) => check.status === 'nao_conforme');
  if (invalid.length > 0) {
    return {
      status: 'nao_conforme',
      reason: invalid.map((check) => `${check.component}: ${check.reason}`).join(' '),
    };
  }

  return { status: 'conforme' };
}
