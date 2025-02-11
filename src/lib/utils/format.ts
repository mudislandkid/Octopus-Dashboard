// Utility function to format numbers with specified decimal places
export function formatNumber(value: number, decimals: number = 2): string {
  if (isNaN(value)) return '0'
  
  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)
}

// Utility function to format currency values
export function formatCurrency(value: number): string {
  if (isNaN(value)) return '£0.00'
  
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

// Utility function to format percentage values
export function formatPercentage(value: number, decimals: number = 1): string {
  if (isNaN(value)) return '0%'
  
  return new Intl.NumberFormat('en-GB', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value / 100)
}

// Utility function to format units (kWh, etc.)
export function formatUnits(value: number, unit: string, decimals: number = 2): string {
  return `${formatNumber(value, decimals)} ${unit}`
} 