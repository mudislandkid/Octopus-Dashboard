// @ts-nocheck
import { useEffect, useMemo, useState } from 'react'
import { useOctopus } from '@/lib/context/OctopusContext'
import { StatsCard } from './StatsCard'
import { ConsumptionChart } from './ConsumptionChart'
import { DailyPatternChart } from './DailyPatternChart'
import { DateRangePicker } from '../DateRangePicker'
import { DateRangeButtons } from '../DateRangeButtons'
import { Button } from '../ui/button'
import { RefreshCw, TrendingDown, TrendingUp, Leaf, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { formatDistanceToNow, format, startOfDay, endOfDay, subDays, isSameDay, differenceInDays } from 'date-fns'
import { Consumption, Rate } from '@/lib/types/api'
import { Grid, Switch as MuiSwitch, FormControlLabel } from '@mui/material'
import { DateRange } from 'react-day-picker'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { logger } from '@/lib/utils/logger'

// Add constants for CO2 calculations (kg CO2e per kWh)
const CO2_FACTORS = {
  ELECTRICITY: 0.233, // UK grid average
  GAS: 0.184,
  EXPORT_SAVING: 0.233 // Same as grid for exported electricity
}

export function DashboardGrid() {
  const { 
    electricityImportConsumption,
    electricityExportConsumption,
    gasConsumption,
    previousPeriodData,
    electricityRates,
    gasRates,
    electricityStandingCharge,
    gasStandingCharge,
    isLoading,
    dateRange,
    setDateRange,
    refreshData
  } = useOctopus()

  const [showPreviousPeriod, setShowPreviousPeriod] = useState(false)

  useEffect(() => {
    refreshData()
  }, [dateRange])

  const todayData = useMemo(() => {
    if (!dateRange?.from) return null

    const start = startOfDay(dateRange.from)
    const end = endOfDay(dateRange.to || dateRange.from)

    return {
      electricityImport: electricityImportConsumption?.filter(reading =>
        new Date(reading.interval_start) >= start &&
        new Date(reading.interval_start) <= end
      ) || null,
      electricityExport: electricityExportConsumption?.filter(reading =>
        new Date(reading.interval_start) >= start &&
        new Date(reading.interval_start) <= end
      ) || null,
      gas: gasConsumption?.filter(reading =>
        new Date(reading.interval_start) >= start &&
        new Date(reading.interval_start) <= end
      ) || null
    }
  }, [dateRange, electricityImportConsumption, electricityExportConsumption, gasConsumption])

  // Calculate current usage (last reading)
  const currentElectricityUsage = electricityImportConsumption?.[0]?.consumption || 0
  const currentGasUsage = (gasConsumption?.[0]?.consumption || 0) * 11.1 // Convert to kWh

  // Calculate daily totals
  const getDailyTotal = (data: Consumption[] | null) => {
    if (!data) return 0
    const today = new Date()
    const todayStart = startOfDay(today)
    const todayEnd = endOfDay(today)
    const todayData = data.filter(reading => {
      const readingDate = new Date(reading.interval_start)
      return readingDate >= todayStart && readingDate <= todayEnd
    })
    return todayData.reduce((sum, reading) => sum + reading.consumption, 0)
  }

  const dailyElectricityTotal = getDailyTotal(electricityImportConsumption)
  const dailyGasTotal = getDailyTotal(gasConsumption) * 11.1 // Convert to kWh

  // Calculate costs (example rates - you should get these from your tariff)
  const electricityRate = 0.2924 // £/kWh
  const gasRate = 0.0724 // £/kWh
  const dailyElectricityCost = dailyElectricityTotal * electricityRate
  const dailyGasCost = dailyGasTotal * gasRate

  // Get last update time
  const lastUpdateTime = electricityImportConsumption?.[0]?.interval_end
    ? formatDistanceToNow(new Date(electricityImportConsumption[0].interval_end), { addSuffix: true })
    : 'Unknown'

  const handleDateChange = (newRange: DateRange | undefined) => {
    setDateRange(newRange)
    refreshData()
  }

  const calculateStats = (data: Consumption[] | null) => {
    if (!data || data.length === 0) return null
    
    const total = data.reduce((sum, reading) => sum + reading.consumption, 0)
    const validReadings = data.length
    const avgPerDay = total / 30 // Assuming 30 days of data
    
    return {
      total,
      validReadings,
      avgPerDay
    }
  }

  // Calculate percentage change
  const calculateChange = (current: number, previous: number) => {
    // Add minimum threshold to avoid division by very small numbers
    const MIN_THRESHOLD = 0.1 // 0.1 kWh minimum to consider it valid consumption
    
    if (previous < MIN_THRESHOLD) {
      // If previous period had negligible consumption, don't show percentage
      return null
    }
    
    return ((current - previous) / previous) * 100
  }

  // Calculate peak usage time
  const getPeakUsageTime = (data: Consumption[] | null) => {
    if (!data || data.length === 0) return null
    const hourlyUsage = data.reduce((acc, reading) => {
      const hour = new Date(reading.interval_start).getHours()
      acc[hour] = (acc[hour] || 0) + (reading.consumption || 0)
      return acc
    }, {} as Record<number, number>)
    
    const peakHour = Object.entries(hourlyUsage)
      .sort(([, a], [, b]) => b - a)[0]
    return peakHour ? parseInt(peakHour[0]) : null
  }

  // Calculate CO2 emissions
  const calculateCO2 = (usage: number, type: keyof typeof CO2_FACTORS) => {
    return usage * CO2_FACTORS[type]
  }

  // Calculate metrics for each card
  const electricityMetrics = useMemo(() => {
    if (!electricityImportConsumption || !dateRange?.from || !dateRange?.to) return null
    
    logger.group('Electricity Import Metrics')
    const currentTotal = todayData?.electricityImport?.reduce((sum, r) => sum + (r.consumption || 0), 0) || 0
    const previousTotal = previousPeriodData?.electricityImport?.reduce((sum, r) => sum + (r.consumption || 0), 0) || 0
    
    // Add detailed logging for consumption values
    logger.log('Consumption Totals:', {
      current: {
        total: currentTotal.toFixed(2),
        readingCount: todayData?.electricityImport?.length,
        nonZeroReadings: todayData?.electricityImport?.filter(r => r.consumption > 0).length
      },
      previous: {
        total: previousTotal.toFixed(2),
        readingCount: previousPeriodData?.electricityImport?.length,
        nonZeroReadings: previousPeriodData?.electricityImport?.filter(r => r.consumption > 0).length
      }
    })

    const percentChange = calculateChange(currentTotal, previousTotal)
    const peakHour = getPeakUsageTime(todayData?.electricityImport || null)
    const co2 = calculateCO2(currentTotal, 'ELECTRICITY')
    
    logger.log('Current Period Data:', {
      readings: todayData?.electricityImport?.length,
      total: currentTotal.toFixed(2),
      dateRange: {
        from: dateRange.from,
        to: dateRange.to
      }
    })
    
    logger.log('Previous Period Data:', {
      readings: previousPeriodData?.electricityImport?.length,
      total: previousTotal.toFixed(2)
    })
    
    logger.log('Calculated Metrics:', {
      percentChange: percentChange !== null ? percentChange.toFixed(2) + '%' : 'N/A',
      peakHour: peakHour ? format(new Date().setHours(peakHour, 0), 'ha') : 'N/A',
      co2: co2.toFixed(2) + ' kg'
    })
    logger.groupEnd()
    
    return {
      total: currentTotal,
      percentChange,
      peakHour,
      co2
    }
  }, [electricityImportConsumption, previousPeriodData, dateRange, todayData])

  const exportMetrics = useMemo(() => {
    if (!electricityExportConsumption || !electricityImportConsumption || !dateRange?.from || !dateRange?.to) return null
    
    logger.group('Electricity Export Metrics')
    const currentTotal = todayData?.electricityExport?.reduce((sum, r) => sum + (r.consumption || 0), 0) || 0
    const importTotal = todayData?.electricityImport?.reduce((sum, r) => sum + (r.consumption || 0), 0) || 0
    const exportPercentage = (currentTotal / importTotal) * 100
    const previousTotal = previousPeriodData?.electricityExport?.reduce((sum, r) => sum + (r.consumption || 0), 0) || 0
    
    // Add detailed logging for consumption values
    logger.log('Consumption Totals:', {
      current: {
        total: currentTotal.toFixed(2),
        readingCount: todayData?.electricityExport?.length,
        nonZeroReadings: todayData?.electricityExport?.filter(r => r.consumption > 0).length
      },
      previous: {
        total: previousTotal.toFixed(2),
        readingCount: previousPeriodData?.electricityExport?.length,
        nonZeroReadings: previousPeriodData?.electricityExport?.filter(r => r.consumption > 0).length
      }
    })

    const percentChange = calculateChange(currentTotal, previousTotal)
    const co2Saved = calculateCO2(currentTotal, 'EXPORT_SAVING')
    const peakHour = getPeakUsageTime(todayData?.electricityExport || null)
    
    logger.log('Current Period Data:', {
      readings: todayData?.electricityExport?.length,
      total: currentTotal.toFixed(2),
      importTotal: importTotal.toFixed(2),
      dateRange: {
        from: dateRange.from,
        to: dateRange.to
      }
    })
    
    logger.log('Previous Period Data:', {
      readings: previousPeriodData?.electricityExport?.length,
      total: previousTotal.toFixed(2)
    })
    
    logger.log('Calculated Metrics:', {
      exportPercentage: exportPercentage.toFixed(2) + '%',
      percentChange: percentChange !== null ? percentChange.toFixed(2) + '%' : 'N/A',
      peakHour: peakHour ? format(new Date().setHours(peakHour, 0), 'ha') : 'N/A',
      co2Saved: co2Saved.toFixed(2) + ' kg'
    })
    logger.groupEnd()
    
    return {
      total: currentTotal,
      exportPercentage,
      percentChange,
      co2Saved,
      peakHour
    }
  }, [electricityExportConsumption, electricityImportConsumption, previousPeriodData, dateRange, todayData])

  const gasMetrics = useMemo(() => {
    if (!gasConsumption || !dateRange?.from || !dateRange?.to) return null
    
    logger.group('Gas Metrics')
    const currentTotal = todayData?.gas?.reduce((sum, r) => sum + r.consumption, 0) || 0
    const previousTotal = previousPeriodData?.gas?.reduce((sum, r) => sum + r.consumption, 0) || 0
    const percentChange = calculateChange(currentTotal, previousTotal)
    const co2 = calculateCO2(currentTotal, 'GAS')
    
    logger.log('Current Period Data:', {
      readings: todayData?.gas?.length,
      total: currentTotal.toFixed(2),
      dateRange: {
        from: dateRange.from,
        to: dateRange.to
      }
    })
    
    logger.log('Previous Period Data:', {
      readings: previousPeriodData?.gas?.length,
      total: previousTotal.toFixed(2)
    })
    
    logger.log('Calculated Metrics:', {
      percentChange: percentChange !== null ? `${percentChange.toFixed(2)}%` : 'N/A',
      co2: `${co2.toFixed(2)} kg`
    })
    logger.groupEnd()
    
    return {
      total: currentTotal,
      percentChange,
      co2
    }
  }, [gasConsumption, previousPeriodData, dateRange, todayData])

  return (
    <div className="w-full min-h-screen bg-background">
      <div className="space-y-3 sm:space-y-4 max-w-[1800px] mx-auto px-0 sm:px-4 lg:px-6 xl:px-8">
        {/* Date Range Controls */}
        <Card className="rounded-none sm:rounded-lg bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-sm sm:text-base font-medium">Date Range</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DateRangePicker
              date={dateRange}
              onSelect={setDateRange}
              className="w-full"
            />
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1.5 flex-1">
                <DateRangeButtons
                  onSelect={setDateRange}
                  disabled={isLoading}
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => refreshData()}
                disabled={isLoading}
                className="shrink-0"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="px-2 sm:px-4 space-y-3 sm:space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(todayData?.electricityImport || isLoading) && (
              <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-medium">Electricity Import</CardTitle>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0 hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                      >
                        <Info className="h-5 w-5 text-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-2">
                        <h4 className="font-medium">Metrics Calculation</h4>
                        <div className="text-sm space-y-1">
                          <p><span className="font-medium">Total Usage:</span> Sum of all consumption readings</p>
                          <p><span className="font-medium">Peak Usage Time:</span> Hour with highest average consumption</p>
                          <p><span className="font-medium">CO2 Emissions:</span> Based on UK grid average (0.233 kg CO2e/kWh)</p>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold">{electricityMetrics?.total.toFixed(2) || '0'} kWh</div>
                        <div className="text-sm text-muted-foreground">
                          Over {calculateStats(todayData?.electricityImport || null)?.validReadings || 0} readings
                        </div>
                        {previousPeriodData?.electricityImport && (
                          <div className="text-sm text-muted-foreground">
                            Previous: {previousPeriodData.electricityImport.reduce((sum, r) => sum + r.consumption, 0).toFixed(2)} kWh
                          </div>
                        )}
                      </div>
                      {electricityMetrics && electricityMetrics.percentChange !== null && (
                        <div className="text-right">
                          <div className={`flex items-center ${electricityMetrics.percentChange > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {electricityMetrics.percentChange > 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                            {Math.abs(electricityMetrics.percentChange).toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">vs previous</div>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      {electricityMetrics && electricityMetrics.peakHour !== null && (
                        <div>
                          <div className="text-sm font-medium">Peak Usage</div>
                          <div className="text-xl">{format(new Date().setHours(electricityMetrics.peakHour, 0), 'ha')}</div>
                        </div>
                      )}
                      {electricityMetrics && electricityMetrics.co2 !== undefined && (
                        <div className="flex items-start gap-2">
                          <Leaf className="w-4 h-4 text-green-500 mt-1" />
                          <div>
                            <div className="text-sm font-medium">CO2</div>
                            <div className="text-xl">{electricityMetrics.co2.toFixed(1)} kg</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {(todayData?.electricityExport || isLoading) && (
              <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-medium">Electricity Export</CardTitle>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0 hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                      >
                        <Info className="h-5 w-5 text-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-2">
                        <h4 className="font-medium">Metrics Calculation</h4>
                        <div className="text-sm space-y-1">
                          <p><span className="font-medium">Total Generation:</span> Sum of all export readings</p>
                          <p><span className="font-medium">Peak Generation Time:</span> Hour with highest average export</p>
                          <p><span className="font-medium">CO2 Saved:</span> Based on UK grid average (0.233 kg CO2e/kWh)</p>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold">{exportMetrics?.total.toFixed(2) || '0'} kWh</div>
                        <div className="text-sm text-muted-foreground">
                          Over {calculateStats(todayData?.electricityExport || null)?.validReadings || 0} readings
                        </div>
                        {previousPeriodData?.electricityExport && (
                          <div className="text-sm text-muted-foreground">
                            Previous: {previousPeriodData.electricityExport.reduce((sum, r) => sum + r.consumption, 0).toFixed(2)} kWh
                          </div>
                        )}
                      </div>
                      {exportMetrics && exportMetrics.percentChange !== null && (
                        <div className="text-right">
                          <div className={`flex items-center ${exportMetrics.percentChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {exportMetrics.percentChange > 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                            {Math.abs(exportMetrics.percentChange).toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">vs previous</div>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      {exportMetrics && exportMetrics.peakHour !== null && (
                        <div>
                          <div className="text-sm font-medium">Peak Generation</div>
                          <div className="text-xl">{format(new Date().setHours(exportMetrics.peakHour, 0), 'ha')}</div>
                        </div>
                      )}
                      {exportMetrics && exportMetrics.co2Saved !== undefined && (
                        <div className="flex items-start gap-2">
                          <Leaf className="w-4 h-4 text-green-500 mt-1" />
                          <div>
                            <div className="text-sm font-medium">CO2 Saved</div>
                            <div className="text-xl">{exportMetrics.co2Saved.toFixed(1)} kg</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {(todayData?.gas || isLoading) && (
              <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-medium">Gas</CardTitle>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0 hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                      >
                        <Info className="h-5 w-5 text-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-2">
                        <h4 className="font-medium">Metrics Calculation</h4>
                        <div className="text-sm space-y-1">
                          <p><span className="font-medium">Total Usage:</span> Sum of all consumption readings</p>
                          <p><span className="font-medium">CO2 Emissions:</span> Based on UK grid average (0.184 kg CO2e/kWh)</p>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold">{gasMetrics?.total.toFixed(2) || '0'} kWh</div>
                        <div className="text-sm text-muted-foreground">
                          Over {calculateStats(todayData?.gas || null)?.validReadings || 0} readings
                        </div>
                        {previousPeriodData?.gas && (
                          <div className="text-sm text-muted-foreground">
                            Previous: {previousPeriodData.gas.reduce((sum, r) => sum + r.consumption, 0).toFixed(2)} kWh
                          </div>
                        )}
                      </div>
                      {gasMetrics && gasMetrics.percentChange !== null && (
                        <div className="text-right">
                          <div className={`flex items-center ${gasMetrics.percentChange > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {gasMetrics.percentChange > 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                            {Math.abs(gasMetrics.percentChange).toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">vs previous</div>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-start gap-2">
                        <Leaf className="w-4 h-4 text-green-500 mt-1" />
                        <div>
                          <div className="text-sm font-medium">CO2</div>
                          <div className="text-xl">{gasMetrics?.co2.toFixed(1)} kg</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Charts */}
          <div className="grid gap-6">
            {(todayData?.electricityImport || isLoading) && (
              <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
                  <div className="space-y-1">
                    <CardTitle>Electricity Import</CardTitle>
                  </div>
                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={showPreviousPeriod}
                        onChange={(e) => setShowPreviousPeriod(e.target.checked)}
                        sx={{
                          '& .MuiSwitch-switchBase': {
                            margin: 1,
                            padding: 0,
                            '&.Mui-checked': {
                              color: '#40E0D0',
                              '& + .MuiSwitch-track': {
                                opacity: 0.5,
                                backgroundColor: '#40E0D0',
                              },
                            },
                          },
                          '& .MuiSwitch-thumb': {
                            width: 16,
                            height: 16,
                            backgroundColor: 'currentColor',
                          },
                          '& .MuiSwitch-track': {
                            opacity: 0.3,
                            backgroundColor: 'rgba(255, 255, 255, 0.8)',
                            borderRadius: 20 / 2,
                          },
                        }}
                      />
                    }
                    label="Compare Previous"
                    className="text-xs sm:text-sm m-0"
                  />
                </CardHeader>
                <CardContent>
                  <ConsumptionChart
                    title="Consumption"
                    data={todayData?.electricityImport ?? []}
                    previousPeriodData={previousPeriodData?.electricityImport}
                    showPreviousPeriod={showPreviousPeriod}
                    rates={electricityRates}
                    unit="kWh"
                    loading={isLoading}
                    standingCharge={electricityStandingCharge?.value_inc_vat}
                  />
                </CardContent>
              </Card>
            )}

            {(todayData?.electricityExport || isLoading) && (
              <Card>
                <CardHeader>
                  <CardTitle>Electricity Export</CardTitle>
                </CardHeader>
                <CardContent>
                  <ConsumptionChart
                    title="Generation"
                    data={todayData?.electricityExport ?? []}
                    unit="kWh"
                    loading={isLoading}
                  />
                </CardContent>
              </Card>
            )}

            {(todayData?.gas || isLoading) && (
              <Card>
                <CardHeader>
                  <CardTitle>Gas Consumption</CardTitle>
                </CardHeader>
                <CardContent>
                  <ConsumptionChart
                    title="Consumption"
                    data={todayData?.gas ?? []}
                    rates={gasRates}
                    unit="kWh"
                    loading={isLoading}
                    standingCharge={gasStandingCharge?.value_inc_vat}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Daily Pattern Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {(todayData?.electricityImport || isLoading) && (
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Electricity Import Daily Pattern</CardTitle>
                </CardHeader>
                <CardContent>
                  <DailyPatternChart
                    data={todayData?.electricityImport ?? null}
                    loading={isLoading}
                    type="electricity"
                  />
                </CardContent>
              </Card>
            )}

            {(todayData?.electricityExport || isLoading) && (
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Electricity Export Daily Pattern</CardTitle>
                </CardHeader>
                <CardContent>
                  <DailyPatternChart
                    data={todayData?.electricityExport ?? null}
                    loading={isLoading}
                    type="electricity"
                  />
                </CardContent>
              </Card>
            )}

            {(todayData?.gas || isLoading) && (
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Gas Daily Pattern</CardTitle>
                </CardHeader>
                <CardContent>
                  <DailyPatternChart
                    data={todayData?.gas ?? null}
                    loading={isLoading}
                    type="gas"
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 