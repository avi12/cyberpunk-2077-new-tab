/**
 * Handing a file to the reader, and naming it.
 *
 * Shared rather than kept beside the settings export, which is where both of these started: the
 * netlinks export writes a file the same way, and a netlinks module reaching into the settings
 * feature for a helper is a dependency that says nothing true about either of them.
 */

/**
 * Dated, because a second export is a second file rather than "(1)".
 *
 * The ISO date rather than a formatted one: this is a filename, so it is sorted by a file manager
 * and read by whoever is looking for last week's copy - `2026-09-10` does both, and no locale puts
 * its own month names or slashes into it. A plain date carries no colons, which Windows would
 * refuse anyway.
 */
export function jsonFileName(stem: string) {
  return `${stem}-${Temporal.Now.plainDateISO()}.json`;
}

export function downloadFile({ name, contents, type }: {
  name: string;
  contents: BlobPart;
  type: string;
}) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const elAnchor = document.createElement("a");
  elAnchor.href = url;
  elAnchor.download = name;
  document.body.append(elAnchor);
  elAnchor.click();
  elAnchor.remove();
  URL.revokeObjectURL(url);
}
