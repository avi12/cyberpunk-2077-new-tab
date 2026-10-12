/** An ISO date rather than a locale format: it sorts in a file manager and has no slashes or colons. */
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
