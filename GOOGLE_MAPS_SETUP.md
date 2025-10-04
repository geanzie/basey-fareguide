# Google Maps API Integration Setup Guide

## Prerequisites

1. **Google Cloud Console Account**: You need a Google Cloud Console account to obtain an API key.
2. **Google Maps JavaScript API**: Must be enabled in your Google Cloud Console.
3. **Distance Matrix API**: Must be enabled for route distance calculations.
4. **Directions API**: Must be enabled for detailed route information.

## Step 1: Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" → "Library"
4. Enable the following APIs:
   - Maps JavaScript API
   - Distance Matrix API  
   - Directions API
   - Places API (optional, for future enhancements)
5. Go to "APIs & Services" → "Credentials"
6. Click "Create Credentials" → "API Key"
7. Copy your API key

## Step 2: Configure API Key Restrictions (Important for Security)

1. In the Google Cloud Console, click on your API key
2. Under "Application restrictions":
   - Choose "HTTP referrers (web sites)"
   - Add your domains:
     - `http://localhost:3000/*` (for development)
     - `https://yourdomain.com/*` (for production)
3. Under "API restrictions":
   - Select "Restrict key"
   - Choose only the APIs you enabled above

## Step 3: Set Environment Variables

The API key is already configured in your `.env.local` file:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

**Security Note**: The `NEXT_PUBLIC_` prefix makes this accessible to the client-side code, which is required for Google Maps. However, this means it will be visible in the browser. That's why API key restrictions are crucial.

## Step 4: API Usage and Costs

### Free Tier Limits (as of 2024):
- **Maps JavaScript API**: $7.00 per 1,000 loads (first 28,000 loads free per month)
- **Distance Matrix API**: $5.00 per 1,000 elements (first 40,000 elements free per month)  
- **Directions API**: $5.00 per 1,000 requests (first 40,000 requests free per month)

### Cost Optimization Tips:
1. **Enable billing alerts** in Google Cloud Console
2. **Set quotas** to prevent unexpected charges
3. **Use caching** - our implementation includes rate limiting
4. **Consider usage patterns** - for Basey Municipality's size, you should stay well within free limits

## Step 5: Testing the Integration

1. Make sure your API key is properly set in `.env.local`
2. Start the development server: `npm run dev`
3. Navigate to `/dashboard/calculator`
4. Select "Google Maps Calculator"
5. Choose two locations and calculate a route

## Step 6: Monitoring Usage

1. Go to Google Cloud Console → "APIs & Services" → "Dashboard"
2. Monitor your API usage and quotas
3. Set up billing alerts if needed

## Implementation Details

### Files Created/Modified:

1. **`src/lib/googleMaps.ts`**: Core Google Maps service functions
2. **`src/app/api/routes/google-maps/route.ts`**: API endpoint for route calculations
3. **`src/components/GoogleMapsFareCalculator.tsx`**: React component for the calculator
4. **`src/app/dashboard/calculator/page.tsx`**: Updated to include both calculators

### API Endpoints:

- **POST `/api/routes/google-maps`**: Calculate route using Google Maps
  ```json
  {
    "origin": [11.280182, 125.06918],
    "destination": [11.2768363, 125.0114879]
  }
  ```

### Key Features:

- ✅ **High Accuracy**: Uses real Google Maps road data
- ✅ **Real-time Traffic**: Considers current traffic conditions  
- ✅ **Municipal Compliance**: Uses Basey Municipal Ordinance 105 fare structure
- ✅ **Rate Limiting**: Prevents API abuse
- ✅ **Error Handling**: Comprehensive error management
- ✅ **Validation**: Ensures coordinates are within Basey Municipality

### Future Enhancements:

1. **Visual Map Component**: Interactive map showing the route
2. **Real-time Traffic Alerts**: Display current traffic conditions
3. **Alternative Routes**: Show multiple route options
4. **Historical Data**: Track popular routes and optimize

## Troubleshooting

### Common Issues:

1. **"Failed to load Google Maps"**: Check your API key and internet connection
2. **"No route found"**: Ensure coordinates are valid and accessible by road
3. **"API key not found"**: Make sure `.env.local` contains your API key
4. **High API costs**: Check your usage in Google Cloud Console and set up quotas

### Debug Mode:

To enable detailed logging, open browser developer tools and check the console for detailed error messages.

## Production Deployment

1. **Update environment variables** in your hosting platform
2. **Update API key restrictions** to include your production domain
3. **Set up monitoring** for API usage and costs
4. **Configure proper HTTPS** for secure API calls

## Support

For issues specific to Google Maps API, refer to:
- [Google Maps JavaScript API Documentation](https://developers.google.com/maps/documentation/javascript)
- [Distance Matrix API Documentation](https://developers.google.com/maps/documentation/distance-matrix)
- [Directions API Documentation](https://developers.google.com/maps/documentation/directions)