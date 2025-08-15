// Synthé Web Modulaire - Version corrigée & complète

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const modules = [];
let moduleId = 1;
let audioStarted = false;

// ===== Classe de base =====
class AudioModule {
  constructor(type, name) {
    this.type = type;
    this.name = name || `${type} #${moduleId++}`;
    this.inputs = [];
    this.outputs = [];
    this.node = null;
  }
  connect(target) {
    if (this.node && target.node && this.node.connect) {
      this.node.connect(target.node);
      this.outputs.push(target);
      target.inputs.push(this);
    }
  }
}

// ===== Modules =====
class OscillatorModule extends AudioModule {
  constructor(audioCtx) {
    super('Oscillateur');
    this.audioCtx = audioCtx;
    this.osc = audioCtx.createOscillator();
    this.gain = audioCtx.createGain();
    this.osc.connect(this.gain);
    this.osc.type = 'sawtooth';
    this.osc.frequency.value = 220;
    this.gain.gain.value = 0.5;
    this.node = this.gain;
    this.started = false;
  }
  start() { if (!this.started) { this.osc.start(); this.started = true; } }
  setFrequency(v){ this.osc.frequency.value = v; }
  setGain(v){ this.gain.gain.value = v; }
}

class GainModule extends AudioModule {
  constructor(audioCtx){ super('Gain'); this.node = audioCtx.createGain(); this.node.gain.value = 0.5; }
  setGain(v){ this.node.gain.value = v; }
}

class FilterModule extends AudioModule {
  constructor(audioCtx){
    super('Filtre');
    this.node = audioCtx.createBiquadFilter();
    this.node.type = 'lowpass';
    this.node.frequency.value = 800;
    this.node.Q.value = 1;
  }
  setFrequency(v){ this.node.frequency.value = v; }
  setQ(v){ this.node.Q.value = v; }
}

class DelayModule extends AudioModule {
  constructor(audioCtx){
    super('Delay');
    this.delayNode = audioCtx.createDelay(5.0);
    this.feedback = audioCtx.createGain();
    this.wetGain = audioCtx.createGain();
    this.output = audioCtx.createGain();
    this.delayNode.delayTime.value = 0.3;
    this.feedback.gain.value = 0.3;
    this.wetGain.gain.value = 0.5;
    this.delayNode.connect(this.feedback);
    this.feedback.connect(this.delayNode);
    this.delayNode.connect(this.wetGain);
    this.wetGain.connect(this.output);
    this.node = this.delayNode;
    this.outputNode = this.output;
  }
  connect(target){
    const out = this.outputNode || this.node;
    if (out && target.node && out.connect) {
      out.connect(target.node); this.outputs.push(target); target.inputs.push(this);
    }
  }
  setDelay(v){ this.delayNode.delayTime.value = v; }
  setFeedback(v){ this.feedback.gain.value = v; }
}

class ReverbModule extends AudioModule {
  constructor(audioCtx){
    super('Reverb');
    this.convolver = audioCtx.createConvolver();
    const rate = audioCtx.sampleRate, length = rate * 2.5;
    const impulse = audioCtx.createBuffer(2, length, rate);
    for (let c=0;c<2;c++){ const ch = impulse.getChannelData(c);
      for (let i=0;i<length;i++){ ch[i]=(Math.random()*2-1)*Math.pow(1-i/length,2); } }
    this.convolver.buffer = impulse;
    this.wet = audioCtx.createGain(); this.wet.gain.value = 0.5;
    this.output = audioCtx.createGain();
    this.convolver.connect(this.wet); this.wet.connect(this.output);
    this.node = this.convolver; this.outputNode = this.output;
  }
  connect(target){
    const out = this.outputNode || this.node;
    if (out && target.node && out.connect) {
      out.connect(target.node); this.outputs.push(target); target.inputs.push(this);
    }
  }
  setWet(v){ this.wet.gain.value = v; }
}

class DistortionModule extends AudioModule {
  constructor(audioCtx){ super('Distortion'); this.node = audioCtx.createWaveShaper(); this.amount = 20; this.setAmount(this.amount); }
  setAmount(amount){
    this.amount = amount;
    const n=44100, curve=new Float32Array(n), k=(typeof amount==='number'?amount:20);
    for(let i=0;i<n;i++){ const x=i*2/n-1; curve[i]=((3+k)*x*20*Math.PI/180)/(Math.PI+k*Math.abs(x)); }
    this.node.curve=curve; this.node.oversample='4x';
  }
}

