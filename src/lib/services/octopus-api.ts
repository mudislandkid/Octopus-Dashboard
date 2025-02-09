import { ConsumptionResponse, TariffResponse, AccountInfo } from '../types/api'
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

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Basic ${btoa(this.apiKey + ':')}`
      }
    })

    if (!response.ok) {
      throw new OctopusApiError(
        response.status,
        `API request failed: ${response.statusText}`
      )
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
    // Use the first import meter point for tariff info
    const meterPoint = this.electricityMeterPoints.find(mp => !mp.is_export)
    if (!meterPoint) {
      throw new Error('No import electricity meter found')
    }

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

    // Extract product code from tariff code (e.g., "E-1R-SUPER-GREEN-24M-21-07-30-A" -> "SUPER-GREEN-24M-21-07-30")
    const productCode = currentAgreement.tariff_code.split('E-1R-')[1]?.split('-A')[0]
    if (!productCode) {
      throw new Error('Invalid tariff code format')
    }

    // Get current rates
    const params = new URLSearchParams({
      period_from: now.toISOString(),
      period_to: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() // Next 24 hours
    })

    return this.request<any>(
      `/products/${productCode}/electricity-tariffs/${currentAgreement.tariff_code}/standard-unit-rates/?${params}`
    )
  }

  private getDateRange() {
    const now = new Date()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)

    // Adjust for timezone offset to ensure we get today's data
    const offset = today.getTimezoneOffset()
    today.setMinutes(today.getMinutes() - offset)
    now.setMinutes(now.getMinutes() - offset)

    return {
      from: today.toISOString(),
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