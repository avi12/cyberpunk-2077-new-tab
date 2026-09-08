/**
 * The page as a PNG, drawn with nothing but the platform.
 *
 * `captureVisibleTab` would hand back the compositor's own output and be perfect, and it cannot be
 * used: it needs `<all_urls>` or `activeTab`, and neither is reachable from a button inside the
 * extension's own page - `activeTab` is granted only when the extension is invoked from outside it,
 * and `permissions.request` for `<all_urls>` never resolves here at all, measured with and without a
 * toolbar action to anchor its prompt.
 *
 * So the page is re-rendered instead, the way `html-to-image` does it and for the same reason, but
 * written here rather than taken as a dependency. The whole trick is that SVG can carry HTML:
 * a `foreignObject` holding a copy of the DOM is a picture the browser will draw onto a canvas.
 *
 * Two things it cannot reproduce, both worth knowing rather than discovering:
 *
 * - `backdrop-filter` does not apply inside `foreignObject`, so the blur behind a panel is missing
 *   from the picture. Two rules in this app use it.
 * - Anything the copy cannot reach becomes nothing: a cross-origin image with no CORS headers is
 *   dropped rather than drawn, because tainting the canvas would make it unreadable.
 */

/** A copy is only as good as the styles carried with it, and computed styles are the only complete set. */
const PSEUDO_ELEMENTS = ["::before", "::after"] as const;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

/** Where the generated pseudo-element rules are hung, since inline styles cannot express them. */
const PSEUDO_CLASS_PREFIX = "capture-pseudo-";

/**
 * What the reader raised over the page, which is not the page.
 *
 * `foreignObject` has no top layer, so a copied dialog would come back as an ordinary block in the
 * flow - out of position, without its backdrop, sitting on the very thing it was raised above. It
 * would not be wanted even if it landed correctly: the panel someone pressed a button in is not
 * part of the picture they asked for.
 */
const TOP_LAYER_SELECTOR = "dialog[open], :popover-open";

/** Every longhand, so nothing rests on whether the shorthand happens to serialise back out. */
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

/** A blank frame is worth more than a broken picture, so a source that will not load is dropped. */
const TRANSPARENT_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export async function capturePage() {
  const { innerWidth: width, innerHeight: height, devicePixelRatio } = window;
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
  await inlineMedia({
    originals,
    clones
  });

  const svg = buildSvg({
    body: clone,
    ground: takeBackground(clone),
    pseudoRules,
    width,
    height
  });

  return draw({
    svg,
    width,
    height,
    scale: devicePixelRatio
  });
}

/**
 * Every computed property, written onto the copy as an inline style.
 *
 * Verbose and the only complete answer: the copy is torn out of the document, so no stylesheet
 * reaches it and anything not written down here is simply lost.
 */
function copyStyles({ originals, clones, pseudoRules }: {
  originals: HTMLElement[];
  clones: HTMLElement[];
  pseudoRules: string[];
}) {
  for (const [index, original] of originals.entries()) {
    const clone = clones[index];
    if (!clone) {
      continue;
    }

    clone.style.cssText = declarationsOf(getComputedStyle(original));
    collectPseudoRules({
      original,
      clone,
      index,
      pseudoRules
    });
  }
}

/** A pseudo-element has no node to carry a style attribute, so it gets a class and a real rule. */
function collectPseudoRules({ original, clone, index, pseudoRules }: {
  original: HTMLElement;
  clone: HTMLElement;
  index: number;
  pseudoRules: string[];
}) {
  for (const pseudo of PSEUDO_ELEMENTS) {
    const style = getComputedStyle(original, pseudo);
    const isDrawn = style.content !== "none" && style.content !== "normal";
    if (!isDrawn) {
      continue;
    }

    const className = `${PSEUDO_CLASS_PREFIX}${index}`;
    clone.classList.add(className);
    pseudoRules.push(`.${className}${pseudo}{${declarationsOf(style)}}`);
  }
}

/**
 * Asked of the original rather than the copy, and answered after the styles are on.
 *
 * `:popover-open` is a live state rather than an attribute, so a copy torn out of the document
 * cannot answer it - only the element still in the page knows. And `copyStyles` assigns `cssText`
 * whole, which would wipe anything written before it.
 */
