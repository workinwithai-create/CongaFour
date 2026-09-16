const SF="https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@gh-pages/FluidR3_GM";
const STEPS=16,BARS=4;
const GROOVES=[
  {id:"tumbao",name:"Tumbao Porch",bpm:96,key:"A minor",feel:"2-3 clave, open on 4+"},
  {id:"guaguanco",name:"Guaguancó Fold",bpm:108,key:"D minor",feel:"rumba talk"},
  {id:"mozambique",name:"Mozambique Cut",bpm:118,key:"E minor",feel:"street pocket"},
  {id:"bossa",name:"Bossa Shade",bpm:88,key:"G major",feel:"soft thumb, late open"},
];
const RECIPES=[
  {id:"tumbao",name:"Tumbao",blurb:"Heel-toe, slap on 2, open on 4+."},
  {id:"martillo",name:"Martillo",blurb:"Bongo hammer: muted 1, slap 4."},
  {id:"guaguanco",name:"Guaguancó",blurb:"Quinto answers the tres."},
  {id:"mozambique",name:"Mozambique",blurb:"Offbeat opens, downbeat mute."},
  {id:"bossa",name:"Bossa",blurb:"Soft thumb, almost late."},
  {id:"cascara",name:"Cascará",blurb:"Shell pattern on the rim."},
];
const CHAIRS=[
  {id:"conga",label:"Conga",role:"tumba + quinto",locked:true},
  {id:"bongo",label:"Bongó",role:"martillo"},
  {id:"clave",label:"Clave",role:"2-3 wood"},
  {id:"kit",label:"Kit",role:"stiff reference"},
];
const H={o:{midi:63,label:"conga open"},s:{midi:62,label:"conga slap"},m:{midi:64,label:"conga mute"},bh:{midi:60,label:"bongo macho"},bl:{midi:61,label:"bongo hembra"},c:{midi:75,label:"clave"},k:{midi:36,label:"kick"},n:{midi:38,label:"snare"},h:{midi:42,label:"hat"}};
const url=m=>`${SF}/percussion-mp3/${m}.mp3`;
function recipeHits(id){
  if(id==="martillo")return[{step:0,hit:H.bh},{step:2,hit:H.bl},{step:4,hit:H.bh},{step:6,hit:H.bh},{step:8,hit:H.bl},{step:10,hit:H.bh},{step:12,hit:H.bh},{step:14,hit:H.bl}];
  if(id==="guaguanco")return[{step:0,hit:H.m},{step:3,hit:H.s},{step:6,hit:H.o},{step:8,hit:H.m},{step:11,hit:H.s},{step:14,hit:H.o}];
  if(id==="mozambique")return[{step:0,hit:H.m},{step:2,hit:H.o},{step:5,hit:H.s},{step:8,hit:H.m},{step:10,hit:H.o},{step:13,hit:H.s}];
  if(id==="bossa")return[{step:0,hit:H.m},{step:3,hit:H.o},{step:8,hit:H.m},{step:11,hit:H.o},{step:14,hit:H.s}];
  if(id==="cascara")return[{step:0,hit:H.s},{step:2,hit:H.m},{step:3,hit:H.s},{step:6,hit:H.s},{step:8,hit:H.m},{step:10,hit:H.s},{step:12,hit:H.m},{step:14,hit:H.s}];
  return[{step:0,hit:H.m},{step:4,hit:H.s},{step:6,hit:H.m},{step:10,hit:H.m},{step:14,hit:H.o}];
}
const claveHits=()=>[{step:0,hit:H.c},{step:4,hit:H.c},{step:10,hit:H.c},{step:12,hit:H.c},{step:14,hit:H.c}];
function stiffKit(){const ev=[];for(let s=0;s<STEPS;s++){if(s%4===0)ev.push({step:s,hit:H.k});if(s===4||s===12)ev.push({step:s,hit:H.n});ev.push({step:s,hit:H.h});}return ev;}
function expand(hits){const out=[];for(let b=0;b<BARS;b++)for(const h of hits)out.push({...h,abs:b*STEPS+h.step,bar:b});return out;}
const state={groove:GROOVES[0],recipe:RECIPES[0].id,chairs:{conga:true,bongo:true,clave:true,kit:false},mode:"stopped",ctx:null,buffers:new Map(),loopBuf:null,sources:[],timer:null};
const $=id=>document.getElementById(id);
const setStatus=t=>$("status").textContent=t;
const setMode=t=>{state.mode=t;$("modeLabel").textContent=t;};
async function ensureCtx(){if(!state.ctx)state.ctx=new AudioContext();if(state.ctx.state==="suspended")await state.ctx.resume();return state.ctx;}
async function loadSample(midi){if(state.buffers.has(midi))return state.buffers.get(midi);const ctx=await ensureCtx();const res=await fetch(url(midi));if(!res.ok)throw new Error("sample "+midi);const buf=await ctx.decodeAudioData(await res.arrayBuffer());state.buffers.set(midi,buf);return buf;}
async function seat(){setStatus("Seating live FluidR3 hands…");try{await Promise.all(Object.values(H).map(h=>loadSample(h.midi)));setStatus("Chairs seated. Live FluidR3 percussion.");}catch(e){setStatus("Some chairs missed a sample. Play anyway.");}}
function pocket(){let ev=expand(recipeHits(state.recipe));if(state.chairs.clave)ev=ev.concat(expand(claveHits()));if(state.recipe!=="martillo"&&state.chairs.bongo)ev=ev.concat(expand(recipeHits("martillo")).map(e=>({...e,gain:.55})));return ev;}
function playHit(ctx,when,hit,gain=.85){const buf=state.buffers.get(hit.midi);if(!buf)return;const src=ctx.createBufferSource();src.buffer=buf;const g=ctx.createGain();g.gain.value=gain;src.connect(g).connect(ctx.destination);src.start(when);state.sources.push(src);}
function stopAll(){for(const s of state.sources){try{s.stop();}catch{}}state.sources=[];if(state.timer)clearInterval(state.timer);state.timer=null;setMode("stopped");highlight(-1);}
const stepDur=g=>60/g.bpm/4;
function highlight(abs){document.querySelectorAll(".bar").forEach((el,i)=>el.classList.toggle("active",abs>=0&&Math.floor(abs/STEPS)===i));document.querySelectorAll(".bar li").forEach(li=>li.classList.toggle("now",Number(li.dataset.abs)===abs));}
async function playMode(mode){stopAll();const ctx=await ensureCtx();const g=state.groove;const dur=stepDur(g);const start=ctx.currentTime+.06;if(state.loopBuf&&mode==="pocket"){const src=ctx.createBufferSource();src.buffer=state.loopBuf;const gain=ctx.createGain();gain.gain.value=.7;src.connect(gain).connect(ctx.destination);src.start(start);state.sources.push(src);}else if(mode==="stiff"||state.chairs.kit){for(const e of expand(stiffKit()))playHit(ctx,start+e.abs*dur,e.hit,.35);}if(mode==="pocket"){for(const e of pocket()){if(["kick","snare","hat"].includes(e.hit.label))continue;playHit(ctx,start+e.abs*dur,e.hit,e.gain??.88);}}setMode(mode==="stiff"?"A · stiff kit":"B · pocket");const total=BARS*STEPS,t0=performance.now();state.timer=setInterval(()=>{const abs=Math.floor((performance.now()-t0)/1000/dur);if(abs>=total){stopAll();return;}highlight(abs);},40);}
function punchText(){const g=state.groove,rec=RECIPES.find(r=>r.id===state.recipe);const lines=[`CongaFour punch list`,`${g.name} · ${g.bpm} BPM · ${g.key} · ${g.feel}`,`Recipe: ${rec.name} — ${rec.blurb}`,`Chairs: ${Object.entries(state.chairs).filter(([,v])=>v).map(([k])=>k).join(", ")}`,"","Lock the WAV to bar 1. Hands sit 2–4 dB under the kit.","Do not quantize the 4+ open — that late is the pocket.","Mute the programmed shaker if it fights the tumbao slap.","Export MIDI as GM percussion (60–64 conga/bongo, 75 clave).","", "Bar 1 map:"];for(const e of pocket().filter(e=>e.bar===0).sort((a,b)=>a.step-b.step))lines.push(`  step ${String(e.step).padStart(2,"0")}  ${e.hit.label}`);return lines.join("\n");}
function render(){const gg=$("grooves");gg.innerHTML="";for(const g of GROOVES){const b=document.createElement("button");b.className=g.id===state.groove.id?"on":"";b.innerHTML=`<strong>${g.name}</strong><small>${g.bpm} · ${g.feel}</small>`;b.onclick=()=>{state.groove=g;render();};gg.appendChild(b);}const rr=$("recipes");rr.innerHTML="";for(const r of RECIPES){const b=document.createElement("button");b.className=r.id===state.recipe?"on":"";b.innerHTML=`<strong>${r.name}</strong><small>${r.blurb}</small>`;b.onclick=()=>{state.recipe=r.id;render();};rr.appendChild(b);}const cc=$("chairs");cc.innerHTML="";for(const c of CHAIRS){const b=document.createElement("button");b.className=state.chairs[c.id]?"on":"";b.innerHTML=`<strong>${c.label}</strong><small>${c.role}</small>`;b.onclick=()=>{if(c.locked)return;state.chairs[c.id]=!state.chairs[c.id];render();};cc.appendChild(b);}const bb=$("bars");bb.innerHTML="";const ev=pocket();for(let i=0;i<BARS;i++){const bar=document.createElement("div");bar.className="bar";bar.innerHTML=`<div class="top"><span class="chord">Bar ${i+1}</span><span class="n">${state.groove.bpm}</span></div>`;const ol=document.createElement("ol");for(const h of ev.filter(e=>e.bar===i&&e.hit!==H.c).slice(0,6)){const li=document.createElement("li");li.dataset.abs=String(h.abs);li.textContent=`${String(h.step).padStart(2,"0")} ${h.hit.label.replace("conga ","").replace("bongo ","b·")}`;ol.appendChild(li);}bar.appendChild(ol);bb.appendChild(bar);}$("punch").textContent=punchText();}
function writeMidi(events){const ticks=480,tempo=Math.round(60000000/state.groove.bpm),track=[];const vlq=n=>{const bytes=[n&127];n>>=7;while(n>0){bytes.unshift((n&127)|128);n>>=7;}track.push(...bytes);};track.push(0x00,0xff,0x51,0x03,(tempo>>16)&255,(tempo>>8)&255,tempo&255);let last=0;for(const e of [...events].sort((a,b)=>a.abs-b.abs)){const tick=e.abs*(ticks/4);vlq(tick-last);last=tick;track.push(0x99,e.hit.midi,100);vlq(60);track.push(0x89,e.hit.midi,0);last+=60;}track.push(0x00,0xff,0x2f,0x00);const header=[0x4d,0x54,0x68,0x64,0,0,0,6,0,0,0,1,(ticks>>8)&255,ticks&255];const th=[0x4d,0x54,0x72,0x6b,(track.length>>24)&255,(track.length>>16)&255,(track.length>>8)&255,track.length&255];return new Uint8Array([...header,...th,...track]);}
function encodeWav(audio){const ch0=audio.getChannelData(0),ch1=audio.numberOfChannels>1?audio.getChannelData(1):ch0,len=ch0.length,buf=new ArrayBuffer(44+len*4),view=new DataView(buf);const w=(o,s)=>{for(let i=0;i<s.length;i++)view.setUint8(o+i,s.charCodeAt(i));};w(0,"RIFF");view.setUint32(4,36+len*4,true);w(8,"WAVE");w(12,"fmt ");view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,audio.sampleRate,true);view.setUint32(28,audio.sampleRate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);w(36,"data");view.setUint32(40,len*4,true);let o=44;for(let i=0;i<len;i++){view.setInt16(o,Math.max(-1,Math.min(1,ch0[i]))*0x7fff,true);view.setInt16(o+2,Math.max(-1,Math.min(1,ch1[i]))*0x7fff,true);o+=4;}return buf;}
function download(data,name,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href);}
async function bounceWav(){const g=state.groove,dur=stepDur(g),seconds=BARS*STEPS*dur+.4,ctx=new OfflineAudioContext(2,Math.ceil(44100*seconds),44100);for(const e of pocket()){const buf=state.buffers.get(e.hit.midi);if(!buf)continue;const src=ctx.createBufferSource();src.buffer=buf;const gain=ctx.createGain();gain.gain.value=e.gain??.88;src.connect(gain).connect(ctx.destination);src.start(.05+e.abs*dur);}download(encodeWav(await ctx.startRendering()),`congafour-${g.id}-${state.recipe}.wav`,"audio/wav");}
$("playA").onclick=()=>playMode("stiff");
$("playB").onclick=()=>playMode("pocket");
$("stop").onclick=stopAll;
$("wav").onclick=()=>bounceWav().catch(e=>setStatus(String(e.message||e)));
$("copy").onclick=async()=>{await navigator.clipboard.writeText(punchText());setStatus("Punch list copied.");};
$("midi").onclick=()=>download(writeMidi(pocket()),`congafour-${state.groove.id}-${state.recipe}.mid`,"audio/midi");
$("loop").onchange=async e=>{const file=e.target.files?.[0];if(!file)return;const ctx=await ensureCtx();state.loopBuf=await ctx.decodeAudioData(await file.arrayBuffer());$("loopLabel").textContent=file.name;state.chairs.kit=false;render();};
window.addEventListener("keydown",e=>{if(e.target.matches("input,textarea"))return;if(e.code==="Digit1")playMode("stiff");if(e.code==="Digit2")playMode("pocket");if(e.code==="Space"){e.preventDefault();stopAll();}});
render();seat();
