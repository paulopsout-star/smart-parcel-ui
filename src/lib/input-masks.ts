// Utilitários para máscaras de input

/**
 * Formata telefone: (11) 99999-9999
 */
export const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/(-$)/, '');
  }
  
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/(-$)/, '');
};

/**
 * Formata CPF: 000.000.000-00 ou CNPJ: 00.000.000/0000-00
 */
export const formatDocument = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length <= 11) {
    // CPF
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  
  // CNPJ
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

/**
 * Formata valor de moeda: 1234.56 -> "1.234,56"
 */
export const formatCurrencyInput = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  
  if (!digits) return '';
  
  const number = parseInt(digits) / 100;
  
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
};

/**
 * Remove formatação de telefone
 */
export const unformatPhone = (value: string): string => {
  return value.replace(/\D/g, '');
};

/**
 * Remove formatação de documento
 */
export const unformatDocument = (value: string): string => {
  return value.replace(/\D/g, '');
};

/**
 * Converte valor formatado de moeda para centavos
 */
export const currencyToCents = (value: string): number => {
  const digits = value.replace(/\D/g, '');
  return parseInt(digits) || 0;
};
