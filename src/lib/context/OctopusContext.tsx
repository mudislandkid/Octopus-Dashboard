import { createContext, useContext, useState, ReactNode } from 'react'
import { OctopusApi, OctopusApiError } from '../services/octopus-api'
import { Consumption, Rate, AccountInfo } from '../types/api'
import { DateRange } from 'react-day-picker'
import { startOfDay, endOfDay, subDays } from 'date-fns'

interface OctopusContextType {
  api: OctopusApi | null
  isLoading: boolean
  error: string | null
  accountInfo: AccountInfo | null
  electricityImportConsumption: Consumption[] | null
  electricityExportConsumption: Consumption[] | null
  gasConsumption: Consumption[] | null
  electricityRates: Rate[] | null
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
  const [electricityRates, setElectricityRates] = useState<Rate[] | null>(null)
  
  // Initialize with last 30 days of data
  const now = new Date()
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(subDays(now, 30)),
    to: endOfDay(now)
  })

  const fetchData = async (api: OctopusApi) => {
    if (!dateRange?.from || !dateRange?.to) return

    const from = startOfDay(dateRange.from)
    const to = endOfDay(dateRange.to || dateRange.from)

    // Validate date range
    const daysDiff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff > 90) {
      throw new Error('Date range cannot exceed 90 days')
    }

    console.log('Fetching data for date range:', {
      from: from.toISOString(),
      to: to.toISOString(),
      days: daysDiff
    })

    // Get account info and discover meters
    console.log('Fetching account info and discovering meters...')
    await api.discoverMeters()
    const accountData = await api.getAccountInfo()
    console.log('Account info response:', accountData)
    setAccountInfo(accountData)

    try {
      // Get import electricity consumption
      console.log('Fetching import electricity consumption...')
      const importConsumption = await api.getElectricityConsumption(
        from.toISOString(),
        to.toISOString(),
        false
      )
      setElectricityImportConsumption(importConsumption.results)
    } catch (error) {
      console.log('No import electricity meter found or error fetching data:', error)
    }

    try {
      // Get export electricity consumption
      console.log('Fetching export electricity consumption...')
      const exportConsumption = await api.getElectricityConsumption(
        from.toISOString(),
        to.toISOString(),
        true
      )
      setElectricityExportConsumption(exportConsumption.results)
    } catch (error) {
      console.log('No export electricity meter found or error fetching data:', error)
    }

    try {
      // Get gas consumption
      console.log('Fetching gas consumption...')
      const consumption = await api.getGasConsumption(
        from.toISOString(),
        to.toISOString()
      )
      setGasConsumption(consumption.results)
    } catch (error) {
      console.log('No gas meter found or error fetching data:', error)
    }

    try {
      // Get electricity rates
      console.log('Fetching electricity rates...')
      const rates = await api.getElectricityTariff()
      console.log('Electricity rates response:', rates)
      
      // Filter rates to get only current and future rates
      const now = new Date()
      const currentRates = rates.results[0]?.unit_rate?.filter(rate => 
        new Date(rate.valid_from) <= now && new Date(rate.valid_to) > now
      ) || null
      console.log('Current electricity rates:', currentRates)
      setElectricityRates(currentRates)
    } catch (error) {
      console.log('Error fetching electricity rates:', error)
    }
  }

  const refreshData = async () => {
    if (!api) return
    setIsLoading(true)
    setError(null)
    
    try {
      await fetchData(api)
    } catch (err) {
      console.error('Refresh error:', err)
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
    console.log('Connecting with config:', { 
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
      console.error('Connection error:', err)
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
        electricityRates,
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