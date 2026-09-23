import { nonEmptyTextSchema } from "@/features/companion/model";
import { fetchJson } from "@/lib/fetch";
import type { GeoLocation } from "@/lib/storage/schema";
import { geoLocationSchema } from "@/lib/storage/schema";
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

/**
 * Where the connection says the reader is, for the devices that will not say themselves - a Firefox
 * whose position provider cannot reach anything, a desktop with no radios to be placed by, a reader
 * who told the browser no. Keyless and `Access-Control-Allow-Origin: *`, so it costs no permission
 * and no host entry, like every other address here.
 *
 * City-level and no better, which is all the weather ever needed: Google is asked for the sky over a
 * place by name, so anywhere inside a town is the same question. It follows the connection rather
 * than the device, so a VPN moves it - which is why a reader is told where the reading came from and
 * can type over it.
 */
const CONNECTION_LOCATION_URL = "https://ipwho.is/";

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

/**
 * Where a place is, which is the half of `GeoLocation` that is a measurement rather than a word -
 * taken off the one schema that already says what a coordinate may be, so the bounds are stated in
 * exactly one file however a reading arrived.
 */
const coordinatesSchema = geoLocationSchema.omit({ name: true });

/** The service answers `success: false` rather than an error status when it will not say. */
const connectionPlaceSchema = coordinatesSchema.extend({
  success: z.literal(true),
  city: nonEmptyTextSchema.optional(),
  region: nonEmptyTextSchema.optional(),
  country: nonEmptyTextSchema.optional()
});

/**
 * The one way a place is built here, so the connection's town and the device's fix cannot end up
 * shaped differently. A name nothing could find falls back to the coordinates themselves, which is
 * the only naming rule there is and is therefore written down once.
 */
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

/**
 * A place, near enough, without asking the device anything. Named by what the service already
 * knows, so this is the one location that costs no reverse geocode.
 */
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

/** Every field optional and none of them allowed to be empty, which is what `??` below relies on. */
const placeSchema = z.object({
  city: nonEmptyTextSchema.optional(),
  locality: nonEmptyTextSchema.optional(),
  principalSubdivision: nonEmptyTextSchema.optional(),
  countryName: nonEmptyTextSchema.optional()
});

/** Only ever handed coordinates that satisfied `coordinatesSchema`, so nonsense never goes out. */
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

/**
 * Where the reader is, as well as this page can work it out without asking them anything.
 *
 * The device is never touched on a hunch. Where the permission was not granted outright, that read
 * is not a question the reader ever sees - it is either a prompt raised at a moment they asked for
 * nothing, or a refusal already decided on and paid for with the timeout. Either way the connection
 * is asked instead, which raises nothing and is better than the fallback city by a continent.
 */
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

/**
 * Coordinates given a name, or named after themselves where nothing can be found to call them.
 *
 * The device's own numbers are checked before they are used for anything, which the connection's
 * already were: they arrive from an implementation this page does not own, they are about to be
 * sent to a third party to be named, and they end up written into a setting. A fix that fails the
 * check is no fix, and the caller falls back the same way it would for a refusal.
 */
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

/**
 * One reading of the device per page, shared by everything that asks for it. A miss is not kept:
 * the location can be handed over after the page was drawn, and the read that follows the grant has
 * to be free to find what the one before it could not.
 */
let inFlight: Promise<GeoLocation | null> | null = null;

/** Which of the two answers a reading came from, since the panel says so and they are not equals. */
export enum LocationSource {
  device = "device",
  connection = "connection"
}

/** A reading, or the reason there is none - which is what the panel has to be able to say out loud. */
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

/** The device's answer as a place, where it gave one - a no of either kind is simply no place. */
function devicePlace(answer: GeolocationCoordinates | LocationRefusal) {
  if (isRefusal(answer)) {
    return Promise.resolve(null);
  }

  return locationFrom(answer);
}

/**
 * Why there is no reading, for the panel to say out loud. A device that answered with coordinates
 * nothing could make a place of is `unavailable` rather than any of the nos it never gave.
 */
function refusalOf(answer: GeolocationCoordinates | LocationRefusal) {
  if (isRefusal(answer)) {
    return answer;
  }

  return LocationRefusal.unavailable;
}

/**
 * The reader asking outright, which is the one moment the prompt belongs: this skips the guard and
 * lets `getCurrentPosition` raise the browser's own question.
 *
 * A fix becomes the page's shared reading rather than only this caller's, so whatever asks next is
 * answered by the press - a second trip to the device could be guarded away by a browser that says
 * `prompt` even once it has answered, and would then overwrite the fix with nothing.
 */
export async function askDeviceLocation(): Promise<AskedLocation> {
  inFlight = null;
  const answer = await currentPosition(ASKED_TIMEOUT_MS);
  const asked = devicePlace(answer);
  const fromDevice = await asked;
  if (fromDevice) {
    inFlight = asked;

    return {
      isFound: true,
      source: LocationSource.device,
      location: fromDevice
    };
  }

  /* A press that reached no device is still a reader asking to be found, so the connection answers. */
  const fromConnection = await connectionLocation();
  if (!fromConnection) {
    return {
      isFound: false,
      refusal: refusalOf(answer)
    };
  }

  inFlight = Promise.resolve(fromConnection);

  return {
    isFound: true,
    source: LocationSource.connection,
    location: fromConnection
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
