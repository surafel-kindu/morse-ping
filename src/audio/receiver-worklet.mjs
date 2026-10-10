import { ToneDetector } from './tone-detector.mjs';
class MorseReceiver extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const {frequency,threshold}=options.processorOptions;
    this.detector=new ToneDetector(sampleRate,frequency,threshold,event => this.port.postMessage(event));
  }
  process(inputs, outputs) {
    const channels=inputs[0];
    // Average input channels so a one-sided stereo input is still usable.
    if (channels?.length) {
      const mono=new Float32Array(channels[0].length);
      for (const channel of channels) for (let i=0;i<mono.length;i++) mono[i]+=channel[i]/channels.length;
      this.detector.push(mono);
    }
    for (const output of outputs) for (const channel of output) channel.fill(0);
    return true;
  }
}
registerProcessor('morse-receiver', MorseReceiver);
