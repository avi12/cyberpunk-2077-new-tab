import { nonEmptyTextSchema } from "@/features/companion/model";
import { fetchJson } from "@/lib/fetch";
import type { GeoLocation } from "@/lib/storage/schema";
import { geoLocationSchema } from "@/lib/storage/schema";
import { z } from "@/lib/zod";

const POSITION_MAX_AGE_MS = 120_000;
const POSITION_TIMEOUT_MS = 8000;

/** Long enough to outlast a browser that raises a prompt and the human reading it. */
const ASKED_TIMEOUT_MS = 120_000;

const REVERSE_GEOCODE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";

/**
 * City-level location by IP, for devices that will not place themselves. Keyless and CORS-open, so it
 * needs no permission. A VPN moves it, which is why the panel says where a reading came from.
 */
const CONNECTION_LOCATION_URL = "https://ipwho.is/";

const REVERSE_GEOCODE_LANGUAGE = "en";

const COORDINATE_DECIMALS = 4;

/**
 * Chromium grants the manifest's `geolocation` to extension pages outright, so this reads `granted`
 * there. `prompt` counts as no: reading the device on load would raise an unasked-for prompt.
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

export function roundCoordinate(value: number) {
  return Number(value.toFixed(COORDINATE_DECIMALS));
}

export enum LocationRefusal {
  blocked = "blocked",
  unavailable = "unavailable",
  timedOut = "timed-out"
}

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

export const coordinatesSchema = geoLocationSchema.omit({ name: true });

/** The service answers `success: false` rather than an error status when it will not say. */
const connectionPlaceSchema = coordinatesSchema.extend({
  success: z.literal(true),
  city: nonEmptyTextSchema.optional(),
  region: nonEmptyTextSchema.optional(),
  country: nonEmptyTextSchema.optional()
});

function placeNamed({ latitude, longitude, name }: {
  latitude: number;
  longitude: number;
  name?: string;
}) {
  return {
    name: name ?? `${latitude}, ${longitude}`,
    latitude,
    longitude
  };
}

async function connectionLocation() {
  const place = await fetchJson({
    url: CONNECTION_LOCATION_URL,
    schema: connectionPlaceSchema
  });
  if (!place) {
    return null;
  }

  return placeNamed({
    latitude: roundCoordinate(place.latitude),
    longitude: roundCoordinate(place.longitude),
    name: place.city ?? place.region ?? place.country
  });
}

/** Fields are non-empty when present, which the `??` chain below relies on. */
const placeSchema = z.object({
  city: nonEmptyTextSchema.optional(),
  locality: nonEmptyTextSchema.optional(),
  principalSubdivision: nonEmptyTextSchema.optional(),
  countryName: nonEmptyTextSchema.optional()
});

async function reverseGeocode({ latitude, longitude }: z.infer<typeof coordinatesSchema>) {
  const url = new URL(REVERSE_GEOCODE_URL);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("localityLanguage", REVERSE_GEOCODE_LANGUAGE);

  const place = await fetchJson({
    url,
    schema: placeSchema
  });

  return place?.city ?? place?.locality ?? place?.principalSubdivision ?? place?.countryName;
}

/** Never prompts: without an outright grant, or on a refusal, the connection is asked instead. */
async function detectLocation() {
  if (!await hasLocationAccess()) {
    return connectionLocation();
  }

  const answer = await currentPosition(POSITION_TIMEOUT_MS);
  if (isRefusal(answer)) {
    return connectionLocation();
  }

  return locationFrom(answer);
}

/** Validated before the coordinates are sent to a third party or written into a setting. */
async function locationFrom(coords: GeolocationCoordinates) {
  const parsed = coordinatesSchema.safeParse({
    latitude: roundCoordinate(coords.latitude),
    longitude: roundCoordinate(coords.longitude)
  });
  if (!parsed.success) {
    return null;
  }

  const name = await reverseGeocode(parsed.data);

  return placeNamed({
    ...parsed.data,
    name
  });
}

/** A miss is not kept: access can be granted later, and the next read must be free to find it. */
let sharedLocationRead: Promise<GeoLocation | null> | null = null;

export enum LocationSource {
  device = "device",
  connection = "connection"
}

export type AskedLocation =
  | {
    isFound: true;
    source: LocationSource;
    location: GeoLocation;
  }
  | {
    isFound: false;
    refusal: LocationRefusal;
  };

function devicePlace(answer: GeolocationCoordinates | LocationRefusal) {
  if (isRefusal(answer)) {
    return Promise.resolve(null);
  }

  return locationFrom(answer);
}

/** Coordinates that could not be made into a place count as `unavailable`. */
function refusalOf(answer: GeolocationCoordinates | LocationRefusal) {
  if (isRefusal(answer)) {
    return answer;
  }

  return LocationRefusal.unavailable;
}

/**
 * The fix is never stored, so this forgets all of it. The geolocation permission stays: Chromium
 * refuses it as optional, so the manifest requires it.
 */
export function forgetDeviceLocation() {
  sharedLocationRead = null;
}

/**
 * Skips the access guard so the browser can prompt - only from a reader's press. The fix becomes the
 * shared read, because a browser may keep saying `prompt` after answering and a second read would be
 * guarded away and overwrite the fix with nothing.
 */
export async function askDeviceLocation(): Promise<AskedLocation> {
  sharedLocationRead = null;
  const answer = await currentPosition(ASKED_TIMEOUT_MS);
  const asked = devicePlace(answer);
  const fromDevice = await asked;
  if (fromDevice) {
    sharedLocationRead = asked;

    return {
      isFound: true,
      source: LocationSource.device,
      location: fromDevice
    };
  }

  const fromConnection = await connectionLocation();
  if (!fromConnection) {
    return {
      isFound: false,
      refusal: refusalOf(answer)
    };
  }

  sharedLocationRead = Promise.resolve(fromConnection);

  return {
    isFound: true,
    source: LocationSource.connection,
    location: fromConnection
  };
}

export function deviceLocation() {
  sharedLocationRead ??= detectLocation().then(fix => {
    if (!fix) {
      sharedLocationRead = null;
    }

    return fix;
  });

  return sharedLocationRead;
}
