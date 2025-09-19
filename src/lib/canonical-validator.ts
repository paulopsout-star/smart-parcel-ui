// Utilitário para validar JSON canônico do Quita+
// Garante que o REQUEST_BODY está exatamente no formato esperado

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// JSON canônico de referência (contrato obrigatório)
export const CANONICAL_STRUCTURE = {
  orderDetails: {
    merchantId: "string",
    initiatorKey: "null|string", 
    expiresAt: "string",
    description: "null|string",
    details: "null|string",
    payer: {
      document: "string",
      email: "string", 
      phoneNumber: "string",
      name: "string"
    },
    bankslip: {
      number: "string",
      creditorDocument: "string",
      creditorName: "string"
    },
    checkout: {
      maskFee: "boolean",
      installments: "null|number"
    }
  }
}

/**
 * Valida se o JSON está exatamente no formato canônico
 * Rejeita qualquer chave extra ou faltante
 */
export function validateCanonicalStructure(body: any): ValidationResult {
  const errors: string[] = []

  // Verificar se existe body
  if (!body || typeof body !== 'object') {
    errors.push('Body must be an object')
    return { isValid: false, errors }
  }

  // Verificar objeto raiz contém apenas orderDetails
  const rootKeys = Object.keys(body)
  if (rootKeys.length !== 1 || rootKeys[0] !== 'orderDetails') {
    errors.push('Root object must contain only orderDetails')
    return { isValid: false, errors }
  }

  const orderDetails = body.orderDetails
  if (!orderDetails || typeof orderDetails !== 'object') {
    errors.push('orderDetails must be an object')
    return { isValid: false, errors }
  }

  // Verificar chaves do orderDetails
  const expectedOrderDetailsKeys = ['merchantId', 'initiatorKey', 'expiresAt', 'description', 'details', 'payer', 'bankslip', 'checkout']
  const actualOrderDetailsKeys = Object.keys(orderDetails)
  
  // Verificar se tem todas as chaves obrigatórias
  for (const key of expectedOrderDetailsKeys) {
    if (!actualOrderDetailsKeys.includes(key)) {
      errors.push(`Missing key in orderDetails: ${key}`)
    }
  }

  // Verificar se não tem chaves extras
  for (const key of actualOrderDetailsKeys) {
    if (!expectedOrderDetailsKeys.includes(key)) {
      errors.push(`Extra key in orderDetails not allowed: ${key}`)
    }
  }

  // Verificar chaves do payer
  if (orderDetails.payer) {
    const expectedPayerKeys = ['document', 'email', 'phoneNumber', 'name']
    const actualPayerKeys = Object.keys(orderDetails.payer)
    
    for (const key of expectedPayerKeys) {
      if (!actualPayerKeys.includes(key)) {
        errors.push(`Missing key in payer: ${key}`)
      }
    }
    
    for (const key of actualPayerKeys) {
      if (!expectedPayerKeys.includes(key)) {
        errors.push(`Extra key in payer not allowed: ${key}`)
      }
    }
  } else {
    errors.push('payer is required')
  }

  // Verificar chaves do bankslip
  if (orderDetails.bankslip) {
    const expectedBankslipKeys = ['number', 'creditorDocument', 'creditorName']
    const actualBankslipKeys = Object.keys(orderDetails.bankslip)
    
    for (const key of expectedBankslipKeys) {
      if (!actualBankslipKeys.includes(key)) {
        errors.push(`Missing key in bankslip: ${key}`)
      }
    }
    
    for (const key of actualBankslipKeys) {
      if (!expectedBankslipKeys.includes(key)) {
        errors.push(`Extra key in bankslip not allowed: ${key}`)
      }
    }
  } else {
    errors.push('bankslip is required')
  }

  // Verificar chaves do checkout
  if (orderDetails.checkout) {
    const expectedCheckoutKeys = ['maskFee', 'installments']
    const actualCheckoutKeys = Object.keys(orderDetails.checkout)
    
    for (const key of expectedCheckoutKeys) {
      if (!actualCheckoutKeys.includes(key)) {
        errors.push(`Missing key in checkout: ${key}`)
      }
    }
    
    for (const key of actualCheckoutKeys) {
      if (!expectedCheckoutKeys.includes(key)) {
        errors.push(`Extra key in checkout not allowed: ${key}`)
      }
    }
  } else {
    errors.push('checkout is required')
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Utilitário para debug - compara dois JSONs e mostra diferenças
 */
export function compareJsonStructures(expected: any, actual: any): ValidationResult {
  const errors: string[] = []
  
  const validation = validateCanonicalStructure(actual)
  errors.push(...validation.errors)

  return { isValid: errors.length === 0, errors }
}