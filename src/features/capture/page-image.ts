/**
 * The page re-rendered as a PNG through an SVG `foreignObject`, the way `html-to-image` does it.
 *
 * `captureVisibleTab` cannot be used: `activeTab` is only granted when invoked from outside the
 * extension's page, and `permissions.request` for `<all_urls>` never resolves here (measured).
 *
 * Known gaps: `backdrop-filter` does not apply inside `foreignObject`, and a cross-origin image
 * without CORS headers is dropped, since it would taint the canvas.
 */

const PSEUDO_ELEMENTS = ["::before", "::after"] as const;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

const PSEUDO_CLASS_PREFIX = "capture-pseudo-";

/**
 * Skipped because the physical twin is already copied. Writing both made the CSSOM regroup them into
 * shorthands where the last one won, and margins were lost (measured: `margin-block: 0px 16px;`
 * then `margin-block: 0px;`).
 */
const LOGICAL_BOX_PROPERTY = /(^|-)(block|inline)(-|$)/u;

/**
 * A resolved `height: auto` written back as pixels stops the last child's margin collapsing through
 * the box. Leaving it out still reproduces every element's height exactly (measured).
 */
const COLLAPSE_BLOCKING_PROPERTY = "height";

/** `foreignObject` has no top layer, so a copied dialog would land in the flow - and it is not wanted anyway. */
const TOP_LAYER_SELECTOR = "dialog[open], :popover-open";

const BACKGROUND_PROPERTIES = [
  "background-color",
  "background-image",
  "background-position",
  "background-size",
  "background-repeat",
  "background-attachment",
  "background-origin",
  "background-clip"
] as const;

const TRANSPARENT_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export async function capturePage() {
  const { scrollX, scrollY, devicePixelRatio } = window;
  /* `clientWidth` rather than `innerWidth`, which counts the scrollbar the page cannot draw in. */
  const { clientWidth: width, clientHeight: height } = document.documentElement;
  const clone = document.body.cloneNode(true);
  if (!(clone instanceof HTMLElement)) {
    throw new Error("the page has no body to copy");
  }

  const pseudoRules: string[] = [];

  const originals = [document.body, ...document.body.querySelectorAll<HTMLElement>("*")];
  const clones = [clone, ...clone.querySelectorAll<HTMLElement>("*")];

  copyStyles({
    originals,
    clones,
    pseudoRules
  });
  hideTopLayer({
    originals,
    clones
  });
  alignToScroll({
    clone,
    scrollX,
    scrollY
  });
  await inlineMedia({
    originals,
    clones
  });

  const svg = buildSvg({
    body: clone,
    backgroundDeclarations: takeBackground(clone),
    pseudoRules,
    width,
    height
  });

  return drawToPng({
    svg,
    width,
    height,
    scale: devicePixelRatio
  });
}

/** No stylesheet reaches the detached copy, so every computed property is inlined. */
function copyStyles({ originals, clones, pseudoRules }: {
  originals: HTMLElement[];
  clones: HTMLElement[];
  pseudoRules: string[];
}) {
  for (const [i, original] of originals.entries()) {
    const clone = clones[i];
    if (!clone) {
      continue;
    }

    clone.style.cssText = declarationsOf(getComputedStyle(original));
    collectPseudoRules({
      original,
      clone,
      iElement: i,
      pseudoRules
    });
  }
}

/** A pseudo-element has no node to carry a style attribute, so it gets a class and a real rule. */
function collectPseudoRules({ original, clone, iElement, pseudoRules }: {
  original: HTMLElement;
  clone: HTMLElement;
  iElement: number;
  pseudoRules: string[];
}) {
  for (const pseudo of PSEUDO_ELEMENTS) {
    const style = getComputedStyle(original, pseudo);
    const isDrawn = style.content !== "none" && style.content !== "normal";
    if (!isDrawn) {
      continue;
    }

    const className = `${PSEUDO_CLASS_PREFIX}${iElement}`;
    clone.classList.add(className);
    pseudoRules.push(`.${className}${pseudo}{${declarationsOf(style)}}`);
  }
}

/**
 * A `foreignObject` does not scroll, so the copy is offset instead. Positioned rather than
 * transformed: a transform would become the containing block for every `fixed` element inside.
 * This relies on `LOGICAL_BOX_PROPERTY` keeping the logical insets, which would overrule it, out.
 */
function alignToScroll({ clone, scrollX, scrollY }: {
  clone: HTMLElement;
  scrollX: number;
  scrollY: number;
}) {
  clone.style.position = "absolute";
  clone.style.left = `${-scrollX}px`;
  clone.style.top = `${-scrollY}px`;
}

/**
 * Asks the original, since `:popover-open` is live state a detached copy cannot answer. Runs after
 * `copyStyles`, whose whole-`cssText` assignment would wipe this.
 */
