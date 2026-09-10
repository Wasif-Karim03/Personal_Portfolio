/**
 * Coordinate formatting shared by the server render and the scroll readout.
 * Client-safe: it imports nothing, so d3 stays out of the browser bundle.
 */

/**
 * "23.84°N 090.40°E". Fixed digits on both axes, so a ticking readout set in a
 * monospace never changes width.
 */
export function formatCoordinates(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  const latText = Math.abs(lat).toFixed(2).padStart(5, '0');
  const lonText = Math.abs(lon).toFixed(2).padStart(6, '0');
  return `${latText}°${ns} ${lonText}°${ew}`;
}

export const kilometres = new Intl.NumberFormat('en-US');
