/* Draft / Shape — gentle writing hints.
   Draft (default) shows nothing and runs nothing. Shape (⌘;, or right-click in the note) marks weak spots with a
   dotted sage underline. The same right-click menu refines a selection, paragraph, section or the whole note.
   The rules are plain JavaScript (shapeRules); underlines are drawn on screen only and never touch the text. */
(function(){
'use strict';
/* ---------- Rules ---------- */
const HEDGE=/\b(i feel like|i think|kind of|sort of|somewhat|perhaps|maybe)\b/gi;
const FILLER=/\b(very|really|just|actually|basically|quite)\b/gi;
const PASSIVE=/\b(am|is|are|was|were|be|been|being)\s+(?:([a-z]+ly)\s+)?([a-z]+)\b/gi;
const IRREG=new Set(('made done given taken seen written known shown built found held kept left lost paid sent set told thought brought bought caught taught '+
  'chosen driven eaten forgotten hidden broken spoken stolen worn torn drawn grown thrown begun sung won led fed met sold understood meant heard hung shut spent struck').split(' '));
const NOT_PP=new Set(('interested tired excited bored worried pleased concerned supposed used based married scared surprised confused involved related red need seed '+
  'feed bed shed speed indeed embed proceed exceed succeed hundred sacred naked wicked rugged ragged crooked beloved learned aged blessed tied').split(' '));
const STOP=new Set(('the a an and or but if then than that this these those there their they them its with from into onto upon about over under for of to in on at by as '+
  'is are was were be been being am do does did done have has had not no yes you your yours we our ours he she his her him me my mine it what which who whom whose when '+
  'where why how all any some each every more most much many such can could will would shall should may might must also very just like so too only own same other out up '+
  'down off again once here been into than then them they this that with just even still well really thing things').split(' '));
const LABEL={hedge:'Hedge',filler:'Filler',passive:'Passive',long:'Long sentence',opener:'Weak opener',repeat:'Repeat'};
const LEAD=/^\s*(?:#{1,3}\s+|>\s?|[-*]\s+\[[ xX]\]\s+|[-*]\s+|\d+[.)]\s+)/;

/* Blank out everything that is never checked (code, link targets, [[note links]], URLs, list and heading marks),
   keeping every offset where it was. */
function mask(l){const sp=m=>' '.repeat(m.length);
  return l.replace(/`[^`]*`/g,sp).replace(/\[\[[^\]]*\]\]/g,sp).replace(/\]\([^)\s]*\)/g,m=>' '+sp(m.slice(1)))
    .replace(/\b(?:https?:\/\/|www\.)\S+/g,sp).replace(LEAD,sp).replace(/[*~=_[\]]/g,' ')}
function hash(s){let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return(h>>>0).toString(36)}
function sentences(s){const out=[],re=/[^.!?]+(?:[.!?]+|$)/g;let m;
  while((m=re.exec(s))){if(!m[0].length){re.lastIndex++;continue}const lead=m[0].match(/^\s*/)[0].length,body=m[0].slice(lead).replace(/\s+$/,'');
    if(/[A-Za-z]/.test(body))out.push({start:m.index+lead,end:m.index+lead+body.length})}
  return out}
/* Removing a word tidily: take a following comma and one space with it, and capitalise what now starts the sentence. */
function removal(l,a,b){let e=b;if(l[e]===',')e++;
  const atStart=/(^|[.!?:]\s+)$/.test(mask(l).slice(0,a).replace(/^\s+$/,''))||!mask(l).slice(0,a).trim();
  if(l[e]===' ')e++;else if(a>0&&l[a-1]===' ')a--;
  if(atStart&&/[a-z]/.test(l[e]||''))return{start:a,end:e+1,insert:l[e].toUpperCase()};
  return{start:a,end:e,insert:''}}

function lineRules(l){
  if(/^```/.test(l)||/^!\[[^\]]*\]\([^)]*\)\s*$/.test(l)||/^(-{3,}|\*{3,})\s*$/.test(l)||!l.trim())return[];
  const s=mask(l),out=[];
  /* An ignored hint is remembered by its rule, its words and the word on each side, so it stays ignored while the rest of the sentence changes. */
  const add=(rule,a,b,why,fix,ss)=>{const t=l.slice(a,b),pw=(s.slice(0,a).match(/([A-Za-z'’]+)[^A-Za-z]*$/)||[])[1]||'',nw=(s.slice(b).match(/^[^A-Za-z]*([A-Za-z'’]+)/)||[])[1]||'';
    out.push({rule,label:LABEL[rule],start:a,end:b,text:t,why,fix:fix||null,ss:ss?ss.start:a,se:ss?ss.end:b,key:rule+':'+hash((pw+'|'+t+'|'+nw).toLowerCase())})};
  for(const ss of sentences(s)){const sen=s.slice(ss.start,ss.end),o=ss.start;let m;
    const words=[];const W=/[A-Za-z][A-Za-z'’]*(?:-[A-Za-z]+)*/g;while((m=W.exec(sen)))words.push(m);
    if(words.length>25)add('long',o,ss.end,words.length+' words is hard to follow in one breath.',null,ss);
    if((m=/^(there\s+(?:is|are|was|were)|there['’]s)\b/i.exec(sen)))add('opener',o,o+m[0].length,'“'+m[0]+'” delays the point.',null,ss);
    else if((m=/^it\s+(?:is|was)\s+(?:[A-Za-z'’-]+\s+){1,5}?that\b/i.exec(sen)))add('opener',o,o+m[0].length,'“'+m[0]+'” delays the point.',null,ss);
    HEDGE.lastIndex=0;while((m=HEDGE.exec(sen))){const a=o+m.index,b=a+m[0].length;add('hedge',a,b,'“'+m[0]+'” makes you sound unsure.',removal(l,a,b),ss)}
    FILLER.lastIndex=0;while((m=FILLER.exec(sen))){const a=o+m.index,b=a+m[0].length;add('filler',a,b,'“'+m[0]+'” adds words, not meaning.',removal(l,a,b),ss)}
    PASSIVE.lastIndex=0;while((m=PASSIVE.exec(sen))){const p=m[3].toLowerCase();
      if((p.length>4&&p.endsWith('ed')&&!NOT_PP.has(p))||IRREG.has(p)){add('passive',o+m.index,o+m.index+m[0].length,'Passive voice hides who did it.',null,ss)}}
  }
  /* Repeats can cross sentences inside a paragraph, so they use the whole line. */
  const all=[];const W=/[A-Za-z][A-Za-z'’]*(?:-[A-Za-z]+)*/g;let m;while((m=W.exec(s)))all.push(m);
  const sens=sentences(s),senAt=i=>sens.find(x=>i>=x.start&&i<x.end)||{start:i,end:i};
  for(let j=1;j<all.length;j++){const w=all[j][0].toLowerCase();if(w.length<4||STOP.has(w))continue;
    for(let k=j-1;k>=Math.max(0,j-12);k--)if(all[k][0].toLowerCase()===w){const a=all[j].index;add('repeat',a,a+w.length,'“'+all[j][0]+'” twice in a few words sounds clunky.',null,senAt(a));break}}
  return out.sort((x,y)=>x.start-y.start||y.end-x.end)}

/* text in, list of {rule, start, end, fix?} out (plus label, why, key and the sentence bounds). */
function shapeRules(text){const out=[];let f=false,pos=0;
  for(const l of text.split('\n')){if(/^```/.test(l))f=!f;else if(!f)for(const r of lineRules(l))
    out.push({...r,start:r.start+pos,end:r.end+pos,ss:r.ss+pos,se:r.se+pos,fix:r.fix&&{...r.fix,start:r.fix.start+pos,end:r.fix.end+pos}});
    pos+=l.length+1}
  return out}

if(typeof module!=='undefined'&&module.exports){module.exports={shapeRules,lineRules};return}
if(typeof document==='undefined'||typeof ed==='undefined')return;

/* ---------- On screen ---------- */
const $=id=>document.getElementById(id),scroller=$('scroll'),stage=document.querySelector('.stage');
const layer=document.createElement('div');layer.className='shape-layer';layer.setAttribute('aria-hidden','true');stage.appendChild(layer);
const pop=document.createElement('div');pop.className='shape-pop';pop.setAttribute('role','dialog');pop.hidden=true;document.body.appendChild(pop);
const cache=new Map(),MODES=new Map(),EL=new Map();
let on=false,noteId=null,anim=null,list=[],prevLines=[],prevMarks=[],lastText=null,hideAt=null,raf=0,rt=0,ht=0,hov=null;
const P={m:null,kb:false,pinned:false,run:0};

const ignored=()=>new Set((STATE.dismissed&&STATE.dismissed[curId])||[]);
function setBtn(){document.body.classList.toggle('shaping',on)}

/* Called by app.js at the end of every paint. */
function painted(){
  if(curId!==noteId){noteId=curId;closePop();clearAll();on=!!(curId&&MODES.get(curId));setBtn();lastText=text;if(on){anim='draw';recheck()}}
  if(!on)return;
  if(text!==lastText){lastText=text;const s=document.activeElement===ed?readSel():null;hideAt=s&&s[0]===s[1]?s[0]:null;recheckSoon()}
  soon()}
const soon=()=>{if(!raf)raf=requestAnimationFrame(relayout)};
function recheckSoon(){clearTimeout(rt);rt=setTimeout(recheck,400)}

/* Only lines whose text is new are checked; what's on screen first, the rest a moment later. */
function recheck(){clearTimeout(rt);if(!on||!curId)return;
  if(cache.size>5000)cache.clear();
  const lines=text.split('\n'),todo=[];let f=false;
  for(let i=0;i<lines.length;i++){const l=lines[i];if(/^```/.test(l)){f=!f;continue}if(!f&&!cache.has(l))todo.push(i)}
  if(!todo.length)return soon();
  const top=scroller.scrollTop-200,bot=scroller.scrollTop+scroller.clientHeight+400,now=[],later=[];
  for(const i of todo){const d=ed.childNodes[i],y=d?d.offsetTop:0;(y>=top&&y<=bot?now:later).push(i)}
  for(const i of now)cache.set(lines[i],lineRules(lines[i]));soon();
  if(later.length)setTimeout(()=>{if(!on)return;for(const i of later)if(!cache.has(lines[i]))cache.set(lines[i],lineRules(lines[i]));soon()},60)}

/* While a line is being edited, keep the marks whose words are still in place, then re-check after a pause. */
function reuse(i,l){const pl=prevLines[i],pm=prevMarks[i];if(pl==null||!pm||!pm.length)return[];const d=l.length-pl.length,out=[];
  for(const m of pm){if(m.rule==='long'||m.rule==='repeat')continue;
    if(l.substr(m.start,m.end-m.start)===m.text)out.push(m);
    else if(d&&l.substr(m.start+d,m.end-m.start)===m.text)out.push({...m,start:m.start+d,end:m.end+d,ss:m.ss+d,se:m.se+d,fix:m.fix&&{...m.fix,start:m.fix.start+d,end:m.fix.end+d}})}
  return out}

function relayout(){raf=0;
  if(!on||!curId||isRaw()||!fast){if(EL.size)clearAll();list=[];return}
  const lines=text.split('\n'),next=new Array(lines.length),ign=ignored(),found=[],s=document.activeElement===ed?readSel():null,caret=s&&s[0]===s[1]?s[0]:null;
  if(caret!==hideAt)hideAt=null;
  let f=false;
  for(let i=0;i<lines.length;i++){const l=lines[i];let lm=[];
    if(/^```/.test(l))f=!f;else if(!f)lm=cache.get(l)||reuse(i,l);
    next[i]=lm;
    for(const m of lm){if(ign.has(m.key))continue;const a=PRE[i]+m.start,b=PRE[i]+m.end;
      if(hideAt!=null&&hideAt>=a&&hideAt<=b)continue;
      found.push({...m,a,b,i,id:m.key+'@'+a})}}
  prevLines=lines;prevMarks=next;list=found;draw();
  if(P.m&&!P.pinned&&!found.some(m=>m.id===P.m.id))closePop()}

function boxes(a,b){const r=document.createRange(),p=point(a),q=point(b);try{r.setStart(p[0],p[1]);r.setEnd(q[0],q[1])}catch(e){return[]}
  const sr=stage.getBoundingClientRect(),out=[];
  for(const x of r.getClientRects()){if(x.width<1)continue;const l=x.left-sr.left,t=x.top-sr.top,rr=x.right-sr.left,bb=x.bottom-sr.top;
    const o=out.find(o=>Math.abs((o.t+o.b)/2-(t+bb)/2)<Math.max(4,(bb-t)/3));
    if(o){o.l=Math.min(o.l,l);o.r=Math.max(o.r,rr);o.t=Math.min(o.t,t);o.b=Math.max(o.b,bb)}else out.push({l,t,r:rr,b:bb})}
  return out}

/* Only what is on screen (plus a margin) is measured and drawn, so a long note costs the same as a short one. */
function draw(){const seen=new Set(),rank=new Map();let n=0;
  const base=ed.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop,top=scroller.scrollTop-500,bot=scroller.scrollTop+scroller.clientHeight+500;
  for(const m of list){const d=ed.childNodes[m.i],y=d&&d.nodeType===1?base+d.offsetTop:null;
    if(y==null||y+d.offsetHeight<top||y>bot){m.box=null;continue}
    seen.add(m.id);if(!rank.has(m.i))rank.set(m.i,Math.min(n++,7));
    m.box=boxes(m.a,m.b);let els=EL.get(m.id);
    if(!els){els=[];EL.set(m.id,els)}
    while(els.length<m.box.length){const e=document.createElement('div');e.className='sm'+(m.rule==='long'?' long':'')+(anim==='draw'&&!calm?' draw':' fade');
      if(anim==='draw')e.style.animationDelay=(rank.get(m.i)*20)+'ms';layer.appendChild(e);els.push(e)}
    while(els.length>m.box.length)els.pop().remove();
    m.box.forEach((x,k)=>{const e=els[k],st=e.style,L=Math.round(x.l)+'px',T=Math.round(x.b-1)+'px',W=Math.round(x.r-x.l)+'px';
      if(st.left!==L)st.left=L;if(st.top!==T)st.top=T;if(st.width!==W)st.width=W;e.classList.toggle('hov',hov===m.id)})}
  for(const[id,els]of EL)if(!seen.has(id)){for(const e of els)e.remove();EL.delete(id)}
  anim=null;layer.classList.remove('out')}
function clearAll(){for(const els of EL.values())for(const e of els)e.remove();EL.clear();list=[];prevLines=[];prevMarks=[];hov=null}

/* Each note remembers its own mode for the session. Every note starts in Draft. */
function toggle(want){if(!curId)return;if(want==null)want=!on;if(want===on)return;on=want;MODES.set(curId,on);setBtn();
  if(on){anim='draw';lastText=text;hideAt=null;recheck();soon();
    setTimeout(()=>{if(on)toast(isRaw()?'Shape is on. Hints show on the formatted page (⌘E).':list.length?list.length+(list.length===1?' hint':' hints')+'. Hover an underline to see why.':'Shape is on. Nothing to flag in this note.')},90)}
  else{closePop();clearTimeout(rt);list=[];layer.classList.add('out');setTimeout(()=>{if(!on){clearAll();layer.classList.remove('out')}},130);toast('Back to Draft.')}}

/* ---------- Hover and the popover ---------- */
function hit(x,y){const sr=stage.getBoundingClientRect();x-=sr.left;y-=sr.top;let best=null;
  for(const m of list)for(const b of m.box||[])if(x>=b.l-1&&x<=b.r+1&&y>=b.t&&y<=b.b+4){if(!best||(best.rule==='long'&&m.rule!=='long')||(m.rule!=='long'&&m.b-m.a<best.b-best.a))best=m}
  return best}
function setHov(id){hov=id;for(const[k,els]of EL)for(const e of els)e.classList.toggle('hov',k===id)}
scroller.addEventListener('mousemove',e=>{if(!on||P.pinned||(P.kb&&!pop.hidden))return;const m=hit(e.clientX,e.clientY),id=m?m.id:null;
  if(id===hov)return;setHov(id);clearTimeout(ht);
  if(m)ht=setTimeout(()=>openPop(m,false,e.clientX),pop.hidden?160:60);else if(!pop.hidden)ht=setTimeout(()=>{if(!pop.matches(':hover'))closePop()},250)});
scroller.addEventListener('mouseleave',()=>{if(P.pinned)return;clearTimeout(ht);setHov(null);ht=setTimeout(()=>{if(!pop.matches(':hover'))closePop()},250)});
pop.addEventListener('mouseenter',()=>clearTimeout(ht));
pop.addEventListener('mouseleave',()=>{if(P.pinned||P.kb)return;ht=setTimeout(closePop,250)});
document.addEventListener('mousedown',e=>{if(!pop.hidden&&!pop.contains(e.target))closePop()},true);

const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function openPop(m,kb,mx){clearTimeout(ht);P.m=m;P.kb=kb;P.pinned=false;P.run++;setHov(m.id);
  const ai=aiOn();
  pop.innerHTML=`<div class="sp-k">${esc(m.label)}</div><p class="sp-w">${esc(m.why)}</p>`+
    `<div class="sp-a">${m.fix?'<button data-a="fix" title="Return">Fix</button>':''}${ai?'<button data-a="str">Strengthen ✨</button>':''}<button data-a="ign">Ignore</button></div>`+
    (!m.fix&&!ai?'<p class="sp-n">Choose a writing-help model in Settings to get rewrites.</p>':'')+'<div class="sp-o" hidden></div>';
  place(m,mx);
  if(pop.hidden){pop.hidden=false;pop.classList.remove('shut');void pop.offsetWidth}pop.classList.add('open')}
function place(m,mx){const sr=stage.getBoundingClientRect();let b=(m.box||[])[0];if(!b)return;
  if(mx!=null){const near=(m.box||[]).find(x=>mx>=x.l+sr.left-2&&mx<=x.r+sr.left+2);if(near)b=near}
  const w=Math.min(300,innerWidth-24),x=Math.max(12,Math.min(innerWidth-w-12,(mx!=null&&m.rule==='long'?mx-40:b.l+sr.left-8)));
  let y=b.b+sr.top+8;pop.style.width='';pop.style.maxWidth=w+'px';pop.style.left=x+'px';pop.style.top=y+'px';
  const h=pop.offsetHeight||120;if(y+h>innerHeight-12){y=b.t+sr.top-h-8;pop.style.transformOrigin='bottom left'}else pop.style.transformOrigin='top left';pop.style.top=Math.max(12,y)+'px'}
function closePop(){if(pop.hidden)return;P.run++;P.m=null;P.kb=false;P.pinned=false;setHov(null);pop.classList.remove('open');pop.classList.add('shut');
  setTimeout(()=>{if(!pop.classList.contains('open')){pop.hidden=true;pop.classList.remove('shut')}},calm?0:120)}

pop.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!P.m)return;const m=P.m,a=b.dataset.a;
  if(a==='fix')doFix(m);else if(a==='ign')doIgnore(m);else if(a==='str')strengthen(m);
  else if(a==='opt')useOption(m,b.dataset.v);else if(a==='keep')closePop()});

function still(m){return text.slice(m.a,m.b)===m.text}
function doFix(m){if(!m.fix)return;if(!still(m)){closePop();return toast('That text has changed since.')}
  const a=m.a-m.start+m.fix.start,b=m.a-m.start+m.fix.end,ins=m.fix.insert;closePop();
  lastPush=0;commit(text.slice(0,a)+ins+text.slice(b),a+ins.length);lastPush=0;glow(a,a+ins.length)}
function doIgnore(m){const d=STATE.dismissed||(STATE.dismissed={}),k=d[curId]||(d[curId]=[]);if(!k.includes(m.key))k.push(m.key);saveState();closePop();
  const els=EL.get(m.id)||[];EL.delete(m.id);for(const e of els){e.classList.add('gone');setTimeout(()=>e.remove(),130)}list=list.filter(x=>x.id!==m.id)}
function glow(a,b){if(b<=a)return;requestAnimationFrame(()=>{for(const x of boxes(a,b)){const g=document.createElement('div');g.className='sg';
  Object.assign(g.style,{left:x.l-2+'px',top:x.t+'px',width:x.r-x.l+4+'px',height:x.b-x.t+'px'});layer.appendChild(g);setTimeout(()=>g.remove(),450)}})}

/* Strengthen sends just the sentence to the local model and asks for two versions. */
const ASK={hedge:'Rewrite it so it sounds sure of itself.',filler:'Rewrite it more tightly, without filler words.',passive:'Rewrite it in the active voice, so it is clear who does what.',
  long:'Split it into two or three shorter, clear sentences.',opener:'Rewrite it so it starts with the main point.',repeat:'Rewrite it so the word “%” is not repeated.'};
let sid=900000;const RUNS=new Map();
window.__TAURI__.event.listen('ai-chunk',e=>{const p=e.payload;const r=p&&RUNS.get(p.id);if(!r)return;if(p.text){r.out+=p.text;if(r.on)r.on()}if(p.error)r.err=p.error});
const strip=t=>t.replace(/<think>[\s\S]*?<\/think>/g,'').replace(/<think>[\s\S]*$/,'');
const around=(a,b)=>text.length<=6000?text:text.slice(Math.max(0,a-2500),Math.min(text.length,b+2500));
async function strengthen(m){if(!aiOn())return;P.pinned=true;const run=P.run,o=pop.querySelector('.sp-o'),acts=pop.querySelector('.sp-a');
  const sen=text.slice(m.a-m.start+m.ss,m.a-m.start+m.se);acts.hidden=true;o.hidden=false;o.innerHTML='<p class="sp-wait">Thinking…</p>';place(m);
  const id=++sid,r={out:'',err:null};RUNS.set(id,r);
  const prompt=ASK[m.rule].replace('%',m.text)+' Give exactly two different versions. Reply with only the two versions, one per line, the first starting with "1. " and the second with "2. ".\n\nFor context only, here is the note the sentence comes from. Make the versions fit it. Do not rewrite the note.\n---\n'+around(m.a,m.b)+'\n---\n\nSentence to rewrite: '+sen;
  try{await API.ai(AI.base,AI.model,'You are a careful writing coach inside a notes app. Keep the meaning, the author’s voice and any Markdown formatting. No preamble, no notes.',prompt,id)}catch(e){r.err=String(e)}
  RUNS.delete(id);if(run!==P.run||P.m!==m)return;
  const txt=strip(r.out).trim();
  let opts=txt.split('\n').map(l=>l.match(/^\s*(?:\*\*)?[12][.)]\s*(?:\*\*)?\s*(.+)$/)).filter(Boolean).map(x=>x[1]);
  if(opts.length<2)opts=txt.split('\n').map(l=>l.trim()).filter(Boolean);
  opts=opts.map(s=>s.replace(/^["“']+|["”']+$/g,'').trim()).filter(Boolean).slice(0,2);
  if(r.err||!opts.length){o.innerHTML=`<p class="sp-wait">${esc(r.err?'That did not work. '+r.err:'The model returned nothing.')}</p><div class="sp-c"><button data-a="keep">Close</button></div>`;return place(m)}
  o.innerHTML=opts.map(s=>`<button class="sp-opt" data-a="opt" data-v="${esc(s)}">${esc(s)}</button>`).join('')+'<div class="sp-c"><button data-a="keep">Keep mine</button></div>';
  m.sen=[m.a-m.start+m.ss,m.a-m.start+m.se,sen];place(m)}
function useOption(m,v){const[a,b,sen]=m.sen||[];if(a==null)return;if(text.slice(a,b)!==sen){closePop();return toast('That text has changed since.')}
  closePop();lastPush=0;commit(text.slice(0,a)+v+text.slice(b),a+v.length);lastPush=0;glow(a,a+v.length)}

/* ---------- Right-click in the note ---------- */
/* Refine reads the note for context, so the result fits the rest of the writing. Used by aiGo('shape') in app.js. */
function prompt(body,r){const whole=!r||(r[0]<=0&&r[1]>=text.length),base='Refine the text below so the writing is stronger and clearer: cut hedges and filler words, prefer the active voice, '+
    'split sentences that run long, start sentences with the point, and avoid repeating the same word close together. Keep the meaning, the author’s voice, the order of ideas, and all Markdown '+
    '(headings, lists, links, [[note links]], images, code) as it is. Leave sentences that are already strong alone. Do not add new ideas. Reply with only the refined text.';
  return whole?base+'\n\n---\n'+body:base+'\n\nFor context only, here is the note the text comes from. Make the result fit the note. Do not rewrite the note.\n---\n'+around(r[0],r[1])+'\n---\n\nText to refine:\n'+body}
function paraAt(pos){const i=lineAt(pos);if(!lineLen(i))return null;let a=i,b=i;while(a>0&&lineLen(a-1))a--;while(b<KEYS.length-1&&lineLen(b+1))b++;return[PRE[a],PRE[b]+lineLen(b)]}
/* A section runs from the heading above the cursor to the next heading of the same or a higher level. */
function sectionAt(pos){const lines=text.split('\n'),i=lineAt(pos),lv=l=>{const m=/^(#{1,3})\s/.exec(l);return m?m[1].length:0};let a=i,f=false;
  for(let k=0;k<=i;k++)if(/^```/.test(lines[k]))f=!f;if(f)return null;
  while(a>=0&&!lv(lines[a]))a--;if(a<0)return null;const L=lv(lines[a]);let b=a+1;f=false;
  for(;b<lines.length;b++){if(/^```/.test(lines[b]))f=!f;else if(!f&&lv(lines[b])&&lv(lines[b])<=L)break}
  b--;while(b>a&&!lines[b].trim())b--;return b>a?[PRE[a],PRE[b]+lines[b].length]:null}
let ctxSel=null;
ed.addEventListener('mousedown',e=>{if(e.button===2&&!e.shiftKey){ctxSel=readSel();e.preventDefault()}});
/* Shift + right-click keeps the system menu (spelling, Look Up). */
ed.addEventListener('contextmenu',e=>{if(e.shiftKey||!curId||!fast)return;const s=ctxSel||readSel();ctxSel=null;closePop();
  let pos=null;const cr=document.caretRangeFromPoint&&document.caretRangeFromPoint(e.clientX,e.clientY);
  if(cr&&ed.contains(cr.startContainer))pos=Math.min(text.length,posOf(cr.startContainer,cr.startOffset));
  const sel=s&&s[0]<s[1]&&(pos==null||(pos>=s[0]&&pos<=s[1]))?s:null,at=sel?sel[0]:pos!=null?pos:s?s[0]:text.length;
  if(!sel){ed.focus({preventScroll:true});setSel(at)}
  const copy=t=>navigator.clipboard.writeText(t).catch(()=>toast('Could not reach the clipboard. Press ⌘C.'));
  const paste=()=>navigator.clipboard.readText().then(v=>{if(!v)return;v=v.replace(/\r\n?/g,'\n');const[a,b]=sel||[at,at];commit(text.slice(0,a)+v+text.slice(b),a+v.length)}).catch(()=>toast('Press ⌘V to paste.'));
  const raw=isRaw(),m=on&&!raw?hit(e.clientX,e.clientY):null,para=sel?null:paraAt(at),sec=sectionAt(at),same=(x,y)=>x&&y&&x[0]===y[0]&&x[1]===y[1];
  const short=t=>t.length>22?t.slice(0,22).trimEnd()+'…':t,go=r=>()=>aiGo('shape',null,r);
  menu(e,[sel&&{label:'Cut',run:()=>{copy(text.slice(sel[0],sel[1]));commit(text.slice(0,sel[0])+text.slice(sel[1]),sel[0])}},sel&&{label:'Copy',run:()=>copy(text.slice(sel[0],sel[1]))},{label:'Paste',run:paste},'-',
    {head:'Shape'},{label:(on?'Hide':'Show')+' writing hints   ⌘;',run:()=>toggle()},
    m&&m.fix&&{label:'Fix “'+short(m.text)+'”',run:()=>doFix(m)},m&&{label:'Ignore this hint',run:()=>doIgnore(m)},
    sel&&{label:'Refine the selection ✨',run:go(sel)},para&&{label:'Refine this paragraph ✨',run:go(para)},
    sec&&!same(sec,para)&&!same(sec,[0,text.length])&&{label:'Refine this section ✨',run:go(sec)},text.trim()&&{label:'Refine the whole note ✨',run:go([0,text.length])}])});

/* ---------- Keys ---------- */
function step(dir){relayout();if(!list.length)return;const s=readSel(),c=P.m?P.m.a:s?s[0]:-1;
  const m=dir>0?list.find(x=>x.a>c)||list[0]:[...list].reverse().find(x=>x.a<c)||list[list.length-1];
  closePop();ed.focus({preventScroll:true});setSel(m.a);const d=ed.childNodes[m.i];if(d&&d.scrollIntoView)d.scrollIntoView({block:'center'});
  setTimeout(()=>{relayout();const n=list.find(x=>x.key===m.key&&x.a===m.a)||list.find(x=>x.key===m.key);if(n)openPop(n,true)},30)}
document.addEventListener('keydown',e=>{const mod=e.metaKey||e.ctrlKey;
  if(mod&&!e.shiftKey&&!e.altKey&&(e.key===';'||e.code==='Semicolon')){e.preventDefault();e.stopPropagation();toggle();return}
  if(!on)return;
  if(e.altKey&&!mod&&(e.key==='ArrowDown'||e.key==='ArrowUp')){e.preventDefault();e.stopPropagation();step(e.key==='ArrowDown'?1:-1);return}
  if(pop.hidden)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closePop();return}
  if(e.key==='Enter'&&P.kb&&!mod&&!e.shiftKey&&P.m){e.preventDefault();e.stopPropagation();if(P.m.fix)doFix(P.m);return}
  if(P.kb&&!P.pinned&&!['Shift','Alt','Meta','Control'].includes(e.key))closePop()},true);

document.addEventListener('selectionchange',()=>{if(on)soon()});
new MutationObserver(()=>{if(on)soon()}).observe(ed,{attributes:true,attributeFilter:['class']});
new ResizeObserver(()=>{if(on)soon()}).observe(ed);
addEventListener('resize',()=>{if(on)soon()});
scroller.addEventListener('scroll',()=>{if(on)soon()},{passive:true});
function moved(o,n){if(MODES.has(o)){MODES.set(n,MODES.get(o));MODES.delete(o)}if(noteId===o)noteId=n;const d=STATE.dismissed;if(d&&d[o]){d[n]=d[o];delete d[o]}}
window.Shape={painted,toggle,prompt,moved,rules:shapeRules,get on(){return on},get list(){return list}};
setBtn();
})();
