#!/usr/bin/env node

/**
 * Google Maps API Setup Helper for Basey Fare Guide
 * 
 * This script helps set up the Google Maps API for accurate fare calculation.
 * Without proper API setup, fare calculations would be unfair to drivers.
 */

console.log('\n🗺️  Basey Fare Guide - Google Maps API Setup');
console.log('===========================================\n');

console.log('⚠️  CRITICAL: Why Google Maps API is Required');
console.log('   Without road-based routing:');
console.log('   • San Antonio to Basiao: GPS = 7.6km, Reality = 21km');
console.log('   • This would undercharge drivers by ₱40+ per trip!');
console.log('   • Fair fare calculation requires actual road distance\n');

console.log('📋 Setup Instructions:');
console.log('1. Go to Google Cloud Console: https://console.cloud.google.com/');
console.log('2. Create a new project or select existing project');
console.log('3. Enable the following APIs:');
console.log('   ✓ Directions API (REQUIRED)');
console.log('   ✓ Distance Matrix API (REQUIRED)');
console.log('   ✓ Maps JavaScript API (optional)');
console.log('4. Create API credentials (API Key)');
console.log('5. Copy .env.local.example to .env.local');
console.log('6. Add your API key to .env.local');
console.log('7. Restart your development server\n');

console.log('🔗 Useful Links:');
console.log('   • Google Cloud Console: https://console.cloud.google.com/');
console.log('   • Enable APIs: https://console.cloud.google.com/apis/library');
console.log('   • Create API Key: https://console.cloud.google.com/apis/credentials');
console.log('   • Directions API: https://console.cloud.google.com/apis/library/directions-backend.googleapis.com');
console.log('   • Distance Matrix API: https://console.cloud.google.com/apis/library/distance-matrix-backend.googleapis.com\n');

console.log('🔒 Security Recommendations:');
console.log('   • Restrict API key to required APIs only');
console.log('   • Set usage quotas to avoid unexpected charges');
console.log('   • Restrict to your domain/IP for production');
console.log('   • Monitor usage in Google Cloud Console\n');

console.log('🧪 Testing:');
console.log('   After setup, test with San Antonio to Basiao route');
console.log('   Expected: ~21km road distance (not 7.6km GPS distance)\n');

const fs = require('fs');
const path = require('path');

// Check if .env.local exists
const envPath = path.join(process.cwd(), '.env.local');
const examplePath = path.join(process.cwd(), '.env.local.example');

if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
  console.log('📁 Creating .env.local from template...');
  fs.copyFileSync(examplePath, envPath);
  console.log('✅ Created .env.local - Please add your Google Maps API key');
} else if (fs.existsSync(envPath)) {
  console.log('✅ .env.local file already exists');
} else {
  console.log('❌ No .env.local.example template found');
}

console.log('\n🚀 Ready to configure your Google Maps API key!');