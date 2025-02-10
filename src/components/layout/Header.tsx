import { Button } from "@/components/ui/button"
import { useOctopus } from "@/lib/context/OctopusContext"
import { cache } from "@/lib/utils/cache"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Settings, RefreshCw, Trash2 } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

export function Header() {
  const { refreshData, isLoading } = useOctopus()
  const { toast } = useToast()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  const handleRefreshData = async () => {
    try {
      setIsRefreshing(true)
      await refreshData()
      toast({
        title: "Data Refreshed",
        description: "Your data has been successfully updated from Octopus Energy.",
      })
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "There was an error refreshing your data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleClearCache = async () => {
    try {
      setIsClearing(true)
      // Clear the client cache
      cache.clear()
      // Clear localStorage
      localStorage.removeItem('octopusConfig')
      
      toast({
        title: "Cache Cleared",
        description: "All cached data has been cleared. The page will refresh.",
      })
      
      // Short delay to show the toast before refresh
      await new Promise(resolve => setTimeout(resolve, 1500))
      window.location.reload()
    } catch (error) {
      toast({
        title: "Clear Cache Failed",
        description: "There was an error clearing the cache. Please try again.",
        variant: "destructive",
      })
      setIsClearing(false)
    }
  }

  return (
    <header className="bg-[#0f1729] border-b border-[#1d2839]">
      <div className="max-w-screen-2xl mx-auto px-2 sm:px-4 lg:px-6">
        <div className="h-14 sm:h-16 flex justify-between items-center gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 shrink-0 text-[#40E0D0]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Octopus Energy Dashboard</h1>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-2 sm:px-3 text-xs sm:text-sm hover:bg-white/10 text-white"
            >
              Help
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2 sm:px-3 text-xs sm:text-sm hover:bg-white/10 text-white"
                >
                  <Settings className="h-4 w-4" />
                  <span className="ml-2 hidden sm:inline">Settings</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-56 p-0 bg-[#1a2332] border border-[#2a3649] shadow-lg overflow-hidden"
                align="end"
              >
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-sm font-normal hover:bg-white/10 text-white h-10 px-3 rounded-none"
                    onClick={handleRefreshData}
                    disabled={isRefreshing || isLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
                  </Button>
                  <div className="h-[1px] w-full bg-[#2a3649]" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-sm font-normal hover:bg-white/10 text-white h-10 px-3 rounded-none"
                    onClick={handleClearCache}
                    disabled={isClearing || isLoading}
                  >
                    <Trash2 className={`h-4 w-4 mr-2 ${isClearing ? 'animate-pulse' : ''}`} />
                    {isClearing ? 'Clearing...' : 'Clear Cached Data'}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </header>
  )
} 