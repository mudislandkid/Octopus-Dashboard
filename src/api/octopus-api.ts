import { request } from './request'

interface TariffResponse {
  count: number
  next: string | null
  previous: string | null
  results: Array<{
    value_exc_vat: number
    value_inc_vat: number
    valid_from: string
    valid_to: string
  }>
}

interface Agreement {
  tariff_code: string
  valid_from: string
  valid_to: string
}

interface AccountDetails {
  number: string
  properties: Array<{
    electricity_meter_points: Array<{
      agreements: Agreement[]
      is_export: boolean
    }>
  }>
}

function findCurrentTariff(agreements: Agreement[]): Agreement | null {
  const now = new Date()
  return agreements.find(agreement => {
    const validFrom = new Date(agreement.valid_from)
    const validTo = new Date(agreement.valid_to)
    return now >= validFrom && now <= validTo
  }) || null
}

export async function getAccountDetails(
  apiKey: string,
  accountNumber: string
): Promise<AccountDetails> {
  const response = await request<AccountDetails>(
    `accounts/${accountNumber}`,
    { apiKey }
  )
  return response
}

export async function getElectricityTariff(
  apiKey: string,
  accountNumber: string,
  periodFrom: Date,
  periodTo: Date
): Promise<TariffResponse> {
  try {
    // First get the account details to find the current tariff
    const accountDetails = await getAccountDetails(apiKey, accountNumber)
    
    // Find the import electricity meter point
    const electricityMeterPoint = accountDetails.properties[0]?.electricity_meter_points?.find(
      point => !point.is_export
    )

    if (!electricityMeterPoint?.agreements?.length) {
      throw new Error('No electricity agreements found')
    }

    // Get the current agreement
    const now = new Date()
    const currentAgreement = findCurrentTariff(electricityMeterPoint.agreements)
    if (!currentAgreement?.tariff_code) {
      throw new Error('No current electricity agreement found')
    }

    // Extract product code from tariff code (e.g., "E-1R-AGILE-24-10-01-D" -> "AGILE-24-10-01")
    const matches = currentAgreement.tariff_code.match(/^E-1R-(.+)-([A-Z])$/)
    if (!matches) {
      throw new Error('Invalid tariff code format')
    }
    const [_, productCode, regionCode] = matches

    // Format dates to match exactly: 2025-02-02T00:00:00.000Z
    const formatDate = (date: Date) => {
      const year = date.getUTCFullYear()
      const month = String(date.getUTCMonth() + 1).padStart(2, '0')
      const day = String(date.getUTCDate()).padStart(2, '0')
      return `${year}-${month}-${day}T00:00:00.000Z`
    }

    const response = await request<TariffResponse>(
      `products/${productCode}/electricity-tariffs/${currentAgreement.tariff_code}/standard-unit-rates/`,
      {
        apiKey,
        params: {
          page_size: '1500',
          period_from: formatDate(periodFrom),
          period_to: formatDate(periodTo)
        }
      }
    )

    return response
  } catch (error) {
    console.error('Error fetching electricity tariff:', error)
    throw error
  }
}

// Update the tomorrow rates function to fetch a longer range
export async function getTomorrowElectricityRates(
  apiKey: string,
  accountNumber: string
): Promise<TariffResponse> {
  const now = new Date()
  const from = new Date(now)
  from.setDate(now.getDate() - 30) // Default to last 30 days
  
  // Format to UTC midnight
  from.setUTCHours(0, 0, 0, 0)
  now.setUTCHours(23, 59, 59, 999)

  return getElectricityTariff(apiKey, accountNumber, from, now)
} 