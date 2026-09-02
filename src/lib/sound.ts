import { clearMedia, loadMedia, MediaSlot, saveMedia } from "./storage/media-store";
import { settings } from "./storage/settings.svelte";

/**
 * What a card says back to the cursor.
 *
 * Two voices, and the reader picks between them by bringing a file or not. A sound they drop in is
 * decoded once and played as it is; with none, the built-in blip is synthesised from two
 * oscillators every time it plays - smaller than any file, and free to come out a little different
 * each time, which is what keeps a row of cards from sounding like a machine gun. The metal in it
 * is the frequency modulation: a modulator at an interval no instrument would use, its depth
 * collapsing inside 40ms, over a noise transient for the strike.
 *
 * A brought-in sound stays in this browser, stored beside the custom background. Nothing is
 * shipped with the extension.
 */

const MS_PER_SECOND = 1000;

/** Long enough to hear the strike ring, short enough that crossing a grid is not a melody. */
const BLIP_MS = 90;
const TRANSIENT_MS = 14;
/** The metal is all in the first half of the blip; what is left of it is the tail. */
const MODULATION_MS = 45;
const ATTACK_MS = 1.5;

/** A cursor crossing a corner touches two cards in a frame; one of them is the sound. */
const REPEAT_GUARD_MS = 55;

const BLIP_HZ = 1180;
/** Inharmonic on purpose - a whole-number ratio would ring like a bell instead of a machine. */
const MODULATOR_RATIO = 2.76;
const MODULATION_DEPTH = 1.7;
/** Each blip lands a hair off the last, the way a real mechanism never repeats exactly. */
const PITCH_SPREAD = 0.06;

const BLIP_GAIN = 0.11;
const TRANSIENT_GAIN = 0.05;
/** Everything under this is the room, not the strike. */
const STRIKE_EDGE_HZ = 3200;
/** `exponentialRampToValueAtTime` cannot reach zero, so silence is the quietest audible step. */
const SILENCE = 0.0001;

/** What the picker takes, and so what a drop on its zone takes too. */
export const HOVER_SOUND_ACCEPT = "audio/*";

/** A file that arrived without a name of its own still has to be named back at the reader. */
const UNNAMED_SOUND = "custom sound";

let context: AudioContext | null = null;
let transient: AudioBuffer | null = null;
let sample: AudioBuffer | null = null;
let isSampleAsked = false;
let playingSample: AudioBufferSourceNode | null = null;
let lastPlayedMs = 0;

/**
 * A page nobody has clicked yet is not allowed to make a sound, and a suspended context does not
 * drop what it was asked for - it queues it, and plays the lot at once when it wakes. So the blip
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

/** The same hiss every time it is asked for: the strike is an envelope, not a new noise. */
function transientBuffer(audio: AudioContext): AudioBuffer {
  if (transient) {
    return transient;
  }

  const length = Math.round(audio.sampleRate * TRANSIENT_MS / MS_PER_SECOND);
  transient = audio.createBuffer(1, length, audio.sampleRate);
  transient.getChannelData(0).set(Float32Array.from({ length }, () => Math.random() * 2 - 1));

  return transient;
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

function playSynth(audio: AudioContext): void {
  const startedAt = audio.currentTime;
  const endsAt = startedAt + BLIP_MS / MS_PER_SECOND;
  const pitch = BLIP_HZ * (1 + (Math.random() - 0.5) * PITCH_SPREAD);

  const output = new GainNode(audio, { gain: 0 });
  output.gain.linearRampToValueAtTime(BLIP_GAIN, startedAt + ATTACK_MS / MS_PER_SECOND);
  output.gain.exponentialRampToValueAtTime(SILENCE, endsAt);
  output.connect(audio.destination);

  const carrier = new OscillatorNode(audio, {
    type: "triangle",
    frequency: pitch
  });
  const modulator = new OscillatorNode(audio, {
    type: "sine",
    frequency: pitch * MODULATOR_RATIO
  });
  const depth = new GainNode(audio, { gain: pitch * MODULATION_DEPTH });
  depth.gain.exponentialRampToValueAtTime(SILENCE, startedAt + MODULATION_MS / MS_PER_SECOND);
  modulator.connect(depth).connect(carrier.frequency);
  carrier.connect(output);

  const strike = new AudioBufferSourceNode(audio, { buffer: transientBuffer(audio) });
  const edge = new BiquadFilterNode(audio, {
    type: "highpass",
    frequency: STRIKE_EDGE_HZ
  });
  const strikeGain = new GainNode(audio, { gain: TRANSIENT_GAIN });
  strikeGain.gain.exponentialRampToValueAtTime(SILENCE, startedAt + TRANSIENT_MS / MS_PER_SECOND);
  strike.connect(edge).connect(strikeGain).connect(output);

  for (const source of [carrier, modulator]) {
    source.start(startedAt);
    source.stop(endsAt);
  }

  strike.start(startedAt);
}

export function playBlip(): void {
  if (!settings.playSounds.current) {
    return;
  }

  const now = performance.now();
  if (now - lastPlayedMs < REPEAT_GUARD_MS) {
    return;
  }

  const audio = runningContext();
  if (!audio) {
    return;
  }

  lastPlayedMs = now;
  // The first hover of a page is the built-in blip; the file is decoded in time for the second.
  void ensureSample(audio);

  if (sample) {
    playSample(audio, sample);

    return;
  }

  playSynth(audio);
}

/**
 * The panel's own preview. A click is exactly the activation a context waits for, so unlike a
 * hover it is worth waiting on the wake-up before playing.
 */
export async function previewBlip(): Promise<void> {
  context ??= new AudioContext();
  await context.resume();
  playBlip();
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
export function blipOnHover(node: HTMLElement) {
  node.addEventListener("pointerenter", playBlip);
  node.addEventListener("focus", playBlip);

  return {
    destroy() {
      node.removeEventListener("pointerenter", playBlip);
      node.removeEventListener("focus", playBlip);
    }
  };
}
