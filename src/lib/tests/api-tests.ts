import { format, subDays } from 'date-fns'
import nodeFetch from 'node-fetch'
import { OctopusApi } from '../services/test-octopus-api'

// Test configuration
const API_KEY = process.env.VITE_OCTOPUS_API_KEY || ''
const API_ENDPOINT = 'https://api.octopus.energy/v1'
const TEST_CONFIG = {
  electricity: {
    mpan: '2000024512368',  // Replace with your MPAN
    serialNumber: '20L123456'  // Replace with your serial number
  },
  gas: {
    mprn: '3938453',  // Replace with your MPRN
    serialNumber: 'G4123456'  // Replace with your serial number
  }
}

async function runTests() {
  console.log('Starting API Tests...')
  const api = new OctopusApi(API_KEY, TEST_CONFIG, API_ENDPOINT)

  try {
    // Test 1: Get Account Info
    console.log('\n=== Test 1: Account Info ===')
    const accountUrl = `${API_ENDPOINT}/accounts/`
    const accountResponse = await nodeFetch(accountUrl, {
      headers: {
        'Authorization': `Basic ${Buffer.from(API_KEY + ':').toString('base64')}`
      }
    })
    const accountData = await accountResponse.json()
    console.log('Account Response:', JSON.stringify(accountData, null, 2))

    // Test 2: Get Electricity Consumption (Last 7 Days)
    console.log('\n=== Test 2: Electricity Consumption (Last 7 Days) ===')
    const endDate = new Date()
    const startDate = subDays(endDate, 7)
    const electricityResponse = await api.getElectricityConsumption(
      startDate.toISOString(),
      endDate.toISOString()
    )
    console.log('Response Structure:', {
      count: electricityResponse.count,
      next: electricityResponse.next,
      previous: electricityResponse.previous,
      'results.length': electricityResponse.results.length
    })
    if (electricityResponse.results.length > 0) {
      console.log('Sample Consumption Entry:', electricityResponse.results[0])
      console.log('Date Range:', {
        first: format(new Date(electricityResponse.results[0].interval_start), 'yyyy-MM-dd HH:mm:ss'),
        last: format(new Date(electricityResponse.results[electricityResponse.results.length - 1].interval_start), 'yyyy-MM-dd HH:mm:ss')
      })
    }

    // Test 3: Get Gas Consumption (Last 7 Days)
    console.log('\n=== Test 3: Gas Consumption (Last 7 Days) ===')
    const gasResponse = await api.getGasConsumption(
      startDate.toISOString(),
      endDate.toISOString()
    )
    console.log('Response Structure:', {
      count: gasResponse.count,
      next: gasResponse.next,
      previous: gasResponse.previous,
      'results.length': gasResponse.results.length
    })
    if (gasResponse.results.length > 0) {
      console.log('Sample Consumption Entry:', gasResponse.results[0])
      console.log('Date Range:', {
        first: format(new Date(gasResponse.results[0].interval_start), 'yyyy-MM-dd HH:mm:ss'),
        last: format(new Date(gasResponse.results[gasResponse.results.length - 1].interval_start), 'yyyy-MM-dd HH:mm:ss')
      })
    }

    // Test 4: Get Electricity Tariff
    console.log('\n=== Test 4: Electricity Tariff ===')
    const tariffResponse = await api.getElectricityTariff()
    console.log('Response Structure:', {
      'results.length': tariffResponse.results.length,
      'unit_rate.length': tariffResponse.results[0]?.unit_rate?.length,
      'standing_charge.length': tariffResponse.results[0]?.standing_charge?.length
    })
    if (tariffResponse.results[0]?.unit_rate?.length > 0) {
      console.log('Sample Rate Entry:', tariffResponse.results[0].unit_rate[0])
    }
    if (tariffResponse.results[0]?.standing_charge?.length > 0) {
      console.log('Sample Standing Charge:', tariffResponse.results[0].standing_charge[0])
    }

    // Test 5: Get Available Tariff Products
    console.log('\n=== Test 5: Available Tariff Products ===')
    const productsUrl = `${API_ENDPOINT}/products/`
    const productsResponse = await nodeFetch(productsUrl)
    const productsData = await productsResponse.json()
    console.log('Products Response:', JSON.stringify(productsData, null, 2))

  } catch (error) {
    console.error('Test Error:', error)
  }
}

// Run the tests
runTests().then(() => console.log('Tests completed')) 