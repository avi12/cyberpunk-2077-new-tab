import { z } from "zod";

// An extension page runs under the extension's CSP, which blocks the `new Function` probe Zod runs
// on first object-schema build. jitless skips the probe entirely.
z.config({ jitless: true });

export { z };
