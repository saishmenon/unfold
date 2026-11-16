/* The welcome tour, the writing-help set-up card (also used in Settings), and the notes-folder reminder.
   Loaded after app.js and shares its globals. */
(function(){
'use strict';
const AIMODEL='gemma3:4b',AISIZE='3.3 GB',GET='https://ollama.com/download';
const LS={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prettyRoot=()=>{let p=ROOT||'';if(HOME&&p.startsWith(HOME))p=p.slice(HOME.length);return p.split('/').filter(Boolean).join(' › ')||'Documents › Unfold'};
const FOLDER='<svg viewBox="0 0 20 20"><path d="M2.5 6.5a2 2 0 0 1 2-2h3l2 2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z"/></svg>';

/* ---------- Writing help: get Ollama, download a model ---------- */
let PULL=null,opening=false;
const redraw=()=>{drawSettings();drawOnb()};
const useModel=m=>{AI.provider='ollama';AI.model=m;saveAI()};
const pct=()=>PULL&&PULL.total?Math.min(100,Math.round(PULL.done/PULL.total*100)):0;
function aiHelp(){const c=el('div','aiset'),noApp=!MODELS||!!MODELS.error,busy=PULL&&!PULL.error;
  let h='<b>Set up writing help</b><i>Free and private. A small AI model runs on this Mac, so your notes are not sent anywhere.</i>'+
    `<ol><li class="${noApp?'now':'ok'}">Get Ollama, a free app that runs the model</li><li class="${noApp?'':'now'}">Download a model (${AISIZE}, once)</li></ol>`;
  if(busy)h+=`<div class="prog"><u style="width:${pct()}%"></u></div><small class="pst">${esc(PULL.total?'Downloading… '+pct()+'%':'Starting the download…')}</small>`;
  else if(noApp)h+=`<div class="acts"><button class="btn pri" data-a="get">Get Ollama</button><button class="btn" data-a="open"${opening?' disabled':''}>${opening?'Opening Ollama…':'I have it. Open Ollama'}</button></div><small>Install it, then come back here and press “I have it”.</small>`;
  else h+=`<div class="acts"><button class="btn pri" data-a="pull">Download model</button></div><small>Gemma 3 is a good, quick start for writing. Keep Unfold open while it downloads.</small>`;
  if(PULL&&PULL.error)h+=`<small class="bad">That did not work. ${esc(PULL.error)}</small>`;
  c.innerHTML=h;
  c.onclick=async e=>{const b=e.target.closest('button');if(!b)return;const a=b.dataset.a;
    if(a==='get')API.openUrl(GET).catch(()=>toast('Open ollama.com/download in your browser.'));
    else if(a==='open'){opening=true;redraw();
      try{await API.aiStart()}catch(x){opening=false;redraw();return toast('Ollama is not on this Mac yet. Press Get Ollama first.')}
      let m=null;for(let i=0;i<12&&!m;i++){await sleep(i?900:300);try{m=await API.models(AI.base)}catch(x){}}
      opening=false;if(m){MODELS=m;if(m.length&&!aiOn())useModel(m[0])}else toast('Ollama is still starting. Try again in a moment.');redraw()}
    else if(a==='pull'){PULL={done:0,total:0};redraw();
      try{await API.aiPull(AI.base,AIMODEL);PULL=null;MODELS=await API.models(AI.base);useModel(MODELS.find(m=>m.startsWith('gemma3'))||MODELS[0]||AIMODEL);toast('Writing help is on.')}
      catch(x){PULL={error:String(x)}}redraw()}};
  return c}
window.__TAURI__.event.listen('ai-pull',e=>{const p=e.payload;if(!p||!PULL||PULL.error)return;
  if(p.total>=PULL.total){PULL.total=p.total;PULL.done=p.done}
  for(const u of document.querySelectorAll('.aiset .prog u'))u.style.width=pct()+'%';
  for(const s of document.querySelectorAll('.aiset .pst'))s.textContent=PULL.total?'Downloading… '+pct()+'%':(p.status||'Starting the download…')});

/* ---------- Welcome tour ---------- */
let onb=null,step=0,pick='';
const LOOKS=[['','Auto'],['paper','Paper'],['sepia','Sepia'],['dusk','Dusk']];
const sw=k=>k?(THEMES[k]||{}).bg||'#fff':`linear-gradient(90deg,${THEMES.paper.bg} 50%,${(THEMES.dusk||THEMES.paper).bg} 50%)`;
const easyOn=()=>S.font===EASY.font&&S.rs===EASY.rs;
const BODY=[
  ()=>`<h2>Welcome to Unfold</h2><p>A quiet place to write. Three small choices and you are in.</p><div class="acts"><button class="btn pri" data-a="next">Let’s begin</button></div>`,
  ()=>`<h2>Where should your notes live?</h2><p>They are plain files in a folder you own. No account, no cloud.</p><div class="chip">${FOLDER}<span>${esc(prettyRoot())}</span></div>`+
      `<div class="acts"><button class="btn pri" data-a="keep">Keep this folder</button><button class="btn" data-a="choose">Choose another…</button></div>`,
  ()=>`<h2>Make it feel like yours</h2><p>Pick a look. You can change it any time under Aa.</p><div class="row">`+
      LOOKS.map(([k,n])=>`<button class="pick" data-skin="${k}" aria-pressed="${(S.skin||'')===k}"><u style="background:${sw(k)}"></u>${n}</button>`).join('')+
      `</div><label class="easy"><span>Easy reading<small>A dyslexia-friendly typeface with more room to breathe</small></span><input type="checkbox" data-a="easy"${easyOn()?' checked':''}></label>`+
      `<div class="acts"><button class="btn pri" data-a="next">Looks good</button></div>`,
  ()=>{let h=`<h2>Want a writing helper?</h2><p>Optional. It helps you tidy and strengthen your writing, and it runs on this Mac.</p>`;
    if(aiOn())return h+`<div class="chip"><span>Writing help is on · ${esc(AI.model)}</span></div><div class="acts"><button class="btn pri" data-a="next">Continue</button></div>`;
    if(MODELS===null)return h+`<p>Looking for models on this Mac…</p><div class="acts"><button class="btn" data-a="next">Not now</button></div>`;
    if(MODELS.error||!MODELS.length)return h+`<div data-slot="ai"></div><div class="acts"><button class="btn" data-a="next">Not now</button></div>`;
    if(!MODELS.includes(pick))pick=MODELS[0];
    return h+`<div class="list">`+MODELS.map(m=>`<button class="mrow${m===pick?' on':''}" data-m="${esc(m)}"><span><b>${esc(m)}</b><i>Found on this Mac</i></span><u></u></button>`).join('')+
      `</div><div class="acts"><button class="btn pri" data-a="aion">Turn it on</button><button class="btn" data-a="aioff">Not now</button></div>`},
  ()=>`<h2>You are all set</h2><p>Three things worth knowing.</p><ul class="tips"><li><kbd>⌘K</kbd>Find any note or command</li><li><kbd>⌘;</kbd>Gentle writing hints, when you are ready to polish</li>`+
      `<li><kbd>Echoes</kbd>Older notes come back as you write</li></ul><div class="acts"><button class="btn pri" data-a="finish">Start writing</button></div>`];
function drawOnb(fresh){if(!onb)return;let body=onb.querySelector('.onb-body');
  if(fresh){const n=el('div','onb-body');body.replaceWith(n);body=n}
  body.innerHTML=BODY[step]();const slot=body.querySelector('[data-slot=ai]');if(slot)slot.replaceWith(aiHelp());
  onb.querySelectorAll('.onb-dots i').forEach((d,i)=>d.classList.toggle('on',i===step));
  onb.querySelector('.p1').classList.toggle('on',step>=1);onb.querySelector('.p3').classList.toggle('on',step>=2);onb.querySelector('.tick').classList.toggle('on',step>=4);
  onb.querySelector('.onb-skip').hidden=step===BODY.length-1}
function go(n){step=Math.max(0,Math.min(BODY.length-1,n));if(step===3)loadModels();drawOnb(true)}
function startTour(){if(onb)return;settings(false);step=0;onb=el('div','onb');
  onb.innerHTML=`<div class="onb-card" role="dialog" aria-modal="true" aria-label="Welcome to Unfold"><button class="onb-skip">Skip</button>`+
    `<svg class="onb-art" viewBox="250 84 340 222" aria-hidden="true"><path class="p1" d="M270 290l100-50V100l-100 50z"/><path class="p2 on" d="M370 240l100 50V150l-100-50z"/><path class="p3" d="M470 290l100-50V100l-100 50z"/><path class="tick" d="M398 196l15 15 28-33"/></svg>`+
    `<div class="onb-body"></div><div class="onb-dots">${'<i></i>'.repeat(BODY.length)}</div></div>`;
  document.body.appendChild(onb);requestAnimationFrame(()=>requestAnimationFrame(()=>onb&&onb.classList.add('in')));drawOnb(true);
  onb.querySelector('.onb-skip').onclick=()=>finish();
  onb.querySelector('.onb-dots').onclick=e=>{const i=[...e.currentTarget.children].indexOf(e.target);if(i>=0&&i<step)go(i)};
  onb.addEventListener('change',e=>{if(e.target.dataset.a==='easy')set(e.target.checked?EASY:{font:DEF.font,rs:DEF.rs,rl:DEF.rl,rls:DEF.rls,rws:DEF.rws,rw:DEF.rw,bold:DEF.bold,focus:DEF.focus})});
  onb.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||!b.closest('.onb-body')||b.closest('.aiset'))return;const a=b.dataset.a;
    if(b.dataset.skin!=null){set({skin:b.dataset.skin});return drawOnb()}
    if(b.dataset.m){pick=b.dataset.m;return drawOnb()}
    if(a==='next')go(step+1);
    else if(a==='keep'){LS.set('unfold-folder','1');go(step+1)}
    else if(a==='choose'){const was=ROOT;await chooseRoot();if(ROOT!==was)LS.set('unfold-folder','1');drawOnb()}
    else if(a==='aion'){useModel(pick);go(step+1)}
    else if(a==='aioff')go(step+1);
    else if(a==='finish')finish()})}
