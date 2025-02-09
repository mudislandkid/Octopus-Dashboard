import { StatsCard } from "./StatsCard"
import { Zap, PoundSterling, Clock, TrendingUp } from "lucide-react"
import { useOctopus } from "@/lib/context/OctopusContext"
import { ConsumptionChart } from "./ConsumptionChart"

export function DashboardGrid() {
  const { todayConsumption, currentRates, isLoading } = useOctopus()

  // Calculate current usage (last reading)
  const currentUsage = todayConsumption?.[todayConsumption.length - 1]?.consumption || 0

  // Calculate total consumption for today
  const totalConsumption = todayConsumption?.reduce((sum, reading) => sum + reading.consumption, 0) || 0

  // Calculate cost (simplified - we'll add proper rate calculations later)
  const estimatedCost = totalConsumption * 0.1512 // Example rate in £/kWh

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Current Usage"
          value={`${currentUsage.toFixed(2)} kWh`}
          description="Live consumption"
          icon={<Zap className="h-4 w-4" />}
          loading={isLoading}
        />
        <StatsCard
          title="Today's Cost"
          value={`£${estimatedCost.toFixed(2)}`}
          description="Based on current rates"
          icon={<PoundSterling className="h-4 w-4" />}
          loading={isLoading}
        />
        <StatsCard
          title="Total Usage Today"
          value={`${totalConsumption.toFixed(2)} kWh`}
          description="Since midnight"
          icon={<Clock className="h-4 w-4" />}
          loading={isLoading}
        />
        <StatsCard
          title="Trend"
          value={todayConsumption ? "Coming soon" : "No data"}
          description="Compared to yesterday"
          icon={<TrendingUp className="h-4 w-4" />}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="col-span-2">
          <div className="h-[400px] rounded-xl border bg-card p-6">
            <h3 className="font-semibold">Usage Over Time</h3>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : todayConsumption ? (
              <ConsumptionChart
                data={todayConsumption}
                loading={isLoading}
                type="electricity"
                conversionFactor={1}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No data available</p>
            )}
          </div>
        </div>
        <div>
          <div className="h-[400px] rounded-xl border bg-card p-6">
            <h3 className="font-semibold">Current Tariff</h3>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : currentRates ? (
              <p className="text-sm text-muted-foreground">Details coming soon...</p>
            ) : (
              <p className="text-sm text-muted-foreground">No tariff data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 