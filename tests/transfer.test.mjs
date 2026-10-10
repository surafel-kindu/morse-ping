import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_BYTES, base32Encode, base32Decode, crc32, makePacket, readPacket, framesIn, TimingDecoder, ToneDetector, timeline, duration, normalizePlain, toMorse} from '../core.mjs';
const encode=text=>new TextEncoder().encode(text);
test('exact transfer preserves mixed case, whitespace, Ethiopic and emoji',()=>{
  const text='Hello\n  ሰላም 👋!\t';
  const packet=makePacket(encode(text)); assert.equal(readPacket(packet).text,text);
  assert.deepEqual(framesIn(`noise ${packet} extra`),[packet]);
});
test('all byte values and empty files preserve filename and MIME type',()=>{
  for (const bytes of [new Uint8Array(),Uint8Array.from({length:256},(_,i)=>i),Uint8Array.from({length:MAX_BYTES},(_,i)=>i%256)]) {
    const original={kind:'file',name:'ሰላም.bin',type:'application/octet-stream'};
    const result=readPacket(makePacket(bytes,original)); assert.deepEqual(result.bytes,bytes); assert.equal(result.name,original.name); assert.equal(result.type,original.type);
  }
});
test('base32 is canonical and rejects damaged encodings',()=>{
  for (let n=0;n<80;n++) { const bytes=Uint8Array.from({length:n},(_,i)=>(i*73+n)&255); assert.deepEqual(base32Decode(base32Encode(bytes)),bytes); }
  assert.throws(()=>base32Decode('A')); assert.throws(()=>base32Decode('AB')); assert.throws(()=>base32Decode('XYZ!'));
});
test('checksum rejects corrupted bytes or metadata; bounds reject oversize',()=>{
  assert.equal(crc32(encode('123456789')),'CBF43926');
  const packet=makePacket(encode('hello')); const parts=packet.split(' ');
  parts[3]=(parts[3][0]==='A' ? 'B' : 'A')+parts[3].slice(1);
  assert.throws(()=>readPacket(parts.join(' ')),/Checksum/);
  const altered=packet.split(' '); altered[2]='A'+altered[2].slice(1);
  assert.throws(()=>readPacket(altered.join(' ')));
  assert.throws(()=>readPacket(packet.slice(0,-4)),/Incomplete/);
  assert.throws(()=>makePacket(new Uint8Array(MAX_BYTES+1)));
  assert.throws(()=>makePacket(new Uint8Array(),{name:'x'.repeat(121)}),/Filename/);
  assert.equal(readPacket(makePacket(new Uint8Array(),{name:'👋'.repeat(60),type:'🦊'.repeat(60)})).name,'👋'.repeat(60));
});
test('frame parser waits for full terminator and ignores END payload token',()=>{
  assert.deepEqual(framesIn('VVV MT1 ABC END 12345678 EN'),[]);
  assert.deepEqual(framesIn('VVV MT1 ABC END 12345678 END'),['VVV MT1 ABC END 12345678 END']);
});
test('plain Morse validates unsupported characters and follows standard timing',()=>{
  assert.equal(normalizePlain(' hello\n world '),'HELLO WORLD'); assert.throws(()=>normalizePlain('ሰላም'));
  assert.equal(toMorse('SOS'),'... --- ...'); assert.equal(duration('PARIS',20),3);
});
function decodeAudio(wire,{wpm=30,frequency=700,sampleRate=48000,amplitude=.2,noise=.002,jitter=0}={}) {
  const decoder=new TimingDecoder(wpm); let maxAmplitude=0;
  const detector=new ToneDetector(sampleRate,frequency,.01,event=>{decoder.update(event.on,event.time);maxAmplitude=Math.max(maxAmplitude,event.amplitude);});
  let count=0,seed=1234,seg=0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296;};
  for (const segment of [{on:false,units:8},...timeline(wire),{on:false,units:8}]) {
    const samples=Math.round(segment.units*1.2/wpm*sampleRate*(1+jitter*Math.sin(++seg)));
    let remaining=samples,within=0;
    while (remaining) {
      const n=Math.min(128,remaining),block=new Float32Array(n);
      for (let i=0;i<n;i++) {
        const ramp=Math.min(1,(within+i)/(sampleRate*.003),(samples-within-i-1)/(sampleRate*.003));
        block[i]=(segment.on ? amplitude*ramp*Math.sin(2*Math.PI*frequency*(count+i)/sampleRate) : 0)+(random()-.5)*noise;
      }
      detector.push(block); count+=n; within+=n; remaining-=n;
    }
  }
  decoder.advance(count/sampleRate+1); return {text:decoder.text.trim(),morse:decoder.morse,maxAmplitude};
}
for (const wpm of [10,20,30,40,50]) test(`sampled audio restores exact packet at ${wpm} WPM (44.1 kHz, noise and jitter)`,()=>{
  const original='Hi ሰላም 👋\n'; const packet=makePacket(encode(original),{name:'',type:''});
  const decoded=decodeAudio(packet,{wpm,sampleRate:44100,jitter:.08});
  assert.equal(decoded.text,packet); assert.equal(readPacket(decoded.text).text,original);
});
for (const frequency of [550,700,900]) test(`sampled audio detects Morse at ${frequency} Hz`,()=>{
  assert.equal(decodeAudio('SOS TEST 123',{frequency}).text,'SOS TEST 123');
});
test('noise and a strongly off-frequency tone do not decode into messages',()=>{
  const decoder=new TimingDecoder(30); const detector=new ToneDetector(48000,700,.01,e=>decoder.update(e.on,e.time));
  const noise=Float32Array.from({length:96000},(_,i)=>.02*Math.sin(i*1.831)+.1*Math.sin(2*Math.PI*2100*i/48000));
  detector.push(noise); decoder.advance(3); assert.equal(decoder.text,'');
});
test('invalid long pulse is not silently treated as a valid dash',()=>{
  const decoder=new TimingDecoder(30); decoder.update(true,1); decoder.update(false,2); decoder.advance(3); assert.equal(decoder.text.trim(),'?');
});
