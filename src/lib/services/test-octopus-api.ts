// @ts-nocheck
import { ConsumptionResponse, TariffResponse } from '../types/api.js'
import fetch from 'node-fetch'

export class OctopusApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public statusText?: string
  ) {
    super(message)
    this.name = 'OctopusApiError'
  }
}

export interface MeterConfig {
  electricity?: {
    mpan: string
    serialNumber: string
  }
  gas?: {
    mprn: string
    serialNumber: string
  }
}

export class OctopusApi {
  private apiKey: string
  private baseUrl: string
  private meterConfig: MeterConfig

  constructor(apiKey: string, meterConfig: MeterConfig, baseUrl: string = 'https://api.octopus.energy/v1') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
    this.meterConfig = meterConfig
  }

  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    console.log(`Making API request to: ${url}`)
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      console.log(`Response status: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        throw new OctopusApiError(
          `API Error: ${response.status} ${response.statusText}`,
          response.status,
          response.statusText
        )
      }

      const data = await response.json()
      console.log('Response data:', data)
      return data as T
    } catch (error) {
      console.error('API request failed:', error)
      if (error instanceof OctopusApiError) {
        throw error
      }
      
      throw new OctopusApiError(
        error instanceof Error ? error.message : 'An unknown error occurred'
      )
    }
  }

  async getElectricityConsumption(from?: string, to?: string): Promise<ConsumptionResponse> {
    if (!this.meterConfig.electricity) {
      throw new Error('No electricity meter configured')
    }

    const { mpan, serialNumber } = this.meterConfig.electricity
    const params = new URLSearchParams()
    if (from) params.append('period_from', from)
    if (to) params.append('period_to', to)
    
    return this.fetch<ConsumptionResponse>(
      `/electricity-meter-points/${mpan}/meters/${serialNumber}/consumption/?${params.toString()}`
    )
  }

  async getGasConsumption(from?: string, to?: string): Promise<ConsumptionResponse> {
    if (!this.meterConfig.gas) {
      throw new Error('No gas meter configured')
    }

    const { mprn, serialNumber } = this.meterConfig.gas
    const params = new URLSearchParams()
    if (from) params.append('period_from', from)
    if (to) params.append('period_to', to)
    
    return this.fetch<ConsumptionResponse>(
      `/gas-meter-points/${mprn}/meters/${serialNumber}/consumption/?${params.toString()}`
    )
  }

  async getElectricityTariff(productCode: string = 'AGILE-24-10-01', tariffCode: string = 'E-1R-AGILE-24-10-01-D'): Promise<TariffResponse> {
    const now = new Date()
    const params = new URLSearchParams({
      period_from: now.toISOString(),
      period_to: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() // Next 24 hours
    })

    return this.fetch<TariffResponse>(
      `/products/${productCode}/electricity-tariffs/${tariffCode}/standard-unit-rates/?${params.toString()}`
    )
  }
} 