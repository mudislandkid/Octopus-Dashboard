require('dotenv').config()
const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')

// Test configuration
const API_KEY = process.env.VITE_OCTOPUS_API_KEY
const API_ENDPOINT = process.env.VITE_OCTOPUS_API_ENDPOINT || 'https://api.octopus.energy/v1'
const ACCOUNT_NUMBER = process.env.OCTOPUS_ACCOUNT_NUMBER // Should be in format A-AAAA1111

// Create test-results directory if it doesn't exist
const resultsDir = path.join(__dirname, '..', 'test-results')
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true })
}

// Function to save response to JSON file
async function saveToJson(data, filename) {
  const filePath = path.join(resultsDir, filename)
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2))
  console.log(`Saved results to ${filePath}`)
}

// Debug info
console.log('Environment Check:')
console.log('API Key present:', !!API_KEY)
console.log('API Key prefix:', API_KEY?.substring(0, 6))
console.log('API Endpoint:', API_ENDPOINT)
console.log('Account Number present:', !!ACCOUNT_NUMBER)

// Your meter details
const TEST_CONFIG = {
  electricity: {
    mpan: '1300005390486',  // Import MPAN
    serialNumber: '22L4345151'  // Current meter serial number
  },
  gas: {
    mprn: '1516838700',  // Gas MPRN
    serialNumber: 'E6E07401842221'  // Current gas meter serial number
  }
}

async function runTests() {
  console.log('\nStarting API Tests...')

  if (!API_KEY) {
    console.error('Error: No API key found in environment variables')
    return
  }

  if (!ACCOUNT_NUMBER) {
    console.error('Error: No account number found in environment variables')
    return
  }

  const headers = {
    'Authorization': `Basic ${Buffer.from(API_KEY + ':').toString('base64')}`,
    'Content-Type': 'application/json'
  }

  try {
    // Test 1: Get Account Info
    console.log('\n=== Test 1: Account Info ===')
    const accountUrl = `${API_ENDPOINT}/accounts/${ACCOUNT_NUMBER}/`
    console.log('Request URL:', accountUrl)
    
    const accountResponse = await fetch(accountUrl, { headers })
    if (!accountResponse.ok) {
      throw new Error(`HTTP error! status: ${accountResponse.status} ${accountResponse.statusText}`)
    }
    const accountData = await accountResponse.json()
    await saveToJson(accountData, 'account-info.json')
    console.log('Account data saved')

    // Test 2: Get Electricity Consumption (Last 7 days)
    console.log('\n=== Test 2: Electricity Consumption ===')
    const { mpan, serialNumber } = TEST_CONFIG.electricity
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
    const period_from = sevenDaysAgo.toISOString()
    const period_to = now.toISOString()
    
    const electricityUrl = `${API_ENDPOINT}/electricity-meter-points/${mpan}/meters/${serialNumber}/consumption/?page_size=100&period_from=${period_from}&period_to=${period_to}&order_by=period`
    console.log('Request URL:', electricityUrl)
    
    const electricityResponse = await fetch(electricityUrl, { headers })
    if (!electricityResponse.ok) {
      throw new Error(`HTTP error! status: ${electricityResponse.status} ${electricityResponse.statusText}`)
    }
    const electricityData = await electricityResponse.json()
    await saveToJson(electricityData, 'electricity-consumption.json')
    console.log('Electricity consumption data saved')

    // Test 3: Get Gas Consumption (Last 7 days)
    console.log('\n=== Test 3: Gas Consumption ===')
    const { mprn, serialNumber: gasSerial } = TEST_CONFIG.gas
    const gasUrl = `${API_ENDPOINT}/gas-meter-points/${mprn}/meters/${gasSerial}/consumption/?page_size=100&period_from=${period_from}&period_to=${period_to}&order_by=period`
    console.log('Request URL:', gasUrl)
    
    const gasResponse = await fetch(gasUrl, { headers })
    if (!gasResponse.ok) {
      throw new Error(`HTTP error! status: ${gasResponse.status} ${gasResponse.statusText}`)
    }
    const gasData = await gasResponse.json()
    await saveToJson(gasData, 'gas-consumption.json')
    console.log('Gas consumption data saved')

    // Test 4: Get Electricity Tariff
    console.log('\n=== Test 4: Electricity Tariff ===')
    const tariffUrl = `${API_ENDPOINT}/products/AGILE-23-12-06-D/electricity-tariffs/E-1R-AGILE-23-12-06-D/standard-unit-rates/`
    const tariffResponse = await fetch(tariffUrl)
    const tariffData = await tariffResponse.json()
    await saveToJson(tariffData, 'electricity-tariff.json')
    console.log('Electricity tariff data saved')

    // Test 5: Get Available Products
    console.log('\n=== Test 5: Available Products ===')
    const productsUrl = `${API_ENDPOINT}/products/`
    const productsResponse = await fetch(productsUrl)
    const productsData = await productsResponse.json()
    await saveToJson(productsData, 'available-products.json')
    console.log('Available products data saved')

    // Save test configuration
    await saveToJson({
      timestamp: new Date().toISOString(),
      apiEndpoint: API_ENDPOINT,
      accountNumber: ACCOUNT_NUMBER,
      meterConfig: TEST_CONFIG,
      dateRange: {
        from: period_from,
        to: period_to
      }
    }, 'test-config.json')

  } catch (error) {
    console.error('Test Error:', error)
    await saveToJson({ error: error.message }, 'error.json')
  }
}

// Run the tests
runTests().then(() => console.log('Tests completed')) 