class LFOModule extends AudioModule {
  constructor(audioCtx){
    super('LFO');
    this.audioCtx = audioCtx;
    this.osc = audioCtx.createOscillator();
    this.gain = audioCtx.createGain();
    this.osc.connect(this.gain);
    this.osc.type='sine'; this.osc.frequency.value=2; this.gain.gain.value=0.5;
    this.node = this.gain; this.started=false;
  }
  start(){ if(!this.started){ this.osc.start(); this.started=true; } }
  setFrequency(v){ this.osc.frequency.value=v; }
  setDepth(v){ this.gain.gain.value=v; }
}

class CompressorModule extends AudioModule {
  constructor(audioCtx){
    super('Compressor');
    this.node = audioCtx.createDynamicsCompressor();
    this.node.threshold.value=-24; this.node.knee.value=30; this.node.ratio.value=12;
    this.node.attack.value=0.003; this.node.release.value=0.25;
  }
  setThreshold(v){ this.node.threshold.value=v; }
  setRatio(v){ this.node.ratio.value=v; }
  setAttack(v){ this.node.attack.value=v; }
  setRelease(v){ this.node.release.value=v; }
}

class ChorusModule extends AudioModule {
  constructor(audioCtx){
    super('Chorus');
    this.input = audioCtx.createGain();
    this.delayL = audioCtx.createDelay(0.05);
    this.delayR = audioCtx.createDelay(0.05);
    this.lfoL = audioCtx.createOscillator();
    this.lfoR = audioCtx.createOscillator();
    this.lfoGainL = audioCtx.createGain();
    this.lfoGainR = audioCtx.createGain();
    this.merger = audioCtx.createChannelMerger(2);
    this.splitter = audioCtx.createChannelSplitter(2);
    this.wet = audioCtx.createGain();
    this.dry = audioCtx.createGain();
    this.output = audioCtx.createGain();
    this.delayL.delayTime.value=0.015; this.delayR.delayTime.value=0.025;
    this.lfoL.frequency.value=0.5; this.lfoR.frequency.value=0.7;
    this.lfoGainL.gain.value=0.005; this.lfoGainR.gain.value=0.005;
    this.wet.gain.value=0.5; this.dry.gain.value=0.7;
    this.input.connect(this.splitter);
    this.splitter.connect(this.delayL,0);
    this.splitter.connect(this.delayR,1);
    this.lfoL.connect(this.lfoGainL); this.lfoR.connect(this.lfoGainR);
    this.lfoGainL.connect(this.delayL.delayTime); this.lfoGainR.connect(this.delayR.delayTime);
    this.delayL.connect(this.merger,0,0); this.delayR.connect(this.merger,0,1);
    this.merger.connect(this.wet); this.input.connect(this.dry);
    this.wet.connect(this.output); this.dry.connect(this.output);
    this.lfoL.start(); this.lfoR.start();
    this.node = this.input; this.outputNode = this.output;
  }
  connect(target){
    const out=this.outputNode||this.node;
    if(out && target.node && out.connect){ out.connect(target.node); this.outputs.push(target); target.inputs.push(this); }
  }
  setRate(v){ this.lfoL.frequency.value=v; this.lfoR.frequency.value=v*1.4; }
  setDepth(v){ this.lfoGainL.gain.value=v*0.01; this.lfoGainR.gain.value=v*0.01; }
  setMix(v){ this.wet.gain.value=v; this.dry.gain.value=1-v; }
}

class EnvelopeModule extends AudioModule {
  constructor(audioCtx){
    super('Envelope');
    this.audioCtx = audioCtx;
    this.node = audioCtx.createGain();
    this.node.gain.value = 0;
    this.attack = 0.1; this.decay = 0.2; this.sustain = 0.7; this.releaseTime = 0.5;
    this.isPlaying = false;
  }
  trigger(){
    const now=this.audioCtx.currentTime;
    this.node.gain.cancelScheduledValues(now);
    this.node.gain.setValueAtTime(0, now);
    this.node.gain.linearRampToValueAtTime(1, now + this.attack);
    this.node.gain.linearRampToValueAtTime(this.sustain, now + this.attack + this.decay);
    this.isPlaying = true;
  }
  release(){
    if(this.isPlaying){
      const now=this.audioCtx.currentTime;
      this.node.gain.cancelScheduledValues(now);
      this.node.gain.setValueAtTime(this.node.gain.value, now);
      this.node.gain.linearRampToValueAtTime(0, now + this.releaseTime);
      this.isPlaying = false;
    }
  }
  setAttack(v){ this.attack=v; }
  setDecay(v){ this.decay=v; }
  setSustain(v){ this.sustain=v; }
  setRelease(v){ this.releaseTime=v; }
}

