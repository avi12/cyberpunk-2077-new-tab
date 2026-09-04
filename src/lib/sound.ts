import { settings } from "./storage/settings.svelte";

/**
 * What a card says back to the cursor.
 *
 * Two voices, taken off the game's own menu and rebuilt from oscillators and filtered noise.
 * Nothing here is CDPR's audio - the numbers below are measurements of it, and an extension that
 * ships no sample cannot ship anyone's sample.
 *
 * The pair is the mouse's pair: `ui_menu_hover` (hash 435721760) and `ui_menu_mouse_click`
 * (142422666). The game also has `ui_menu_onpress`, which is the gamepad and keyboard answer to the
 * same row and a longer, more tonal sound; a page driven by a pointer should say what the game says
 * to a pointer.
 *
 * The tick is 68ms and hollow - 145Hz carrying 60% of the energy, a pair at 5672Hz and 5906Hz
 * carrying the rest, and almost nothing in between. The 234Hz gap between the two highs beats
 * about four times across the sound, and that beating is the shimmer. It swells over 12ms rather
 * than striking, so there is no transient in it at all.
 *
 * The click is barely a note at all: 31ms of hash with a spectral flatness of 0.72, flat from 2kHz
 * to the top of the band and falling away below 1kHz, with only an eighth of its energy under
 * 1.5kHz. It has no decay - it comes up over about 6ms and then simply stops. In the game it sits
 * roughly 10dB above the hover, because a click is an event and a hover is weather.
 */

const MS_PER_SECOND = 1000;

/** A cursor crossing a corner touches two cards in a frame; one of them is the sound. */
const REPEAT_GUARD_MS = 55;

/**
 * The measured balance, as amplitudes relative to the loudest partial. Faithful rather than
 * flattering: the tick really is mostly a 145Hz hum, which small speakers will not reproduce, and
 * correcting for that here would be inventing a sound the game does not make.
 */
const TICK_PARTIALS = [
  {
    hertz: 145.3,
    gain: 1
  },
  {
    hertz: 435.9,
    gain: 0.105
  },
  {
    hertz: 5672.1,
    gain: 0.66
  },
  {
    hertz: 5905.5,
    gain: 0.45
  }
];
const TICK_MS = 68;
const TICK_ATTACK_MS = 12;
const TICK_RELEASE_MS = 6;
const TICK_GAIN = 0.09;

/**
 * The hollow between the hum and the shimmer is not empty - a broad bed of hash sits in it, and
 * without it four sines are a test tone rather than a machine. These three numbers put the
 * synthesised octave balance within 2dB of the original's across 640Hz-5kHz, and its spectral
 * flatness at 0.188 against a measured 0.185. Some of that hash is likely the preview's own encode;
 * it is reproduced anyway, because it is what the sound has always sounded like.
 */
const TICK_HASH_HZ = 2000;
const TICK_HASH_Q = 0.5;
const TICK_HASH_GAIN = 0.16;

/**
 * One highpass over noise, because that is all the measurement supports - adding a second band on
 * top only fitted worse. The Q is what makes the shape: at 1.0 the corner's own resonance fills
 * 500Hz-2kHz, which is the plateau the original has there, and the 12dB/octave skirt below it lands
 * the two bottom octaves within half a dB. All six octaves come out within 2.6dB, mean 1.4dB.
 */
const CLICK_MS = 31;
const CLICK_ATTACK_MS = 6;
const CLICK_RELEASE_MS = 3;
const CLICK_HZ = 540;
const CLICK_Q = 1;

/**
 * The one number here that is a judgement rather than a measurement. In the bank the click sits
 * 9.7dB over the hover, but a bank level is not what a player hears - the game mixes both through a
 * UI bus this page does not have, and copying the raw ratio puts every click at -3.9dBFS. 6dB keeps
 * the click the louder, deliberate sound of the two with headroom left over.
 */
