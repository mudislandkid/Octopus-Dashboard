import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2 } from "lucide-react"

interface ApiKeyInputProps {
  error?: string | null
  isLoading?: boolean
  onConnect: (apiKey: string, accountNumber: string) => Promise<void>
}

interface StoredConfig {
  apiKey: string
  accountNumber: string
}

export function ApiKeyInput({ error, isLoading, onConnect }: ApiKeyInputProps) {
  const [apiKey, setApiKey] = useState('')
  const [accountNumber, setAccountNumber] = useState('')

  // Load saved values from localStorage
  useEffect(() => {
    const savedConfig = localStorage.getItem('octopusConfig')
    if (savedConfig) {
      try {
        const config: StoredConfig = JSON.parse(savedConfig)
        setApiKey(config.apiKey || '')
        setAccountNumber(config.accountNumber || '')
      } catch (error) {
        console.error('Error loading saved config:', error)
        localStorage.removeItem('octopusConfig')
      }
    }
  }, [])

  const handleConnect = () => {
    const trimmedApiKey = apiKey.trim()
    const trimmedAccountNumber = accountNumber.trim()
    
    if (trimmedApiKey && trimmedAccountNumber) {
      localStorage.setItem('octopusConfig', JSON.stringify({
        apiKey: trimmedApiKey,
        accountNumber: trimmedAccountNumber
      }))

      onConnect(trimmedApiKey, trimmedAccountNumber)
    }
  }

  const isFormValid = () => {
    return apiKey.trim().length > 0 && accountNumber.trim().length > 0
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Welcome to Your Energy Dashboard</h1>
          <p className="text-xl text-muted-foreground">
            Please wait while we verify your credentials and fetch your meter data...
          </p>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Welcome to Your Energy Dashboard</h1>
        <div className="space-y-2 text-xl text-muted-foreground">
          <p>To get started, please enter your Octopus Energy API key and account number.</p>
          <p className="text-lg">
            You can find your API key in your{' '}
            <a 
              href="https://octopus.energy/dashboard/developer" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#40E0D0] hover:text-[#40E0D0]/80 underline"
            >
              Octopus Energy Developer Dashboard
            </a>
          </p>
          <p className="text-lg">
            Your account number can be found in your{' '}
            <a 
              href="https://octopus.energy/dashboard/accounts" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#40E0D0] hover:text-[#40E0D0]/80 underline"
            >
              Octopus Energy Account Page
            </a>
            {' '}(format: A-XXXX1234)
          </p>
        </div>
      </div>

      <Card className="glow-card">
        <CardContent className="pt-6 space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey" className="text-lg">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Enter your API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={isLoading}
                className="h-12 text-lg font-mono bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountNumber" className="text-lg">Account Number</Label>
              <Input
                id="accountNumber"
                placeholder="Enter your account number (e.g., A-1234ABCD)"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                disabled={isLoading}
                className="h-12 text-lg font-mono bg-background/50"
              />
            </div>

            <Button 
              onClick={handleConnect}
              disabled={!isFormValid() || isLoading}
              className="w-full h-12 text-lg"
            >
              {isLoading ? (
                <div className="flex items-center gap-2 justify-center">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Connecting...
                </div>
              ) : (
                'Connect'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-sm text-muted-foreground space-y-2 max-w-2xl mx-auto">
        <p className="font-medium">Privacy & Data Notice:</p>
        <p>
          All data is stored locally in your browser. No information is sent to or stored on any external servers. 
          Your API key and account details never leave your device except to communicate directly with Octopus Energy's API.
        </p>
        <p>
          This dashboard is for informational purposes only. While we strive for accuracy, the displayed data may be incomplete 
          or inaccurate. Please always refer to your official{' '}
          <a 
            href="https://octopus.energy/dashboard" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[#40E0D0] hover:text-[#40E0D0]/80 underline"
          >
            Octopus Energy Dashboard
          </a>
          {' '}and statements for accurate billing information.
        </p>
      </div>
    </div>
  )
} 