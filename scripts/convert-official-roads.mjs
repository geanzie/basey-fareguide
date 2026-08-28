/**
 * scripts/convert-official-roads.mjs
 *
 * Converts the municipality's GIS road inventory (ESRI Shapefile, polygons, UTM
 * zone 51N) into WGS84 GeoJSON at src/data/basey-official-roads.geojson.
 *
 * Run ONCE when the GIS layer is updated, not per build.
 *
 *   node scripts/convert-official-roads.mjs "/path/to/ROADS UPDATED"
 *
 * (pass the path without an extension; .shp, .dbf and .prj are read alongside)
 *
 * WHAT THIS LAYER IS
 * ------------------
 * 796 carriageway *footprints* — polygons with an AREA field, not centerlines.
 * Nothing can be routed on them; ORS remains the distance engine. What they
 * carry that OpenStreetMap does not is authority and attribution: every road is
 * classified (barangay / municipal / national / provincial) and tagged with the
 * barangay it serves, and all 51 barangays join cleanly on that tag. That is
 * what lets a drop-off be proposed on the road *into* a place rather than
 * whichever road happens to be nearest.
 *
 * It is written to src/data/ rather than public/ on purpose: it is read by the
 * server and by scripts, and must not be shipped to the browser alongside the
 * 2.9 MB public/data/basey-roads.geojson.
 *
 * Data © Municipality of Basey GIS.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, "..", "src", "data", "basey-official-roads.geojson");

const EXPECTED_FEATURES = 796;
const EXPECTED_BBOX = { latMin: 11.25, latMax: 11.39, lngMin: 124.97, lngMax: 125.28 };

// --- inverse Transverse Mercator, WGS84 / UTM zone 51N (see the .prj) ---
const A = 6378137.0;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
const E1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
const K0 = 0.9996;
const FALSE_EASTING = 500000.0;
const LON0 = (123.0 * Math.PI) / 180;

function utmToLngLat(easting, northing) {
  const x = easting - FALSE_EASTING;
  const m = northing / K0;
  const mu = m / (A * (1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256));
  const phi1 =
    mu +
    (3 * E1 / 2 - (27 * E1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * E1 ** 2) / 16 - (55 * E1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * E1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * E1 ** 4) / 512) * Math.sin(8 * mu);

  const ep2 = E2 / (1 - E2);
  const c1 = ep2 * Math.cos(phi1) ** 2;
  const t1 = Math.tan(phi1) ** 2;
  const n1 = A / Math.sqrt(1 - E2 * Math.sin(phi1) ** 2);
  const r1 = (A * (1 - E2)) / (1 - E2 * Math.sin(phi1) ** 2) ** 1.5;
  const d = x / (n1 * K0);

  const lat =
    phi1 -
    ((n1 * Math.tan(phi1)) / r1) *
      (d ** 2 / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) * d ** 6) / 720);

  const lon =
    LON0 +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5) / 120) /
      Math.cos(phi1);

  return [round5((lon * 180) / Math.PI), round5((lat * 180) / Math.PI)];
}

function round5(v) {
  return Math.round(v * 1e5) / 1e5;
}

// --- shapefile (.shp) polygons ---
function readPolygons(shpPath) {
  const buf = readFileSync(shpPath);
  const shapeType = buf.readInt32LE(32);
  if (shapeType !== 5) {
    throw new Error(`Expected shape type 5 (Polygon), got ${shapeType}`);
  }

  const shapes = [];
  let off = 100;

  while (off < buf.length) {
    const contentLen = buf.readInt32BE(off + 4);
    const rec = buf.subarray(off + 8, off + 8 + contentLen * 2);
    off += 8 + contentLen * 2;

    if (rec.readInt32LE(0) === 0) {
      shapes.push([]);
      continue;
    }

    const numParts = rec.readInt32LE(36);
    const numPoints = rec.readInt32LE(40);
    const parts = [];
    for (let i = 0; i < numParts; i++) parts.push(rec.readInt32LE(44 + 4 * i));

    const pointBase = 44 + 4 * numParts;
    const points = [];
    for (let i = 0; i < numPoints; i++) {
      points.push(
        utmToLngLat(
          rec.readDoubleLE(pointBase + 16 * i),
          rec.readDoubleLE(pointBase + 16 * i + 8),
        ),
      );
    }

    const rings = [];
    for (let i = 0; i < parts.length; i++) {
      const start = parts[i];
      const end = i + 1 < parts.length ? parts[i + 1] : numPoints;
      const ring = points.slice(start, end);
      // GeoJSON requires a closed ring; shapefile rings usually are already.
      const [fx, fy] = ring[0];
      const [lx, ly] = ring[ring.length - 1];
      if (fx !== lx || fy !== ly) ring.push([fx, fy]);
      if (ring.length >= 4) rings.push(ring);
    }
    shapes.push(rings);
  }

  return shapes;
}

// --- attributes (.dbf) ---
function readAttributes(dbfPath) {
  const buf = readFileSync(dbfPath);
  const numRecords = buf.readUInt32LE(4);
  const headerLen = buf.readUInt16LE(8);
  const recordLen = buf.readUInt16LE(10);

  const fields = [];
  for (let off = 32; buf[off] !== 0x0d; off += 32) {
    const name = buf.subarray(off, off + 11).toString("latin1").replace(/\0.*$/, "");
    fields.push({ name, length: buf[off + 16] });
  }

  const rows = [];
  for (let i = 0; i < numRecords; i++) {
    let off = headerLen + i * recordLen + 1; // skip the deletion flag
    const row = {};
    for (const field of fields) {
      row[field.name] = buf.subarray(off, off + field.length).toString("utf8").trim();
      off += field.length;
    }
    rows.push(row);
  }

  return rows;
}

/**
 * The raw Rd_name field carries typos — "Mun. Rd", "Brgy.. Rd.", "Brgy. Rd",
 * "Mun Rd.", "National Rd." — which would otherwise become distinct classes.
 */
