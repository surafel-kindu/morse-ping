import {MAX_BYTES, TimingDecoder, ToneDetector, normalizePlain, toMorse, timeline, duration, makePacket, readPacket, framesIn} from './core.mjs';
const $=id=>document.getElementById(id);
const encoder=new TextEncoder();
let inputKind='text', textMode='plain', prepared=null, previewVersion=0, tx=null, rx=null, received=null, testing=false;
const seenFrames=new Set();
const settings=()=>({wpm:Number($('speed').value),frequency:Number($('frequency').value),threshold:Number($('threshold').value)/1000});
const status=(id,text,type='')=>{ $(id).textContent=text; $(id).className=`status ${type}`; };
function formatTime(seconds) { return seconds < 60 ? `${Math.ceil(seconds)} sec` : `${Math.floor(seconds/60)}m ${Math.ceil(seconds%60)}s`; }
function lockControls() {
  const busy=!!(tx || rx || testing);
  for (const id of ['speed','frequency','threshold','self-test','receive-mode']) $(id).disabled=busy;
  $('listen').disabled=busy; $('stop-listen').disabled=!rx;
  $('send').disabled=busy || !prepared; $('stop-send').disabled=!tx;
  for (const id of ['message','file','text-tab','file-tab']) $(id).disabled=!!tx || testing;
  $('mode').disabled=!!tx || testing || inputKind==='file';
  $('clear').disabled=!!tx || testing;
}
async function updatePreview() {
  const version=++previewVersion; prepared=null; lockControls();
  try {
    let bytes, wire;
    const plain=inputKind==='text' && $('mode').value==='plain';
    if (inputKind==='file') {
      const file=$('file').files[0];
      if (!file) throw new Error('Choose a file to prepare a transfer.');
      if (file.size > MAX_BYTES) throw new Error('This file is too large. Choose a file up to 2 KB (2,048 bytes).');
      bytes=new Uint8Array(await file.arrayBuffer());
      wire=makePacket(bytes,{kind:'file',name:file.name,type:file.type || 'application/octet-stream'});
    } else {
      const text=$('message').value;
      bytes=plain ? null : encoder.encode(text);
      $('input-count').textContent=plain ? `${[...text].length.toLocaleString()} characters` : `${bytes.length.toLocaleString()} bytes`;
      $('text-note').textContent=plain ? 'Send letters, numbers & punctuation directly.' : 'Exact transfer keeps case, emoji & Unicode.';
      if (!text.length) throw new Error('Enter a message to prepare a transfer.');
      wire=plain ? normalizePlain(text) : makePacket(bytes);
    }
    if (version!==previewVersion) return;
    prepared={wire,bytes,plain,segments:timeline(wire)};
    const seconds=duration(wire,settings().wpm);
    $('duration').textContent=formatTime(seconds); $('payload-size').textContent=plain ? `${wire.length} characters` : `${bytes.length} bytes`;
    $('send-morse').textContent=toMorse(wire);
    $('encoding-note').textContent=$('mode').value==='plain' && inputKind==='text' ? 'Each letter, number, or supported punctuation mark goes directly to Morse. Text becomes uppercase with single spaces. Choose Text on the receiver; there is no checksum.' : 'Exact transfer encodes the original bytes, filename, and type in Morse-safe characters and adds a CRC32 checksum.';
    if (!tx) status('send-status',seconds>180 ? `This transfer takes ${formatTime(seconds)}. Morse is best for very small messages.` : 'Ready when you are. Start the receiver first.');
  } catch(error) {
    if (version!==previewVersion) return;
    $('duration').textContent='—'; $('payload-size').textContent='—'; $('send-morse').textContent='';
    status('send-status',error.message,'error');
  }
  lockControls();
}
function setInputKind(kind) {
  if (inputKind==='text') textMode=$('mode').value;
  inputKind=kind;
  for (const k of ['text','file']) {
    const selected=k===kind; $(`${k}-panel`).hidden=!selected;
    $(`${k}-tab`).classList.toggle('active',selected); $(`${k}-tab`).setAttribute('aria-selected',String(selected)); $(`${k}-tab`).tabIndex=selected ? 0 : -1;
  }
  $('mode').value=kind==='file' ? 'exact' : textMode;
  updatePreview();
}
$('text-tab').onclick=()=>setInputKind('text'); $('file-tab').onclick=()=>setInputKind('file');
for (const id of ['text-tab','file-tab']) $(id).onkeydown=event=>{
  if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) { event.preventDefault(); const kind=event.key==='Home' ? 'text' : event.key==='End' ? 'file' : inputKind==='text' ? 'file' : 'text'; setInputKind(kind); $(`${kind}-tab`).focus(); }
};
$('message').oninput=updatePreview; $('mode').onchange=()=>{ textMode=$('mode').value; updatePreview(); }; $('speed').onchange=updatePreview;
$('file').onchange=()=>{ $('file-label').textContent=$('file').files[0]?.name || 'Choose a tiny file'; updatePreview(); };
$('threshold').oninput=()=>{ $('threshold-value').value=(Number($('threshold').value)/1000).toFixed(3); };
function audioContext() {
  const Constructor=window.AudioContext || window.webkitAudioContext;
  if (!Constructor) throw new Error('This browser does not support Web Audio. Try a current browser.');
  return new Constructor({latencyHint:'interactive'});
}
async function stopSending(completed=false) {
  const session=tx; if (!session) return; tx=null;
  cancelAnimationFrame(session.animation); clearTimeout(session.timer);
  if (session.context.state!=='closed') await session.context.close().catch(()=>{});
  $('tone-light').classList.remove('on'); $('tone-light').setAttribute('aria-label','Tone off');
  if (completed) $('send-progress').value=1;
  status('send-status',completed ? (session.plain ? 'Sound sent. Read the text on the receiving device.' : 'Sound sent. Check the receiving device for verification.') : 'Transmission stopped. Resend the whole message to restore it.');
  lockControls();
}
$('stop-send').onclick=()=>stopSending();
$('send').onclick=async()=>{
  if (!prepared || tx || rx || testing) return;
  const packet=prepared; const {wpm,frequency}=settings();
  let session;
  try {
    const context=audioContext(); session={context,plain:packet.plain}; tx=session; lockControls();
    await context.resume(); if (tx!==session) return;
    const oscillator=context.createOscillator(), gain=context.createGain();
    oscillator.type='sine'; oscillator.frequency.value=frequency; gain.gain.value=0;
    oscillator.connect(gain).connect(context.destination);
    const start=context.currentTime+.25, unit=1.2/wpm;
    let time=start; const edges=[];
    for (const segment of packet.segments) {
      const end=time+segment.units*unit;
      if (segment.on) {
        const ramp=Math.min(.003,unit*.1);
        gain.gain.setValueAtTime(0,time); gain.gain.linearRampToValueAtTime(.35,time+ramp);
        gain.gain.setValueAtTime(.35,end-ramp); gain.gain.linearRampToValueAtTime(0,end);
      }
      edges.push({start:time,end,on:segment.on}); time=end;
    }
    oscillator.start(start); oscillator.stop(time+.05);
    let edgeIndex=0;
    function draw() {
      if (tx!==session) return;
      const now=context.currentTime;
      while (edgeIndex<edges.length-1 && edges[edgeIndex].end<now) edgeIndex++;
      const on=now>=start && now<time && edges[edgeIndex]?.on;
      $('tone-light').classList.toggle('on',!!on); $('tone-light').setAttribute('aria-label',on ? 'Tone on' : 'Tone off');
      $('send-progress').value=Math.max(0,Math.min(1,(now-start)/(time-start)));
      status('send-status',`Transmitting · ${formatTime(Math.max(0,time-now))} remaining. Keep this page active.`);
      // Audio clock, rather than a wall-clock timer, tolerates context suspension.
      if (now>=time+.05) { stopSending(true); return; }
      session.animation=requestAnimationFrame(draw);
    }
    draw();
  } catch(error) {
    if (tx===session) await stopSending();
    status('send-status',`Unable to play: ${error.message}`,'error');
  }
};
function showReceived(result, verified=true) {
  received=result; $('result').hidden=false;
  $('result-title').textContent=verified ? (result.kind==='text' ? 'Original text restored' : 'Original file restored') : 'Received text';
  $('result-badge').textContent=verified ? '✓ CHECKSUM OK' : 'TEXT · NO CHECKSUM';
  $('received-text').textContent=result.kind==='text' ? result.text : `${result.name}\n${result.bytes.length} bytes · ${result.type || 'unknown type'}`;
  $('download').textContent=verified ? 'Download original' : 'Download text';
  status('receive-status',verified ? `Transfer verified · ${result.bytes.length} bytes restored.` : 'Letters and numbers decoded directly. Text is uppercase; this mode has no checksum.',verified ? 'success' : '');
}
function makeDecoder(wpm, mode=$('receive-mode').value) {
  return new TimingDecoder(wpm,(_character,text,morse)=>{
    $('received-morse').textContent=morse; $('received-characters').textContent=text;
    if (mode==='plain') {
      const message=text.trimEnd();
      // UTF-8 is used only to save a downloaded .txt file. The sound carries
      // the letters themselves, without Base32 or a binary transfer frame.
      showReceived({kind:'text',name:'message.txt',type:'text/plain',bytes:encoder.encode(message),text:message},false);
      return;
    }
    for (const frame of framesIn(text)) {
      if (seenFrames.has(frame)) continue;
      seenFrames.add(frame);
      if (seenFrames.size>20) seenFrames.delete(seenFrames.values().next().value);
      try { showReceived(readPacket(frame)); }
      catch(error) { status('receive-status',error.message,'error'); }
    }
  });
}
async function stopListening() {
  const session=rx; if (!session) return; rx=null;
  session.cancelled=true; session.stream?.getTracks().forEach(track=>track.stop());
  session.node?.disconnect(); session.source?.disconnect();
  if (session.context?.state!=='closed') await session.context?.close().catch(()=>{});
  session.decoder?.flush();
  $('listen-orb').classList.remove('active','detected'); $('signal-meter').style.width='0%';
  $('listen-label').textContent='Listening stopped'; $('listen-hint').textContent='Start again for the next message.';
  if (!$('receive-status').classList.contains('success') && !$('receive-status').classList.contains('error')) status('receive-status',$('receive-mode').value==='plain' ? 'Microphone released. Received text is shown above.' : 'Microphone released. Incomplete exact transfers need to be resent.');
  lockControls();
}
$('stop-listen').onclick=stopListening;
$('listen').onclick=async()=>{
  if (rx || tx || testing) return;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { status('receive-status','Microphone access requires HTTPS or localhost. A phone cannot listen using an ordinary HTTP LAN address.','error'); return; }
  let session;
  try {
    clearSignal();
    const context=audioContext(); session={context,cancelled:false}; rx=session; lockControls();
    status('receive-status','Requesting microphone access…');
    await context.resume(); if (session.cancelled) return;
    session.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
    if (session.cancelled) { session.stream.getTracks().forEach(track=>track.stop()); return; }
    if (!context.audioWorklet) throw new Error('AudioWorklet is unavailable. Try a current browser over HTTPS.');
    await context.audioWorklet.addModule('./receiver-worklet.mjs'); if (session.cancelled) return;
    const {wpm,frequency,threshold}=settings(); session.decoder=makeDecoder(wpm);
    session.node=new AudioWorkletNode(context,'morse-receiver',{processorOptions:{frequency,threshold}});
    session.source=context.createMediaStreamSource(session.stream);
    session.node.port.onmessage=({data})=>{
      if (rx!==session) return;
      session.decoder.update(data.on,data.time);
      $('signal-meter').style.width=`${Math.min(100,data.amplitude*400)}%`;
      $('listen-orb').classList.toggle('detected',data.on);
      $('listen-label').textContent=data.on ? 'Morse tone detected' : 'Listening for a signal';
    };
    session.source.connect(session.node).connect(context.destination);
    await context.resume(); if (session.cancelled) return;
    context.onstatechange=()=>{
      if (rx===session && context.state==='suspended') status('receive-status','Audio paused by the browser. Keep the page in the foreground; stop and restart listening if needed.','error');
    };
    session.stream.getTracks()[0].onended=()=>{ if (rx===session) { stopListening(); status('receive-status','The microphone disconnected. Restart listening.','error'); } };
    $('listen-orb').classList.add('active'); $('listen-label').textContent='Listening for a signal';
    $('listen-hint').textContent=`${frequency} Hz · ${wpm} WPM · play on the sender now`;
    $('receive-details').open=true; status('receive-status',`Listening for ${$('receive-mode').value==='plain' ? 'direct text' : 'a file / exact Unicode transfer'}. Match sender settings and keep this page active.`);
  } catch(error) {
    if (session?.cancelled) return;
    if (rx===session) await stopListening();
    const message=error.name==='NotAllowedError' ? 'Microphone permission was denied. Allow microphone access in the browser and try again.' : error.message;
    status('receive-status',message,'error');
  }
};
function clearSignal() {
  received=null; seenFrames.clear(); if (rx?.decoder) rx.decoder.reset();
  $('received-morse').textContent='Dots and dashes will appear here.'; $('received-characters').textContent='Waiting…'; $('result').hidden=true;
  status('receive-status',rx ? 'Signal cleared. Start a complete transmission.' : 'Microphone audio stays on this device.');
}
$('clear').onclick=clearSignal;
$('receive-mode').onchange=()=>{
  clearSignal();
  $('receive-mode-note').textContent=$('receive-mode').value==='plain' ? 'Letters appear as they arrive. Match the sender’s Direct text mode.' : 'Restore a file or exact Unicode text after checksum verification. Match the sender’s Exact transfer mode.';
};
$('download').onclick=()=>{
  if (!received) return;
  const url=URL.createObjectURL(new Blob([received.bytes],{type:received.type || 'application/octet-stream'}));
  const link=document.createElement('a'); link.href=url; link.download=received.name.replace(/[\/\\\x00-\x1f]/g,'_') || 'message.txt';
  document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),10000);
};
$('self-test').onclick=async()=>{
  if (testing || tx || rx) return;
  testing=true; clearSignal(); lockControls();
  status('receive-status','Testing generated audio through the tone detector and transfer decoder…');
  await new Promise(resolve=>requestAnimationFrame(resolve));
  try {
    const {wpm,frequency,threshold}=settings(), sampleRate=12000, unit=1.2/wpm;
    const mode=$('receive-mode').value;
    const expectedText=mode==='plain' ? 'HELLO 123' : 'Hi 👋';
    const packet=mode==='plain' ? expectedText : makePacket(encoder.encode(expectedText),{name:'',type:''});
    const decoder=makeDecoder(wpm), detector=new ToneDetector(sampleRate,frequency,threshold,event=>decoder.update(event.on,event.time));
    let offset=0, segmentIndex=0;
    // Synthetic test only: this does not exercise a physical speaker/microphone.
    for (const segment of [{on:false,units:8},...timeline(packet),{on:false,units:8}]) {
      const count=Math.round(segment.units*unit*sampleRate), block=new Float32Array(count);
      if (segment.on) for (let i=0;i<count;i++) {
        const ramp=Math.min(1,i/(sampleRate*.003),(count-1-i)/(sampleRate*.003));
        block[i]=.25*ramp*Math.sin(2*Math.PI*frequency*(offset+i)/sampleRate);
      }
      detector.push(block); offset+=count;
      if (++segmentIndex%200===0) await new Promise(resolve=>setTimeout(resolve,0));
    }
    decoder.advance(offset/sampleRate+unit*8);
    if (!received || received.text!==expectedText) throw new Error('Self-test failed to restore the generated message.');
    $('receive-details').open=true;
    status('receive-status',`Audio self-test passed: ${mode==='plain' ? 'letters and numbers decoded directly' : 'original Unicode text restored'}. Physical two-device testing is still needed.`,'success');
  } catch(error) { status('receive-status',error.message,'error'); }
  testing=false; lockControls();
};
window.addEventListener('pagehide',()=>{ stopSending(); stopListening(); });
updatePreview();