class NoiseModule extends AudioModule {
  constructor(audioCtx){ super('Noise'); this.audioCtx = audioCtx; this.createSource(); this.started=false; }
  createSource(){
    const bufferSize=this.audioCtx.sampleRate*2;
    const buffer=this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<bufferSize;i++) data[i]=Math.random()*2-1;
    this.source=this.audioCtx.createBufferSource(); this.source.buffer=buffer; this.source.loop=true;
    this.gain=this.audioCtx.createGain(); this.gain.gain.value=0.1;
    this.source.connect(this.gain); this.node=this.gain;
  }
  start(){ if(!this.started){ this.source.start(); this.started=true; } }
  restart(){ if(this.started){ this.source.stop(); this.createSource(); this.start(); } }
  setGain(v){ this.gain.gain.value=v; }
}

// ===== Gestion Audio =====
async function ensureAudioStarted(){
  if (!audioStarted && audioCtx.state !== 'running') {
    await audioCtx.resume(); audioStarted = true;
  }
}

// ===== Ajout de modules =====
function addModule(type){
  let mod=null;
  switch(type){
    case 'Oscillateur': mod=new OscillatorModule(audioCtx); mod.start(); break;
    case 'Gain': mod=new GainModule(audioCtx); break;
    case 'Filtre': mod=new FilterModule(audioCtx); break;
    case 'Delay': mod=new DelayModule(audioCtx); break;
    case 'Reverb': mod=new ReverbModule(audioCtx); break;
    case 'Distortion': mod=new DistortionModule(audioCtx); break;
    case 'LFO': mod=new LFOModule(audioCtx); mod.start(); break;
    case 'Compressor': mod=new CompressorModule(audioCtx); break;
    case 'Chorus': mod=new ChorusModule(audioCtx); break;
    case 'Envelope': mod=new EnvelopeModule(audioCtx); break;
    case 'Noise': mod=new NoiseModule(audioCtx); mod.start(); break;
  }
  if(mod){ modules.push(mod); renderModules(); }
}

