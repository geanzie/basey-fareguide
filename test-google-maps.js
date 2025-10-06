// Test script for Google Maps API
// Run with: node test-google-maps.js
// Make sure to set your environment variables first

require('dotenv').config({ path: ['.env.local', '.env'] });

async function testGoogleMapsAPI() {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey || apiKey === 'YOUR_NEW_GOOGLE_MAPS_API_KEY') {
    console.error('❌ Google Maps API key not set or still using placeholder.');
    console.log('Please update your .env.local file with your new API key.');
    return;
  }

  console.log('🔑 API Key found, testing individual APIs...\n');
  
  // Test 1: Geocoding API
  console.log('Testing Geocoding API...');
  try {
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=Basey,Samar&key=${apiKey}`;
    const geocodeResponse = await fetch(geocodeUrl);
    const geocodeData = await geocodeResponse.json();
    
    if (geocodeData.status === 'OK') {
      console.log('✅ Geocoding API: Working');
    } else {
      console.log('❌ Geocoding API:', geocodeData.status, geocodeData.error_message || '');
    }
  } catch (error) {
    console.log('❌ Geocoding API: Network error');
  }

  // Test 2: Directions API
  console.log('Testing Directions API...');
  try {
    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=11.280182,125.06918&destination=11.2768363,125.0114879&key=${apiKey}`;
    const directionsResponse = await fetch(directionsUrl);
    const directionsData = await directionsResponse.json();
    
    if (directionsData.status === 'OK') {
      console.log('✅ Directions API: Working');
    } else {
      console.log('❌ Directions API:', directionsData.status, directionsData.error_message || '');
    }
  } catch (error) {
    console.log('❌ Directions API: Network error');
  }

  // Test 3: Distance Matrix API
  console.log('Testing Distance Matrix API...');
  try {
    const distanceUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=11.280182,125.06918&destinations=11.2768363,125.0114879&key=${apiKey}`;
    const distanceResponse = await fetch(distanceUrl);
    const distanceData = await distanceResponse.json();
    
    if (distanceData.status === 'OK') {
      console.log('✅ Distance Matrix API: Working');
    } else {
      console.log('❌ Distance Matrix API:', distanceData.status, distanceData.error_message || '');
    }
  } catch (error) {
    console.log('❌ Distance Matrix API: Network error');
  }

  console.log('\n📋 Summary:');
  console.log('If any API shows "REQUEST_DENIED", you need to enable it in Google Cloud Console');
  console.log('Go to: https://console.cloud.google.com/apis/library');
  console.log('Enable the APIs that failed the test above.');
}

testGoogleMapsAPI();