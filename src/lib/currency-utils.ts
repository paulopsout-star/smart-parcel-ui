/**
 * Utility functions for currency operations with cent precision
 * All calculations use integer cents to avoid floating point drift
 */

/**
 * Convert BRL string (R$ 1.234,56) to cents
 */
export function toCents(value: string | number): number {
  if (typeof value === 'number') {
    return Math.round(value * 100);
  }
  
  // Remove R$, spaces, and convert , to .
  const cleaned = value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(cleaned || '0');
  return Math.round(parsed * 100);
}

/**
 * Convert cents to BRL number
 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Format cents to BRL string (R$ 1.234,56)
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Format percentage with up to 2 decimal places
 */
export function formatPercentage(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

/**
 * Parse percentage string (8,19) to number
 */
export function parsePercentage(value: string): number {
  const cleaned = value.replace(',', '.');
  return parseFloat(cleaned || '0');
}

/**
 * Calculate cents from percentage of total
 */
export function percentToCents(percentage: number, totalCents: number): number {
  return Math.round((percentage / 100) * totalCents);
}

/**
 * Calculate percentage from cents of total
 */
export function centsToPercent(cents: number, totalCents: number): number {
  if (totalCents === 0) return 0;
  return (cents / totalCents) * 100;
}

/**
 * Format BRL input value (applies mask as user types)
 */
export function formatBRLInput(value: string): string {
  // Remove non-numeric characters except comma
  const cleaned = value.replace(/[^\d,]/g, '');
  
  // Split into integer and decimal parts
  const parts = cleaned.split(',');
  
  if (parts.length > 2) {
    // Only allow one comma
    return parts[0] + ',' + parts.slice(1).join('');
  }
  
  // Format integer part with thousands separator
  if (parts[0]) {
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  
  // Limit decimal to 2 digits
  if (parts[1]) {
    parts[1] = parts[1].substring(0, 2);
  }
  
  return parts.join(',');
}

/**
 * Format percentage input value
 */
export function formatPercentageInput(value: string): string {
  // Remove non-numeric characters except comma
  const cleaned = value.replace(/[^\d,]/g, '');
  
  // Split into integer and decimal parts
  const parts = cleaned.split(',');
  
  if (parts.length > 2) {
    // Only allow one comma
    return parts[0] + ',' + parts.slice(1).join('');
  }
  
  // Limit decimal to 2 digits
  if (parts[1]) {
    parts[1] = parts[1].substring(0, 2);
  }
  
  return parts.join(',');
}
