// Five-millisecond windows and hysteresis. The same DSP runs in an AudioWorklet
// in the browser and in synthetic audio tests. Deliberately fixed-frequency.
export class ToneDetector {
  constructor(sampleRate, frequency, threshold, callback) {
    this.sampleRate=sampleRate; this.size=Math.round(sampleRate*.005);
    this.frequency=frequency; this.threshold=threshold; this.callback=callback;
    this.samples=new Float32Array(this.size); this.index=0; this.total=0;
    this.state=false; this.candidate=false; this.count=0;
    this.cos=new Float32Array(this.size); this.sin=new Float32Array(this.size);
    for (let i=0;i<this.size;i++) {
      const angle=2*Math.PI*frequency*i/sampleRate;
      this.cos[i]=Math.cos(angle); this.sin[i]=Math.sin(angle);
    }
  }
  push(input) {
    for (const sample of input) {
      this.samples[this.index++]=sample; this.total++;
      if (this.index === this.size) { this.analyze(); this.index=0; }
    }
  }
  analyze() {
    let re=0, im=0, power=0;
    for (let i=0;i<this.size;i++) { const s=this.samples[i]; re+=s*this.cos[i]; im+=s*this.sin[i]; power+=s*s; }
    const amplitude = 2*Math.hypot(re,im)/this.size;
    const purity = power ? (re*re+im*im)*2/(this.size*power) : 0;
    const candidate = amplitude > this.threshold*(this.state ? .65 : 1) && purity > (this.state ? .4 : .6);
    if (candidate !== this.candidate) { this.candidate=candidate; this.count=1; } else this.count++;
    if (this.count >= 2 && candidate !== this.state) {
      this.state=candidate;
      // Timestamp the first window of the transition; preserve pulse durations.
      this.callback({on:this.state, time:(this.total-this.size)/this.sampleRate, amplitude, transition:true});
    } else if (this.total % (this.size*10) === 0) {
      this.callback({on:this.state, time:this.total/this.sampleRate, amplitude, transition:false});
    }
  }
}