const CLICK_GAIN = 0.28;

/** One buffer of noise, long enough for whichever of the two voices asks for it. */
const NOISE_MS = 120;

let context: AudioContext | null = null;
let hiss: AudioBuffer | null = null;
let lastPlayedMs = 0;

function audioContext() {
  context ??= new AudioContext();

  return context;
}

/**
 * A page nobody has clicked yet is not allowed to make a sound, and a suspended context does not
 * drop what it was asked for - it queues it, and plays the lot at once when it wakes. So the sound
 * is skipped rather than scheduled until the context is actually running.
 */
function runningContext(): AudioContext | null {
  const audio = audioContext();
  if (audio.state === "running") {
    return audio;
  }

  void audio.resume();

  return null;
}

/** The same hiss every time it is asked for: both voices are an envelope over it, not a new noise. */
function hissBuffer(audio: AudioContext): AudioBuffer {
  if (hiss) {
    return hiss;
  }

  const length = Math.round(audio.sampleRate * NOISE_MS / MS_PER_SECOND);
  hiss = audio.createBuffer(1, length, audio.sampleRate);
  hiss.getChannelData(0).set(Float32Array.from({ length }, () => Math.random() * 2 - 1));

  return hiss;
}

/**
 * Both voices are the same shape at different settings: fade in, hold, fade out. Linear ramps rather
 * than exponential ones, because what was measured is a swell and a release, not a decay.
 */
function envelopeFor({
  audio,
  startedAt,
  endsAt,
  attackMs,
  releaseMs,
  gain
}: {
  audio: AudioContext;
  startedAt: number;
  endsAt: number;
  attackMs: number;
  releaseMs: number;
  gain: number;
}): GainNode {
  const output = new GainNode(audio, { gain: 0 });
  output.gain.linearRampToValueAtTime(gain, startedAt + attackMs / MS_PER_SECOND);
  output.gain.setValueAtTime(gain, endsAt - releaseMs / MS_PER_SECOND);
  output.gain.linearRampToValueAtTime(0, endsAt);
  output.connect(audio.destination);

  return output;
}

function playTick(audio: AudioContext): void {
  const startedAt = audio.currentTime;
  const endsAt = startedAt + TICK_MS / MS_PER_SECOND;
  const envelope = envelopeFor({
    audio,
    startedAt,
    endsAt,
    attackMs: TICK_ATTACK_MS,
    releaseMs: TICK_RELEASE_MS,
    gain: TICK_GAIN
  });

  for (const partial of TICK_PARTIALS) {
    const voice = new OscillatorNode(audio, {
      type: "sine",
      frequency: partial.hertz
    });
    voice.connect(new GainNode(audio, { gain: partial.gain })).connect(envelope);
    voice.start(startedAt);
    voice.stop(endsAt);
  }

  const bed = new AudioBufferSourceNode(audio, { buffer: hissBuffer(audio) });
  const band = new BiquadFilterNode(audio, {
    type: "bandpass",
    frequency: TICK_HASH_HZ,
    Q: TICK_HASH_Q
  });
  bed.connect(band).connect(new GainNode(audio, { gain: TICK_HASH_GAIN })).connect(envelope);
  bed.start(startedAt);
  bed.stop(endsAt);
}

function playClick(audio: AudioContext): void {
  const startedAt = audio.currentTime;
  const endsAt = startedAt + CLICK_MS / MS_PER_SECOND;
  const envelope = envelopeFor({
    audio,
    startedAt,
    endsAt,
    attackMs: CLICK_ATTACK_MS,
    releaseMs: CLICK_RELEASE_MS,
    gain: CLICK_GAIN
  });

  const burst = new AudioBufferSourceNode(audio, { buffer: hissBuffer(audio) });
  const corner = new BiquadFilterNode(audio, {
    type: "highpass",
    frequency: CLICK_HZ,
    Q: CLICK_Q
  });
  burst.connect(corner).connect(envelope);
  burst.start(startedAt);
  burst.stop(endsAt);
}

