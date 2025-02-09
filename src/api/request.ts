const API_BASE_URL = 'https://api.octopus.energy/v1/'

interface RequestOptions {
  apiKey: string
  params?: Record<string, string>
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
}

export async function request<T>(
  endpoint: string,
  { apiKey, params, method = 'GET', body }: RequestOptions
): Promise<T> {
  // Build URL with params
  const url = new URL(API_BASE_URL + endpoint)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })
  }

  console.log('Making request to:', url.toString())  // Debug log

  const response = await fetch(url.toString(), {
    method,
    headers: {
      'Authorization': `Basic ${btoa(apiKey + ':')}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`)
  }

  return response.json()
} 