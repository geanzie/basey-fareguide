import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Coordinate System - Admin Dashboard',
  description: 'Information about the coordinate system used in Basey Municipality fare calculation system.',
};

export default function CoordinateSystemPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Coordinate System</h1>
          <p className="mt-2 text-gray-600">
            The fare calculation system now uses authoritative GeoJSON data for all coordinates.
          </p>
          
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-green-500 text-xl">✅</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Coordinate Verification Discontinued</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p className="mb-2">
                    <strong>Rule:</strong> "Follow whatever the .geojson file has because this is the most realistic coordinates data"
                  </p>
                  <p>
                    The coordinate verification tool has been removed. All coordinates now follow the 
                    accurate GeoJSON data from <code>Barangay.shp.json</code>, which contains official 
                    polygon boundaries for all 51+ barangays.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-blue-900 mb-4">Current Coordinate System</h3>
            <div className="space-y-3 text-sm text-blue-700">
              <div>
                <strong>Data Source:</strong> <code>src/data/Barangay.shp.json</code>
              </div>
              <div>
                <strong>Format:</strong> GeoJSON with polygon boundaries
              </div>
              <div>
                <strong>Coverage:</strong> 51+ barangays with precise boundaries
              </div>
              <div>
                <strong>Coordinate System:</strong> WGS84 (EPSG:4326)
              </div>
              <div>
                <strong>Basey Center:</strong> [11.282621, 125.068848] (calculated from poblacion barangays)
              </div>
            </div>
          </div>
          
          <div className="mt-6">
            <Link 
              href="/admin"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              ← Back to Admin Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}