function hideTopLayer({ originals, clones }: {
  originals: HTMLElement[];
  clones: HTMLElement[];
}) {
  for (const [index, original] of originals.entries()) {
    const clone = clones[index];
    const isRaised = original.matches(TOP_LAYER_SELECTOR);
    if (clone && isRaised) {
      clone.style.display = "none";
    }
  }
}

/**
 * A computed style written out as declarations, because `cssText` on one is empty.
 *
 * Measured here on 2026-09-08: reading `getComputedStyle(element).cssText` gives back an empty
 * string for every element on the page - a computed declaration is not serializable that way, and a
 * copy relying on it carries no styling whatsoever. The properties have to be walked and written by
 * hand, which is what every library that does this ends up doing.
 *
 * Built as one string and assigned once, rather than a `setProperty` per property: this runs for
 * every element on the page, and there are a few hundred properties each.
 */
function declarationsOf(style: CSSStyleDeclaration) {
  let declarations = "";
  for (const property of style) {
    declarations += `${property}:${style.getPropertyValue(property)};`;
  }

  return declarations;
}

/**
 * Sources the copy cannot reach on its own, turned into data it carries.
 *
 * A video is the interesting one: it has no `src` a picture can use, so the frame on screen right
 * now is drawn to a canvas and the element becomes an image of that frame, keeping the styles that
 * positioned it.
 */
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
    ...originals.map(async (original, index) => inlineBackground({
      original,
      clone: clones[index]
    }))
  ]);
}

function replaceVideo(video: HTMLVideoElement) {
  const live = [...document.querySelectorAll("video")].find(candidate => candidate.src === video.src);
  const image = document.createElement("img");
  image.style.cssText = video.style.cssText;
  image.src = live ? frameOf(live) : TRANSPARENT_PIXEL;
  video.replaceWith(image);
}

/** The frame on screen, which is the only part of a video a still picture can hold. */
function frameOf(video: HTMLVideoElement) {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")?.drawImage(video, 0, 0);

  return canvas.toDataURL("image/png");
}

/**
 * Built fresh on every call rather than shared.
 *
 * A global regular expression carries a `lastIndex` between uses, and this one is asked about every
 * element on the page at once - a shared instance has its position moved by whichever call is
 * running, and matches go missing. Measured: the page background silently stopped being found.
 */
function urlPattern() {
  return /url\(["']?(?<source>blob:[^"')]+|https?:[^"')]+)["']?\)/gu;
}

/**
 * Read from the original's computed style rather than back off the copy.
 *
 * The copy's own `background-image` is whatever survived being written into `cssText` alongside
 * three hundred other properties, and that round trip is the part that was quietly losing the page
 * background. The computed value is the one the browser resolved, and it is always there to read.
 */
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
  let index = 0;
  clone.style.backgroundImage = backgroundImage.replace(urlPattern(), () => `url("${inlined[index++]}")`);
}

/** Already-inlined sources are left alone, which is most of them - this app's CSS icons are data URIs. */
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
 * The copy's background, taken off it so the SVG can paint it instead.
 *
 * A browser hands the body's background to the canvas, which is painted before anything the page
 * draws - including the `z-index: -2` layer this app puts its wallpaper on. Inside a `foreignObject`
 * the body is an ordinary box instead, so the same declaration paints in the flow and buries every
 * negative layer under it. Measured: an opaque `rgb(0, 12, 20)` swallowed the wallpaper whole, and
 * the picture came back a flat dark rectangle with the interface floating on it.
 *
 * The SVG element is painted before its own content, which is exactly what the canvas is, so the
 * declaration moves there and the copy gives it up.
 */
function takeBackground(clone: HTMLElement) {
  let declarations = "";
  for (const property of BACKGROUND_PROPERTIES) {
    declarations += `${property}:${clone.style.getPropertyValue(property)};`;
    clone.style.removeProperty(property);
  }

  return declarations;
}

/**
 * The copy wrapped in the one SVG element that will hold HTML.
 *
 * Built through the DOM rather than written as a string, so the markup is well formed by
 * construction - `foreignObject` is XML, and an unclosed tag the HTML parser forgave is an error
 * there.
 */
function buildSvg({ body, ground, pseudoRules, width, height }: {
  body: HTMLElement;
  ground: string;
  pseudoRules: string[];
  width: number;
  height: number;
}) {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.style.cssText = ground;

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

async function draw({ svg, width, height, scale }: {
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

  const image = await load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  context.scale(scale, scale);
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/png");
}

function load(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("the page could not be drawn as an image")));
    image.src = source;
  });
}