function finish(){if(!onb)return;LS.set('unfold-onboarded','1');const o=onb;onb=null;o.classList.add('out');setTimeout(()=>o.remove(),calm?0:200);
  if(!LS.get('unfold-folder'))setTimeout(folderTip,600)}

/* ---------- If the notes folder was never confirmed, a small reminder points at the switcher ---------- */
let tip=null;
function closeTip(){if(tip){tip.remove();tip=null}}
function folderTip(){const b=$('vaultBtn');if(tip||onb||LS.get('unfold-folder')||!b||!b.offsetParent)return;
  tip=el('div','tipb');tip.setAttribute('role','status');
  tip.innerHTML=`<b>Choose where your notes live</b>Right now they are saved in ${esc(prettyRoot())}. You can pick another folder here.<div><button class="pri" data-a="ok">Keep it</button><button data-a="choose">Choose folder…</button></div>`;
  document.body.appendChild(tip);const r=b.getBoundingClientRect();tip.style.left=Math.max(8,r.left+2)+'px';tip.style.bottom=innerHeight-r.top+12+'px';
  tip.onclick=e=>{const x=e.target.closest('button');if(!x)return;LS.set('unfold-folder','1');closeTip();if(x.dataset.a==='choose')chooseRoot()}}
$('vaultBtn').addEventListener('click',()=>{if(tip){LS.set('unfold-folder','1');closeTip()}});
addEventListener('resize',closeTip);

$('tourBtn').onclick=startTour;
Object.assign(window,{aiHelp,drawOnb,startTour,folderTip});
if(!LS.get('unfold-onboarded'))startTour();else setTimeout(folderTip,1500);
})();
