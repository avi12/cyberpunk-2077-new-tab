import { fetchJson } from "@/lib/fetch";
import type { GeoLocation } from "@/lib/storage/schema";
import { z } from "@/lib/zod";

const POSITION_MAX_AGE_MS = 120_000;
const POSITION_TIMEOUT_MS = 8000;

/**
 * What a reader who asked outright is given. Long, because it has to outlast a browser that does
 * raise a prompt and a human reading it - Chromium grants the manifest permission outright and asks
 * nothing, but a browser that asks instead would otherwise be raced. The short timeout is for the
 * silent read on load, where nobody is waiting on an answer.
 */
const ASKED_TIMEOUT_MS = 120_000;

const REVERSE_GEOCODE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";

const REVERSE_GEOCODE_LANGUAGE = "en";

const COORDINATE_DECIMALS = 4;

/**
 * Whether the browser would hand the position over without asking, and where it would not, which of
 * the two nos it is. The extension declares `geolocation`, which Chromium answers by granting it to
 * the extension's own pages - so this reads `granted` there and nothing below it ever runs.
 *
 * It is still asked, for the browser that does not do that. `prompt` counts as no: a page that read
 * the device on load would raise a question at a moment the reader asked for nothing.
 */
export async function locationAccess() {
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });

    return status.state;
  } catch {
    return "prompt";
  }
}

async function hasLocationAccess() {
  return await locationAccess() === "granted";
}

/** How precise a coordinate is kept, wherever one is written down - the device's or a typed one. */
export function roundCoordinate(value: number) {
  return Number(value.toFixed(COORDINATE_DECIMALS));
}

/**
 * Why the device gave nothing, because the three reasons want three different sentences. Being told
 * no is not the same as a machine that cannot place itself, and neither is worth the advice the
 * other one needs - a reader whose Windows has location switched off was being told to check a
 * prompt they were never shown.
 */
export enum LocationRefusal {
  blocked = "blocked",
  unavailable = "unavailable",
  timedOut = "timed-out"
}

/** The browser's own codes, read off the error rather than restated as numbers here. */
function refusalFor(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return LocationRefusal.blocked;
  }

  if (error.code === error.TIMEOUT) {
    return LocationRefusal.timedOut;
  }

  return LocationRefusal.unavailable;
}

function isRefusal(answer: GeolocationCoordinates | LocationRefusal): answer is LocationRefusal {
  return typeof answer === "string";
}

function currentPosition(timeoutMs: number) {
  return new Promise<GeolocationCoordinates | LocationRefusal>(resolve => {
    if (!navigator.geolocation) {
      resolve(LocationRefusal.unavailable);

      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => resolve(position.coords),
      error => resolve(refusalFor(error)),
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
}) {
  const url = new URL(REVERSE_GEOCODE_URL);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("localityLanguage", REVERSE_GEOCODE_LANGUAGE);

  const place = await fetchJson({
    url,
    schema: placeSchema
  });
  if (!place) {
    return null;
  }

  return place.city || place.locality || place.principalSubdivision || place.countryName || null;
}

async function detectLocation() {
  /*
   * The device is never touched on a hunch. Where the permission was not granted outright, this read
   * is not a question the reader ever sees - it is either a prompt raised at a moment they asked for
   * nothing, or a refusal already decided on and paid for with the timeout.
   */
  if (!await hasLocationAccess()) {
    return null;
  }

  const answer = await currentPosition(POSITION_TIMEOUT_MS);
  if (isRefusal(answer)) {
    return null;
  }

  return locationFrom(answer);
}

/** Coordinates given a name, or named after themselves where nothing can be found to call them. */
async function locationFrom(coords: GeolocationCoordinates) {
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

/** A reading, or the reason there is none - which is what the panel has to be able to say out loud. */
export type AskedLocation =
  | {
    isFound: true;
    location: GeoLocation;
  }
  | {
    isFound: false;
    refusal: LocationRefusal;
  };

/**
 * The reader asking outright, which is the one moment the prompt belongs: this skips the guard and
 * lets `getCurrentPosition` raise the browser's own question.
 */
export async function askDeviceLocation(): Promise<AskedLocation> {
  inFlight = null;
  const answer = await currentPosition(ASKED_TIMEOUT_MS);
  if (isRefusal(answer)) {
    return {
      isFound: false,
      refusal: answer
    };
  }

  return {
    isFound: true,
    location: await locationFrom(answer)
  };
}

export function deviceLocation() {
  inFlight ??= detectLocation().then(fix => {
    if (!fix) {
      inFlight = null;
    }

    return fix;
  });

  return inFlight;
}
