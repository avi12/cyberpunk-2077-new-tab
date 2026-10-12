import { settings } from "@/lib/storage/settings.svelte";

/**
 * The game's mouse menu sounds, `ui_menu_hover` (hash 435721760) and `ui_menu_mouse_click`
 * (142422666), rebuilt from oscillators and filtered noise. No CDPR audio ships - the numbers below
 * are measurements of it. Not `ui_menu_onpress`, which is the game's gamepad and keyboard sound.
 *
 * The tick is 68ms and hollow - 145Hz carrying 60% of the energy, a pair at 5672Hz and 5906Hz
 * carrying the rest. The 234Hz gap between the two highs beats about four times across the sound,
 * which is the shimmer. It swells over 12ms rather than striking.
 *
 * The click is 31ms of hash with a spectral flatness of 0.72, flat from 2kHz up and falling away
 * below 1kHz. It has no decay - it comes up over about 6ms and then stops.
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

const NOISE_MS = 120;

let sharedAudioContext: AudioContext | null = null;
let sharedNoiseBuffer: AudioBuffer | null = null;
let lastTickPlayedMs = 0;

function audioContext() {
  sharedAudioContext ??= new AudioContext();

  return sharedAudioContext;
}

/**
 * A suspended context (no click yet) queues what it is asked for and plays the lot at once when it
 * wakes, so a sound is skipped rather than scheduled until it is running.
 */
function runningContext() {
  const audio = audioContext();
  if (audio.state === "running") {
    return audio;
  }

  void audio.resume();

  return null;
}

function noiseBuffer(audio: AudioContext) {
  if (sharedNoiseBuffer) {
    return sharedNoiseBuffer;
  }

  const length = Math.round(audio.sampleRate * NOISE_MS / MS_PER_SECOND);
  sharedNoiseBuffer = audio.createBuffer(1, length, audio.sampleRate);
  sharedNoiseBuffer.getChannelData(0).set(Float32Array.from({ length }, () => Math.random() * 2 - 1));

  return sharedNoiseBuffer;
}

/** Linear ramps rather than exponential, because what was measured is a swell and a release, not a decay. */
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
}) {
  const output = new GainNode(audio, { gain: 0 });
  output.gain.linearRampToValueAtTime(gain, startedAt + attackMs / MS_PER_SECOND);
  output.gain.setValueAtTime(gain, endsAt - releaseMs / MS_PER_SECOND);
  output.gain.linearRampToValueAtTime(0, endsAt);
  output.connect(audio.destination);

  return output;
}

function playTick(audio: AudioContext) {
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

  const bed = new AudioBufferSourceNode(audio, { buffer: noiseBuffer(audio) });
  const band = new BiquadFilterNode(audio, {
    type: "bandpass",
    frequency: TICK_HASH_HZ,
    Q: TICK_HASH_Q
  });
  bed.connect(band).connect(new GainNode(audio, { gain: TICK_HASH_GAIN })).connect(envelope);
  bed.start(startedAt);
  bed.stop(endsAt);
}

function playClick(audio: AudioContext) {
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

  const burst = new AudioBufferSourceNode(audio, { buffer: noiseBuffer(audio) });
  const corner = new BiquadFilterNode(audio, {
    type: "highpass",
    frequency: CLICK_HZ,
    Q: CLICK_Q
  });
  burst.connect(corner).connect(envelope);
  burst.start(startedAt);
  burst.stop(endsAt);
}

function audioIfSoundsEnabled() {
  if (!settings.playSounds.current) {
    return null;
  }

  return runningContext();
}

function playHoverTick() {
  const audio = audioIfSoundsEnabled();
  if (!audio) {
    return;
  }

  const nowMs = performance.now();
  if (nowMs - lastTickPlayedMs < REPEAT_GUARD_MS) {
    return;
  }

  lastTickPlayedMs = nowMs;
  playTick(audio);
}

/** No repeat guard: it would swallow the click, since the hover that led here fired milliseconds ago. */
function playPressClick() {
  const audio = audioIfSoundsEnabled();
  if (audio) {
    playClick(audio);
  }
}

/** Called from a click, which is the activation a context waits for, so the wake-up is worth awaiting. */
export async function previewTick() {
  await audioContext().resume();
  playHoverTick();
}

/** Only the reticle is themed, so the page's resting arrow is read once and holds for the page's life. */
let restingCursor = "";

function isAimed(element: Element) {
  restingCursor ||= getComputedStyle(document.documentElement).cursor;

  return getComputedStyle(element).cursor !== restingCursor;
}

/**
 * Only links speak - buttons are settings, and settings are quiet. The cursor check is there because
 * a netlink being rearranged is a drag handle written as an anchor, and drops back to the arrow.
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
 * `:focus-visible` limits focus sounds to the keyboard, rather than focus restored after a dialog,
 * moved by script, or dragged along by a click already playing its own sound.
 */
export function menuSounds(node: HTMLElement) {
  /** Kept so crossing a link's padding onto its label says nothing new. */
  let elHoveredLink: Element | null = null;

  function onPointerOver(e: PointerEvent) {
    const link = aimedLink(e.target);
    if (link === elHoveredLink) {
      return;
    }

    elHoveredLink = link;

    if (link) {
      playHoverTick();
    }
  }

  /** Leaving the window is the one exit no `pointerover` arrives to describe. */
  function onPointerOut(e: PointerEvent) {
    if (!e.relatedTarget) {
      elHoveredLink = null;
    }
  }

  function onPointerDown(e: PointerEvent) {
    if (aimedLink(e.target)) {
      playPressClick();
    }
  }

  function onFocusIn(e: FocusEvent) {
    const isTabbedOntoLink = e.target instanceof Element
      && e.target.matches(":focus-visible")
      && Boolean(aimedLink(e.target));
    if (isTabbedOntoLink) {
      playHoverTick();
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
