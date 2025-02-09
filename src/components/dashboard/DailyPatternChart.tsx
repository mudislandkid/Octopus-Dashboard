import React from 'react'
import { Consumption } from '../../lib/types/api'
import { Card } from '../ui/card'
import { Skeleton } from '../ui/skeleton'
import { format, parseISO, startOfDay, getHours, set } from 'date-fns'
import { Info } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

// Add color constants
const PEAK_COLOR = 'rgba(255, 71, 71, 0.9)'  // Brighter red
const LOW_COLOR = 'rgba(46, 213, 115, 0.9)'  // Bright green
const DEFAULT_COLOR = 'hsl(var(--primary))'

interface DailyPatternChartProps {
  data: Consumption[] | null
  loading: boolean
  type: 'electricity' | 'gas'
}

interface HourlyData {
  hour: string
  value: number
  readings: number
  isPeak?: boolean
  isLowest?: boolean
}

export function DailyPatternChart({ data, loading, type }: DailyPatternChartProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Stats Grid Loading */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Card className="p-4" key={i}>
              <div className="space-y-3">
                <Skeleton className="h-8 w-24 mx-auto" />
                <Skeleton className="h-4 w-32 mx-auto" />
                <Skeleton className="h-3 w-20 mx-auto" />
              </div>
            </Card>
          ))}
        </div>
        
        {/* Chart Loading */}
        <Card className="p-4">
          <div className="h-[300px] w-full flex items-center justify-center">
            <Skeleton className="h-[250px] w-[90%]" />
          </div>
        </Card>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No data available
      </div>
    )
  }

  // Process data to get hourly averages
  const hourlyAverages = Array.from({ length: 24 }, (_, hour) => {
    const hourReadings = data.filter(reading => {
      const readingHour = getHours(parseISO(reading.interval_start))
      return readingHour === hour
    })

    const totalConsumption = hourReadings.reduce((sum, reading) => sum + (reading.consumption || 0), 0)
    const average = hourReadings.length > 0 ? totalConsumption / hourReadings.length : 0

    return {
      hour,
      average,
      formattedHour: format(set(new Date(), { hours: hour, minutes: 0 }), 'ha')
    }
  })

  // Find peak and lowest usage hours
  const maxAverage = Math.max(...hourlyAverages.map(h => h.average))
  const minAverage = Math.min(...hourlyAverages.filter(h => h.average > 0).map(h => h.average))

  const enhancedHourlyAverages = hourlyAverages.map(hourData => ({
    ...hourData,
    isPeak: hourData.average === maxAverage,
    isLowest: hourData.average === minAverage && hourData.average > 0
  }))

  const peakHour = enhancedHourlyAverages.find(h => h.isPeak)
  const lowestHour = enhancedHourlyAverages.find(h => h.isLowest)

  // Calculate total consumption for the day
  const totalConsumption = hourlyAverages.reduce((sum, hour) => sum + hour.average, 0)

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Card className="p-2 !bg-background/95 backdrop-blur-sm">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-sm text-muted-foreground">
            {payload[0].value.toFixed(2)} kWh/h
          </div>
          <div className="text-xs text-muted-foreground">
            ({payload[0].payload.readings} readings)
          </div>
        </Card>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4" style={{ borderColor: PEAK_COLOR }}>
          <div className="text-center">
            <div className="text-2xl font-bold">{peakHour?.formattedHour}</div>
            <div className="text-sm text-muted-foreground">Peak Usage Time</div>
            <div className="text-sm font-medium">{maxAverage.toFixed(2)} kWh/h</div>
          </div>
        </Card>
        <Card className="p-4" style={{ borderColor: LOW_COLOR }}>
          <div className="text-center">
            <div className="text-2xl font-bold">{lowestHour?.formattedHour}</div>
            <div className="text-sm text-muted-foreground">Lowest Usage Time</div>
            <div className="text-sm font-medium">{minAverage.toFixed(2)} kWh/h</div>
          </div>
        </Card>
      </div>
      
      {/* Chart Area */}
      <Card className="p-4">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold">Daily Usage Pattern</h3>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-transparent">
                <Info className="h-4 w-4 text-foreground hover:text-foreground/80" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <h4 className="font-semibold">Chart Legend</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4" style={{ backgroundColor: PEAK_COLOR }} />
                    <span>Peak Usage Hour</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4" style={{ backgroundColor: LOW_COLOR }} />
                    <span>Lowest Usage Hour</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4" style={{ backgroundColor: DEFAULT_COLOR }} />
                    <span>Regular Usage</span>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>This chart shows your average energy usage pattern throughout the day. The bars are colored to highlight peak usage (red) and lowest usage (green) hours, helping you identify your consumption patterns.</p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={enhancedHourlyAverages}
              margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" />
              <XAxis
                dataKey="formattedHour"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `${value.toFixed(1)}`}
                label={{ 
                  value: 'kWh/h',
                  angle: -90,
                  position: 'insideLeft',
                  fill: 'hsl(var(--muted-foreground))'
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="average"
                radius={[4, 4, 0, 0]}
                fillOpacity={0.8}
              >
                {
                  enhancedHourlyAverages.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isPeak ? PEAK_COLOR : entry.isLowest ? LOW_COLOR : DEFAULT_COLOR}
                      stroke={entry.isPeak ? PEAK_COLOR : entry.isLowest ? LOW_COLOR : DEFAULT_COLOR}
                    />
                  ))
                }
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
} 