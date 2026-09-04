import type { GeoLocation } from "./storage/schema";
import { z } from "./zod";

const POSITION_MAX_AGE_MS = 120_000;
const POSITION_TIMEOUT_MS = 8000;

const REVERSE_GEOCODE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";

const COORDINATE_DECIMALS = 4;

/** How precise a coordinate is kept, wherever one is written down - the device's or a typed one. */
export function roundCoordinate(value: number): number {
  return Number(value.toFixed(COORDINATE_DECIMALS));
}

function currentPosition(): Promise<GeolocationCoordinates | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve(null);

      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => resolve(position.coords),
      () => resolve(null),
      {
        enableHighAccuracy: false,
        timeout: POSITION_TIMEOUT_MS,
        maximumAge: POSITION_MAX_AGE_MS
      }
    );
  });
}

const placeSchema = z.object({
  city: z.string().optional(),
  locality: z.string().optional(),
  principalSubdivision: z.string().optional(),
  countryName: z.string().optional()
});

async function reverseGeocode({ latitude, longitude }: {
  latitude: number;
  longitude: number;
}): Promise<string | null> {
  try {
    const response = await fetch(`${REVERSE_GEOCODE_URL}?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
    if (!response.ok) {
      return null;
    }

    const parsed = placeSchema.safeParse(await response.json());
    if (!parsed.success) {
      return null;
    }

    const place = parsed.data;

    return place.city || place.locality || place.principalSubdivision || place.countryName || null;
  } catch {
    return null;
  }
}

async function detectLocation(): Promise<GeoLocation | null> {
  const coords = await currentPosition();
  if (!coords) {
    return null;
  }

  const latitude = roundCoordinate(coords.latitude);
  const longitude = roundCoordinate(coords.longitude);
  const name = await reverseGeocode({
    latitude,
    longitude
  });

  return {
    name: name ?? `${latitude}, ${longitude}`,
    latitude,
    longitude
  };
}

let inFlight: Promise<GeoLocation | null> | null = null;

export function deviceLocation(): Promise<GeoLocation | null> {
  inFlight ??= detectLocation();

  return inFlight;
}