function audioForSound(): AudioContext | null {
  if (!settings.playSounds.current) {
    return null;
  }

  return runningContext();
}

function onHover(): void {
  const audio = audioForSound();
  if (!audio) {
    return;
  }

  const now = performance.now();
  if (now - lastPlayedMs < REPEAT_GUARD_MS) {
    return;
  }

  lastPlayedMs = now;
  playTick(audio);
}

/**
 * No repeat guard: a click cannot machine-gun the way a cursor crossing a grid can, and the guard
 * would swallow it anyway - the hover that brought the cursor here fired milliseconds ago.
 */
function onClick(): void {
  const audio = audioForSound();
  if (audio) {
    playClick(audio);
  }
}

/**
 * The panel's own preview. A click is exactly the activation a context waits for, so unlike a
 * hover it is worth waiting on the wake-up before playing.
 */
export async function previewTick(): Promise<void> {
  await audioContext().resume();
  onHover();
}

/**
 * The page's own arrow: what everything that cannot be aimed at wears. Only the reticle is themed,
 * so this is read once and holds for the life of the page.
 */
let restingCursor = "";

/** Whether the page is offering this element the reticle rather than the arrow. */
function isAimed(element: Element): boolean {
  restingCursor ||= getComputedStyle(document.documentElement).cursor;

  return getComputedStyle(element).cursor !== restingCursor;
}

/**
 * The link under the pointer, or nothing at all.
 *
 * Only somewhere to go speaks: a netlink, a source under a Copilot card, the card's own action. A
 * button is a setting rather than a destination - a section that collapses, an icon in the picker,
 * a search engine - and settings are quiet.
 *
 * `closest` is what makes a link one thing to speak for rather than an icon and a label. The cursor
 * is then asked whether it is still a link at all, since a netlink being rearranged is a drag
 * handle written as an anchor, and drops back to the arrow to say so.
 */
function aimedLink(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }

  const link = target.closest("a[href]");
  if (!link || !isAimed(link)) {
    return null;
  }

  return link;
}

/**
 * What the page says back to the cursor, said once for the whole page.
 *
 * The game's menu ticks under a target, not under every widget in the pause screen, and here a
 * target is a link. `a[href]` is the whole list, so nothing has to be kept in step by hand as the
 * page grows.
 *
 * `:focus-visible` extends it to the keyboard, and only to the keyboard: it is the browser's own
 * answer to whether the user tabbed here or focus merely landed - restored after a dialog closes,
 * moved by script, or dragged along by the click that is already playing its own sound.
 */
export function menuSounds(node: HTMLElement) {
  /** What the pointer is inside, so crossing a link's padding onto its label says nothing new. */
  let elLink: Element | null = null;

  function onPointerOver(e: PointerEvent) {
    const link = aimedLink(e.target);
    if (link === elLink) {
      return;
    }

    elLink = link;

    if (link) {
      onHover();
    }
  }

  /** Leaving the window, which is the one exit no `pointerover` arrives to describe. */
  function onPointerOut(e: PointerEvent) {
    if (!e.relatedTarget) {
      elLink = null;
    }
  }

  function onPointerDown(e: PointerEvent) {
    if (aimedLink(e.target)) {
      onClick();
    }
  }

  function onFocusIn(e: FocusEvent) {
    if (e.target instanceof Element && e.target.matches(":focus-visible") && aimedLink(e.target)) {
      onHover();
    }
  }

  const listeners = new AbortController();
  const { signal } = listeners;
  node.addEventListener("pointerover", onPointerOver, { signal });
  node.addEventListener("pointerout", onPointerOut, { signal });
  node.addEventListener("pointerdown", onPointerDown, { signal });
  node.addEventListener("focusin", onFocusIn, { signal });

  return () => listeners.abort();
}