function hideTopLayer({ originals, clones }: {
  originals: HTMLElement[];
  clones: HTMLElement[];
}) {
  for (const [i, original] of originals.entries()) {
    const clone = clones[i];
    const isRaised = original.matches(TOP_LAYER_SELECTOR);
    if (clone && isRaised) {
      clone.style.display = "none";
    }
  }
}

/**
 * `getComputedStyle(element).cssText` is empty (measured), so the properties are walked by hand -
 * into one string rather than a `setProperty` each, since this runs for every element.
 */
function declarationsOf(style: CSSStyleDeclaration) {
  let declarations = "";
  for (const property of style) {
    const isCopied = property !== COLLAPSE_BLOCKING_PROPERTY && !LOGICAL_BOX_PROPERTY.test(property);
    if (isCopied) {
      declarations += `${property}:${style.getPropertyValue(property)};`;
    }
  }

  return declarations;
}

async function inlineMedia({ originals, clones }: {
  originals: HTMLElement[];
  clones: HTMLElement[];
}) {
  const [clone] = clones;
  await Promise.all([
    ...[...(clone?.querySelectorAll("video") ?? [])].map(async video => replaceVideo(video)),
    ...[...(clone?.querySelectorAll("img") ?? [])].map(async image => {
      image.src = await asDataUrl(image.src);
    }),
    ...originals.map(async (original, i) => inlineBackground({
      original,
      clone: clones[i]
    }))
  ]);
}

function replaceVideo(video: HTMLVideoElement) {
  const liveVideo = [...document.querySelectorAll("video")].find(candidate => candidate.src === video.src);
  const image = document.createElement("img");
  image.style.cssText = video.style.cssText;
  image.src = liveVideo ? currentFrameOf(liveVideo) : TRANSPARENT_PIXEL;
  video.replaceWith(image);
}

function currentFrameOf(video: HTMLVideoElement) {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")?.drawImage(video, 0, 0);

  return canvas.toDataURL("image/png");
}

/** Fresh per call: a shared global regex carries `lastIndex` across concurrent calls and drops matches. */
function urlPattern() {
  return /url\(["']?(?<source>blob:[^"')]+|https?:[^"')]+)["']?\)/gu;
}

/** Read from the original: the copy's `background-image` round trip through `cssText` was losing it. */
async function inlineBackground({ original, clone }: {
  original: HTMLElement;
  clone: HTMLElement | undefined;
}) {
  if (!clone) {
    return;
  }

  const { backgroundImage } = getComputedStyle(original);
  const sources = [...backgroundImage.matchAll(urlPattern())].map(match => match.groups?.source ?? "");
  if (sources.length === 0) {
    return;
  }

  const inlined = await Promise.all(sources.map(async source => asDataUrl(source)));
  let iSource = 0;
  clone.style.backgroundImage = backgroundImage.replace(urlPattern(), () => `url("${inlined[iSource++]}")`);
}

async function asDataUrl(source: string) {
  if (!source || source.startsWith("data:")) {
    return source || TRANSPARENT_PIXEL;
  }

  try {
    const blob = await (await fetch(source)).blob();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result)));
      reader.addEventListener("error", () => reject(new Error(`could not read ${source}`)));
      reader.readAsDataURL(blob);
    });
  } catch {
    return TRANSPARENT_PIXEL;
  }
}

/**
 * Moved from the body onto the SVG: inside a `foreignObject` the body's background paints in the flow
 * and buries the negative-z-index wallpaper, rather than going to the canvas (measured).
 */
function takeBackground(clone: HTMLElement) {
  let declarations = "";
  for (const property of BACKGROUND_PROPERTIES) {
    declarations += `${property}:${clone.style.getPropertyValue(property)};`;
    clone.style.removeProperty(property);
  }

  return declarations;
}

/** Built through the DOM so the markup is well-formed XML, which `foreignObject` requires. */
function buildSvg({ body, backgroundDeclarations, pseudoRules, width, height }: {
  body: HTMLElement;
  backgroundDeclarations: string;
  pseudoRules: string[];
  width: number;
  height: number;
}) {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.style.cssText = backgroundDeclarations;

  const frame = document.createElementNS(SVG_NAMESPACE, "foreignObject");
  frame.setAttribute("x", "0");
  frame.setAttribute("y", "0");
  frame.setAttribute("width", String(width));
  frame.setAttribute("height", String(height));

  const rules = document.createElementNS(XHTML_NAMESPACE, "style");
  rules.textContent = pseudoRules.join("");

  body.setAttribute("xmlns", XHTML_NAMESPACE);
  frame.append(rules, body);
  svg.append(frame);

  return new XMLSerializer().serializeToString(svg);
}

async function drawToPng({ svg, width, height, scale }: {
  svg: string;
  width: number;
  height: number;
  scale: number;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("this browser gave no 2d context to draw into");
  }

  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  context.scale(scale, scale);
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/png");
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("the page could not be drawn as an image")));
    image.src = source;
  });
}
