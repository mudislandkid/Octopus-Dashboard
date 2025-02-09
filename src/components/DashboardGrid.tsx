import { useEffect, useMemo } from 'react'
import { useOctopus } from '@/lib/context/OctopusContext'
import { StatsCard } from './dashboard/StatsCard'
import { ConsumptionChart } from './dashboard/ConsumptionChart'
import { DailyPatternChart } from './dashboard/DailyPatternChart'
import { DateRangePicker } from './DateRangePicker'
import { DateRangeButtons } from './DateRangeButtons'
import { Button } from './ui/button'
import { RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { formatDistanceToNow, format, startOfDay, endOfDay } from 'date-fns'
import { Consumption, Rate } from '@/lib/types/api'
import { Grid } from '@mui/material'
import { DateRange } from 'react-day-picker'

export function DashboardGrid() {
  const { 
    electricityImportConsumption,
    electricityExportConsumption,
    gasConsumption,
    electricityRates,
    isLoading,
    dateRange,
    setDateRange,
    refreshData
  } = useOctopus()

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

  const calculateStats = (data: Consumption[] | null | undefined) => {
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

  return (
    <div className="space-y-8">
      {/* Date Range Controls */}
      <Card className="bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Date Range</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <DateRangePicker
            date={dateRange}
            onSelect={setDateRange}
          />
          <div className="flex items-center gap-2">
            <DateRangeButtons
              onSelect={setDateRange}
              disabled={isLoading}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => refreshData()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid gap-6">
        {/* Stats Cards */}
        <Grid container spacing={3}>
          {(todayData?.electricityImport || isLoading) && (
            <Grid item xs={12} md={6}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Electricity Import</CardTitle>
                </CardHeader>
                <CardContent>
                  <StatsCard
                    title="Total Consumption"
                    value={calculateStats(todayData?.electricityImport)?.total.toFixed(2) || '0'}
                    unit="kWh"
                    description={`Over 30 days (${calculateStats(todayData?.electricityImport)?.validReadings || 0} readings)`}
                    loading={isLoading}
                  />
                </CardContent>
              </Card>
            </Grid>
          )}

          {(todayData?.electricityExport || isLoading) && (
            <Grid item xs={12} md={6}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Electricity Export</CardTitle>
                </CardHeader>
                <CardContent>
                  <StatsCard
                    title="Total Generation"
                    value={calculateStats(todayData?.electricityExport)?.total.toFixed(2) || '0'}
                    unit="kWh"
                    description={`Over 30 days (${calculateStats(todayData?.electricityExport)?.validReadings || 0} readings)`}
                    loading={isLoading}
                  />
                </CardContent>
              </Card>
            </Grid>
          )}

          {(todayData?.gas || isLoading) && (
            <Grid item xs={12} md={6}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Gas</CardTitle>
                </CardHeader>
                <CardContent>
                  <StatsCard
                    title="Total Consumption"
                    value={calculateStats(todayData?.gas)?.total.toFixed(2) || '0'}
                    unit="kWh"
                    description={`Over 30 days (${calculateStats(todayData?.gas)?.validReadings || 0} readings)`}
                    loading={isLoading}
                  />
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>

        {/* Charts */}
        <Grid container spacing={3}>
          {(todayData?.electricityImport || isLoading) && (
            <Grid item xs={12}>
              <Card>
                <CardHeader>
                  <CardTitle>Electricity Import Consumption</CardTitle>
                </CardHeader>
                <CardContent>
                  <ConsumptionChart
                    title="Consumption"
                    data={todayData?.electricityImport ?? []}
                    rates={electricityRates}
                    unit="kWh"
                    loading={isLoading}
                  />
                </CardContent>
              </Card>
            </Grid>
          )}

          {(todayData?.electricityExport || isLoading) && (
            <Grid item xs={12}>
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
            </Grid>
          )}

          {(todayData?.gas || isLoading) && (
            <Grid item xs={12}>
              <Card>
                <CardHeader>
                  <CardTitle>Gas Consumption</CardTitle>
                </CardHeader>
                <CardContent>
                  <ConsumptionChart
                    title="Consumption"
                    data={todayData?.gas ?? []}
                    unit="kWh"
                    loading={isLoading}
                  />
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>

        {/* Daily Pattern Charts */}
        <Grid container spacing={3}>
          {(todayData?.electricityImport || isLoading) && (
            <Grid item xs={12} lg={6}>
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
            </Grid>
          )}

          {(todayData?.electricityExport || isLoading) && (
            <Grid item xs={12} lg={6}>
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
            </Grid>
          )}

          {(todayData?.gas || isLoading) && (
            <Grid item xs={12} lg={6}>
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
            </Grid>
          )}
        </Grid>
      </div>
    </div>
  )
} 