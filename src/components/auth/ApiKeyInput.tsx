import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
      // Save to localStorage
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
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting to Octopus Energy
            </div>
          </CardTitle>
          <CardDescription>
            Please wait while we verify your credentials and fetch your meter data...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome to Your Energy Dashboard</CardTitle>
        <CardDescription>
          To get started, please enter your Octopus Energy API key and account number.
          You can find these in your Octopus Energy account settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key</Label>
          <Input
            id="apiKey"
            type="password"
            placeholder="Enter your API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="accountNumber">Account Number</Label>
          <Input
            id="accountNumber"
            placeholder="Enter your account number (e.g., A-1234ABCD)"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <Button 
          onClick={handleConnect}
          disabled={isLoading || !isFormValid()}
          className="w-full"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting...
            </div>
          ) : (
            'Connect'
          )}
        </Button>
      </CardContent>
    </Card>
  )
} 