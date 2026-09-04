import type { GeoLocation } from "./storage/schema";
import { z } from "./zod";

const POSITION_MAX_AGE_MS = 120_000;
const POSITION_TIMEOUT_MS = 8000;

/**
 * What a reader who asked outright is given, which has to outlast them reading the browser's prompt
 * and deciding. The short timeout is for the silent read on load, where nothing is waiting on a
 * person; racing a human with it is how a granted location arrived after the code had given up.
 */
const ASKED_TIMEOUT_MS = 120_000;

const REVERSE_GEOCODE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";

const COORDINATE_DECIMALS = 4;

/**
 * Whether the browser would hand the position over without asking. The extension declares no
 * `geolocation` permission - Chromium refuses to make that one optional, and an extension page
 * raises the ordinary site prompt anyway - so the site's own answer is the only one that matters.
 *
 * `prompt` counts as no: a page that reads the device on load would raise that prompt at a moment
 * the reader asked for nothing.
 */
export async function hasLocationAccess(): Promise<boolean> {
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });

    return status.state === "granted";
  } catch {
    return false;
  }
}

/** How precise a coordinate is kept, wherever one is written down - the device's or a typed one. */
export function roundCoordinate(value: number): number {
  return Number(value.toFixed(COORDINATE_DECIMALS));
}

function currentPosition(timeoutMs: number): Promise<GeolocationCoordinates | null> {
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
        timeout: timeoutMs,
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

  return locationFrom(await currentPosition(POSITION_TIMEOUT_MS));
}

/** Coordinates given a name, or named after themselves where nothing can be found to call them. */
async function locationFrom(coords: GeolocationCoordinates | null): Promise<GeoLocation | null> {
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
/**
 * The reader asking outright, which is the one moment the prompt belongs: this skips the guard and
 * lets `getCurrentPosition` raise the browser's own question.
 */
export async function askDeviceLocation(): Promise<GeoLocation | null> {
  inFlight = null;

  return locationFrom(await currentPosition(ASKED_TIMEOUT_MS));
}

export function deviceLocation(): Promise<GeoLocation | null> {
  inFlight ??= detectLocation().then(fix => {
    if (!fix) {
      inFlight = null;
    }

    return fix;
  });

  return inFlight;
}
