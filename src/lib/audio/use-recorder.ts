"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { MessageKey } from "@/i18n/dictionary";

import { concat, encodeWav, resample } from "./wav";

export type RecorderError = Extract<MessageKey, `mic.error.${string}`>;

export interface Recording {
  wav: Uint8Array<ArrayBuffer>;
  durationMs: number;
}

const MIN_MS = 500; // shorter than this is a mis-tap, not speech

// Doc 06 haptics: short buzz on start and done, double buzz on failure.
export const buzz = (pattern: number | number[]) => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
};

function errorFor(error: unknown): RecorderError {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "mic.error.denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "mic.error.none";
  return "mic.error.failed";
}

// Tap to start, tap to stop (doc 06). Records the microphone through Web
// Audio, stops by itself at `maxSeconds`, and hands back a 16 kHz mono WAV.
export function useRecorder({ maxSeconds, onRecorded }: { maxSeconds: number; onRecorded: (recording: Recording) => void }) {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<RecorderError | null>(null);

  const session = useRef<{
    stream: MediaStream;
    context: AudioContext;
    chunks: Float32Array[];
    startedAt: number;
    timer: number;
    frame: number;
    nodes: AudioNode[];
  } | null>(null);
  // Set while the browser is asking for the mic, and while the screen is shown.
  const starting = useRef(false);
  const mounted = useRef(true);
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
  }, [onRecorded]);

  const teardown = useCallback(() => {
    const s = session.current;
    if (!s) return null;
    session.current = null;
    clearInterval(s.timer);
    cancelAnimationFrame(s.frame);
    for (const node of s.nodes) node.disconnect();
    for (const track of s.stream.getTracks()) track.stop();
    void s.context.close();
    setRecording(false);
    setLevel(0);
    return s;
  }, []);

  const stop = useCallback(() => {
    const s = teardown();
    if (!s) return;
    const durationMs = performance.now() - s.startedAt;
    if (durationMs < MIN_MS) {
      setError("mic.error.tooShort");
      buzz([40, 60, 40]);
      return;
    }
    const wav = encodeWav(resample(concat(s.chunks), s.context.sampleRate));
    buzz(30);
    onRecordedRef.current({ wav, durationMs: Math.round(durationMs) });
  }, [teardown]);

  const begin = useCallback(async () => {
    setError(null);
    setElapsedMs(0);
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") {
      setError("mic.error.unsupported");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (failure) {
      setError(errorFor(failure));
      buzz([40, 60, 40]);
      return;
    }

    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const chunks: Float32Array[] = [];
    const nodes: AudioNode[] = [source, analyser];

    // AudioWorklet where available; ScriptProcessor for older browsers.
    try {
      await context.audioWorklet.addModule("/audio/capture-worklet.js");
      const worklet = new AudioWorkletNode(context, "capture");
      worklet.port.onmessage = (event: MessageEvent<Float32Array>) => chunks.push(event.data);
      source.connect(worklet);
      nodes.push(worklet);
    } catch {
      const processor = context.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (event) => chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      source.connect(processor);
      processor.connect(context.destination);
      nodes.push(processor);
    }

    // The screen closed while the mic was starting: release it at once.
    if (!mounted.current) {
      for (const node of nodes) node.disconnect();
      for (const track of stream.getTracks()) track.stop();
      void context.close();
      return;
    }

    const samples = new Float32Array(analyser.fftSize);
    const startedAt = performance.now();
    const meter = () => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const s of samples) sum += s * s;
      setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 4));
      if (session.current) session.current.frame = requestAnimationFrame(meter);
    };
    session.current = {
      stream,
      context,
      chunks,
      startedAt,
      nodes,
      frame: requestAnimationFrame(meter),
      timer: window.setInterval(() => {
        const ms = performance.now() - startedAt;
        setElapsedMs(ms);
        // Doc 06: stops by itself at the limit; only ever this recording.
        if (ms >= maxSeconds * 1000 && session.current?.startedAt === startedAt) stop();
      }, 100),
    };
    setRecording(true);
    buzz(30);
  }, [maxSeconds, stop]);

  const start = useCallback(async () => {
    // A second tap while the browser is still asking for the mic must not
    // start a second session (the first would never be released).
    if (session.current || starting.current) return;
    starting.current = true;
    try {
      await begin();
    } finally {
      starting.current = false;
    }
  }, [begin]);

  // Leaving the screen mid-recording releases the microphone.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      teardown();
    };
  }, [teardown]);

  return { recording, elapsedMs, level, error, setError, start, stop };
}
