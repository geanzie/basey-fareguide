// GeoJSON type declarations for barangay boundary data
declare module '*.geojson' {
  const value: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      geometry: {
        type: 'Polygon';
        coordinates: number[][][];
      };
      properties: {
        Name?: string | null;
        BARANGAY: string;
        BRGY_INDEX: number;
        POB?: boolean | null;
        IN_POB?: number | null;
        OUT_POB?: number | null;
        [key: string]: any;
      };
    }>;
  };
  export default value;
}

// JSON files containing GeoJSON data (specifically for our barangay file)
declare module '*Barangay.shp.json' {
  const value: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      geometry: {
        type: 'Polygon';
        coordinates: number[][][];
      };
      properties: {
        Name?: string | null;
        BARANGAY: string;
        BRGY_INDEX: number;
        POB?: boolean | null;
        IN_POB?: number | null;
        OUT_POB?: number | null;
        [key: string]: any;
      };
    }>;
  };
  export default value;
}