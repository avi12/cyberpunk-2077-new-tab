import { clearMedia, loadMedia, MediaSlot, saveMedia } from "./storage/media-store";
import { settings } from "./storage/settings.svelte";

/**
 * What a card says back to the cursor.
 *
 * Two voices, taken off the game's own menu and rebuilt from oscillators. Nothing here is CDPR's
 * audio - the numbers below are measurements of it, and an extension that ships no sample cannot
 * ship anyone's sample. A reader who wants the real thing brings their own file, which is decoded
 * once and played as it is in place of the hover tick.
 *
 * The measurements, from `ui_menu_hover` (hash 435721760) and `ui_menu_onpress` (698798840):
 *
 * The tick is 68ms and hollow - 145Hz carrying 60% of the energy, a pair at 5672Hz and 5906Hz
 * carrying the rest, and almost nothing in between. The 234Hz gap between the two highs beats
 * about four times across the sound, and that beating is the shimmer. It swells over 12ms rather
 * than striking, so there is no transient in it at all.
 *
 * The press is the opposite sound: no low end whatsoever, a dense inharmonic cluster between
 * 2.4kHz and 3.9kHz that rises in 18ms and is 30dB down by 55ms, and then a noise tail that
 * outlasts the tone. Its spectral flatness climbs from 0.11 in the body to 0.6 in the tail, which
 * is the tone handing over to the hiss.
 */

const MS_PER_SECOND = 1000;

/** A cursor crossing a corner touches two cards in a frame; one of them is the sound. */
const REPEAT_GUARD_MS = 55;

/** `exponentialRampToValueAtTime` cannot reach zero, so silence is the quietest audible step. */
const SILENCE = 0.0001;

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

const PRESS_PARTIALS = [
  {
    hertz: 2926.3,
    gain: 1
  },
  {
    hertz: 2433.1,
    gain: 0.42
  },
  {
    hertz: 2493.7,
    gain: 0.38
  },
  {
    hertz: 3929.9,
    gain: 0.31
  },
  {
    hertz: 3092.8,
    gain: 0.22
  }
];
const PRESS_MS = 106;
const PRESS_ATTACK_MS = 18;
const PRESS_RELEASE_MS = 38;
const PRESS_GAIN = 0.07;

/** The hiss the cluster hands over to, and the band it lives in. */
const PRESS_TAIL_MS = 60;
const PRESS_TAIL_DELAY_MS = 46;
const PRESS_TAIL_HZ = 6000;
const PRESS_TAIL_Q = 1.4;
const PRESS_TAIL_GAIN = 0.1;

/** One buffer of noise, long enough for whichever of the two voices asks for it. */
const NOISE_MS = 120;

/** What the picker takes, and so what a drop on its zone takes too. */
export const HOVER_SOUND_ACCEPT = "audio/*";

/** A file that arrived without a name of its own still has to be named back at the reader. */
const UNNAMED_SOUND = "custom sound";

let context: AudioContext | null = null;
let hiss: AudioBuffer | null = null;
let sample: AudioBuffer | null = null;
let isSampleAsked = false;
let playingSample: AudioBufferSourceNode | null = null;
let lastPlayedMs = 0;

/**
 * A page nobody has clicked yet is not allowed to make a sound, and a suspended context does not
 * drop what it was asked for - it queues it, and plays the lot at once when it wakes. So the sound
 * is skipped rather than scheduled until the context is actually running.
 */
function runningContext(): AudioContext | null {
  context ??= new AudioContext();

  if (context.state === "running") {
    return context;
  }

  void context.resume();

  return null;
}

/** The same hiss every time it is asked for: both beds are an envelope over it, not a new noise. */
function hissBuffer(audio: AudioContext): AudioBuffer {
  if (hiss) {
    return hiss;
  }

  const length = Math.round(audio.sampleRate * NOISE_MS / MS_PER_SECOND);
  hiss = audio.createBuffer(1, length, audio.sampleRate);
  hiss.getChannelData(0).set(Float32Array.from({ length }, () => Math.random() * 2 - 1));

  return hiss;
}

/** Asked for once. The store is the whole of the choice, so there is no setting to disagree with it. */
async function ensureSample(audio: AudioContext): Promise<void> {
  if (isSampleAsked) {
    return;
  }

  isSampleAsked = true;
  const media = await loadMedia(MediaSlot.hoverSound);
  if (!media) {
    return;
  }

  sample = await audio.decodeAudioData(await media.blob.arrayBuffer()).catch(() => null);
}

/** One at a time: a cursor down a column would otherwise stack every card it passes. */
function playSample(audio: AudioContext, buffer: AudioBuffer): void {
  playingSample?.stop();
  playingSample = new AudioBufferSourceNode(audio, { buffer });
  playingSample.connect(audio.destination);
  playingSample.start();
}

/**
 * Both voices are the same thing at different settings: a handful of sines that fade in together,
 * hold, and fade out together. Linear ramps rather than exponential ones, because what was measured
 * is a swell and a release, not a decay. Answers the envelope, so a caller can hang its own bed of
 * noise under the same shape.
 */
