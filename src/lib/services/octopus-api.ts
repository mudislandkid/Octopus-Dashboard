import { ConsumptionResponse, TariffResponse, AccountInfo, StandingChargeResponse, Property } from '../types/api'
import { cache } from '../utils/cache'
import { formatApiDate, extractTariffDetails } from '../utils/date'

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
  private readonly CACHE_KEYS = {
    ACCOUNT_INFO: 'account_info',
    METERS: 'meters',
    ELECTRICITY_TARIFF: 'electricity_tariff',
    GAS_TARIFF: 'gas_tariff',
    CONSUMPTION_IMPORT: 'consumption_import',
    CONSUMPTION_EXPORT: 'consumption_export',
    CONSUMPTION_GAS: 'consumption_gas'
  }

  constructor(
    private apiKey: string,
    private accountNumber: string
  ) {}

  private async request<T>(path: string, options?: { params?: Record<string, string> }): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    
    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Basic ${btoa(this.apiKey + ':')}`
      }
    })

    if (!response.ok) {
      throw new OctopusApiError(response.status, response.statusText)
    }

    return response.json()
  }

  async getAccountInfo(): Promise<AccountInfo> {
    // Check cache first
    const cachedData = cache.get<AccountInfo>(this.CACHE_KEYS.ACCOUNT_INFO)
    if (cachedData) {
      return cachedData
    }

    const accountData = await this.request<AccountInfo>(`/accounts/${this.accountNumber}`)
    cache.set(this.CACHE_KEYS.ACCOUNT_INFO, accountData)
    return accountData
  }

  async discoverMeters(): Promise<void> {
    // Check cache first
    const cachedMeters = cache.get<{ electricity: MeterPoint[]; gas: GasMeterPoint | null }>(this.CACHE_KEYS.METERS)
    if (cachedMeters) {
      this.electricityMeterPoints = cachedMeters.electricity
      this.gasMeterPoint = cachedMeters.gas
      return
    }

    console.log('Discovering meters for account:', this.accountNumber)
    const accountData = await this.getAccountInfo()
    
    this.electricityMeterPoints = []
    for (const property of accountData.properties) {
      for (const point of property.electricity_meter_points || []) {
        const meter = point.meters[point.meters.length - 1]
        if (point.mpan && meter?.serial_number) {
          this.electricityMeterPoints.push({
            mpan: point.mpan,
            serial_number: meter.serial_number,
            is_export: point.is_export || false
          })
        }
      }
      
      if (!this.gasMeterPoint && property.gas_meter_points?.[0]) {
        const point = property.gas_meter_points[0]
        const meter = point.meters[point.meters.length - 1]
        if (point.mprn && meter?.serial_number) {
          this.gasMeterPoint = {
            mprn: point.mprn,
            serial_number: meter.serial_number
          }
        }
      }
    }
    
    // Cache the meter information
    cache.set(this.CACHE_KEYS.METERS, {
      electricity: this.electricityMeterPoints,
      gas: this.gasMeterPoint
    })
  }

  private async fetchConsumptionForPeriod(
    endpoint: string,
    from: string,
    to: string,
    cacheKey: string
  ): Promise<ConsumptionResponse | null> {
    // Check cache first
    const cachedData = cache.getDateRangeData<ConsumptionResponse>(cacheKey, from, to)
    if (cachedData) {
      return cachedData
    }

    try {
      const response = await this.request<ConsumptionResponse>(
        endpoint,
        { params: { period_from: from, period_to: to, page_size: '25000', order_by: 'period' } }
      )
      
      // Cache the response
      cache.setDateRangeData(cacheKey, from, to, response)
      return response
    } catch (error) {
      console.error(`Error fetching consumption for ${cacheKey}:`, error)
      return null
    }
  }

  async fetchAllConsumption(from: string, to: string, includePreviousPeriod: boolean = true) {
    const tasks: { type: 'import' | 'export' | 'gas', period: 'current' | 'previous', promise: Promise<ConsumptionResponse | null> }[] = []
    const periodLength = new Date(to).getTime() - new Date(from).getTime()
    // Calculate previous period based on the current period's length
    const previousTo = new Date(from).toISOString()
    const previousFrom = new Date(new Date(previousTo).getTime() - periodLength).toISOString()

    console.group('Octopus API - Fetching Consumption')
    console.log('Date Ranges:', {
      current: { from, to },
      previous: { from: previousFrom, to: previousTo }
    })

    // Import electricity consumption
    const importMeter = this.electricityMeterPoints.find(mp => !mp.is_export)
    if (importMeter) {
      const endpoint = `/electricity-meter-points/${importMeter.mpan}/meters/${importMeter.serial_number}/consumption/`
      console.log('Electricity Import Endpoint:', endpoint)
      tasks.push({
        type: 'import',
        period: 'current',
        promise: this.fetchConsumptionForPeriod(endpoint, from, to, this.CACHE_KEYS.CONSUMPTION_IMPORT)
          .then(response => {
            console.log('Current Period - Electricity Import:', {
              readings: response?.results?.length,
              firstReading: response?.results?.[0],
              lastReading: response?.results?.[response?.results?.length - 1]
            })
            return response
          })
      })
      if (includePreviousPeriod) {
        tasks.push({
          type: 'import',
          period: 'previous',
          promise: this.fetchConsumptionForPeriod(endpoint, previousFrom, previousTo, this.CACHE_KEYS.CONSUMPTION_IMPORT)
            .then(response => {
              console.log('Previous Period - Electricity Import:', {
                readings: response?.results?.length,
                firstReading: response?.results?.[0],
                lastReading: response?.results?.[response?.results?.length - 1]
              })
              return response
            })
        })
      }
    }

    // Export electricity consumption
    const exportMeter = this.electricityMeterPoints.find(mp => mp.is_export)
    if (exportMeter) {
      const endpoint = `/electricity-meter-points/${exportMeter.mpan}/meters/${exportMeter.serial_number}/consumption/`
      console.log('Electricity Export Endpoint:', endpoint)
      tasks.push({
        type: 'export',
        period: 'current',
        promise: this.fetchConsumptionForPeriod(endpoint, from, to, this.CACHE_KEYS.CONSUMPTION_EXPORT)
          .then(response => {
            console.log('Current Period - Electricity Export:', {
              readings: response?.results?.length,
              firstReading: response?.results?.[0],
              lastReading: response?.results?.[response?.results?.length - 1]
            })
            return response
          })
      })
      if (includePreviousPeriod) {
        tasks.push({
          type: 'export',
          period: 'previous',
          promise: this.fetchConsumptionForPeriod(endpoint, previousFrom, previousTo, this.CACHE_KEYS.CONSUMPTION_EXPORT)
            .then(response => {
              console.log('Previous Period - Electricity Export:', {
                readings: response?.results?.length,
                firstReading: response?.results?.[0],
                lastReading: response?.results?.[response?.results?.length - 1]
              })
              return response
            })
        })
      }
    }

    // Gas consumption
    if (this.gasMeterPoint) {
      const endpoint = `/gas-meter-points/${this.gasMeterPoint.mprn}/meters/${this.gasMeterPoint.serial_number}/consumption/`
      console.log('Gas Endpoint:', endpoint)
      tasks.push({
        type: 'gas',
        period: 'current',
        promise: this.fetchConsumptionForPeriod(endpoint, from, to, this.CACHE_KEYS.CONSUMPTION_GAS)
          .then(response => {
            console.log('Current Period - Gas:', {
              readings: response?.results?.length,
              firstReading: response?.results?.[0],
              lastReading: response?.results?.[response?.results?.length - 1]
            })
            return response
          })
      })
      if (includePreviousPeriod) {
        tasks.push({
          type: 'gas',
          period: 'previous',
          promise: this.fetchConsumptionForPeriod(endpoint, previousFrom, previousTo, this.CACHE_KEYS.CONSUMPTION_GAS)
            .then(response => {
              console.log('Previous Period - Gas:', {
                readings: response?.results?.length,
                firstReading: response?.results?.[0],
                lastReading: response?.results?.[response?.results?.length - 1]
              })
              return response
            })
        })
      }
    }

    const results = await Promise.all(tasks.map(t => t.promise))
    
    const response = {
      currentPeriod: {
        importElectricity: results[tasks.findIndex(t => t.type === 'import' && t.period === 'current')] || null,
        exportElectricity: results[tasks.findIndex(t => t.type === 'export' && t.period === 'current')] || null,
        gas: results[tasks.findIndex(t => t.type === 'gas' && t.period === 'current')] || null
      },
      previousPeriod: includePreviousPeriod ? {
        importElectricity: results[tasks.findIndex(t => t.type === 'import' && t.period === 'previous')] || null,
        exportElectricity: results[tasks.findIndex(t => t.type === 'export' && t.period === 'previous')] || null,
        gas: results[tasks.findIndex(t => t.type === 'gas' && t.period === 'previous')] || null
      } : null
    }

    console.log('Final Response:', response)
    console.groupEnd()

    return response
  }

  async fetchAllTariffs(from: string, to: string) {
    const accountData = await this.getAccountInfo()
    const tasks = []

    // Get electricity tariff details
    const electricityPoint = accountData.properties[0]?.electricity_meter_points?.find(
      (point: { is_export: boolean }) => !point.is_export
    )

    if (electricityPoint?.agreements?.length) {
      const currentAgreement = this.findCurrentAgreement(electricityPoint.agreements)
      if (currentAgreement?.tariff_code) {
        const { productCode } = extractTariffDetails(currentAgreement.tariff_code)
        
        tasks.push(
          // Rates
          this.request<TariffResponse>(
            `/products/${productCode}/electricity-tariffs/${currentAgreement.tariff_code}/standard-unit-rates/`,
            {
              params: {
                page_size: '1500',
                period_from: from,
                period_to: to
              }
            }
          ),
          // Standing charges
          this.request<StandingChargeResponse>(
            `/products/${productCode}/electricity-tariffs/${currentAgreement.tariff_code}/standing-charges/`,
            {
              params: {
                period_from: from,
                period_to: to
              }
            }
          )
        )
      }
    }

    // Get gas tariff details if available
    const gasPoint = accountData.properties[0]?.gas_meter_points?.[0]
    if (gasPoint?.agreements?.length) {
      const currentAgreement = this.findCurrentAgreement(gasPoint.agreements)
      if (currentAgreement?.tariff_code) {
        const { productCode } = extractTariffDetails(currentAgreement.tariff_code)
        
        tasks.push(
          // Standing charges
          this.request<StandingChargeResponse>(
            `/products/${productCode}/gas-tariffs/${currentAgreement.tariff_code}/standing-charges/`,
            {
              params: {
                period_from: from,
                period_to: to
              }
            }
          )
        )
      }
    }

    const results = await Promise.all(tasks.map(p => p.catch(e => null)))
    return {
      electricityRates: results[0],
      electricityStandingCharges: results[1],
      gasStandingCharges: results[2]
    }
  }

  private findCurrentAgreement(agreements: Array<{ valid_from: string; valid_to: string | null; tariff_code: string }>) {
    const now = new Date()
    return agreements.find(agreement => {
      const validFrom = new Date(agreement.valid_from)
      const validTo = agreement.valid_to ? new Date(agreement.valid_to) : new Date('9999-12-31')
      return now >= validFrom && now <= validTo
    })
  }
} 