import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {TimingDecoder,timeline} from '../core.mjs';
const events=[]; let Processor;
const context=vm.createContext({sampleRate:12000,AudioWorkletProcessor:class {constructor(){this.port={postMessage:event=>events.push(event)};}},registerProcessor:(name,Constructor)=>{assert.equal(name,'morse-receiver');Processor=Constructor;}});
const modules=new Map();
async function load(url) {
  if(modules.has(url.href))return modules.get(url.href);
  const mod=new vm.SourceTextModule(await readFile(url,'utf8'),{context,identifier:url.href}); modules.set(url.href,mod);
  await mod.link((specifier,ref)=>load(new URL(specifier,ref.identifier))); return mod;
}
const module=await load(new URL('../receiver-worklet.mjs',import.meta.url)); await module.evaluate();
const receiver=new Processor({processorOptions:{frequency:700,threshold:.01}});
let offset=0;
for(const segment of [{on:false,units:8},...timeline('SOS TEST 123'),{on:false,units:8}]) {
  const count=segment.units*.04*12000;
  for(let start=0;start<count;start+=128){
    const size=Math.min(128,count-start),input=new Float32Array(size),output=new Float32Array(size).fill(1);
    for(let i=0;i<size;i++)input[i]=segment.on?.25*Math.sin(2*Math.PI*700*(offset+i)/12000):0;
    assert.equal(receiver.process([[input]],[[output]]),true); assert.ok(output.every(value=>value===0));offset+=size;
  }
}
const decoder=new TimingDecoder(30);for(const event of events)decoder.update(event.on,event.time);decoder.advance(offset/12000+1);
assert.equal(decoder.text.trim(),'SOS TEST 123');
console.log('AudioWorklet isolated-global integration passed');
