/**
 * Format a date to match the Octopus API format: YYYY-MM-DDTHH:mm:ss.SSSZ
 */
export function formatApiDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}T00:00:00.000Z`
}

/**
 * Extract product code and region code from a tariff code
 */
export function extractTariffDetails(tariffCode: string): { productCode: string; regionCode: string } {
  const matches = tariffCode.match(/^[EG]-1R-(.+)-([A-Z])$/)
  if (!matches) {
    throw new Error('Invalid tariff code format')
  }
  const [_, productCode, regionCode] = matches
  return { productCode, regionCode }
} 