import { NextRequest, NextResponse } from 'next/server';

/**
 * Diagnostic API endpoint to check Google Maps API configuration
 * Use this to debug Google Maps issues in production
 * Access via: /api/debug/google-maps
 */
export async function GET(request: NextRequest) {
  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      apiKeys: {
        serverKey: {
          exists: !!process.env.GOOGLE_MAPS_SERVER_API_KEY,
          configured: !!process.env.GOOGLE_MAPS_SERVER_API_KEY
        },
        clientKey: {
          exists: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
          configured: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      },
      requiredApis: [
        'Distance Matrix API',
        'Directions API', 
        'Maps JavaScript API',
        'Geocoding API'
      ],
      testEndpoints: {
        geocoding: 'https://maps.googleapis.com/maps/api/geocode/json',
        distanceMatrix: 'https://maps.googleapis.com/maps/api/distancematrix/json',
        directions: 'https://maps.googleapis.com/maps/api/directions/json'
      }
    };

    // Test API key if available
    const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (apiKey) {
      try {
        const testUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=Basey,Samar,Philippines&key=${apiKey}`;
        const testResponse = await fetch(testUrl);
        const testData = await testResponse.json();
        
        (diagnostics as any).apiTest = {
          status: testData.status,
          working: testData.status === 'OK',
          errorMessage: testData.error_message || null,
          resultsCount: testData.results?.length || 0
        };
      } catch (testError) {
        (diagnostics as any).apiTest = {
          status: 'NETWORK_ERROR',
          working: false,
          errorMessage: testError instanceof Error ? testError.message : 'Network error',
          resultsCount: 0
        };
      }
    } else {
      (diagnostics as any).apiTest = {
        status: 'NO_API_KEY',
        working: false,
        errorMessage: 'No API key configured',
        resultsCount: 0
      };
    }

    return NextResponse.json({
      success: true,
      diagnostics,
      recommendations: generateRecommendations(diagnostics, (diagnostics as any).apiTest)
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

function generateRecommendations(diagnostics: any, apiTest: any): string[] {
  const recommendations: string[] = [];

  if (!diagnostics.apiKeys.serverKey.exists && !diagnostics.apiKeys.clientKey.exists) {
    recommendations.push('❌ CRITICAL: No Google Maps API keys found. Set GOOGLE_MAPS_SERVER_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
  }

  if (apiTest.status === 'REQUEST_DENIED') {
    recommendations.push('❌ API key is invalid or restricted. Check Google Cloud Console credentials');
  }

  if (apiTest.status === 'OVER_DAILY_LIMIT' || apiTest.status === 'OVER_QUERY_LIMIT') {
    recommendations.push('⚠️ API quota exceeded. Check your Google Cloud Console billing and quotas');
  }

  if (apiTest.status === 'UNKNOWN_ERROR') {
    recommendations.push('⚠️ Google Maps service error. This is usually temporary');
  }

  if (!apiTest.working && diagnostics.apiKeys.serverKey.exists) {
    recommendations.push('🔧 Enable required APIs: Distance Matrix API, Directions API, Maps JavaScript API, Geocoding API');
    recommendations.push('🔧 Check API key restrictions in Google Cloud Console');
    recommendations.push('🔧 Verify billing is enabled for your Google Cloud project');
  }

  if (apiTest.working) {
    recommendations.push('✅ Google Maps API is working correctly');
  }

  recommendations.push('📖 Check Google Cloud Console: https://console.cloud.google.com/apis/credentials');
  recommendations.push('📖 Enable APIs: https://console.cloud.google.com/apis/library');

  return recommendations;
}
