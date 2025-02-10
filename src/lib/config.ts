// @ts-nocheck

interface EnvConfig {
  OCTOPUS_API_KEY: string
  OCTOPUS_API_ENDPOINT: string
}

function validateApiKey(key: string | undefined): string {
  if (!key) {
    throw new Error('VITE_OCTOPUS_API_KEY is not set in environment variables')
  }
  
  if (!key.startsWith('sk_')) {
    throw new Error('Invalid API key format. Octopus Energy API keys should start with "sk_"')
  }

  if (key.length < 32) {
    throw new Error('Invalid API key length. Octopus Energy API keys should be at least 32 characters')
  }

  return key
}

function validateApiEndpoint(endpoint: string | undefined): string {
  if (!endpoint) {
    throw new Error('VITE_OCTOPUS_API_ENDPOINT is not set in environment variables')
  }

  try {
    new URL(endpoint)
  } catch {
    throw new Error('VITE_OCTOPUS_API_ENDPOINT must be a valid URL')
  }

  return endpoint
}

export const config: EnvConfig = {
  OCTOPUS_API_KEY: validateApiKey(import.meta.env.VITE_OCTOPUS_API_KEY),
  OCTOPUS_API_ENDPOINT: validateApiEndpoint(import.meta.env.VITE_OCTOPUS_API_ENDPOINT),
}

// Add TypeScript types for Vite env
interface ImportMetaEnv {
  readonly VITE_OCTOPUS_API_KEY: string
  readonly VITE_OCTOPUS_API_ENDPOINT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 