// ===== UI =====
function renderModules() {
  const container = document.getElementById('modules');
  container.innerHTML = '';
  modules.forEach((mod, idx) => {
    const div = document.createElement('div');
    div.className = 'module';
    div.style.position = 'absolute';
    div.style.left = (typeof mod._x === 'number' ? mod._x : 100 + idx * 40) + 'px';
    div.style.top = (typeof mod._y === 'number' ? mod._y : 100 + idx * 40) + 'px';
    div.setAttribute('data-idx', idx);
    // Drag & drop modules
    let dragIdx = null, offsetX = 0, offsetY = 0;
    container.querySelectorAll('.module').forEach(div => {
      div.onmousedown = function(e) {
        if (e.button !== 0) return; // drag only with left mouse button
        dragIdx = +div.getAttribute('data-idx');
        offsetX = e.clientX - div.offsetLeft;
        offsetY = e.clientY - div.offsetTop;
        document.body.style.userSelect = 'none';
      };
    });
    document.onmousemove = function(e) {
      if (dragIdx !== null) {
        const div = container.querySelector('.module[data-idx="'+dragIdx+'"]');
        if (div) {
          let x = e.clientX - offsetX;
          let y = e.clientY - offsetY;
          div.style.left = x + 'px';
          div.style.top = y + 'px';
          modules[dragIdx]._x = x;
          modules[dragIdx]._y = y;
        }
      }
    };
    document.onmouseup = function() {
      dragIdx = null;
      document.body.style.userSelect = '';
    };
    let controls='';
    let connectUI = '';
    if(mod.type==='Oscillateur'){
      controls=`<label>Fréquence <input type="range" min="50" max="2000" value="${mod.osc.frequency.value}" step="1" data-idx="${idx}" data-type="freq"></label>
                <label>Gain <input type="range" min="0" max="1" value="${mod.gain.gain.value}" step="0.01" data-idx="${idx}" data-type="gain"></label>`;
    } else if(mod.type==='Gain'){
      controls=`<label>Gain <input type="range" min="0" max="1" value="${mod.node.gain.value}" step="0.01" data-idx="${idx}" data-type="gain"></label>`;
    } else if(mod.type==='Filtre'){
      controls=`<label>Fréquence <input type="range" min="50" max="5000" value="${mod.node.frequency.value}" step="1" data-idx="${idx}" data-type="freq"></label>
                <label>Q <input type="range" min="0.1" max="20" value="${mod.node.Q.value}" step="0.1" data-idx="${idx}" data-type="q"></label>`;
    } else if(mod.type==='Delay'){
      controls=`<label>Delay (s) <input type="range" min="0" max="2" value="${mod.delayNode.delayTime.value}" step="0.01" data-idx="${idx}" data-type="delay"></label>
                <label>Feedback <input type="range" min="0" max="0.95" value="${mod.feedback.gain.value}" step="0.01" data-idx="${idx}" data-type="feedback"></label>`;
    } else if(mod.type==='Reverb'){
      controls=`<label>Wet <input type="range" min="0" max="1" value="${mod.wet.gain.value}" step="0.01" data-idx="${idx}" data-type="wet"></label>`;
    } else if(mod.type==='Distortion'){
      controls=`<label>Amount <input type="range" min="0" max="100" value="${mod.amount}" step="1" data-idx="${idx}" data-type="amount"></label>`;
    } else if(mod.type==='LFO'){
      // Menu de modulation pour LFO
      let modOptions = '<option value="">--Moduler--</option>';
      modules.forEach((target, tIdx) => {
        if (tIdx !== idx) {
          if (target.type === 'Oscillateur') {
            modOptions += `<option value="${tIdx}:freq">${target.name} (Fréquence)</option>`;
            modOptions += `<option value="${tIdx}:gain">${target.name} (Gain)</option>`;
          } else if (target.type === 'Gain') {
            modOptions += `<option value="${tIdx}:gain">${target.name} (Gain)</option>`;
          } else if (target.type === 'Filtre') {
            modOptions += `<option value="${tIdx}:freq">${target.name} (Fréquence)</option>`;
            modOptions += `<option value="${tIdx}:q">${target.name} (Q)</option>`;
          }
        }
      });
      controls=`<label>Fréquence <input type="range" min="0.1" max="20" value="${mod.osc.frequency.value}" step="0.1" data-idx="${idx}" data-type="freq"></label>
                <label>Depth <input type="range" min="0" max="1" value="${mod.gain.gain.value}" step="0.01" data-idx="${idx}" data-type="depth"></label>
                <label>Moduler : <select data-idx="${idx}" class="lfo-target">${modOptions}</select></label>`;
    } else if(mod.type==='Compressor'){
      controls=`<label>Threshold <input type="range" min="-60" max="0" value="${mod.node.threshold.value}" step="1" data-idx="${idx}" data-type="threshold"></label>
                <label>Ratio <input type="range" min="1" max="20" value="${mod.node.ratio.value}" step="0.1" data-idx="${idx}" data-type="ratio"></label>
                <label>Attack <input type="range" min="0" max="1" value="${mod.node.attack.value}" step="0.001" data-idx="${idx}" data-type="attack"></label>
                <label>Release <input type="range" min="0" max="1" value="${mod.node.release.value}" step="0.01" data-idx="${idx}" data-type="releaseParam"></label>`;
    } else if(mod.type==='Chorus'){
      controls=`<label>Rate <input type="range" min="0.1" max="5" value="${mod.lfoL.frequency.value}" step="0.1" data-idx="${idx}" data-type="rate"></label>
                <label>Depth <input type="range" min="0" max="1" value="0.5" step="0.01" data-idx="${idx}" data-type="depth"></label>
                <label>Mix <input type="range" min="0" max="1" value="${mod.wet.gain.value}" step="0.01" data-idx="${idx}" data-type="mix"></label>`;
    } else if(mod.type==='Envelope'){
      // Menu de modulation pour Envelope
      let modOptions = '<option value="">--Moduler--</option>';
      modules.forEach((target, tIdx) => {
        if (tIdx !== idx) {
          if (target.type === 'Oscillateur') {
            modOptions += `<option value="${tIdx}:gain">${target.name} (Gain)</option>`;
          } else if (target.type === 'Gain') {
            modOptions += `<option value="${tIdx}:gain">${target.name} (Gain)</option>`;
          }
        }
      });
      controls=`<label>Attack <input type="range" min="0" max="2" value="${mod.attack}" step="0.01" data-idx="${idx}" data-type="attack"></label>
                <label>Decay <input type="range" min="0" max="2" value="${mod.decay}" step="0.01" data-idx="${idx}" data-type="decay"></label>
                <label>Sustain <input type="range" min="0" max="1" value="${mod.sustain}" step="0.01" data-idx="${idx}" data-type="sustain"></label>
                <label>Release <input type="range" min="0" max="2" value="${mod.releaseTime}" step="0.01" data-idx="${idx}" data-type="release"></label>
                <div style="margin-top:10px;">
                  <button data-idx="${idx}" class="trigger-btn">Trigger</button>
                  <button data-idx="${idx}" class="release-btn">Release</button>
                </div>
                <label>Moduler : <select data-idx="${idx}" class="env-target">${modOptions}</select></label>`;
    } else if(mod.type==='Noise'){
      controls=`<label>Gain <input type="range" min="0" max="0.5" value="${mod.gain.gain.value}" step="0.01" data-idx="${idx}" data-type="gain"></label>`;
    }

    // Options de connexion (sauf LFO et Envelope)
    if(mod.type!=='LFO' && mod.type!=='Envelope'){
      let connectOptions = '<option value="">--Connecter à--</option>';
      modules.forEach((t, tIdx)=>{ if(tIdx!==idx) connectOptions += `<option value="${tIdx}">${t.name}</option>`; });
      connectUI = `<select data-idx="${idx}" class="connectSelect">${connectOptions}</select>
        <button data-idx="${idx}" class="toOut">→ Sortie</button>`;
    }

    div.innerHTML = `
      <h3>${mod.name}</h3>
      <div class="controls">${controls}</div>
      <div style="margin-top:8px; display:flex; align-items:center; gap:8px;">
        ${connectUI}
        <button data-idx="${idx}" class="deleteModule" style="background:#e74c3c;color:#fff;">Supprimer</button>
      </div>`;
  // Event listeners pour la modulation LFO
  container.querySelectorAll('.lfo-target').forEach(sel => {
    sel.addEventListener('change', e => {
      const lfoIdx = +e.target.dataset.idx;
      const lfo = modules[lfoIdx];
      const val = e.target.value;
      if (!val) return;
      const [targetIdx, param] = val.split(':');
      const target = modules[+targetIdx];
      if (!target) return;
      // Déconnecte l'ancien
      if (lfo._modTarget && lfo._modParam) {
        try { lfo.osc.disconnect(); } catch {}
      }
      // Connecte le LFO au paramètre
      if (param === 'freq' && target.osc) {
        lfo.osc.connect(target.osc.frequency);
      } else if (param === 'gain' && target.gain) {
        lfo.osc.connect(target.gain.gain);
      } else if (param === 'gain' && target.node && target.node.gain) {
        lfo.osc.connect(target.node.gain);
      } else if (param === 'freq' && target.node && target.node.frequency) {
        lfo.osc.connect(target.node.frequency);
      } else if (param === 'q' && target.node && target.node.Q) {
        lfo.osc.connect(target.node.Q);
      }
      lfo._modTarget = target;
      lfo._modParam = param;
    });
  });

  // Event listeners pour la modulation Envelope
  container.querySelectorAll('.env-target').forEach(sel => {
    sel.addEventListener('change', e => {
      const envIdx = +e.target.dataset.idx;
      const env = modules[envIdx];
      const val = e.target.value;
      if (!val) return;
      const [targetIdx, param] = val.split(':');
      const target = modules[+targetIdx];
      if (!target) return;
      env._modTarget = target;
      env._modParam = param;
    });
  });
  // Suppression de module
  container.querySelectorAll('.deleteModule').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = +e.target.dataset.idx;
      const modToDelete = modules[idx];
      if (modToDelete) {
        // Déconnecte ce module de tous les autres
        modules.forEach(m => {
          m.inputs = m.inputs.filter(input => input !== modToDelete);
          m.outputs = m.outputs.filter(output => output !== modToDelete);
          if (m.node && modToDelete.node && m.node.disconnect) {
            try { m.node.disconnect(modToDelete.node); } catch {}
          }
          if (m.outputNode && modToDelete.node && m.outputNode.disconnect) {
            try { m.outputNode.disconnect(modToDelete.node); } catch {}
          }
        });
        // Arrête les sources si besoin (optionnel, safe)
        if (modToDelete.osc && typeof modToDelete.osc.stop === 'function') {
          try { modToDelete.osc.stop(); } catch {}
        }
        if (modToDelete.source && typeof modToDelete.source.stop === 'function') {
          try { modToDelete.source.stop(); } catch {}
        }
        // Supprime le module par référence même si pas d'entrée/sortie/source
        const i = modules.indexOf(modToDelete);
        if (i !== -1) modules.splice(i, 1);
        renderModules();
      }
    });
  });
    container.appendChild(div);
  });

  // Sliders
  container.querySelectorAll('input[type=range]').forEach(input=>{
    input.addEventListener('input', e=>{
      const idx=+e.target.dataset.idx, type=e.target.dataset.type, m=modules[idx], val=+e.target.value;
      if(!m) return;
      if(m.type==='Oscillateur'){ if(type==='freq') m.setFrequency(val); if(type==='gain') m.setGain(val); }
      else if(m.type==='Gain'){ if(type==='gain') m.setGain(val); }
      else if(m.type==='Filtre'){ if(type==='freq') m.setFrequency(val); if(type==='q') m.setQ(val); }
      else if(m.type==='Delay'){ if(type==='delay') m.setDelay(val); if(type==='feedback') m.setFeedback(val); }
      else if(m.type==='Reverb'){ if(type==='wet') m.setWet(val); }
      else if(m.type==='Distortion'){ if(type==='amount') m.setAmount(val); }
      else if(m.type==='LFO'){ if(type==='freq') m.setFrequency(val); if(type==='depth') m.setDepth(val); }
      else if(m.type==='Compressor'){
        if(type==='threshold') m.setThreshold(val);
        if(type==='ratio') m.setRatio(val);
        if(type==='attack') m.setAttack(val);
        if(type==='releaseParam') m.setRelease(val);
      }
      else if(m.type==='Chorus'){ if(type==='rate') m.setRate(val); if(type==='depth') m.setDepth(val); if(type==='mix') m.setMix(val); }
      else if(m.type==='Envelope'){
        if(type==='attack') m.setAttack(val);
        if(type==='decay') m.setDecay(val);
        if(type==='sustain') m.setSustain(val);
        if(type==='release') m.setRelease(val);
      }
      else if(m.type==='Noise'){ if(type==='gain') m.setGain(val); }
    });
  });

  // Connexions module → module
  container.querySelectorAll('.connectSelect').forEach(sel=>{
    sel.addEventListener('change', e=>{
      const fromIdx=+e.target.dataset.idx, toIdx=+e.target.value;
      if(modules[fromIdx] && modules[toIdx]) modules[fromIdx].connect(modules[toIdx]);
    });
  });

  // Connexion à la sortie
  container.querySelectorAll('.toOut').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const idx=+e.target.dataset.idx, m=modules[idx];
      if(!m) return;
      const nodeToConnect = m.outputNode || m.node;
      if(nodeToConnect) nodeToConnect.connect(audioCtx.destination);
    });
  });

  // Envelope triggers
  container.querySelectorAll('.trigger-btn').forEach(btn=>{
    btn.addEventListener('click', e=>{ const m=modules[+e.target.dataset.idx]; if(m && m.type==='Envelope') m.trigger(); });
  });
  container.querySelectorAll('.release-btn').forEach(btn=>{
    btn.addEventListener('click', e=>{ const m=modules[+e.target.dataset.idx]; if(m && m.type==='Envelope') m.release(); });
  });
}

// Boutons d’ajout
window.addEventListener('DOMContentLoaded', ()=>{
  const ids = [
    ['addOsc','Oscillateur'], ['addGain','Gain'], ['addFilter','Filtre'], ['addDelay','Delay'],
    ['addReverb','Reverb'], ['addDist','Distortion'], ['addLFO','LFO'], ['addComp','Compressor'],
    ['addChorus','Chorus'], ['addEnv','Envelope'], ['addNoise','Noise']
  ];
  ids.forEach(([id,type])=>{
    const btn=document.getElementById(id);
    if(!btn) return;
    btn.addEventListener('click', async ()=>{ await ensureAudioStarted(); addModule(type); });
  });
});
