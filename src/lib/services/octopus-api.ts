import { ConsumptionResponse, TariffResponse, AccountInfo, StandingChargeResponse, Property } from '../types/api'
import { config } from '../config'

export class OctopusApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'OctopusApiError'
  }
}

interface MeterPoint {
  mpan: string
  serial_number: string
  is_export: boolean
}

interface GasMeterPoint {
  mprn: string
  serial_number: string
}

export class OctopusApi {
  private baseUrl = 'https://api.octopus.energy/v1'
  private electricityMeterPoints: MeterPoint[] = []
  private gasMeterPoint: GasMeterPoint | null = null

  constructor(
    private apiKey: string,
    private accountNumber: string
  ) {}

  private async request<T>(path: string, options?: { params?: Record<string, string> }): Promise<T> {
    // First create the base URL
    const url = new URL(`${this.baseUrl}${path}`)
    
    // Add query parameters if they exist
    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        // Don't encode the value here - URLSearchParams will handle the encoding
        url.searchParams.append(key, value)
      })
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Basic ${btoa(this.apiKey + ':')}`
      }
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`)
    }

    return response.json()
  }

  async discoverMeters(): Promise<void> {
    console.log('Discovering meters for account:', this.accountNumber)
    
    const accountData = await this.getAccountInfo()
    
    // Extract electricity meter points
    this.electricityMeterPoints = []
    for (const property of accountData.properties) {
      for (const point of property.electricity_meter_points || []) {
        // Get the latest meter from the meters array
        const meter = point.meters[point.meters.length - 1]
        if (point.mpan && meter?.serial_number) {
          this.electricityMeterPoints.push({
            mpan: point.mpan,
            serial_number: meter.serial_number,
            is_export: point.is_export || false
          })
        }
      }
      
      // Extract gas meter point (use first one found)
      if (!this.gasMeterPoint && property.gas_meter_points?.[0]) {
        const point = property.gas_meter_points[0]
        // Get the latest meter from the meters array
        const meter = point.meters[point.meters.length - 1]
        if (point.mprn && meter?.serial_number) {
          this.gasMeterPoint = {
            mprn: point.mprn,
            serial_number: meter.serial_number
          }
        }
      }
    }
    
    console.log('Discovered meters:', {
      electricity: this.electricityMeterPoints,
      gas: this.gasMeterPoint
    })
  }

  async getAccountInfo() {
    return this.request<any>(`/accounts/${this.accountNumber}`)
  }

  async getElectricityConsumption(from: string, to: string, isExport: boolean = false) {
    // Find the appropriate meter point
    const meterPoint = this.electricityMeterPoints.find(mp => mp.is_export === isExport)
    if (!meterPoint) {
      throw new Error(`No ${isExport ? 'export' : 'import'} electricity meter found`)
    }

    return this.request<any>(
      `/electricity-meter-points/${meterPoint.mpan}/meters/${meterPoint.serial_number}/consumption/` +
      `?period_from=${from}&period_to=${to}&page_size=25000&order_by=period`
    )
  }

  async getGasConsumption(from: string, to: string) {
    if (!this.gasMeterPoint) {
      throw new Error('No gas meter found')
    }

    return this.request<any>(
      `/gas-meter-points/${this.gasMeterPoint.mprn}/meters/${this.gasMeterPoint.serial_number}/consumption/` +
      `?period_from=${from}&period_to=${to}&page_size=25000&order_by=period`
    )
  }

  async getElectricityTariff() {
    // Get account info to find the current tariff
    const accountData = await this.getAccountInfo()
    const electricityMeterPoint = accountData.properties[0]?.electricity_meter_points?.find(
      (point: { is_export: boolean }) => !point.is_export
    )

    if (!electricityMeterPoint?.agreements?.length) {
      throw new Error('No electricity agreements found')
    }

    // Get the current agreement
    const now = new Date()
    const currentAgreement = electricityMeterPoint.agreements.find((agreement: { 
      valid_from: string
      valid_to: string | null
      tariff_code: string 
    }) => {
      const validFrom = new Date(agreement.valid_from)
      const validTo = agreement.valid_to ? new Date(agreement.valid_to) : new Date('9999-12-31')
      return now >= validFrom && now <= validTo
    })

    if (!currentAgreement?.tariff_code) {
      throw new Error('No current electricity agreement found')
    }

    // Extract product code from tariff code (e.g., "E-1R-AGILE-24-10-01-D" -> "AGILE-24-10-01")
    const matches = currentAgreement.tariff_code.match(/^E-1R-(.+)-([A-Z])$/)
    if (!matches) {
      throw new Error('Invalid tariff code format')
    }
    const [_, productCode, regionCode] = matches

    // Get the date range from the context
    const { from, to } = this.getDateRange()
    const periodFrom = new Date(from)
    const periodTo = new Date(to)

    // Format dates to match exactly: 2025-02-02T00:00:00.000Z
    const formatDate = (date: Date) => {
      const year = date.getUTCFullYear()
      const month = String(date.getUTCMonth() + 1).padStart(2, '0')
      const day = String(date.getUTCDate()).padStart(2, '0')
      return `${year}-${month}-${day}T00:00:00.000Z`
    }

    return this.request<TariffResponse>(
      `/products/${productCode}/electricity-tariffs/${currentAgreement.tariff_code}/standard-unit-rates/`,
      {
        params: {
          page_size: '1500',
          period_from: formatDate(periodFrom),
          period_to: formatDate(periodTo)
        }
      }
    )
  }

  async getElectricityStandingCharge() {
    // Get account info to find the current tariff
    const accountData = await this.getAccountInfo()
    const electricityMeterPoint = accountData.properties[0]?.electricity_meter_points?.find(
      (point: { is_export: boolean }) => !point.is_export
    )

    if (!electricityMeterPoint?.agreements?.length) {
      throw new Error('No electricity agreements found')
    }

    // Get the current agreement
    const now = new Date()
    const currentAgreement = electricityMeterPoint.agreements.find((agreement: { 
      valid_from: string
      valid_to: string | null
      tariff_code: string 
    }) => {
      const validFrom = new Date(agreement.valid_from)
      const validTo = agreement.valid_to ? new Date(agreement.valid_to) : new Date('9999-12-31')
      return now >= validFrom && now <= validTo
    })

    if (!currentAgreement?.tariff_code) {
      throw new Error('No current electricity agreement found')
    }

    // Extract product code from tariff code (e.g., "E-1R-AGILE-24-10-01-D" -> "AGILE-24-10-01")
    const matches = currentAgreement.tariff_code.match(/^E-1R-(.+)-([A-Z])$/)
    if (!matches) {
      throw new Error('Invalid tariff code format')
    }
    const [_, productCode, regionCode] = matches

    // Get the date range from the context
    const { from, to } = this.getDateRange()
    const periodFrom = new Date(from)
    const periodTo = new Date(to)

    // Format dates to match exactly: 2025-02-02T00:00:00.000Z
    const formatDate = (date: Date) => {
      const year = date.getUTCFullYear()
      const month = String(date.getUTCMonth() + 1).padStart(2, '0')
      const day = String(date.getUTCDate()).padStart(2, '0')
      return `${year}-${month}-${day}T00:00:00.000Z`
    }

    return this.request<StandingChargeResponse>(
      `/products/${productCode}/electricity-tariffs/${currentAgreement.tariff_code}/standing-charges/`,
      {
        params: {
          period_from: formatDate(periodFrom),
          period_to: formatDate(periodTo)
        }
      }
    )
  }

  async getGasStandingCharge() {
    // Get account info to find the current tariff
    const accountData = await this.getAccountInfo()
    
    // Find the first property with a gas meter point
    const property = accountData.properties.find((p: Property) => p.gas_meter_points?.length > 0)
    if (!property) {
      throw new Error('No property with gas meter found')
    }

    // Get the gas meter point
    const gasMeterPoint = property.gas_meter_points[0]
    if (!gasMeterPoint) {
      throw new Error('No gas meter point found')
    }

    // Get the current agreement
    const currentAgreement = gasMeterPoint.agreements?.[0]
    if (!currentAgreement) {
      throw new Error('No current gas agreement found')
    }

    // Extract product code from tariff code (e.g., "G-1R-FIX-12M-20-02-12-D" -> "FIX-12M-20-02-12")
    const matches = currentAgreement.tariff_code.match(/^G-1R-(.+)-[A-Z]$/)
    if (!matches) {
      throw new Error('Invalid gas tariff code format')
    }
    const productCode = matches[1]
    const regionCode = currentAgreement.tariff_code.slice(-1)

    console.log('Getting gas tariff details:', {
      productCode,
      regionCode,
      fullTariffCode: currentAgreement.tariff_code
    })

    // Get the product details which includes both standing charges and unit rates
    const productResponse = await this.request<any>(
      `/products/${productCode}/`
    )

    console.log('Gas product response:', productResponse)

    // Find the gas tariff details for the current agreement
    const tariffDetails = productResponse.single_register_gas_tariffs?.[`_${regionCode}`]?.direct_debit_monthly
    if (!tariffDetails) {
      throw new Error('Could not find gas tariff details')
    }

    // Return both standing charge and unit rate, with the rate formatted as an array to match the Rate interface
    return {
      standingCharge: {
        value_exc_vat: tariffDetails.standing_charge_exc_vat,
        value_inc_vat: tariffDetails.standing_charge_inc_vat,
        valid_from: new Date().toISOString(),
        valid_to: null
      },
      rates: [{
        value_exc_vat: tariffDetails.standard_unit_rate_exc_vat,
        value_inc_vat: tariffDetails.standard_unit_rate_inc_vat,
        valid_from: new Date().toISOString(),
        valid_to: null,
        payment_method: 'direct_debit_monthly'
      }]
    }
  }

  public getDateRange() {
    const now = new Date()
    const from = new Date(now)
    from.setDate(now.getDate() - 30) // Default to last 30 days
    
    // Format to UTC midnight
    from.setUTCHours(0, 0, 0, 0)
    now.setUTCHours(23, 59, 59, 999)

    // Adjust for timezone offset to ensure we get today's data
    const offset = now.getTimezoneOffset()
    from.setMinutes(from.getMinutes() - offset)
    now.setMinutes(now.getMinutes() - offset)

    return {
      from: from.toISOString(),
      to: now.toISOString()
    }
  }

  // Helper methods
  async getTodayElectricityConsumption(isExport: boolean = false): Promise<ConsumptionResponse> {
    const { from, to } = this.getDateRange()
    console.log(`Fetching ${isExport ? 'export' : 'import'} electricity consumption for range:`, { from, to })
    return this.getElectricityConsumption(from, to, isExport)
  }

  async getTodayGasConsumption(): Promise<ConsumptionResponse> {
    const { from, to } = this.getDateRange()
    console.log('Fetching gas consumption for range:', { from, to })
    return this.getGasConsumption(from, to)
  }
} 