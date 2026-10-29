// Copies the microphone's first channel to the page, 128 samples at a time,
// for the WAV encoder (src/lib/audio/wav.ts). Runs on the audio thread.
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}

registerProcessor("capture", CaptureProcessor);