function playPartials({
  audio,
  partials,
  totalMs,
  attackMs,
  releaseMs,
  gain
}: {
  audio: AudioContext;
  partials: {
    hertz: number;
    gain: number;
  }[];
  totalMs: number;
  attackMs: number;
  releaseMs: number;
  gain: number;
}): GainNode {
  const startedAt = audio.currentTime;
  const endsAt = startedAt + totalMs / MS_PER_SECOND;

  const output = new GainNode(audio, { gain: 0 });
  output.gain.linearRampToValueAtTime(gain, startedAt + attackMs / MS_PER_SECOND);
  output.gain.setValueAtTime(gain, endsAt - releaseMs / MS_PER_SECOND);
  output.gain.linearRampToValueAtTime(0, endsAt);
  output.connect(audio.destination);

  for (const partial of partials) {
    const voice = new OscillatorNode(audio, {
      type: "sine",
      frequency: partial.hertz
    });
    voice.connect(new GainNode(audio, { gain: partial.gain })).connect(output);
    voice.start(startedAt);
    voice.stop(endsAt);
  }

  return output;
}

function playTick(audio: AudioContext): void {
  const envelope = playPartials({
    audio,
    partials: TICK_PARTIALS,
    totalMs: TICK_MS,
    attackMs: TICK_ATTACK_MS,
    releaseMs: TICK_RELEASE_MS,
    gain: TICK_GAIN
  });

  const startedAt = audio.currentTime;
  const bed = new AudioBufferSourceNode(audio, { buffer: hissBuffer(audio) });
  const band = new BiquadFilterNode(audio, {
    type: "bandpass",
    frequency: TICK_HASH_HZ,
    Q: TICK_HASH_Q
  });
  bed.connect(band).connect(new GainNode(audio, { gain: TICK_HASH_GAIN })).connect(envelope);
  bed.start(startedAt);
  bed.stop(startedAt + TICK_MS / MS_PER_SECOND);
}

function playPress(audio: AudioContext): void {
  playPartials({
    audio,
    partials: PRESS_PARTIALS,
    totalMs: PRESS_MS,
    attackMs: PRESS_ATTACK_MS,
    releaseMs: PRESS_RELEASE_MS,
    gain: PRESS_GAIN
  });

  const startedAt = audio.currentTime + PRESS_TAIL_DELAY_MS / MS_PER_SECOND;
  const tail = new AudioBufferSourceNode(audio, { buffer: hissBuffer(audio) });
  const band = new BiquadFilterNode(audio, {
    type: "bandpass",
    frequency: PRESS_TAIL_HZ,
    Q: PRESS_TAIL_Q
  });
  const fade = new GainNode(audio, { gain: PRESS_TAIL_GAIN });
  fade.gain.exponentialRampToValueAtTime(SILENCE, startedAt + PRESS_TAIL_MS / MS_PER_SECOND);
  tail.connect(band).connect(fade).connect(audio.destination);
  tail.start(startedAt);
  tail.stop(startedAt + PRESS_TAIL_MS / MS_PER_SECOND);
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
  // The first hover of a page is the built-in tick; the file is decoded in time for the second.
  void ensureSample(audio);

  if (sample) {
    playSample(audio, sample);

    return;
  }

  playTick(audio);
}

/**
 * No repeat guard: a press cannot machine-gun the way a cursor crossing a grid can, and the guard
 * would swallow it anyway - the hover that brought the cursor here fired milliseconds ago.
 *
 * A brought-in file stands in for the tick, not for the press: it is the hover sound, by name.
 */
function onPress(): void {
  const audio = audioForSound();
  if (audio) {
    playPress(audio);
  }
}

/**
 * The panel's own preview. A click is exactly the activation a context waits for, so unlike a
 * hover it is worth waiting on the wake-up before playing.
 */
export async function previewBlip(): Promise<void> {
  context ??= new AudioContext();
  await context.resume();
  onHover();
}

/**
 * Decoded before it is kept, because a file the browser cannot read would fail on hover, where
 * there is nothing to say so with. Answers whether it was one.
 */
export async function keepHoverSound(file: File): Promise<boolean> {
  context ??= new AudioContext();
  const decoded = await context.decodeAudioData(await file.arrayBuffer()).catch(() => null);
  if (!decoded) {
    return false;
  }

  await saveMedia({
    slot: MediaSlot.hoverSound,
    blob: file,
    type: file.type,
    name: file.name
  });
  sample = decoded;
  isSampleAsked = true;

  return true;
}

export async function dropHoverSound(): Promise<void> {
  await clearMedia(MediaSlot.hoverSound);
  sample = null;
  isSampleAsked = true;
}

export async function hoverSoundName(): Promise<string | null> {
  const media = await loadMedia(MediaSlot.hoverSound);
  if (!media) {
    return null;
  }

  return media.name || UNNAMED_SOUND;
}

/** On focus as well as on pointer, so a keyboard hears the same page a mouse does. */
export function menuSounds(node: HTMLElement) {
  node.addEventListener("pointerenter", onHover);
  node.addEventListener("focus", onHover);
  node.addEventListener("pointerdown", onPress);

  return {
    destroy() {
      node.removeEventListener("pointerenter", onHover);
      node.removeEventListener("focus", onHover);
      node.removeEventListener("pointerdown", onPress);
    }
  };
}
