/**
 * Geometry for FIG. 04, the flight: Bangladesh to Ohio, 10 August 2022.
 *
 * Build time only. The globe, graticule and route are projected here with
 * d3-geo and reach the page as finished SVG paths, together with the samples
 * the scroll readout steps through, so none of d3 ships to the browser.
 *
 * The line is the great circle between the two places, the shortest path over
 * the globe. It is not the flights actually taken, and the scene says so.
 */
import {
  geoDistance,
  geoGraticule10,
  geoInterpolate,
  geoOrthographic,
  geoPath,
} from 'd3-geo';
import { feature } from 'topojson-client';
import landTopology from 'world-atlas/land-110m.json';

export interface Place {
  label: string;
  lon: number;
  lat: number;
}

/** Hazrat Shahjalal International, where flights out of Bangladesh leave from. */
export const origin: Place = { label: 'DAC · Dhaka', lon: 90.3978, lat: 23.8433 };

/** Ohio Wesleyan University, in Delaware, Ohio. */
export const destination: Place = { label: 'Delaware, OH', lon: -83.068, lat: 40.2987 };

/** The viewBox is SIZE × SIZE. */
const SIZE = 800;
const MARGIN = 28;
const SAMPLES = 200;
const EARTH_RADIUS_KM = 6371;

const round = (value: number, places: number) => Number(value.toFixed(places));

const from: [number, number] = [origin.lon, origin.lat];
const to: [number, number] = [destination.lon, destination.lat];
const along = geoInterpolate(from, to);
const [midLon, midLat] = along(0.5);

// Centred on the route's midpoint. The two ends are about 116° apart, so each
// sits roughly 58° from the centre and the whole arc stays on the visible side.
const projection = geoOrthographic()
  .rotate([-midLon, -midLat])
  .translate([SIZE / 2, SIZE / 2])
  .scale(SIZE / 2 - MARGIN)
  .clipAngle(90);
const path = geoPath(projection).digits(1);

function project(lon: number, lat: number): [number, number] {
  const point = projection([lon, lat]);
  if (!point) throw new Error(`(${lon}, ${lat}) is on the far side of the globe`);
  return [round(point[0], 1), round(point[1], 1)];
}

// The route as dense samples: screen position, coordinates for the readout, and
// cumulative drawn length, so the line's tip, the marker and the numbers all
// move together. Samples are evenly spaced in angle, so the fraction of samples
// passed is also the fraction of the distance flown.
const samples = Array.from({ length: SAMPLES }, (_, index) => {
  const [lon, lat] = along(index / (SAMPLES - 1));
  const [x, y] = project(lon, lat);
  return { x, y, lat: round(lat, 2), lon: round(lon, 2) };
});

const lengths: number[] = [];
let total = 0;
samples.forEach((sample, index) => {
  if (index > 0) {
    const previous = samples[index - 1];
    total += Math.hypot(sample.x - previous.x, sample.y - previous.y);
  }
  lengths.push(round(total, 1));
});

function marker(place: Place) {
  const [x, y] = project(place.lon, place.lat);
  // The label points away from the centre, so it never sits on the route.
  const left = x < SIZE / 2;
  return { ...place, x, y, labelX: left ? x - 14 : x + 14, anchor: left ? 'end' : 'start' };
}

const topology = landTopology as unknown as Parameters<typeof feature>[0];
const land = feature(topology, topology.objects.land);

export const flight = {
  size: SIZE,
  sphere: path({ type: 'Sphere' }) ?? '',
  land: path(land) ?? '',
  graticule: path(geoGraticule10()) ?? '',
  route: 'M' + samples.map((sample) => `${sample.x},${sample.y}`).join('L'),
  origin: marker(origin),
  destination: marker(destination),
  distanceKm: Math.round(geoDistance(from, to) * EARTH_RADIUS_KM),
  /** What the browser needs to scrub: [x, y, lat, lon] per sample, and lengths. */
  samples: samples.map((sample) => [sample.x, sample.y, sample.lat, sample.lon]),
  lengths,
  total: round(total, 1),
};