function normalizeClass(rdName) {
  const v = rdName.toLowerCase().replace(/[.\s]/g, "");
  if (v.startsWith("national")) return "national";
  if (v.startsWith("provincial")) return "provincial";
  if (v.startsWith("mun")) return "municipal";
  if (v.startsWith("brgy")) return "barangay";
  if (v.startsWith("church")) return "church";
  if (v.startsWith("school")) return "school";
  return "other";
}

/** "csnmanila" is a typo for Can-manila; one row has no Loc at all. */
function normalizeBarangay(loc) {
  const trimmed = loc.trim();
  if (!trimmed) return null;
  return /^csn\s*manila$/i.test(trimmed) ? "Can-manila" : trimmed;
}

function main() {
  const base = process.argv[2];
  if (!base) {
    console.error('Usage: node scripts/convert-official-roads.mjs "/path/to/ROADS UPDATED"');
    process.exit(1);
  }

  const shapes = readPolygons(`${base}.shp`);
  const attrs = readAttributes(`${base}.dbf`);

  if (shapes.length !== attrs.length) {
    throw new Error(`Geometry/attribute mismatch: ${shapes.length} vs ${attrs.length}`);
  }

  const features = [];
  const classCounts = {};
  const barangays = new Set();
  let latMin = Infinity, latMax = -Infinity, lngMin = Infinity, lngMax = -Infinity;

  for (let i = 0; i < shapes.length; i++) {
    const rings = shapes[i];
    if (rings.length === 0) continue;

    const roadClass = normalizeClass(attrs[i].Rd_name ?? "");
    const barangay = normalizeBarangay(attrs[i].Loc ?? "");
    classCounts[roadClass] = (classCounts[roadClass] ?? 0) + 1;
    if (barangay) barangays.add(barangay);

    for (const ring of rings) {
      for (const [lng, lat] of ring) {
        if (lat < latMin) latMin = lat;
        if (lat > latMax) latMax = lat;
        if (lng < lngMin) lngMin = lng;
        if (lng > lngMax) lngMax = lng;
      }
    }

    features.push({
      type: "Feature",
      properties: { class: roadClass, barangay },
      geometry: { type: "Polygon", coordinates: rings },
    });
  }

  // Assertions, not a unit test: this file is generated once and then trusted.
  if (features.length !== EXPECTED_FEATURES) {
    throw new Error(`Expected ${EXPECTED_FEATURES} features, produced ${features.length}`);
  }
  if (
    latMin < EXPECTED_BBOX.latMin || latMax > EXPECTED_BBOX.latMax ||
    lngMin < EXPECTED_BBOX.lngMin || lngMax > EXPECTED_BBOX.lngMax
  ) {
    throw new Error(
      `Reprojected bbox outside Basey: lat ${latMin}..${latMax}, lng ${lngMin}..${lngMax}`,
    );
  }

  writeFileSync(
    OUTPUT,
    JSON.stringify({
      type: "FeatureCollection",
      properties: {
        source: "Municipality of Basey GIS — ROADS UPDATED",
        crsOriginal: "WGS_1984_UTM_Zone_51N",
        convertedAt: new Date().toISOString().slice(0, 10),
        note: "Carriageway polygons, not centerlines. Not routable; used to classify road access and propose drop-off points.",
      },
      features,
    }),
  );

  console.log(`Wrote ${features.length} road polygons to ${OUTPUT}`);
  console.log("classes:", classCounts);
  console.log(`barangays tagged: ${barangays.size}`);
  console.log(
    `bbox: lat ${latMin.toFixed(5)}..${latMax.toFixed(5)}  lng ${lngMin.toFixed(5)}..${lngMax.toFixed(5)}`,
  );
}

main();
