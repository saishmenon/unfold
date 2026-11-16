/* Writing prompts: when you pause, one gentle question appears below your writing. Keep typing and it fades.
   Press Tab and it stays in the note as a quote line, with the cursor ready underneath. Esc puts it away.
   With writing help on, the question is about what you just wrote (asked of the local model, which is kept
   awake so the answer comes in a fraction of a second). Without it, a small set of open questions is used.
   On by default; Settings → General turns it off. Loaded after app.js and shares its globals. */
(function(){
'use strict';
const OPEN=['What’s on your mind right now?','What happened today that you want to remember?','What are you trying to figure out?','What is one true sentence you could start with?',
  'Who or what have you been thinking about?','What would you tell a friend about this?','What is the smallest thing you could say about it?','What do you want to remember about today?'];
const NEXT=['What happened next?','Why does this matter to you?','What is an example?','How did that feel?','What is the part you haven’t said yet?','What would make this clearer to a friend?',
  'What do you want to do about it?','What surprised you?','What were you hoping for?','What would you do differently?'];
const SYS='You are a warm, curious friend helping someone keep writing in their private notebook. Reply with ONE short question, under 12 words, that makes the next sentence easy to write. '+
  'Be specific to what they wrote. No advice, no praise, no quotation marks. Reply with only the question.';
const PAUSE=1500,PAUSE_EMPTY=350,ASK_AT=350;
const stage=document.querySelector('.stage'),g=document.createElement('div');g.className='ghost';g.setAttribute('aria-live','polite');stage.appendChild(g);
let shown=null,t1=0,t2=0,seq=0,ready=null,lastLen=-1e9,quietLen=-1,note=null,warmAt=0,used=[];

const words=s=>(s.trim().match(/\S+/g)||[]).length;
const pick=list=>{const pool=list.filter(q=>!used.includes(q));const q=(pool.length?pool:list)[Math.floor(Math.random()*(pool.length||list.length))];used.push(q);if(used.length>8)used.shift();return q};
/* A prompt only shows when you are writing forward: the cursor is at the very end of the note, on plain text (not a list or code), in the formatted page, in Draft. */
function place(){if(!S.prompts||!curId||document.activeElement!==ed||composing||isRaw()||!fast||document.querySelector('.onb'))return null;
  if(window.Shape&&Shape.on)return null;const s=readSel();if(!s||s[0]!==s[1]||text.slice(s[0]).trim())return null;
  const i=lineAt(Math.min(s[0],text.length)),l=text.split('\n')[i]||'';if(/^\s*([-*]|\d+[.)])\s/.test(l)||/^(```|>|!\[)/.test(l))return null;
  let f=false;for(const x of text.split('\n').slice(0,i+1))if(/^```/.test(x))f=!f;if(f)return null;
  return{i,empty:words(text.replace(/^#+\s.*$/m,''))<8}}
function hide(){clearTimeout(t1);clearTimeout(t2);t1=t2=0;if(!shown)return;shown=null;g.classList.remove('on');ed.classList.remove('ghosted')}
function show(q,p){const d=ed.childNodes[p.i];if(!d||d.nodeType!==1)return;shown={q,len:text.length};lastLen=text.length;
  g.innerHTML='<span></span><kbd>Tab to keep</kbd>';g.firstChild.textContent=q;
  const top=text===''?d.offsetTop:d.offsetTop+d.offsetHeight+(lineLen(p.i)?parseFloat(getComputedStyle(ed).fontSize)*.5:0);
  g.style.left=ed.offsetLeft+'px';g.style.width=ed.offsetWidth+'px';g.style.top=ed.offsetTop+top+'px';
  ed.classList.toggle('ghosted',text==='');void g.offsetWidth;g.classList.add('on')}
const clean=r=>{let q=String(r||'').replace(/<think>[\s\S]*?(<\/think>|$)/g,'').trim().split('\n').find(l=>l.trim())||'';q=q.replace(/^[\s"“'*>\-\d.)]+|["”'*\s]+$/g,'');
  return q.length>=8&&q.length<=110&&q.endsWith('?')?q:''};
/* The model is loaded quietly the first time you put the cursor in a note, so it is awake before the first pause. */
function warm(){if(!aiOn()||Date.now()-warmAt<8*60e3)return;warmAt=Date.now();API.quick(AI.base,AI.model,'','').catch(()=>{warmAt=0})}
function ask(p){if(!aiOn()||aiBusy||p.empty&&!text.trim())return;const id=++seq,at=text;
  const title=titleOf(cur()),body=text.replace(/\s+$/,'').slice(-700);
  API.quick(AI.base,AI.model,SYS,(title?'Note title: '+title+'\n\n':'')+'They just wrote:\n'+body).then(r=>{const q=clean(r);if(id===seq&&q&&at===text)ready={q,at}}).catch(()=>{})}
function plan(){hide();if(curId!==note){note=curId;lastLen=-1e9;quietLen=-1;ready=null}
  const p=place();if(!p)return;warm();
  /* Not again until you have written some more, and after Esc not for a good while. */
  if(text.length<quietLen||(text.length-lastLen<60&&text.length>=lastLen&&!(p.empty&&lastLen<0)))return;
  ready=ready&&ready.at===text?ready:null;
  if(!ready)t1=setTimeout(()=>{const q=place();if(q)ask(q)},ASK_AT);
  t2=setTimeout(()=>{const q=place();if(!q)return;show(ready&&ready.at===text?ready.q:pick(q.empty?OPEN:NEXT),q)},text.trim()?PAUSE:PAUSE_EMPTY)}
function keep(){if(!shown)return;const q=shown.q;hide();const base=text.replace(/\s+$/,''),t=(base?base+'\n\n':'')+'> '+q+'\n\n';lastLen=t.length;lastPush=0;commit(t,t.length);lastPush=0;
  requestAnimationFrame(()=>{const d=ed.lastChild;if(d&&d.scrollIntoView)d.scrollIntoView({block:'nearest'})})}

ed.addEventListener('focus',plan);ed.addEventListener('blur',hide);
/* The editor handles typing itself, so a change of text is noticed here: every keystroke moves the cursor. */
document.addEventListener('selectionchange',()=>{if(shown&&text.length===shown.len&&place())return;if(shown||document.activeElement===ed)plan()});
document.addEventListener('keydown',e=>{if(!shown)return;
  if(e.key==='Tab'&&!e.shiftKey&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault();e.stopPropagation();keep()}
  else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();quietLen=text.length+240;hide()}},true);
addEventListener('resize',hide);
window.Prompts={get shown(){return shown&&shown.q},plan,hide,keep,OPEN,NEXT};
})();
