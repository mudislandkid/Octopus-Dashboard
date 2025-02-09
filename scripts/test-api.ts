require('dotenv').config()
require('../src/lib/tests/api-tests')

console.log('API Test Runner')
console.log('Environment:', process.env.NODE_ENV)
console.log('API Key Present:', !!process.env.VITE_OCTOPUS_API_KEY) 