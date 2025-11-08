#!/usr/bin/env node

/**
 * Discount Application API Test Script
 * 
 * This script tests the discount card application APIs
 * Run with: node scripts/test-discount-api.js
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000'

// Test configuration
const TEST_CONFIG = {
  // You'll need to set these with real tokens
  publicUserToken: process.env.TEST_PUBLIC_TOKEN || 'YOUR_PUBLIC_USER_TOKEN',
  adminToken: process.env.TEST_ADMIN_TOKEN || 'YOUR_ADMIN_TOKEN',
}

console.log('🧪 Discount Application API Test Suite\n')
console.log('Configuration:')
console.log(`- API Base: ${API_BASE}`)
console.log(`- Public Token: ${TEST_CONFIG.publicUserToken.substring(0, 20)}...`)
console.log(`- Admin Token: ${TEST_CONFIG.adminToken.substring(0, 20)}...\n`)

async function testEndpoint(name, config) {
  console.log(`\n📋 Testing: ${name}`)
  console.log(`   Method: ${config.method}`)
  console.log(`   Endpoint: ${config.endpoint}`)
  
  try {
    const response = await fetch(`${API_BASE}${config.endpoint}`, {
      method: config.method,
      headers: config.headers,
      body: config.body
    })

    const data = await response.json()
    
    console.log(`   Status: ${response.status} ${response.ok ? '✅' : '❌'}`)
    console.log(`   Response:`, JSON.stringify(data, null, 2).substring(0, 200))
    
    if (config.expectedStatus && response.status !== config.expectedStatus) {
      console.log(`   ⚠️  Expected status ${config.expectedStatus}, got ${response.status}`)
    }
    
    return { success: response.ok, status: response.status, data }
  } catch (error) {
    console.log(`   ❌ Error:`, error.message)
    return { success: false, error: error.message }
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(60))
  console.log('🚀 Starting API Tests')
  console.log('='.repeat(60))

  // Test 1: Check application status (no application yet)
  await testEndpoint('Get Application Status (Empty)', {
    method: 'GET',
    endpoint: '/api/discount-cards/my-application',
    headers: {
      'Authorization': `Bearer ${TEST_CONFIG.publicUserToken}`
    },
    expectedStatus: 200
  })

  // Test 2: Try to apply without auth
  await testEndpoint('Apply Without Auth (Should Fail)', {
    method: 'POST',
    endpoint: '/api/discount-cards/apply',
    headers: {
      'Content-Type': 'application/json'
    },
    expectedStatus: 401
  })

  // Test 3: Apply with invalid discount type
  const formData = new FormData()
  formData.append('discountType', 'INVALID_TYPE')
  formData.append('fullName', 'Test User')
  formData.append('dateOfBirth', '1950-01-01')

  await testEndpoint('Apply With Invalid Type (Should Fail)', {
    method: 'POST',
    endpoint: '/api/discount-cards/apply',
    headers: {
      'Authorization': `Bearer ${TEST_CONFIG.publicUserToken}`
    },
    body: formData,
    expectedStatus: 400
  })

  // Test 4: Admin get all discount cards
  await testEndpoint('Admin List All Cards', {
    method: 'GET',
    endpoint: '/api/admin/discount-cards?page=1&limit=10',
    headers: {
      'Authorization': `Bearer ${TEST_CONFIG.adminToken}`
    },
    expectedStatus: 200
  })

  // Test 5: Admin filter by PENDING status
  await testEndpoint('Admin Filter by PENDING', {
    method: 'GET',
    endpoint: '/api/admin/discount-cards?verificationStatus=PENDING',
    headers: {
      'Authorization': `Bearer ${TEST_CONFIG.adminToken}`
    },
    expectedStatus: 200
  })

  // Test 6: Try admin endpoint as public user (should fail)
  await testEndpoint('Public User Access Admin Endpoint (Should Fail)', {
    method: 'GET',
    endpoint: '/api/admin/discount-cards',
    headers: {
      'Authorization': `Bearer ${TEST_CONFIG.publicUserToken}`
    },
    expectedStatus: 403
  })

  console.log('\n' + '='.repeat(60))
  console.log('✅ Test Suite Complete')
  console.log('='.repeat(60))
  console.log('\n💡 Note: For full testing, you need to:')
  console.log('   1. Set TEST_PUBLIC_TOKEN environment variable')
  console.log('   2. Set TEST_ADMIN_TOKEN environment variable')
  console.log('   3. Have a running server at ' + API_BASE)
  console.log('   4. Manually test file uploads with real images\n')
}

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error)
}

module.exports = { testEndpoint, runTests }
