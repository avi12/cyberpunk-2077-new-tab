/**
 * A file handed over by dropping it rather than picked out of a dialog. The zone stamps itself
 * `data-dropping` for as long as a file is over it, so the highlight is the stylesheet's business
 * and no component has to hold that state.
 *
 * `accept` is the same string the file input carries, so what a zone takes is written once and both
 * the dialog and the drop read it from there.
 *
 * A file dropped anywhere else is a file the browser navigates to, which would take the page with
 * it - so for as long as a zone is on screen, the document swallows the drops that miss.
 *
 * An attachment rather than an action, so a zone whose `accept` changes is rebuilt on the spot: the
 * listeners are four and the state is a counter, and nothing can be mid-drop while the answer to
 * what a zone takes is changing.
 */

type DropZoneOptions = {
  accept: string;
  onFile: (file: File) => void;
};

const DROPPING_ATTRIBUTE = "data-dropping";

let zoneCount = 0;

function swallowStray(e: DragEvent) {
  e.preventDefault();

  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = "none";
  }
}

function watchStrays() {
  zoneCount += 1;

  if (zoneCount > 1) {
    return;
  }

  document.addEventListener("dragover", swallowStray);
  document.addEventListener("drop", swallowStray);
}

function unwatchStrays() {
  zoneCount -= 1;

  if (zoneCount > 0) {
    return;
  }

  document.removeEventListener("dragover", swallowStray);
  document.removeEventListener("drop", swallowStray);
}

function carriesFile(e: DragEvent) {
  return e.dataTransfer?.types.includes("Files") ?? false;
}

function isAccepted({ file, accept }: {
  file: File;
  accept: string;
}) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  return accept.split(",").some(entry => {
    const pattern = entry.trim().toLowerCase();
    if (pattern.startsWith(".")) {
      return name.endsWith(pattern);
    }

    if (pattern.endsWith("/*")) {
      return type.startsWith(pattern.slice(0, -1));
    }

    return type === pattern;
  });
}

export function dropZone({ accept, onFile }: DropZoneOptions) {
  return (node: HTMLElement) => {
    // `dragleave` fires for every child the pointer crosses, so the depth is what says it has left.
    let depth = 0;

    function mark(isOver: boolean) {
      node.toggleAttribute(DROPPING_ATTRIBUTE, isOver);
    }

    function onDragEnter(e: DragEvent) {
      if (!carriesFile(e)) {
        return;
      }

      depth += 1;
      mark(true);
    }

    function onDragOver(e: DragEvent) {
      if (!carriesFile(e)) {
        return;
      }

      // Stopped here so the document's own handler leaves the copy cursor alone over a real target.
      e.preventDefault();
      e.stopPropagation();

      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
    }

    function onDragLeave(e: DragEvent) {
      if (!carriesFile(e)) {
        return;
      }

      depth -= 1;

      if (depth < 1) {
        depth = 0;
        mark(false);
      }
    }

    function onDrop(e: DragEvent) {
      e.preventDefault();
      e.stopPropagation();
      depth = 0;
      mark(false);

      const file = e.dataTransfer?.files[0];
      if (!file || !isAccepted({
        file,
        accept
      })) {
        return;
      }

      onFile(file);
    }

    const listeners = new AbortController();
    const { signal } = listeners;
    node.addEventListener("dragenter", onDragEnter, { signal });
    node.addEventListener("dragover", onDragOver, { signal });
    node.addEventListener("dragleave", onDragLeave, { signal });
    node.addEventListener("drop", onDrop, { signal });
    watchStrays();

    return () => {
      listeners.abort();
      unwatchStrays();
    };
  };
}
