import type { AccessRequest } from "./permissions";
import { hasAccess, requestAccess } from "./permissions";
import type { GeoLocation } from "./storage/schema";
import { z } from "./zod";

const POSITION_MAX_AGE_MS = 120_000;
const POSITION_TIMEOUT_MS = 8000;

const REVERSE_GEOCODE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";

const COORDINATE_DECIMALS = 4;

/**
 * The extension does not install with the reader's location, so every read of the device goes
 * through this one request - the asking and the checking cannot drift apart, and nothing else has
 * to spell the permission out a second time.
 */
const LOCATION_ACCESS: AccessRequest = {
  permissions: ["geolocation"]
};

export async function hasLocationAccess(): Promise<boolean> {
  return hasAccess(LOCATION_ACCESS);
}

/** Only ever called straight out of a click: a permission prompt needs the gesture that asked for it. */
export async function requestLocationAccess(): Promise<boolean> {
  return requestAccess(LOCATION_ACCESS);
}

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
  /*
   * The device is never touched on a hunch. Without the permission `getCurrentPosition` is not a
   * question the reader ever sees - it is a refusal the browser has already decided on, spent on
   * page load and paid for with the timeout - so the grant is what says whether there is anything
   * to ask at all.
   */
  if (!await hasLocationAccess()) {
    return null;
  }

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

/**
 * One reading of the device per page, shared by everything that asks for it. A miss is not kept:
 * the location can be handed over after the page was drawn, and the read that follows the grant has
 * to be free to find what the one before it could not.
 */
let inFlight: Promise<GeoLocation | null> | null = null;

/** Null whenever the device cannot be read - not granted, unavailable, or refused on the spot. */
export function deviceLocation(): Promise<GeoLocation | null> {
  inFlight ??= detectLocation().then(fix => {
    if (!fix) {
      inFlight = null;
    }

    return fix;
  });

  return inFlight;
}
