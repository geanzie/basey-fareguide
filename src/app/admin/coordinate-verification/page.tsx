import { Metadata } from 'next';
import CoordinateVerificationTool from '../../../components/CoordinateVerificationTool';

export const metadata: Metadata = {
  title: 'Coordinate Verification Tool - Admin Dashboard',
  description: 'Advanced coordinate verification and validation tool for Basey Municipality locations using polygon boundaries and Google Maps API.',
};

export default function CoordinateVerificationPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Coordinate Verification Tool</h1>
          <p className="mt-2 text-gray-600">
            Advanced verification system for validating location coordinates using polygon boundaries and Google Maps API integration.
          </p>
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-yellow-400 text-xl">⚠️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Admin Tool</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    This is a technical administrative tool for data validation. It requires API access and may take time to process.
                    Use this tool to verify and validate coordinate accuracy across all barangay and landmark locations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <CoordinateVerificationTool />
      </div>
    </div>
  );
}