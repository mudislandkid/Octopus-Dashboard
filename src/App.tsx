import { useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { ApiKeyInput } from '@/components/auth/ApiKeyInput'
import { DashboardGrid } from '@/components/dashboard/DashboardGrid'
import { OctopusProvider, useOctopus } from '@/lib/context/OctopusContext'

function AppContent() {
  const { isLoading, error, electricityImportConsumption, electricityExportConsumption, gasConsumption, electricityRates, connect } = useOctopus()

  // Enable dark mode by default
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {!electricityImportConsumption && !electricityExportConsumption && !gasConsumption ? (
          <ApiKeyInput
            error={error}
            isLoading={isLoading}
            onConnect={connect}
          />
        ) : (
          <DashboardGrid />
        )}
      </main>
    </div>
  )
}

function App() {
  return (
    <OctopusProvider>
      <AppContent />
    </OctopusProvider>
  )
}

export default App
