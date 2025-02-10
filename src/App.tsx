import { useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { ApiKeyInput } from '@/components/auth/ApiKeyInput'
import { DashboardGrid } from '@/components/dashboard/DashboardGrid'
import { OctopusProvider, useOctopus } from '@/lib/context/OctopusContext'
import './login.css'

function AppContent() {
  const { isLoading, error, electricityImportConsumption, electricityExportConsumption, gasConsumption, electricityRates, connect } = useOctopus()

  // Enable dark mode by default
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  const isLoginView = !electricityImportConsumption && !electricityExportConsumption && !gasConsumption

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      {isLoginView ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-xl lg:max-w-2xl">
            <ApiKeyInput
              error={error}
              isLoading={isLoading}
              onConnect={connect}
            />
          </div>
        </div>
      ) : (
        <main className="flex-1 w-full">
          <DashboardGrid />
        </main>
      )}
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
