// @ts-nocheck
import { createContext, useContext, useState, ReactNode } from 'react'
import { OctopusApi, OctopusApiError } from '../services/octopus-api'
import { Consumption, Rate, AccountInfo, StandingCharge } from '../types/api'
import { DateRange } from 'react-day-picker'
import { startOfDay, endOfDay, subDays } from 'date-fns'
import { formatApiDate } from '../utils/date'
import { logger } from '../utils/logger'

interface OctopusContextType {
  api: OctopusApi | null
  isLoading: boolean
  error: string | null
  accountInfo: AccountInfo | null
  electricityImportConsumption: Consumption[] | null
  electricityExportConsumption: Consumption[] | null
  gasConsumption: Consumption[] | null
  previousPeriodData: {
    electricityImport: Consumption[] | null
    electricityExport: Consumption[] | null
    gas: Consumption[] | null
  } | null
  electricityRates: Rate[] | null
  gasRates: Rate[] | null
  electricityStandingCharge: StandingCharge | null
  gasStandingCharge: StandingCharge | null
  dateRange: DateRange | undefined
  connect: (apiKey: string, accountNumber: string) => Promise<void>
  setDateRange: (range: DateRange | undefined) => void
  refreshData: () => Promise<void>
}

const OctopusContext = createContext<OctopusContextType | undefined>(undefined)

export function OctopusProvider({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<OctopusApi | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null)
  const [electricityImportConsumption, setElectricityImportConsumption] = useState<Consumption[] | null>(null)
  const [electricityExportConsumption, setElectricityExportConsumption] = useState<Consumption[] | null>(null)
  const [gasConsumption, setGasConsumption] = useState<Consumption[] | null>(null)
  const [previousPeriodData, setPreviousPeriodData] = useState<{
    electricityImport: Consumption[] | null
    electricityExport: Consumption[] | null
    gas: Consumption[] | null
  } | null>(null)
  const [electricityRates, setElectricityRates] = useState<Rate[] | null>(null)
  const [gasRates, setGasRates] = useState<Rate[] | null>(null)
  const [electricityStandingCharge, setElectricityStandingCharge] = useState<StandingCharge | null>(null)
  const [gasStandingCharge, setGasStandingCharge] = useState<StandingCharge | null>(null)
  
  // Initialize with last 30 days of data
  const now = new Date()
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(subDays(now, 30)),
    to: endOfDay(now)
  })

  const fetchData = async (api: OctopusApi) => {
    if (!dateRange?.from || !dateRange?.to) return

    const from = formatApiDate(startOfDay(dateRange.from))
    const to = formatApiDate(endOfDay(dateRange.to || dateRange.from))

    // Validate date range
    const daysDiff = Math.ceil((dateRange.to!.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff > 90) {
      throw new Error('Date range cannot exceed 90 days')
    }

    logger.log('Fetching data for date range:', { from, to, days: daysDiff })

    // Get account info and discover meters
    logger.log('Fetching account info and discovering meters...')
    await api.discoverMeters()
    const accountData = await api.getAccountInfo()
    logger.log('Account info response:', accountData)
    setAccountInfo(accountData)

    // Fetch all consumption data in parallel
    const consumptionData = await api.fetchAllConsumption(from, to)
    if (consumptionData.currentPeriod.importElectricity) {
      setElectricityImportConsumption(consumptionData.currentPeriod.importElectricity.results)
    }
    if (consumptionData.currentPeriod.exportElectricity) {
      setElectricityExportConsumption(consumptionData.currentPeriod.exportElectricity.results)
    }
    if (consumptionData.currentPeriod.gas) {
      setGasConsumption(consumptionData.currentPeriod.gas.results)
    }

    // Set previous period data
    if (consumptionData.previousPeriod) {
      setPreviousPeriodData({
        electricityImport: consumptionData.previousPeriod.importElectricity?.results || null,
        electricityExport: consumptionData.previousPeriod.exportElectricity?.results || null,
        gas: consumptionData.previousPeriod.gas?.results || null
      })
    }

    // Fetch all tariff data in parallel
    const tariffData = await api.fetchAllTariffs(from, to)
    if (tariffData.electricityRates) {
      setElectricityRates(tariffData.electricityRates.results)
    }
    if (tariffData.electricityStandingCharges) {
      const currentCharge = tariffData.electricityStandingCharges.results
        .sort((a, b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0]
      setElectricityStandingCharge(currentCharge)
    }
    if (tariffData.gasStandingCharges) {
      const currentCharge = tariffData.gasStandingCharges.results
        .sort((a, b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0]
      setGasStandingCharge(currentCharge)
    }
  }

  const refreshData = async () => {
    if (!api) return
    setIsLoading(true)
    setError(null)
    
    try {
      await fetchData(api)
    } catch (err) {
      logger.error('Refresh error:', err)
      if (err instanceof OctopusApiError) {
        if (err.status === 401) {
          setError('Invalid API key. Please check your credentials.')
        } else if (err.status === 429) {
          setError('Too many requests. Please try again later.')
        } else if (err.status === 404) {
          setError('Meter not found. Please check your meter details.')
        } else {
          setError(`API Error: ${err.message}`)
        }
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch data from Octopus Energy')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const connect = async (apiKey: string, accountNumber: string) => {
    logger.log('Connecting with config:', { 
      apiKey: apiKey.slice(0, 4) + '...', // Only log first 4 chars of API key
      accountNumber
    })
    
    setIsLoading(true)
    setError(null)
    
    try {
      const newApi = new OctopusApi(apiKey, accountNumber)
      setApi(newApi)
      await fetchData(newApi)
    } catch (err) {
      logger.error('Connection error:', err)
      if (err instanceof OctopusApiError) {
        if (err.status === 401) {
          setError('Invalid API key. Please check your credentials.')
        } else if (err.status === 429) {
          setError('Too many requests. Please try again later.')
        } else if (err.status === 404) {
          setError('Account or meter not found. Please check your details.')
        } else {
          setError(`API Error: ${err.message}`)
        }
      } else {
        setError(err instanceof Error ? err.message : 'Failed to connect to Octopus Energy')
      }
      setApi(null)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <OctopusContext.Provider
      value={{
        api,
        isLoading,
        error,
        accountInfo,
        electricityImportConsumption,
        electricityExportConsumption,
        gasConsumption,
        previousPeriodData,
        electricityRates,
        gasRates,
        electricityStandingCharge,
        gasStandingCharge,
        dateRange,
        connect,
        setDateRange,
        refreshData,
      }}
    >
      {children}
    </OctopusContext.Provider>
  )
}

export function useOctopus() {
  const context = useContext(OctopusContext)
  if (context === undefined) {
    throw new Error('useOctopus must be used within an OctopusProvider')
  }
  return context
} 