//PURE-START
let NOTES=[];
const STOP=new Set("the a an and or but if then so to of in on at for with from by is are was were be been it its this that these those i you we they he she my your our their me not no do does did have has had as about into than too very can could would should will just more most some any when what which who how why there here out up down over again also only one two get got make made like much many them ever every still back keep kept note notes each first next never feel felt past instead between".split(' '));
const stem=w=>w.length>4?w.replace(/(ing|ed|es|s)$/,''):w;
const toks=s=>(s.toLowerCase().match(/[a-z][a-z']{2,}/g)||[]).filter(w=>!STOP.has(w)).map(stem);
function split(b){const out=[];let cur=[],f=false;for(const l of b.split('\n')){if(/^```/.test(l)){f=!f;cur.push(l);continue}if(!f&&l.trim()===''){if(cur.length){out.push(cur.join('\n'));cur=[]}}else cur.push(l)}if(cur.length)out.push(cur.join('\n'));return out}
/* A note is named after its first line, skipping any quote lines at the top (a kept writing prompt is one). */
const headLine=b=>{const ls=b.split('\n').filter(l=>l.trim());return ls.find(l=>!/^>/.test(l))||ls[0]||''};
const titleOf=n=>(headLine(n.body).replace(/^(#+|>)\s*/,'').trim())||(n.id||'').split('/').pop().replace(/\.md$/i,'')||'New note';
const plain=s=>s.replace(/^#+\s*/gm,'').replace(/^\s*(?:[-*]|\d+[.)])\s+(?:\[[ x]\]\s+)?/gim,'').replace(/[*`>\[\]]/g,'').replace(/\s+/g,' ').trim();
/* Each note's paragraphs are broken into words once and reused until the note changes, so opening a note does not re-read every other note. */
const PARA=new Map();
function parasOf(n){const c=PARA.get(n.id);if(c&&c.body===n.body){if(c.n!==n){c.n=n;for(const p of c.paras)p.n=n}return c.paras}
  const paras=[];for(const b of split(n.body)){if(/^```/.test(b)||/^#/.test(b)&&!b.includes('\n'))continue;const t=plain(b);if(t.length<40)continue;paras.push({n,t,set:new Set(toks(t)),b})}
  PARA.set(n.id,{n,body:n.body,paras});return paras}
function buildIndex(notes,skipId){const paras=[],df=new Map();if(PARA.size>notes.length+200)PARA.clear();
  for(const n of notes){if(n.id===skipId)continue;for(const p of parasOf(n)){paras.push(p);for(const w of p.set)df.set(w,(df.get(w)||0)+1)}}return{paras,df}}
function echoesFor(text,idx){const q=new Set(toks(plain(text)));if(q.size<3)return[];const N=idx.paras.length||1,best=new Map();for(const p of idx.paras){const shared=[];let s=0;for(const w of q)if(p.set.has(w)){shared.push(w);s+=Math.log(1+N/(idx.df.get(w)||1))}if(shared.length<2)continue;s=s/Math.sqrt(Math.max(8,p.set.size)/8);if(s<5)continue;const o=best.get(p.n.id);if(!o||s>o.s)best.set(p.n.id,{s,p,shared})}return[...best.values()].sort((a,b)=>b.s-a.s).slice(0,3)}
//PURE-END

const $=id=>document.getElementById(id);
const ed=$('ed');
if(ed.contentEditable!=='plaintext-only')ed.contentEditable='true';
const escMap={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'};
const esc=s=>s.replace(/[&<>"]/g,c=>escMap[c]);
const mk=s=>'<span class="mk">'+esc(s)+'</span>';
const INL=/(`[^`]+`)|(\*\*[^*]+?\*\*)|(\*[^*\s][^*]*?\*)|(\[\[[^\]]+\]\])|(\[[^\]]+\]\(https?:[^)\s]+\))|(~~[^~]+~~)|(==[^=]+==)/g;
function inl(s){let o='',last=0,m;INL.lastIndex=0;
  while(m=INL.exec(s)){o+=esc(s.slice(last,m.index));const t=m[0];
    if(m[1])o+=mk('`')+'<code>'+esc(t.slice(1,-1))+'</code>'+mk('`');
    else if(m[2])o+=mk('**')+'<strong>'+esc(t.slice(2,-2))+'</strong>'+mk('**');
    else if(m[3])o+=mk('*')+'<em>'+esc(t.slice(1,-1))+'</em>'+mk('*');
    else if(m[4])o+=mk('[[')+'<span class="wl">'+esc(t.slice(2,-2))+'</span>'+mk(']]');
    else if(m[6])o+=mk('~~')+'<s>'+esc(t.slice(2,-2))+'</s>'+mk('~~');
    else if(m[7])o+=mk('==')+'<mark class="hl">'+esc(t.slice(2,-2))+'</mark>'+mk('==');
    else{const k=t.indexOf('](');o+=mk('[')+'<span class="lk ext">'+esc(t.slice(1,k))+'</span>'+mk(t.slice(k))}
    last=m.index+t.length}
  return o+esc(s.slice(last))}
/* ---- Files on disk, through the Rust layer ---- */
/* diskSig is the notes folder's fingerprint (names and dates) as last seen. After Unfold changes a file itself, the
   fingerprint is taken again straight away, so only changes made outside Unfold look like changes. */
let diskSig=null;const OWN=new Set(['write_note','create_note','move_path','make_dir','trash_path','remove_empty_dir']);
const inv=(c,a)=>{const p=window.__TAURI__.core.invoke(c,a);if(OWN.has(c)){const again=()=>window.__TAURI__.core.invoke('scan_sig').then(s=>{diskSig=s},()=>{});p.then(again,again)}return p};
const API={load:()=>inv('scan'),sig:()=>inv('scan_sig'),write:(path,body)=>inv('write_note',{path,body}),create:(dir,name)=>inv('create_note',{dir,name}),move:(from,to)=>inv('move_path',{from,to}),
  mkdir:path=>inv('make_dir',{path}),rmdir:path=>inv('remove_empty_dir',{path}),export:(name,content)=>inv('export_file',{name,content}),models:base=>inv('ai_models',{base}),apple:()=>inv('ai_apple_status'),ai:(base,model,system,prompt,id)=>inv('ai_run',{base,model,system,prompt,id}),aiStop:()=>inv('ai_stop'),quick:(base,model,system,prompt)=>inv('ai_quick',{base,model,system,prompt}),aiStart:()=>inv('ai_start'),aiPull:(base,model)=>inv('ai_pull',{base,model}),openUrl:url=>inv('open_url',{url}),trash:path=>inv('trash_path',{path}),saveState:state=>inv('save_state',{state}),pickRoot:()=>inv('pick_root'),setRoot:path=>inv('set_root',{path}),reveal:()=>inv('reveal_root'),revealPath:path=>inv('reveal_path',{path}),image:path=>inv('read_image',{path})};
const base=p=>p.split('/').pop(),dirOf=p=>p.split('/').slice(0,-1).join('/');
const folderOf=p=>{const a=p.split('/');return a.length>=3?a[0]+'/'+a[1]:a.length===2?a[0]:''};
const day=ms=>{const d=new Date(ms);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const clean=s=>s.replace(/[\/\\:\u0000-\u001f]/g,'-').replace(/^\.+/,'').trim().slice(0,120);
const cmp=(a,b)=>a.localeCompare(b,undefined,{sensitivity:'base',numeric:true});
let STATE={pinned:[],closed:[]},ROOT='',HOME='';
const toNote=r=>({id:r.path,mt:r.mtime,ct:r.created||r.mtime,date:day(r.mtime),folder:folderOf(r.path),pinned:(STATE.pinned||[]).includes(r.path),body:r.body.replace(/\r\n?/g,'\n')});
function saveState(){STATE.pinned=NOTES.filter(n=>n.pinned).map(n=>n.id);STATE.closed=[...closed];API.saveState(STATE).catch(()=>{})}
let saveT;const saveSoon=()=>{clearTimeout(saveT);saveT=setTimeout(flush,350)};
function touch(n){n.dirty=true;n.mt=Date.now();n.date=day(n.mt);saveSoon()}
async function flush(){clearTimeout(saveT);
  for(const n of NOTES.filter(n=>n.dirty&&!n.moving)){n.dirty=false;try{await API.write(n.id,n.body)}catch(e){n.dirty=true;toast('Could not save “'+titleOf(n)+'”. '+e)}}}
/* A note Unfold created keeps the name "Untitled" until it has a first line; then the file takes that name. */
async function leave(n){await flush();if(!NOTES.includes(n)||!/^Untitled( \d+)?\.md$/i.test(base(n.id)))return;
  const t=clean(plain(headLine(n.body)));if(!t||/^untitled$/i.test(t))return;
  await relocate(n,(dirOf(n.id)?dirOf(n.id)+'/':'')+t+'.md')}
async function relocate(n,to){const old=n.id;n.moving=true;
  try{const p=await API.move(old,to);n.id=p;n.folder=folderOf(p);if(curId===old){curId=p;try{localStorage.setItem('unfold-last',p)}catch(e){}}if(window.Shape)Shape.moved(old,p);for(const x of BACK.concat(FWD))if(x.id===old)x.id=p;saveState();drawNav();drawList();return true}
  catch(e){toast('Could not move that note. '+e);return false}
  finally{n.moving=false;if(n.dirty)saveSoon()}}
/* Pictures load once, as needed, from beside the note. */
const IMG={};
const norm=p=>{const o=[];for(const s of p.split('/')){if(s==='..'){if(!o.length)return null;o.pop()}else if(s&&s!=='.')o.push(s)}return o.join('/')};
function pic(src,n){if(!n||/^[a-z][a-z0-9+.-]*:/i.test(src))return null;let f=src;try{f=decodeURI(src)}catch(e){}
  const key=norm((dirOf(n.id)?dirOf(n.id)+'/':'')+f);if(!key)return null;
  if(IMG[key]===undefined){IMG[key]=null;API.image(key).then(u=>{if(!u)return;IMG[key]=`url('${u}')`;if(curId)paint(null);clearTimeout(listT);listT=setTimeout(drawList,200)}).catch(()=>{})}
  return IMG[key]}
const ind=s=>s.replace(/\t/g,'    ').length,lvl=n=>Math.min(3,Math.ceil(n/4));
const indSpan=s=>s?'<span class="ind" style="--n:'+ind(s)+'">'+esc(s)+'</span>':'';
const ROMAN=['i','ii','iii','iv','v','vi','vii','viii','ix','x','xi','xii'];
function lineHTML(l,st){let m;
  if(/^```/.test(l)){st.f=!st.f;return['fence '+(st.f?'fo':'fc'),esc(l)]}
  if(st.f)return['code',esc(l)];
  if(m=l.match(/^(#{1,3}\s+)(.*)$/))return['h'+m[1].trim().length,mk(m[1])+inl(m[2])];
  if(/^(-{3,}|\*{3,})\s*$/.test(l))return['hr',esc(l)];
  if(m=l.match(/^(>\s?)(.*)$/))return['bq',mk(m[1])+inl(m[2])];
  if(m=l.match(/^(\s*)([-*]\s+\[( |x)\]\s+)(.*)$/i))return['task'+(m[3]!==' '?' done':''),mk(m[1]+m[2])+'<span class="tx">'+inl(m[4])+'</span>',null,ind(m[1])];
  if(m=l.match(/^(\s*)([-*]\s+)(.*)$/))return['ul',indSpan(m[1])+'<span class="bul" data-l="'+['•','◦','▪','▫'][lvl(ind(m[1]))]+'">'+esc(m[2])+'</span>'+inl(m[3]),null,ind(m[1]),.45*ind(m[1])+1.15];
  if(m=l.match(/^(\s*)(\d+[.)]\s+)(.*)$/)){const mw=+(.62*m[2].trim().length+.5).toFixed(2);return['ol',indSpan(m[1])+'<span class="num" style="--mw:'+mw+'">'+esc(m[2])+'</span>'+inl(m[3]),null,ind(m[1]),.45*ind(m[1])+mw]}
  if(m=l.match(/^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/)){const p=pic(m[2],cur());return p?['img',mk(l),p]:['p',mk('![')+'<span class="lk">'+esc(m[1])+'</span>'+mk(l.slice(2+m[1].length))]}
  return['p',inl(l)]}

const calm=matchMedia('(prefers-reduced-motion: reduce)').matches,isRaw=()=>ed.classList.contains('raw');
let selRange=null,jump=null;
const FIND={value:''};
let curId=null,text='',idx=null,lastEchoKey='',lastPara=null,lastCaret=null,composing=false,undo=[],redo=[],lastPush=0;
const cur=()=>NOTES.find(n=>n.id===curId);
const nlen=n=>n.nodeName==='BR'?0:n.textContent.length;
const readText=()=>[...ed.childNodes].map(n=>n.nodeName==='BR'?'':n.textContent).join('\n');
/* The page is drawn one line at a time. KEYS and PRE mirror what is on screen (a key and a start offset for every
   line), so finding the cursor and redrawing only touch the lines that changed. `fast` is false whenever the browser
   has edited the page itself (dictation, input methods, drag and drop) and those mirrors can't be trusted. */
let KEYS=[],PRE=[0],fast=false,actEl=null,curEls=[];const lineCache=new Map();
const lineOf=node=>{let t=node;while(t&&t.parentNode!==ed)t=t.parentNode;return t};
function lineAt(pos){let lo=0,hi=PRE.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(PRE[mid]<=pos)lo=mid;else hi=mid-1}return lo}
const lineLen=j=>(j<KEYS.length-1?PRE[j+1]-1:text.length)-PRE[j];
function posOf(node,off){
  if(node===ed){if(fast)return off<KEYS.length?PRE[off]:text.length;let p=0;for(let i=0;i<off&&i<ed.childNodes.length;i++)p+=nlen(ed.childNodes[i])+1;return Math.min(p,text.length)}
  const top=lineOf(node);let p=0;
  if(fast)p=PRE[Array.prototype.indexOf.call(ed.childNodes,top)]||0;else for(let c=ed.firstChild;c&&c!==top;c=c.nextSibling)p+=nlen(c)+1;
  const r=document.createRange();r.selectNodeContents(top);r.setEnd(node,off);return p+r.toString().length}
function readSel(){const s=getSelection();if(!s.rangeCount||!ed.contains(s.anchorNode)||!ed.contains(s.focusNode))return null;
  let a=posOf(s.anchorNode,s.anchorOffset),b=s.isCollapsed?a:posOf(s.focusNode,s.focusOffset);if(a>b)[a,b]=[b,a];
  if(a!==b&&fast){ /* a selection that starts or ends beside hidden marks takes the marks with it */
    const hid=(pos,first)=>{const i=lineAt(pos),ls=PRE[i],d=ed.childNodes[i];if(!d||d.nodeType!==1||d.classList.contains('act')||isRaw())return pos;
      const m=first?d.firstElementChild:d.lastElementChild;if(!m||!m.classList.contains('mk')||(first?d.firstChild:d.lastChild)!==m)return pos;
      const le=ls+lineLen(i);return first?(pos-ls===m.textContent.length?ls:pos):(le-pos===m.textContent.length?le:pos)};
    a=hid(a,true);b=hid(b,false)}
  return[a,b]}
function point(pos){let c;
  if(fast){const i=lineAt(pos);c=ed.childNodes[i];pos-=PRE[i]}else{c=ed.firstChild;while(c&&pos>nlen(c)){pos-=nlen(c)+1;c=c.nextSibling}}
  if(!c){c=ed.lastChild;pos=nlen(c)}
  if(c.nodeType===3)return[c,pos];
  const w=document.createTreeWalker(c,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(pos<=n.length)return[n,pos];pos-=n.length}return[c,0]}
function setSel(a,b){const r=document.createRange(),p=point(a);r.setStart(p[0],p[1]);
  if(b!=null&&b!==a){const q=point(b);r.setEnd(q[0],q[1])}else r.collapse(true);
  const s=getSelection();s.removeAllRanges();s.addRange(r)}
function mkLine(o){const d=document.createElement('div');d.className='ln '+o.c+(o.x?' '+o.x:'');d.innerHTML=o.h||'<br>';d._c=o.c;if(o.p)d.style.setProperty('--pic',o.p);if(o.ind)d.style.setProperty('--ind',o.ind);if(o.hang)d.style.setProperty('--hang',o.hang);if(o.lab){const s=d.querySelector('.num');if(s)s.dataset.l=o.lab}return d}
function lineInfo(l,st){const key=(st.f?'1':'0')+l;let o=lineCache.get(key);
  if(o&&!o.img){if(o.fence)st.f=!st.f;return o}
  const[c,h,p,dent,hang]=lineHTML(l,st);o={c,h,p,l,ind:dent||0,hang:hang||0,k:c+'\u0000'+l,img:l.startsWith('!['),fence:/^```/.test(l)};
  if(lineCache.size>6000)lineCache.clear();lineCache.set(key,o);return o}
function paint(caret,caretEnd){
  const lines=text.split('\n'),n=lines.length,st={f:false},out=new Array(n),pre=new Array(n);let off=0;
  const cnt=[0,0,0,0];
  for(let i=0;i<n;i++){pre[i]=off;off+=lines[i].length+1;let o=lineInfo(lines[i],st);
    /* Numbered items inside another list are shown as a, b, c (then i, ii, iii). The file keeps plain numbers. */
    if(o.c==='ol'){const lv=lvl(o.ind);cnt[lv]++;for(let q=lv+1;q<4;q++)cnt[q]=0;
      if(lv){const lab=(lv===1?String.fromCharCode(97+(cnt[lv]-1)%26):lv===2?ROMAN[cnt[lv]-1]||cnt[lv]:cnt[lv])+'.';o={...o,lab,k:o.k+'\u0000'+lab}}}
    else if(o.c==='ul'||o.c.startsWith('task')){for(let q=lvl(o.ind)+1;q<4;q++)cnt[q]=0}
    else if(lines[i].trim())cnt.fill(0);
    /* A heading gets air above it and sits close to what follows. A blank line straight after one is drawn short, so the
       heading stays with its paragraph. This is only how the page is drawn: the file and the source view are untouched. */
    const hx=/^h[1-3]$/.test(o.c)?(i?(lines[i-1].trim()?'hair':'hgap'):''):o.c==='p'&&i&&!lines[i]&&/^h[1-3]$/.test(out[i-1].c)?'hshort':'';
    if(hx)o={...o,x:hx,k:o.k+'\u0000'+hx};
    out[i]=o}
  const m=KEYS.length;
  if(!fast||ed.childNodes.length!==m){const frag=document.createDocumentFragment();for(const o of out)frag.appendChild(mkLine(o));ed.textContent='';ed.appendChild(frag)}
  else{let a=0;while(a<n&&a<m&&KEYS[a]===out[a].k)a++;let b=0;while(b<n-a&&b<m-a&&KEYS[m-1-b]===out[n-1-b].k)b++;
    const kids=ed.childNodes,ref=kids[m-b]||null,one=m-a-b===1&&n-a-b===1?kids[a]:null;
    const from=one&&one._c!==out[a].c&&!calm&&!isRaw()?getComputedStyle(one).fontSize:null;
    for(let i=m-b-1;i>=a;i--)ed.removeChild(kids[i]);
    for(let i=a;i<n-b;i++){const d=mkLine(out[i]);if(from){d.style.setProperty('--from',from);d.classList.add('morph')}ed.insertBefore(d,ref)}}
  KEYS=out.map(o=>o.k);PRE=pre;fast=true;
  ed.classList.toggle('blank',text==='');
  if(caret!=null){if(document.activeElement!==ed)ed.focus({preventScroll:true});setSel(caret,caretEnd)}
  drawToc(out);mark();if(window.Shape)Shape.painted()}
function mark(){if(!fast)return;
  const s=document.activeElement===ed?readSel():null;let i=-1,top=null;
  if(s){lastCaret=s[0];selRange=s[0]!==s[1]?s:null;i=lineAt(s[0]);top=ed.childNodes[i]||null}
  if(top!==actEl||(top&&!top.classList.contains('act'))){for(const e of ed.querySelectorAll('.ln.act'))if(e!==top)e.classList.remove('act');if(top)top.classList.add('act');actEl=top}
  let a=i,b=i;const L=KEYS.length;
  if(i>=0&&lineLen(i)){while(a>0&&lineLen(a-1))a--;while(b<L-1&&lineLen(b+1))b++}
  for(const e of curEls)e.classList.remove('cur');curEls=[];
  if(i>=0)for(let j=a;j<=b;j++){const e=ed.childNodes[j];if(e){e.classList.add('cur');curEls.push(e)}}
  const para=i>=0?text.slice(PRE[a],PRE[b]+lineLen(b)):'';
  if(para!==lastPara){lastPara=para;queueEchoes(para.trim()?para:text)}
  bubbleSoon()}
let listT;const listSoon=()=>{clearTimeout(listT);listT=setTimeout(()=>{
  const n=cur(),cards=[...document.querySelectorAll('#notes .note[data-id]')],want=listFor(sel);
  $('barTitle').textContent=n?titleOf(n):'';
  if(n&&cards.length===want.length&&cards.every((c,i)=>c.dataset.id===want[i].id)){const c=cards.find(c=>c.dataset.id===n.id);if(c)c.replaceWith(noteEl(n,sel.t!=='folder'))}else drawList();
  if(statsOn())drawStats()},300)};
function commit(t,caret,caretEnd){const now=Date.now();
  if(now-lastPush>600){undo.push({t:text,c:lastCaret});if(undo.length>200)undo.shift();redo=[]}
  lastPush=now;text=t;cur().body=t;touch(cur());paint(caret,caretEnd);listSoon()}
function hist(from,to){const h=from.pop();if(!h)return;to.push({t:text,c:lastCaret});lastPush=0;text=h.t;cur().body=text;touch(cur());paint(h.c==null?text.length:Math.min(h.c,text.length));listSoon()}
function wrap(m){const s=readSel();if(!s||!curId)return;const[a,b]=s,L=m.length;
  if(a>=L&&text.slice(a-L,a)===m&&text.slice(b,b+L)===m&&!(m==='*'&&text.slice(a-2,a)==='**'))return commit(text.slice(0,a-L)+text.slice(a,b)+text.slice(b+L),a-L,b-L);
  commit(text.slice(0,a)+m+text.slice(a,b)+m+text.slice(b),a+L,b+L)}

/* The number a list item should take at this indent: one more than the item above it at the same level. */
function numAt(ls,indent){let p=ls;while(p>0){const e=p-1,s=text.lastIndexOf('\n',e-1)+1,l=text.slice(s,e),m=l.match(/^( *)(?:(\d+)[.)]|[-*])\s/);
    if(!m){if(l.trim())break;p=s;continue}if(m[1].length<indent)break;if(m[1].length===indent)return m[2]?+m[2]+1:1;p=s}return 1}
ed.addEventListener('beforeinput',e=>{
  if(composing||e.isComposing)return;
  const t=e.inputType;let a,b,ins='';
  const tr=e.getTargetRanges&&e.getTargetRanges()[0];
  if(tr&&ed.contains(tr.startContainer)&&ed.contains(tr.endContainer)){a=posOf(tr.startContainer,tr.startOffset);b=posOf(tr.endContainer,tr.endOffset);if(a>b)[a,b]=[b,a]}
  else{const s=readSel();if(!s)return;[a,b]=s}
  if(t==='insertText')ins=e.data||'';
  else if(t==='insertParagraph'||t==='insertLineBreak'){
    const ls=text.lastIndexOf('\n',a-1)+1,line=text.slice(ls,a),fenced=(text.slice(0,ls).match(/^```/gm)||[]).length%2===1;
    const m=!fenced&&line.match(/^(\s*)([-*]|\d+[.)])(\s+)(\[[ x]\]\s+)?(.*)$/i);
    if(!m)ins='\n';
    else if(!m[5]){e.preventDefault();const cut=Math.min(4,m[1].length);if(!cut){commit(text.slice(0,ls)+text.slice(b),ls);return}
      const ni=m[1].length-cut,nl=' '.repeat(ni)+(/\d/.test(m[2])?numAt(ls,ni)+m[2].slice(-1):m[2])+m[3]+(m[4]||'');commit(text.slice(0,ls)+nl+text.slice(b),ls+nl.length);return}
    else{let pre=m[2];if(/\d/.test(pre))pre=(parseInt(pre)+1)+pre.slice(-1);ins='\n'+m[1]+pre+m[3]+(m[4]?'[ ] ':'')}}
  else if(t==='insertFromPaste'){if(!e.dataTransfer)return;ins=e.dataTransfer.getData('text/plain').replace(/\r\n?/g,'\n')}
  else if(/^delete/.test(t)&&t!=='deleteByCut'&&t!=='deleteByDrag'){
    if(a===b){if(/Backward/.test(t)){if(!a)return e.preventDefault();a-=a>1&&/[\uDC00-\uDFFF]/.test(text[a-1])?2:1}
      else{if(b>=text.length)return e.preventDefault();b+=/[\uD800-\uDBFF]/.test(text[b])?2:1}}}
  else if(t==='historyUndo'){e.preventDefault();return hist(undo,redo)}
  else if(t==='historyRedo'){e.preventDefault();return hist(redo,undo)}
  else return;
  e.preventDefault();commit(text.slice(0,a)+ins+text.slice(b),a+ins.length)});
ed.addEventListener('input',()=>{if(composing)return;fast=false;const s=readSel();commit(readText(),s?s[0]:null)});
ed.addEventListener('compositionstart',()=>{composing=true;fast=false});
ed.addEventListener('compositionend',()=>{composing=false;fast=false;const s=readSel();commit(readText(),s?s[0]:null)});
ed.addEventListener('keydown',e=>{const mod=e.metaKey||e.ctrlKey,k=e.key.toLowerCase();
  if(e.key==='Escape'){ed.blur();return}
  if(e.key==='Tab'&&!mod&&!e.altKey){e.preventDefault();const s=readSel();if(!s)return;const[a,b]=s,ls=text.lastIndexOf('\n',a-1)+1;let le=text.indexOf('\n',b);if(le<0)le=text.length;
    const lines=text.slice(ls,le).split('\n');if(!lines.every(l=>/^\s*([-*]|\d+[.)])\s/.test(l)))return;
    let da=0,db=0;const out=lines.map((l,i)=>{const sp=l.match(/^ */)[0].length;let r=l;
      if(e.shiftKey){r=l.slice(Math.min(4,sp));if(lines.length===1&&sp)r=r.replace(/^( *)\d+([.)])/,(x,s1,s2)=>s1+numAt(ls,s1.length)+s2)}else if(sp<12)r='    '+l.replace(/^( *)\d+([.)])/,'$11$2');
      if(i===0)da=r.length-l.length;db+=r.length-l.length;return r});
    if(!db)return;commit(text.slice(0,ls)+out.join('\n')+text.slice(le),Math.max(ls,a+da),a===b?undefined:Math.max(ls,b+db));return}
  if(!mod)return;
  if(k==='z'){e.preventDefault();e.shiftKey?hist(redo,undo):hist(undo,redo)}
  else if(k==='y'){e.preventDefault();hist(redo,undo)}
  else if(k==='b'){e.preventDefault();wrap('**')}
  else if(k==='i'){e.preventDefault();wrap('*')}});
ed.addEventListener('mousedown',e=>{
  const wl=e.target.closest('.wl'),lk=e.target.closest('.lk.ext');
  if(isRaw())return;
  /* A web link opens in the browser. The address is read from the line itself and must be http or https. */
  if(lk&&!lk.closest('.act')){const u=(/^\]\((https?:\/\/[^)\s]+)\)$/.exec(lk.nextSibling?lk.nextSibling.textContent:'')||[])[1];if(u){e.preventDefault();API.openUrl(u).catch(x=>toast('Could not open that link. '+x));return}}
  if(wl&&!wl.closest('.act')){e.preventDefault();const q=wl.textContent.toLowerCase(),n=NOTES.find(n=>titleOf(n).toLowerCase()===q);n?openNote(n.id):toast('No note called “'+wl.textContent+'” yet.');return}
  const t=e.target.closest('.task');
  if(t&&!t.classList.contains('act')&&e.clientX<t.getBoundingClientRect().left+parseFloat(getComputedStyle(t).fontSize)*(1.5+.45*(parseFloat(t.style.getPropertyValue('--ind'))||0))){
    e.preventDefault();const i=[...ed.children].indexOf(t),ls=text.split('\n');
    ls[i]=/\[ \]/.test(ls[i])?ls[i].replace('[ ]','[x]'):ls[i].replace(/\[x\]/i,'[ ]');commit(ls.join('\n'),null)}});
document.addEventListener('selectionchange',mark);
ed.addEventListener('blur',()=>setTimeout(mark,0));

/* Echoes */
let echoTimer;
function queueEchoes(text){clearTimeout(echoTimer);echoTimer=setTimeout(()=>drawEchoes(text),260)}
function ago(d){const days=Math.round((Date.now()-new Date(d+'T12:00'))/864e5);if(days<1)return 'today';if(days<14)return days+(days===1?' day ago':' days ago');if(days<60)return Math.round(days/7)+' weeks ago';if(days<365)return Math.round(days/30.4)+' months ago';const y=Math.round(days/365);return y+(y===1?' year ago':' years ago')}
const fmt=d=>new Date(d+'T12:00').toLocaleDateString('en',{day:'numeric',month:'short',year:'numeric'});
function drawEchoes(text){
  if(!curId){$('echoes').innerHTML='';lastEchoKey='';return}
  if(!idx)idx=buildIndex(NOTES,curId);
  let r=echoesFor(text,idx);
  if(!r.length&&text!==cur().body)r=echoesFor(cur().body,idx);
  const key=r.map(x=>x.p.n.id+x.p.t.length).join();if(key===lastEchoKey)return;lastEchoKey=key;
  const box=$('echoes');box.innerHTML='';
  $('echoHint').textContent=r.length?'Older notes that sound like what you are writing. Click one to peek. ⌘-click opens it.':'Nothing to echo yet. Keep writing.';
  const hl=(s,x)=>esc(s).replace(/[A-Za-z']+/g,w=>x.shared.includes(stem(w.toLowerCase()))&&!STOP.has(w.toLowerCase())?'<mark>'+w+'</mark>':w),cut=s=>s.length>220?s.slice(0,220).replace(/\s\S*$/,'')+'…':s;
  for(const x of r){const n=x.p.n,d=document.createElement('div'),k=n.id+'\u0000'+x.p.t.slice(0,40);d.className='echo';d.tabIndex=0;d.setAttribute('role','button');
    const snip=x.p.t.length>170?x.p.t.slice(0,170).replace(/\s\S*$/,'')+'…':x.p.t,blocks=split(n.body),bi=blocks.indexOf(x.p.b),near=q=>{const s=bi<0?'':plain(blocks[bi+q]||'').trim();return s?'<p class="dim">'+esc(cut(s))+'</p>':''};
    d.innerHTML=`<b>${esc(titleOf(n))}</b><i>${ago(n.date)} · ${fmt(n.date)}</i><span class="snip">${hl(snip,x)}</span><div class="peek"><div>${near(-1)}<p>${hl(x.p.t,x)}</p>${near(1)}<button class="go">Open note</button></div></div>`;
    const open=()=>{const at=n.body.indexOf(x.p.b);openAt(n.id,at<0?null:n.body.slice(0,at).split('\n').length-1)};
    const peek=on=>{for(const o of box.children)if(o!==d){o.classList.remove('open');o.setAttribute('aria-expanded',false)}d.classList.toggle('open',on);d.setAttribute('aria-expanded',on);echoOpen=on?k:''};
    if(k===echoOpen){d.classList.add('open','still')}d.setAttribute('aria-expanded',k===echoOpen);
    d.addEventListener('mousedown',e=>e.preventDefault());
    d.addEventListener('click',e=>{if(e.metaKey||e.ctrlKey||e.target.closest('.go'))return open();peek(!d.classList.contains('open'))});
    d.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.metaKey?open():peek(!d.classList.contains('open'))}});
    box.appendChild(d)}
}
let echoOpen='';

/* Notes list */
let SECTIONS=[];const closed=new Set();
let adding=null,sel={t:'all'};
const el=(t,c)=>{const e=document.createElement(t);e.className=c;return e};
const allFolders=()=>SECTIONS.flatMap(s=>s.folders);
const byDate=(a,b)=>(!!b.pinned-!!a.pinned)||(b.mt||0)-(a.mt||0);
/* "All notes" sits at the top of the folders panel and lists every note, most recently edited first. Folders list their pinned notes first. */
const loose=n=>!allFolders().includes(n.folder);
const listFor=s=>s.t==='all'?NOTES.slice().sort((a,b)=>(b.mt||0)-(a.mt||0)):NOTES.filter(n=>s.t==='pinned'?n.pinned:n.folder===s.name).sort(byDate);
const selName=()=>sel.t==='all'?'All notes':sel.t==='pinned'?'Pinned':sel.t==='loose'?'Unfiled':base(sel.name);
const selOf=n=>loose(n)?{t:'all'}:{t:'folder',name:n.folder};
/* Where to land when nothing better is known: the open note's folder, else the first folder, else All notes. */
const home=()=>{const n=cur();return n?selOf(n):allFolders().length?{t:'folder',name:SECTIONS.flatMap(s=>s.folders)[0]}:{t:'all'}};
const secCmp=(a,b)=>{const o=STATE.order||[],i=o.indexOf(a),j=o.indexOf(b);return i>=0&&j>=0?i-j:i>=0?-1:j>=0?1:cmp(a,b)};
let dragS=null;
function moveSection(name,target,before){const names=SECTIONS.map(s=>s.name).filter(x=>x!==name);let i=names.indexOf(target);if(i<0)return;names.splice(before?i:i+1,0,name);
  STATE.order=names;SECTIONS.sort((a,b)=>secCmp(a.name,b.name));saveState();drawNav()}
const sameSel=(a,b)=>a.t===b.t&&a.name===b.name;
const PIN='<path d="M7.5 3.5h5l-.7 4.2 2.2 2.8h-8l2.2-2.8zM10 10.5v6"/>',CHEV='<svg viewBox="0 0 20 20"><path d="M7.5 5l5 5-5 5"/></svg>';
const ICON={all:'<path d="M5.5 3.5h9a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 15V5a1.5 1.5 0 0 1 1.5-1.5zM7 7.5h6M7 10.5h6M7 13.5h3"/>',pinned:PIN,folder:'<path d="M2.5 6.5a2 2 0 0 1 2-2h3l2 2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z"/>'};
function dropZone(el,f){el.ondragover=e=>{if(dragS)return;e.preventDefault();el.classList.add('drop')};el.ondragleave=()=>el.classList.remove('drop');
  el.ondrop=e=>{e.preventDefault();el.classList.remove('drop');const d=e.dataTransfer.getData('text/plain');if(d&&!d.startsWith('folder:'))moveNote(d,f)}}
async function moveNote(id,f){const n=NOTES.find(n=>n.id===id);if(!n||(n.folder||'')===f)return;await flush();
  if(await relocate(n,(f?f+'/':'')+base(n.id)))toast(f?'Moved to '+base(f)+'.':'Moved out of its folder.')}
function navRow(s,label,icon,count){const b=el('button','nrow'+(sameSel(sel,s)?' on':''));b.innerHTML=`<svg viewBox="0 0 20 20">${icon}</svg><span>${esc(label)}</span><i>${count}</i>`;b.onclick=()=>pick(s);return b}
function nameInput(ph,save){const i=el('input','fname');i.placeholder=ph;i.setAttribute('aria-label',ph);
  const done=ok=>{if(!adding)return;adding=null;const v=i.value.trim();if(ok&&v)save(v);drawNav()};
  i.onkeydown=e=>{if(e.key==='Enter')done(true);else if(e.key==='Escape')done(false)};i.onblur=()=>done(true);return i}
let dragF=null;
const pinnedF=()=>STATE.pinnedFolders||(STATE.pinnedFolders=[]);
function folderRow(f,pinned){const r=navRow({t:'folder',name:f},base(f),ICON.folder,NOTES.filter(n=>n.folder===f).length);dropZone(r,f);
  r.oncontextmenu=e=>menu(e,folderMenu(f));
  if(!pinned){r.draggable=true;r.addEventListener('dragstart',e=>{dragF=f;e.dataTransfer.setData('text/plain','folder:'+f);e.dataTransfer.effectAllowed='move'});r.addEventListener('dragend',()=>{dragF=null})}
  return r}
function toggleFolderPin(f){const p=pinnedF(),i=p.indexOf(f);i<0?p.push(f):p.splice(i,1);saveState();drawNav()}
function newFolder(si){if(!SECTIONS.length){adding={t:'section'};drawNav();return toast('Folders live inside sections. Name a section first.')}
  if(si==null){const c=sel.t==='folder'?sel.name.split('/')[0]:null;si=Math.max(0,SECTIONS.findIndex(s=>s.name===c))}
  closed.delete(SECTIONS[si].name);adding={t:'folder',si};drawNav()}
async function moveFolder(f,secName){if(f.split('/')[0]===secName)return;await flush();let p;
  try{p=await API.move(f,secName+'/'+base(f))}catch(e){return toast('Could not move that folder. '+e)}
  for(const n of NOTES)if(n.id.startsWith(f+'/')){const old=n.id;n.id=p+n.id.slice(f.length);n.folder=folderOf(n.id);if(curId===old){curId=n.id;try{localStorage.setItem('unfold-last',n.id)}catch(e){}}}
  for(const s of SECTIONS){s.folders=s.folders.filter(x=>x!==f);if(s.name===secName){s.folders.push(p);s.folders.sort(cmp)}}
  STATE.pinnedFolders=pinnedF().map(x=>x===f?p:x);if(sel.t==='folder'&&sel.name===f)sel={t:'folder',name:p};closed.delete(secName);saveState();drawNav();drawList();toast('Moved to '+secName+'.')}
function drawNav(){const box=$('nav');box.innerHTML='';
  const all=navRow({t:'all'},'All notes',ICON.all,NOTES.length);dropZone(all,'');box.appendChild(all);
  /* Pinned is a section of its own, holding the folders you pinned. It only appears when there is one. */
  const pf=pinnedF().filter(f=>allFolders().includes(f)),PK='\u0000pinned';
  if(pf.length){const shut=closed.has(PK),h=el('div','shead'+(shut?' shut':'')),w=el('div','fwrap'+(shut?' shut':'')),g=el('div','grp');
    h.innerHTML=`<button class="sname" aria-expanded="${!shut}"><span>Pinned</span>${CHEV}</button>`;pf.forEach(f=>g.appendChild(folderRow(f,true)));w.appendChild(g);
    h.firstChild.onclick=()=>{const s=!closed.has(PK);s?closed.add(PK):closed.delete(PK);h.classList.toggle('shut',s);w.classList.toggle('shut',s);h.firstChild.setAttribute('aria-expanded',!s);saveState()};
    box.append(h,w)}
  SECTIONS.forEach((sec,si)=>{const shut=closed.has(sec.name),h=el('div','shead'+(shut?' shut':'')),w=el('div','fwrap'+(shut?' shut':'')),g=el('div','grp');
    h.innerHTML=`<button class="sname" aria-expanded="${!shut}"><span>${esc(sec.name)}</span>${CHEV}</button><button class="sadd" title="New folder in ${esc(sec.name)}" aria-label="New folder in ${esc(sec.name)}"><svg viewBox="0 0 20 20"><path d="M10 4v12M4 10h12"/></svg></button>`;
    sec.folders.forEach(f=>g.appendChild(folderRow(f)));
    if(adding&&adding.t==='folder'&&adding.si===si)g.appendChild(nameInput('Folder name',v=>{const p=sec.name+'/'+clean(v);if(clean(v)&&!sec.folders.some(f=>f.toLowerCase()===p.toLowerCase())){sec.folders.push(p);sec.folders.sort(cmp);API.mkdir(p).catch(e=>toast('Could not create that folder. '+e))}}));
    w.appendChild(g);
    h.firstChild.onclick=()=>{const s=!closed.has(sec.name);s?closed.add(sec.name):closed.delete(sec.name);h.classList.toggle('shut',s);w.classList.toggle('shut',s);h.firstChild.setAttribute('aria-expanded',!s);saveState()};
    h.lastChild.onclick=()=>newFolder(si);
    h.oncontextmenu=e=>menu(e,[{label:'New folder in '+sec.name,run:()=>newFolder(si)},{label:'New section',run:()=>$('sectionBtn').onclick()},showIn(sec.name),SECTIONS.length>1&&'-',
      si>0&&{label:'Move up',run:()=>moveSection(sec.name,SECTIONS[si-1].name,true)},si<SECTIONS.length-1&&{label:'Move down',run:()=>moveSection(sec.name,SECTIONS[si+1].name,false)}]);
    /* Drag a section by its heading to reorder it. Its folders travel with it. */
    h.draggable=true;
    h.addEventListener('dragstart',e=>{if(dragF)return;dragS=sec.name;e.dataTransfer.setData('text/plain','section:'+sec.name);e.dataTransfer.effectAllowed='move';h.classList.add('drag');w.classList.add('drag')});
    h.addEventListener('dragend',()=>{dragS=null;box.querySelectorAll('.above,.below,.drag').forEach(x=>x.classList.remove('above','below','drag'))});
    const upper=e=>e.clientY<(h.getBoundingClientRect().top+w.getBoundingClientRect().bottom)/2,clear=()=>{h.classList.remove('above');w.classList.remove('below')};
    for(const z of[h,w]){z.addEventListener('dragover',e=>{if(!dragS||dragS===sec.name)return;e.preventDefault();const up=upper(e);h.classList.toggle('above',up);w.classList.toggle('below',!up)});
      z.addEventListener('dragleave',e=>{if(!z.contains(e.relatedTarget))clear()});
      z.addEventListener('drop',e=>{if(!dragS||dragS===sec.name)return;e.preventDefault();e.stopPropagation();const up=upper(e),s=dragS;clear();dragS=null;moveSection(s,sec.name,up)})}
    for(const z of[h,w]){z.addEventListener('dragover',e=>{if(dragF&&dragF.split('/')[0]!==sec.name){e.preventDefault();h.classList.add('drop')}});z.addEventListener('dragleave',()=>h.classList.remove('drop'));z.addEventListener('drop',e=>{h.classList.remove('drop');if(dragF&&dragF.split('/')[0]!==sec.name){e.preventDefault();e.stopPropagation();moveFolder(dragF,sec.name)}})}
    box.append(h,w)});
  if(adding&&adding.t==='section')box.appendChild(nameInput('Section name',v=>{v=clean(v);if(v&&!SECTIONS.some(s=>s.name.toLowerCase()===v.toLowerCase())){SECTIONS.push({name:v,folders:[]});SECTIONS.sort((a,b)=>cmp(a.name,b.name));API.mkdir(v).catch(e=>toast('Could not create that section. '+e))}}));
  const fi=box.querySelector('.fname');if(fi){fi.focus();fi.scrollIntoView({block:'nearest'})}}
function pick(s){sel=s;FIND.value='';drawNav();drawList();{const nb=$('notes');nb.classList.remove('fresh');void nb.offsetWidth;nb.classList.add('fresh')}if(curId&&!listFor(sel).some(n=>n.id===curId))closeNote()}
function noteEl(n,tag){const d=el('div','note'+(n.id===curId?' on':''));d.tabIndex=0;d.dataset.id=n.id;d.draggable=true;
  const pics=[...n.body.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map(m=>pic(m[1],n)).filter(Boolean).slice(0,3);
  const prev=plain(split(n.body).slice(1).filter(b=>!/^(!\[|#|```)/.test(b)).join('\n')).slice(0,150);
  d.innerHTML=`<b>${esc(titleOf(n))}</b><span>${esc(prev)||'No text yet'}</span>${pics.length?'<div class="thumbs">'+pics.map(p=>`<u style="background-image:${p}"></u>`).join('')+'</div>':''}<i>${n.pinned?'<svg viewBox="0 0 20 20">'+PIN+'</svg>':''}${fmt(n.date)}${tag&&n.folder?' · '+esc(base(n.folder)):''}</i>`;
  d.onclick=()=>openNote(n.id);d.onkeydown=e=>{if(e.key==='Enter')openNote(n.id)};
  d.ondragstart=e=>{e.dataTransfer.setData('text/plain',n.id);e.dataTransfer.effectAllowed='move'};d.oncontextmenu=e=>menu(e,noteMenu(n));return d}
function drawList(){
  const q=FIND.value.trim().toLowerCase(),box=$('notes');$('listTitle').textContent=q?'Search results':selName();$('listCount').textContent=(q?NOTES.filter(n=>n.body.toLowerCase().includes(q)):listFor(sel)).length;
  const list=q?NOTES.filter(n=>n.body.toLowerCase().includes(q)).sort(byDate):listFor(sel);box.innerHTML='';
  /* Like Apple Notes: a folder's pinned notes sit under their own heading, then the rest. All notes and search results stay one list. */
  const pins=q||sel.t==='all'?[]:list.filter(n=>n.pinned),head=t=>{const d=el('div','lsec');d.textContent=t;d.setAttribute('role','heading');box.appendChild(d)};
  if(pins.length)head('Pinned');
  list.forEach((n,i)=>{if(pins.length&&i===pins.length)head('Notes');box.appendChild(noteEl(n,q||sel.t!=='folder'))});
  if(!list.length)box.innerHTML=`<div class="none"><svg viewBox="0 0 48 48"><path d="M7 35l11-5.5V11L7 16.5zM18 29.5L30 35V16.5L18 11zM30 35l11-5.5V11l-11 5.5z"/></svg><span>${q?'No notes match that search.':'Nothing here yet.'}</span></div>`;
  updateEmpty()}
function updateEmpty(){$('barTitle').textContent=curId?titleOf(cur()):'';document.body.classList.toggle('nonote',!curId);const c=listFor(sel).length,w=sel.t==='folder'?' in '+base(sel.name):sel.t==='pinned'?' pinned':sel.t==='loose'?' unfiled':'';
  $('emptyCount').textContent=c?c+(c===1?' note':' notes')+w:'No notes'+w+' yet';
  if(curId&&statsOn())drawStats();
  drawAssist()}
function closeNote(skip){const was=cur();if(was&&!skip)leave(was);fast=false;lineCache.clear();hideBubble();openAssist(false);curId=null;text='';idx=null;lastPara=null;tocKey='~';navTok++;ed.blur();paint(null);$('echoes').innerHTML='';lastEchoKey='';
  document.querySelectorAll('.note.on').forEach(d=>d.classList.remove('on'));updateEmpty()}
function togglePin(n=cur()){if(!n)return;n.pinned=!n.pinned;saveState();drawNav();drawList();updateEmpty();toast(n.pinned?'Pinned to the top.':'Unpinned.')}
$('sectionBtn').onclick=()=>{adding={t:'section'};drawNav()};
$('newFolderBtn').onclick=()=>newFolder();
$('nav').oncontextmenu=e=>{if(!e.target.closest('.nrow,.shead'))menu(e,[{label:'New folder',run:()=>newFolder()},{label:'New section',run:()=>$('sectionBtn').onclick()}])};
let navTok=0;
/* Back and forward. Every jump to another note remembers where you were: the note, the scroll position and the cursor. */
let BACK=[],FWD=[],histNav=false,restore=null;
const here=()=>({id:curId,y:$('scroll').scrollTop,c:document.activeElement===ed?lastCaret:null});
const alive=h=>h&&h.id!==curId&&NOTES.some(n=>n.id===h.id);
function drawHist(){$('backBtn').disabled=!BACK.some(alive);$('fwdBtn').disabled=!FWD.some(alive)}
function go(dir){const from=dir<0?BACK:FWD,to=dir<0?FWD:BACK;let h;do{h=from.pop()}while(h&&!alive(h));if(!h)return drawHist();
  if(curId)to.push(here());histNav=true;restore=h;openNote(h.id);histNav=false;drawHist()}
function openNote(id,focus){
  if(curId&&id!==curId&&!histNav&&NOTES.some(n=>n.id===id)){BACK.push(here());if(BACK.length>60)BACK.shift();FWD=[]}
  let o=[...document.querySelectorAll('.note[data-id]')].map(d=>d.dataset.id);
  if(!o.includes(id)||!o.includes(curId))o=NOTES.slice().sort(byDate).map(n=>n.id);
  const dir=!curId||o.indexOf(id)>=o.indexOf(curId)?1:-1,same=id===curId,my=++navTok,prev=cur();
  const swap=()=>{if(!NOTES.some(n=>n.id===id))return;fast=false;lineCache.clear();hideBubble();if(prev&&prev.id!==id)leave(prev);curId=id;try{localStorage.setItem('unfold-last',id)}catch(e){}idx=null;lastEchoKey='~';lastPara=null;lastCaret=null;tocKey='~';undo=[];redo=[];lastPush=0;document.body.classList.remove('sideopen','nonote');text=cur().body;
    if(!focus)ed.blur();$('scroll').scrollTop=0;$('barTitle').classList.remove('show');paint(focus?(focus==='end'?text.length:0):null);
    if(restore){const r=restore;restore=null;if(r.id===id){$('scroll').scrollTop=r.y;if(r.c!=null){ed.focus({preventScroll:true});setSel(Math.min(r.c,text.length))}}}
    drawHist();
    if(jump&&jump.id===id){const d=ed.children[jump.line];jump=null;if(d){d.scrollIntoView({block:'center'});d.classList.add('flash');setTimeout(()=>d.classList.remove('flash'),1900)}}
    if(!calm&&!same)ed.animate([{opacity:0,transform:`translateX(${dir*18}px)`},{opacity:1,transform:'none'}],{duration:240,easing:'cubic-bezier(.2,.7,.2,1)'});
    if(!FIND.value&&!listFor(sel).some(n=>n.id===id)){sel=selOf(cur());drawNav()}
    const cards=[...document.querySelectorAll('.note[data-id]')];
    if(cards.some(d=>d.dataset.id===id)){cards.forEach(d=>d.classList.toggle('on',d.dataset.id===id));updateEmpty()}else drawList()};
  if(calm||same||!curId||!ed.children.length)return swap();
  const out=ed.animate([{opacity:1,transform:'none'},{opacity:0,transform:`translateX(${-dir*10}px)`}],{duration:100,easing:'ease-in',fill:'forwards'});
  out.onfinish=()=>{if(my===navTok)swap();out.cancel()}}
/* Table of contents */
let tocKey='',tocItems=[];
function drawToc(out){const items=[];(out||[]).forEach((o,i)=>{if(/^h[1-3]$/.test(o.c)){const t=plain(o.l);if(t)items.push({i,lv:+o.c[1],t})}});
  const key=items.map(x=>x.i+':'+x.lv+x.t).join('|');$('toc').hidden=items.length<2;if(key===tocKey)return;tocKey=key;tocItems=items;
  $('ticks').innerHTML=items.map(x=>`<i class="l${x.lv}"></i>`).join('');
  $('tocList').innerHTML=items.map((x,k)=>`<button class="l${x.lv}" data-k="${k}">${esc(x.t)||'Untitled'}</button>`).join('');spy()}
function spy(){if(!tocItems.length)return;const top=$('scroll').getBoundingClientRect().top+60;let on=0;
  tocItems.forEach((x,k)=>{const d=ed.children[x.i];if(d&&d.getBoundingClientRect().top<=top)on=k});
  [...$('ticks').children].forEach((e,k)=>e.classList.toggle('on',k===on));[...$('tocList').children].forEach((e,k)=>e.classList.toggle('on',k===on))}
let spyQ=false;$('scroll').addEventListener('scroll',()=>{if(spyQ)return;spyQ=true;requestAnimationFrame(()=>{spyQ=false;spy();$('barTitle').classList.toggle('show',$('scroll').scrollTop>70)})});
$('toc').addEventListener('mousedown',e=>e.preventDefault());
$('toc').onclick=e=>{$('toc').classList.add('open');const b=e.target.closest('#tocList button');if(!b)return;const d=ed.children[tocItems[b.dataset.k].i];if(d)d.scrollIntoView({behavior:calm?'auto':'smooth',block:'start'})};
document.addEventListener('mousedown',e=>{if(!e.target.closest('#toc'))$('toc').classList.remove('open')});
async function newNote(title){const dir=sel.t==='folder'?sel.name:'';let r;
  try{r=await API.create(dir,'Untitled')}catch(e){return toast('Could not create a note. '+e)}
  const n=toNote(r);n.pinned=sel.t==='pinned';NOTES.push(n);if(n.pinned)saveState();if(typeof title==='string'&&title.trim()){n.body='# '+title.trim()+'\n\n';touch(n)}drawNav();drawList();openNote(n.id,n.body?'end':true)}
async function trashNote(n=cur()){if(!n)return;await flush();
  try{await API.trash(n.id)}catch(e){return toast('Could not move it to the Trash. '+e)}
  NOTES=NOTES.filter(x=>x!==n);idx=null;if(n.id===curId)closeNote(true);saveState();drawNav();drawList();toast('Moved to the Trash.')}
$('newBtn').onclick=()=>newNote();$('backBtn').onclick=()=>go(-1);$('fwdBtn').onclick=()=>go(1);
$('navBtn').onclick=$('navShow').onclick=()=>set({nav:!S.nav});
/* Drag the edge of a panel to resize it; double-click the edge to put it back. */
function resizer(id,key,min,max){const hd=$(id),prop={navW:'--navw',listW:'--listw',rightW:'--rightw'}[key],dir=key==='rightW'?-1:1;
  hd.addEventListener('pointerdown',e=>{if(e.button)return;e.preventDefault();hd.setPointerCapture(e.pointerId);hd.classList.add('on');document.body.classList.add('resizing');const x0=e.clientX,w0=S[key];
    const mv=ev=>{const used=(S.nav?S.navW:0)+S.listW+(S.side?S.rightW:0)-S[key],room=innerWidth-used-380;S[key]=Math.round(Math.max(min,Math.min(max,room,w0+dir*(ev.clientX-x0))));document.documentElement.style.setProperty(prop,S[key]+'px')};
    const up=()=>{hd.removeEventListener('pointermove',mv);hd.classList.remove('on');document.body.classList.remove('resizing');apply()};
    hd.addEventListener('pointermove',mv);hd.addEventListener('pointerup',up,{once:true});hd.addEventListener('pointercancel',up,{once:true})});
  hd.addEventListener('dblclick',()=>set({[key]:DEF[key]}))}
resizer('rzNav','navW',200,360);resizer('rzList','listW',230,560);resizer('rzRight','rightW',220,460);
const tilde=p=>HOME&&p.startsWith(HOME)?'~'+p.slice(HOME.length):p;
const recentRoots=()=>{try{return JSON.parse(localStorage.getItem('unfold-roots')||'[]')}catch(e){return[]}};
const rememberRoot=p=>{try{localStorage.setItem('unfold-roots',JSON.stringify([p,...recentRoots().filter(x=>x!==p)].slice(0,6)))}catch(e){}};
async function reopen(){closeNote(true);sel={t:'all'};await boot()}
async function chooseRoot(){await flush();let r;try{r=await API.pickRoot()}catch(e){return toast('Could not open that folder. '+e)}if(r)await reopen()}
async function switchRoot(p){await flush();try{await API.setRoot(p)}catch(e){try{localStorage.setItem('unfold-roots',JSON.stringify(recentRoots().filter(x=>x!==p)))}catch(_){}return toast('Could not open that folder. '+e)}await reopen()}
$('folderBtn').onclick=chooseRoot;
$('vaultBtn').onclick=()=>{const b=$('vaultBtn').getBoundingClientRect(),others=recentRoots().filter(p=>p!==ROOT);
  menu({clientX:b.left,clientY:b.top,preventDefault(){},stopPropagation(){}},[{head:tilde(ROOT)},{label:'Show in Finder',run:()=>API.reveal().catch(e=>toast('Could not open Finder. '+e))},
    ...(others.length?['-',{head:'Recent folders'},...others.map(p=>({label:tilde(p),run:()=>switchRoot(p)}))]:[]),'-',{label:'Open another folder…',run:chooseRoot}]);
  if(ctxEl)ctxEl.style.top=Math.max(8,b.top-ctxEl.offsetHeight-6)+'px'};
let toastT;function toast(m){const t=$('toast');t.textContent=m;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),3200)}

/* Reading settings */
const FONTS={inter:'"Inter",system-ui,sans-serif',atkinson:'"Atkinson Hyperlegible","Inter",system-ui,sans-serif',lexend:'"Lexend","Inter",system-ui,sans-serif'};
const DEF={prompts:true,mc:null,skin:'',font:'inter',rs:17,rl:1.7,rls:0,rws:0,rw:62,bold:false,focus:false,echoOn:true,toc:true,bar:false,nav:true,side:true,navW:204,listW:300,rightW:290,view:'rich'};
const EASY={font:'atkinson',rs:19,rl:1.95,rls:0.05,rws:0.16,rw:54,bold:false,focus:true};
let S={...DEF};try{S={...DEF,...JSON.parse(localStorage.getItem('unfold-reading')||'{}')}}catch(e){}
function apply(){
  const r=document.documentElement;S.skin?r.dataset.skin=S.skin:delete r.dataset.skin;if(window.applyMC)applyMC();
  r.style.setProperty('--rf',FONTS[S.font]||FONTS.inter);r.style.setProperty('--rs',S.rs+'px');r.style.setProperty('--rl',S.rl);
  r.style.setProperty('--rls',S.rls+'em');r.style.setProperty('--rws',S.rws+'em');r.style.setProperty('--rw',S.rw+'ch');r.style.setProperty('--rwt',S.bold?500:400);
  ed.classList.toggle('raw',S.view==='md');$('views').style.setProperty('--i',S.view==='md'?1:0);document.querySelectorAll('#views button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===S.view));
  document.body.classList.toggle('sbar-on',S.bar);document.body.classList.toggle('nonav',!S.nav);r.style.setProperty('--navw',Math.max(200,S.navW)+'px');r.style.setProperty('--listw',S.listW+'px');$('barBtn').setAttribute('aria-pressed',S.bar);$('barBtn').title=S.bar?'Hide the style bar':'Show the style bar';
  $('setBar').checked=S.bar;$('setToc').checked=S.toc;$('setEcho').checked=S.side;$('setPrompts').checked=S.prompts;if(window.Prompts&&!S.prompts)Prompts.hide();drawThemes();
  document.body.classList.toggle('focus',S.focus);document.body.classList.toggle('noright',!S.side);r.style.setProperty('--rightw',S.rightW+'px');$('infoBtn').setAttribute('aria-pressed',S.side);$('infoBtn').title=S.side?'Hide the side panel':'Show the side panel';showTab();document.body.classList.toggle('notoc',!S.toc);$('tocOn').checked=S.toc;
  for(const k of['rs','rl','rls','rws','rw'])$(k).value=S[k];
  $('rsO').textContent=S.rs+' px';$('rlO').textContent=(+S.rl).toFixed(2);$('rlsO').textContent=Math.round(S.rls*100)+'%';$('rwsO').textContent=Math.round(S.rws*100)+'%';$('rwO').textContent=S.rw+' characters';
  $('bold').checked=S.bold;$('focus').checked=S.focus;$('echoOn').checked=S.side;
  document.querySelectorAll('#skins button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===S.skin));
  document.querySelectorAll('#fonts button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===S.font));
  try{localStorage.setItem('unfold-reading',JSON.stringify(S))}catch(e){}
}
const set=p=>{Object.assign(S,p);apply()};
for(const k of['rs','rl','rls','rws','rw'])$(k).addEventListener('input',e=>set({[k]:+e.target.value}));
for(const k of['bold','focus','toc'])$(k==='toc'?'tocOn':k).addEventListener('change',e=>set({[k]:e.target.checked}));
$('echoOn').addEventListener('change',e=>set({side:e.target.checked}));
$('skins').onclick=e=>{const b=e.target.closest('button');if(b)set({skin:b.dataset.v})};
$('fonts').onclick=e=>{const b=e.target.closest('button');if(b)set({font:b.dataset.v})};
$('easy').onclick=()=>set(EASY);$('reset').onclick=()=>set({...DEF,skin:S.skin,view:S.view,nav:S.nav,bar:S.bar,side:S.side,navW:S.navW,listW:S.listW,rightW:S.rightW});
function setView(v){if(S.view===v)return;if(calm)return set({view:v});
  ed.animate([{opacity:1},{opacity:0}],{duration:90,easing:'ease-in'}).onfinish=()=>{set({view:v});ed.animate([{opacity:0,transform:'translateY(3px)'},{opacity:1,transform:'none'}],{duration:170,easing:'cubic-bezier(.2,.7,.2,1)'})}}
const flipView=()=>setView(S.view==='md'?'rich':'md');
for(const id of['views','barBtn'])$(id).addEventListener('mousedown',e=>e.preventDefault());
$('views').onclick=e=>{const b=e.target.closest('button');if(b)setView(b.dataset.v)};$('barBtn').onclick=()=>set({bar:!S.bar});
const panel=$('panel'),aa=$('aaBtn');
const togglePanel=on=>{panel.classList.toggle('open',on);aa.setAttribute('aria-expanded',panel.classList.contains('open'))};
aa.onclick=()=>{toggleInfo(false);openAssist(false);togglePanel()};
panel.addEventListener('mousedown',e=>{if(!e.target.closest('input'))e.preventDefault()});
document.addEventListener('mousedown',e=>{if(panel.classList.contains('open')&&!e.target.closest('#panel,#aaBtn'))togglePanel(false)});

/* ---- Right-click menus ---- */
let ctxEl=null;
function closeMenu(){if(ctxEl){ctxEl.remove();ctxEl=null}}
function menu(e,items){e.preventDefault();e.stopPropagation();closeMenu();const m=el('div','ctx');m.setAttribute('role','menu');
  for(const it of items){if(!it)continue;if(it==='-'){m.appendChild(el('hr',''));continue}
    if(it.head){const h=el('div','ch');h.textContent=it.head;m.appendChild(h);continue}
    const b=el('button',it.danger?'danger':'');b.textContent=it.label;b.setAttribute('role','menuitem');b.onclick=()=>{closeMenu();it.run()};m.appendChild(b)}
  document.body.appendChild(m);const r=m.getBoundingClientRect();
  m.style.left=Math.max(8,Math.min(e.clientX,innerWidth-r.width-8))+'px';m.style.top=Math.max(8,Math.min(e.clientY,innerHeight-r.height-8))+'px';ctxEl=m}
document.addEventListener('mousedown',e=>{if(ctxEl&&!e.target.closest('.ctx'))closeMenu()});
window.addEventListener('blur',closeMenu);
const showIn=p=>({label:'Show in Finder',run:async()=>{await flush();API.revealPath(p).catch(e=>toast('Could not show that in Finder. '+e))}});
const noteMenu=n=>[{label:n.pinned?'Unpin':'Pin to top',run:()=>togglePin(n)},showIn(n.id),'-',
  {label:'Export as Markdown…',run:()=>exportNote(n,'md')},{label:'Export as web page…',run:()=>exportNote(n,'html')},{label:'Export as plain text…',run:()=>exportNote(n,'txt')},
  ...(allFolders().length?['-',{head:'Move to'},...allFolders().filter(f=>f!==n.folder).map(f=>({label:base(f),run:()=>moveNote(n.id,f)})),...(n.folder?[{label:'No folder',run:()=>moveNote(n.id,'')}]:[])]:[]),
  '-',{label:'Move to Trash',danger:true,run:()=>trashNote(n)}];
const folderMenu=f=>[{label:'New note here',run:()=>{pick({t:'folder',name:f});newNote()}},{label:pinnedF().includes(f)?'Unpin folder':'Pin folder to top',run:()=>toggleFolderPin(f)},showIn(f),
  ...(SECTIONS.length>1?['-',{head:'Move to section'},...SECTIONS.filter(s=>s.name!==f.split('/')[0]).map(s=>({label:s.name,run:()=>moveFolder(f,s.name)}))]:[])];

/* ---- Export ---- */
function exportHTML(n){const strip=s=>inl(s).replace(/<span class="mk">.*?<\/span>/g,'');let out='',list=null,code=null;
  const close=()=>{if(list){out+='</'+list+'>\n';list=null}},open=t=>{if(list!==t){close();out+='<'+t+'>\n';list=t}};
  for(const l of n.body.split('\n')){let m;
    if(/^```/.test(l)){close();if(code==null)code='';else{out+='<pre><code>'+esc(code)+'</code></pre>\n';code=null}continue}
    if(code!=null){code+=l+'\n';continue}
    if(!l.trim()){close();continue}
    if(m=l.match(/^(#{1,3})\s+(.*)$/)){close();out+=`<h${m[1].length}>${strip(m[2])}</h${m[1].length}>\n`}
    else if(/^(-{3,}|\*{3,})\s*$/.test(l)){close();out+='<hr>\n'}
    else if(m=l.match(/^>\s?(.*)$/)){close();out+='<blockquote>'+strip(m[1])+'</blockquote>\n'}
    else if(m=l.match(/^\s*[-*]\s+\[( |x)\]\s+(.*)$/i)){open('ul');out+=`<li class="task"><input type="checkbox" disabled${m[1]!==' '?' checked':''}> ${strip(m[2])}</li>\n`}
    else if(m=l.match(/^\s*[-*]\s+(.*)$/)){open('ul');out+='<li>'+strip(m[1])+'</li>\n'}
    else if(m=l.match(/^\s*\d+[.)]\s+(.*)$/)){open('ol');out+='<li>'+strip(m[1])+'</li>\n'}
    else if(m=l.match(/^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/)){close();const u=pic(m[2],n);out+=`<p><img alt="${esc(m[1])}" src="${u?u.slice(5,-2):esc(m[2])}"></p>\n`}
    else{close();out+='<p>'+strip(l)+'</p>\n'}}
  close();if(code!=null)out+='<pre><code>'+esc(code)+'</code></pre>\n';
  return `<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(titleOf(n))}</title>\n<style>body{font:17px/1.7 -apple-system,"Inter",system-ui,sans-serif;color:#2B2924;background:#FAF9F5;max-width:680px;margin:48px auto;padding:0 24px}h1,h2,h3{line-height:1.25}code{font-family:ui-monospace,Menlo,monospace;font-size:.9em;background:#EFECE3;border-radius:5px;padding:.1em .35em}pre{background:#EFECE3;border-radius:10px;padding:14px 16px;overflow:auto}pre code{background:none;padding:0}blockquote{border-left:2px solid #5F7A5A;margin:1em 0;padding-left:16px;color:#6F6B62}hr{border:0;border-top:1px solid #E6E2D7;margin:2em 0}img{max-width:100%;border-radius:12px}li.task{list-style:none;margin-left:-1.4em}mark{background:#F6DFC9}a{color:#3F6E8C}</style></head>\n<body>\n${out}</body></html>\n`}
async function exportNote(n,kind){if(!n)return;if(n.dirty)await flush();const name=clean(titleOf(n))||'Note';
  const content=kind==='html'?exportHTML(n):kind==='txt'?n.body.split('\n').map(l=>/^```/.test(l)?'':plain(l)).join('\n'):n.body;
  try{const p=await API.export(name+'.'+kind,content);if(p)toast('Exported to '+(HOME&&p.startsWith(HOME)?'~'+p.slice(HOME.length):p)+'.')}catch(e){toast('Could not export. '+e)}}

/* ---- Right panel: Echoes (the default) and note details ---- */
const infoBtn=$('infoBtn');let infoTab='echo';try{infoTab=localStorage.getItem('unfold-side')||'echo'}catch(e){}
const statsOn=()=>S.side&&infoTab==='stats';
function drawStats(){const n=cur();if(!n)return;const p=text.split('\n').filter(l=>!/^```/.test(l)).map(plain).join(' ').trim(),w=p?p.split(/\s+/).length:0,mins=w/230,put=(id,v)=>{$(id).textContent=v};
  put('stW',w.toLocaleString());put('stC',p.length.toLocaleString());put('stP',split(text).length);put('stR',w?(mins<1?'< 1 min':Math.round(mins)+' min'):'–');
  const dt=ms=>new Date(ms).toLocaleString('en',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
  put('stM',dt(n.mt));put('stCr',dt(n.ct||n.mt));put('stF',n.folder?n.folder.replace('/',' › '):'No folder')}
function showTab(t){if(t)infoTab=t;if(!['echo','stats'].includes(infoTab))infoTab='echo';try{localStorage.setItem('unfold-side',infoTab)}catch(e){}
  $('sideTabs').style.setProperty('--i',infoTab==='stats'?1:0);document.querySelectorAll('#sideTabs button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===infoTab));
  document.querySelectorAll('#rpanel .tab').forEach(d=>{d.hidden=d.dataset.tab!==infoTab});if(infoTab==='stats'&&curId)drawStats()}
/* Kept for older call sites: passing true opens the panel, anything else leaves it alone. */
const toggleInfo=on=>{if(on===true&&!S.side)set({side:true})};
infoBtn.addEventListener('mousedown',e=>e.preventDefault());infoBtn.onclick=()=>set({side:!S.side});
$('sideTabs').addEventListener('mousedown',e=>e.preventDefault());
$('sideTabs').onclick=e=>{const b=e.target.closest('button');if(b)showTab(b.dataset.v)};

/* ---- Writing help: AI that runs on this Mac (through Ollama), offered where the writer is working ---- */
let AI={provider:'off',model:'',base:'http://localhost:11434'};try{AI={...AI,...JSON.parse(localStorage.getItem('unfold-ai')||'{}')}}catch(e){}
const saveAI=()=>{try{localStorage.setItem('unfold-ai',JSON.stringify(AI))}catch(e){}drawAssist();drawSettings()};
const aiOn=()=>AI.provider==='ollama'&&!!AI.model;
let aiRun=0,aiText='',aiTarget=null,aiBusy=false,mouseDown=false;
const aiSel=()=>curId&&selRange&&selRange[0]<selRange[1]&&selRange[1]<=text.length?selRange.slice():null;
const wc=s=>{s=s.split('\n').map(plain).join(' ').trim();return s?s.split(/\s+/).length:0};
function paraRange(){if(lastCaret==null||!fast||!curId)return null;const i=lineAt(Math.min(lastCaret,text.length));if(!lineLen(i))return null;
  let a=i,b=i;while(a>0&&lineLen(a-1))a--;while(b<KEYS.length-1&&lineLen(b+1))b++;return[PRE[a],PRE[b]+lineLen(b)]}
const PROMPTS={sum:'Summarise the following note in 3 to 5 short bullet points.',
  improve:"Rewrite the following text so it is clearer and easier to read. Keep the meaning, the author's voice and any Markdown formatting.",
  short:'Rewrite the following text at about half the length. Keep the key points and any Markdown formatting.',
  fix:'Correct the spelling, grammar and punctuation in the following text. Change nothing else, and keep any Markdown formatting.',
  todo:'List the action items in the following note as a Markdown task list, one "- [ ] item" per line. If there are none, say so in one line.',
  title:'Suggest one short, plain title for the following note. Reply with the title only, with no quotes and no formatting.',
  cont:'Write the next paragraph of the following note, in the same voice. Reply with only the new paragraph.'};
const LABEL={sum:'Summary',improve:'Clearer version',short:'Shorter version',fix:'Corrected version',todo:'Action items',title:'Title idea',cont:'Next paragraph',ask:'Answer',shape:'Stronger version'};
/* What is worth offering right now, judged from what the writer is doing. This list is the part meant to grow. */
function suggestions(){const out=[];if(!curId)return out;const on=aiOn(),sl=aiSel(),w=wc(text),pr=paraRange();
  const ai=(label,sub,kind,range)=>{if(on)out.push({label,sub,run:()=>aiGo(kind,null,range)})};
  if(sl){ai('Improve the selected text','Clearer and easier to read','improve',sl);ai('Fix spelling and grammar','Corrections only, nothing else changes','fix',sl);ai('Make it shorter','About half the length','short',sl)}
  else if(pr&&wc(text.slice(pr[0],pr[1]))>=8){ai('Improve this paragraph','The one your cursor is in','improve',pr);ai('Fix spelling and grammar here','Corrections only, nothing else changes','fix',pr)}
  if(w>=20&&!/^#\s+\S/.test(text.split('\n').find(l=>l.trim())||''))ai('Suggest a title','This note has no heading yet','title');
  if(w>=120)ai('Summarise this note','3 to 5 short points','sum');
  if(/^\s*[-*]\s+\[ \]/m.test(text)||w>=80)ai('Find action items','As a checklist you can tick off','todo');
  if(w>=30&&lastCaret!=null&&!text.slice(lastCaret).trim())ai('Continue writing','One more paragraph in your voice','cont');
  return out.slice(0,5)}
const assist=$('assist'),fab=$('fab');
function drawAssist(){fab.classList.toggle('busy',aiBusy);fab.classList.toggle('hot',!aiBusy&&(!!aiText&&!!aiTarget||!!aiSel()));
  if(!assist.classList.contains('open'))return;const on=aiOn(),showing=aiBusy||(aiText&&aiTarget);
  $('aiModel').textContent=on?AI.model+' · on this Mac':'';$('aiSetup').hidden=on;$('aiForm').hidden=!on||showing;
  const box=$('sugs');box.innerHTML='';box.hidden=!!showing;$('aiOut').hidden=$('aiWhat').hidden=!showing;
  if(showing){$('aiScope').hidden=true;return}
  const list=suggestions();for(const s of list){const b=el('button','sug');b.innerHTML=`<b>${esc(s.label)}</b><i>${esc(s.sub)}</i>`;b.onclick=s.run;box.appendChild(b)}
  const hint=$('aiScope');hint.hidden=false;
  hint.textContent=!on?'Writing help is off. Pick a model in Settings to switch it on. It runs on this Mac, so your notes stay private.':list.length?'Suggestions for what you are working on:':'Write a few lines, or select some text, and suggestions will appear here.'}
function openAssist(on){assist.classList.toggle('open',on);const o=assist.classList.contains('open');fab.setAttribute('aria-expanded',o);if(o){togglePanel(false);toggleInfo(false);hideBubble()}drawAssist()}
async function aiGo(kind,question,range){if(!curId)return;if(!aiOn()||aiBusy){openAssist(true);return}
  const r=range||(kind==='title'||kind==='cont'?null:aiSel()),body=r?text.slice(r[0],r[1]):text;
  if(!body.trim()){openAssist(true);return toast('There is nothing to work on yet.')}
  aiTarget={id:curId,range:r,src:text,kind};aiText='';aiBusy=true;const id=++aiRun,o=$('aiOut');
  $('aiWhat').textContent=LABEL[kind]+(r?' for the text you chose':' for this note');o.textContent='Thinking…';o.classList.add('wait');$('aiDone').hidden=true;$('aiStopRow').hidden=false;openAssist(true);
  const prompt=kind==='shape'?Shape.prompt(body,r):(kind==='ask'?'Answer the question using only the note below. If the note does not say, say so.\n\nQuestion: '+question:PROMPTS[kind])+'\n\n---\n'+body;
  try{await API.ai(AI.base,AI.model,'You are a careful writing assistant inside a notes app. Reply with only the result, in Markdown, with no preamble and no closing remarks.',prompt,id);aiEnd(id)}catch(e){aiEnd(id,String(e))}}
function aiEnd(id,error){if(id!==aiRun||!aiBusy)return;aiBusy=false;$('aiStopRow').hidden=true;const o=$('aiOut');o.classList.remove('wait');aiText=aiText.trim();
  if(error||!aiText){o.textContent=error?'That did not work. '+error:'The model returned nothing.';aiText='';$('aiDone').hidden=false;for(const id of['aiReplace','aiInsert','aiCopy'])$(id).hidden=true;drawAssist();return}
  o.textContent=aiText;$('aiDone').hidden=false;const k=aiTarget.kind,ask=k==='ask'||k==='sum'||k==='todo';
  $('aiReplace').hidden=!(k==='title'||(aiTarget.range&&!ask));$('aiReplace').textContent=k==='title'?'Use as title':'Replace';$('aiInsert').hidden=k==='title';$('aiCopy').hidden=false;drawAssist()}
window.__TAURI__.event.listen('ai-chunk',e=>{const p=e.payload;if(!p||p.id!==aiRun||!aiBusy)return;
  if(p.text){aiText+=p.text;const o=$('aiOut');o.classList.remove('wait');o.textContent=aiText;o.scrollTop=o.scrollHeight}if(p.error)aiEnd(p.id,p.error)});
function aiClear(){aiText='';aiTarget=null;$('aiDone').hidden=true;drawAssist()}
function aiApply(mode){if(!aiText||!aiTarget)return;if(aiTarget.id!==curId)return toast('Open the note this was written for first.');const t=text,r=aiTarget.range;
  if(aiTarget.kind==='title'){const lines=t.split('\n'),fi=lines.findIndex(l=>l.trim()),ti='# '+aiText.split('\n')[0].replace(/^#+\s*/,'').replace(/^["“']+|["”']+$/g,'').trim();
    if(fi>=0&&/^#\s/.test(lines[fi]))lines[fi]=ti;else lines.unshift(ti,'');commit(lines.join('\n'),ti.length)}
  else if(mode==='replace'){if(!r||t.slice(r[0],r[1])!==aiTarget.src.slice(r[0],r[1]))return toast('That text has changed since. Use Insert below.');commit(t.slice(0,r[0])+aiText+t.slice(r[1]),r[0],r[0]+aiText.length)}
  else{let at=t.length;if(r){at=t.indexOf('\n',r[1]);if(at<0)at=t.length}const head=t.slice(0,at),ins=(!at||head.endsWith('\n\n')?'':head.endsWith('\n')?'\n':'\n\n')+aiText+'\n';commit(head+ins+t.slice(at),at+ins.length)}
  selRange=null;aiClear();openAssist(false);toast('Added to the note. Cmd+Z undoes it.')}
fab.addEventListener('mousedown',e=>e.preventDefault());fab.onclick=()=>openAssist();
assist.addEventListener('mousedown',e=>{if(!e.target.closest('input,.aiout'))e.preventDefault()});
document.addEventListener('mousedown',e=>{if(assist.classList.contains('open')&&!e.target.closest('#assist,#fab,#bubble,.ctx'))openAssist(false)});
$('aiForm').onsubmit=e=>{e.preventDefault();const q=$('aiAsk').value.trim();if(q){$('aiAsk').value='';aiGo('ask',q)}};
$('aiStop').onclick=()=>{API.aiStop().catch(()=>{});aiEnd(aiRun)};
$('aiReplace').onclick=()=>aiApply('replace');$('aiInsert').onclick=()=>aiApply('insert');$('aiDiscard').onclick=()=>aiClear();
$('aiCopy').onclick=()=>navigator.clipboard.writeText(aiText).then(()=>toast('Copied.')).catch(()=>toast('Could not copy.'));
$('aiSetup').onclick=()=>{openAssist(false);settings(true,'ai')};
/* The small bar that appears beside selected text. */
const bubble=$('bubble');let bubT;
function hideBubble(){clearTimeout(bubT);bubble.classList.remove('open')}
function bubbleSoon(){clearTimeout(bubT);const s=getSelection();if(!s.rangeCount||s.isCollapsed){bubble.classList.remove('open');if(fab.classList.contains('hot')||assist.classList.contains('open'))drawAssist();return}bubT=setTimeout(showBubble,220)}
function showBubble(){const s=getSelection();drawAssist();
  if(!curId||!aiOn()||aiBusy||mouseDown||document.activeElement!==ed||!s.rangeCount||s.isCollapsed||!ed.contains(s.anchorNode)||assist.classList.contains('open'))return hideBubble();
  const r=s.getRangeAt(0).getBoundingClientRect(),m=document.querySelector('main').getBoundingClientRect();if(!r.width&&!r.height)return hideBubble();
  bubble.classList.add('open');const w=bubble.offsetWidth;let x=r.left+r.width/2-w/2-m.left,y=r.top-m.top-42;
  x=Math.max(8,Math.min(x,m.width-w-8));if(y<54)y=r.bottom-m.top+8;bubble.style.left=x+'px';bubble.style.top=y+'px'}
ed.addEventListener('mousedown',()=>{mouseDown=true;hideBubble()});
document.addEventListener('mouseup',()=>{if(mouseDown){mouseDown=false;bubbleSoon()}});
$('scroll').addEventListener('scroll',()=>{if(bubble.classList.contains('open')){hideBubble();bubbleSoon()}},{passive:true});
bubble.addEventListener('mousedown',e=>e.preventDefault());
bubble.onclick=e=>{const b=e.target.closest('button');if(!b)return;const r=aiSel();hideBubble();if(b.dataset.a==='more')openAssist(true);else if(r)aiGo(b.dataset.a,null,r)};

/* ---- Settings ---- */
const THEMES={paper:{bg:'#FAF9F5',side:'#F3F1EA',nav:'#ECE9DF',ink:'#2B2924',soft:'#6F6B62',faint:'#A8A396',line:'#E6E2D7',tint:'#EFECE3',accent:'#C2613F',mark:'#F6DFC9',link:'#3F6E8C',code:'#8A4B6B',quote:'#5F7A5A'},
  sepia:{bg:'#F4EBDA',side:'#ECE1CC',nav:'#E4D8C0',ink:'#40331F',soft:'#7A6A52',faint:'#A8997F',line:'#E0D3BA',tint:'#EADFC9',accent:'#B0562F',mark:'#EBCFA8',link:'#3E6478',code:'#7F4660',quote:'#5E7048'},
  dusk:{bg:'#262522',side:'#201F1D',nav:'#1B1A18',ink:'#E9E5DA',soft:'#A9A498',faint:'#77736A',line:'#383632',tint:'#302F2B',accent:'#DD8361',mark:'#5A3F30',link:'#8FB6CF',code:'#D8A6C0',quote:'#A3BF9A'}};
const THEME_ROWS=[['','Auto','Matches your Mac'],['paper','Paper','Warm white'],['sepia','Sepia','Softer, for long reading'],['dusk','Dusk','Dark, for evenings']];
const sysDark=matchMedia('(prefers-color-scheme: dark)');
const themeOf=v=>THEMES[v||(sysDark.matches?'dusk':'paper')];
function previewTheme(v){const t=themeOf(v),p=$('tPrev');for(const k in t)p.style.setProperty('--'+k,t[k])}
function drawThemes(){const box=$('tList');if(!box)return;box.innerHTML='';
  for(const[v,name,sub]of THEME_ROWS){const t=themeOf(v),b=el('button','trow');b.setAttribute('role','radio');b.setAttribute('aria-checked',S.skin===v);
    b.innerHTML=`<div class="sw3"><i style="background:${t.bg}"></i><i style="background:${t.ink}"></i><i style="background:${t.accent}"></i></div><span><b>${name}</b><small>${sub}</small></span><em></em>`;
    b.onclick=()=>set({skin:v});b.onmouseenter=b.onfocus=()=>previewTheme(v);box.appendChild(b)}
  box.onmouseleave=()=>previewTheme(S.skin);previewTheme(S.skin)}
sysDark.addEventListener('change',()=>drawThemes());
const setVeil=$('setVeil');let MODELS=null,APPLE='';
let setTabNow='general';
function setTab(t){setTabNow=t;document.querySelectorAll('#setTabs button').forEach(b=>b.setAttribute('aria-current',b.dataset.t===t));document.querySelectorAll('.spane section').forEach(s=>{s.hidden=s.dataset.p!==t})}
$('setTabs').onclick=e=>{const b=e.target.closest('button[data-t]');if(b)setTab(b.dataset.t)};
function settings(on,tab){setVeil.classList.toggle('open',on);if(on){setTab(tab||setTabNow);pal(false);togglePanel(false);toggleInfo(false);openAssist(false);loadModels();if(window.applyMC)applyMC()}}
async function loadModels(){MODELS=null;drawSettings();let m;try{m=await API.models(AI.base)}catch(e){m={error:String(e)}}try{APPLE=await API.apple()}catch(e){APPLE='missing'}MODELS=m;drawSettings();if(window.drawOnb)drawOnb()}
function drawSettings(){if(!setVeil.classList.contains('open'))return;const box=$('aiList');box.innerHTML='';
  const row=(label,sub,on,run,dis)=>{const b=el('button','mrow'+(on?' on':''));b.disabled=!!dis;b.innerHTML=`<span><b>${esc(label)}</b><i>${esc(sub)}</i></span><u></u>`;if(run)b.onclick=run;box.appendChild(b)};
  const note=t=>{const p=el('p','mnote');p.textContent=t;box.appendChild(p)};
  row('Off','No AI features',!aiOn(),()=>{AI.provider='off';saveAI()});
  row('Apple built-in model',APPLE==='ready'?'Found on this Mac. Support arrives in a later update.':APPLE==='license'?'Needs a one-time setup first: open Terminal and run  sudo fm license':'Not available on this Mac',false,null,true);
  if(MODELS===null)note('Looking for Ollama models…');
  else if(MODELS.error||!MODELS.length)box.appendChild(aiHelp());
  else MODELS.forEach(m=>row(m,'Ollama · free, runs on this Mac',aiOn()&&AI.model===m,()=>{AI.provider='ollama';AI.model=m;saveAI()}));
  if(!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(AI.base))note('This address is not on this Mac. Anything you send to writing help will go there.');
  if(document.activeElement!==$('aiBase'))$('aiBase').value=AI.base}
$('settingsBtn').onclick=()=>settings(true);$('setClose').onclick=()=>settings(false);
setVeil.addEventListener('mousedown',e=>{if(e.target===setVeil)settings(false)});
$('aiRefresh').onclick=()=>loadModels();
$('aiBase').onchange=e=>{AI.base=e.target.value.trim().replace(/\/+$/,'')||'http://localhost:11434';saveAI();loadModels()};
$('setBar').onchange=e=>set({bar:e.target.checked});$('setToc').onchange=e=>set({toc:e.target.checked});$('setEcho').onchange=e=>set({side:e.target.checked});$('setPrompts').onchange=e=>set({prompts:e.target.checked});
$('setAa').onclick=()=>{settings(false);togglePanel(true)};

/* ---- Style bar ---- */
const PFX=/^(\s*)(#{1,3}\s+|[-*]\s+\[[ xX]\]\s+|[-*]\s+|\d+[.)]\s+|>\s?)?/;
function editLines(fn){const s=readSel();if(!s||!curId)return;const[a,b]=s,ls=text.lastIndexOf('\n',a-1)+1;let le=text.indexOf('\n',b);if(le<0)le=text.length;
  const lines=text.slice(ls,le).split('\n'),out=lines.map(fn).join('\n');commit(text.slice(0,ls)+out+text.slice(le),lines.length>1?ls:ls+out.length,lines.length>1?ls+out.length:undefined)}
const block=(pre,test)=>editLines((l,i)=>{const m=l.match(PFX),rest=l.slice(m[0].length);return m[1]+(m[2]&&test.test(m[2])?'':typeof pre==='function'?pre(i):pre)+rest});
const ACTS={h:()=>editLines(l=>{const m=l.match(PFX),rest=l.slice(m[0].length),lv=m[2]&&m[2][0]==='#'?m[2].trim().length:0;return lv>=3?rest:'#'.repeat(lv+1)+' '+rest}),
  list:()=>listMenu($('listBtn').getAttribute('aria-expanded')!=='true'),
  task:()=>block('- [ ] ',/\[/),ul:()=>block('- ',/^[-*]\s+$/),ol:()=>block(i=>(i+1)+'. ',/^\d/),quote:()=>block('> ',/^>/),
  b:()=>wrap('**'),i:()=>wrap('*'),hl:()=>wrap('=='),s:()=>wrap('~~'),code:()=>wrap('`'),
  link:()=>{const s=readSel();if(!s)return;const[a,b]=s,t=text.slice(a,b)||'link';commit(text.slice(0,a)+'['+t+'](https://)'+text.slice(b),a+t.length+3,a+t.length+11)},
  hr:()=>{const s=readSel();if(!s)return;let le=text.indexOf('\n',s[1]);if(le<0)le=text.length;commit(text.slice(0,le)+'\n\n---\n\n'+text.slice(le),le+7)}};
$('sbar').addEventListener('mousedown',e=>e.preventDefault());
document.body.appendChild($('listMenu'));$('listMenu').addEventListener('mousedown',e=>e.preventDefault());
$('sbar').onclick=$('listMenu').onclick=e=>{const b=e.target.closest('button');if(!b||!ACTS[b.dataset.a])return;if(document.activeElement!==ed)return toast('Click in the note first, then use the style bar.');ACTS[b.dataset.a]();if(b.dataset.a!=='list')listMenu(false)};
/* One list button in the style bar opens a short menu: bullet, numbered or checklist. The current kind is ticked. */
function listMenu(on){const m=$('listMenu'),b=$('listBtn');if(on===(b.getAttribute('aria-expanded')==='true'))return;b.setAttribute('aria-expanded',on);
  if(on){const s=readSel(),l=s?text.slice(text.lastIndexOf('\n',s[0]-1)+1).split('\n')[0]:'',k=/^\s*[-*]\s+\[/.test(l)?'task':/^\s*[-*]\s/.test(l)?'ul':/^\s*\d+[.)]\s/.test(l)?'ol':'';
    m.querySelectorAll('button').forEach(x=>x.setAttribute('aria-checked',x.dataset.a===k));const r=b.getBoundingClientRect();m.style.left=Math.max(8,r.left-4)+'px';m.style.bottom=innerHeight-r.top+10+'px';m.classList.remove('shut');m.hidden=false}
  else{m.classList.add('shut');setTimeout(()=>{if(b.getAttribute('aria-expanded')!=='true'){m.hidden=true;m.classList.remove('shut')}},calm?0:110)}}
document.addEventListener('mousedown',e=>{if(!e.target.closest('.lsel,.lmenu'))listMenu(false)},true);

/* ---- Search every note (and commands, after ">") ---- */
const veil=$('veil'),palIn=$('palIn'),palList=$('palList');let palItems=[],palSel=0;
const CMDS=()=>[['Welcome tour',()=>startTour()],['Writing prompts: turn '+(S.prompts?'off':'on'),()=>set({prompts:!S.prompts})],['Add the Getting started notes',async()=>{await flush();await addGuide();await reopen()}],['New note',()=>newNote()],['New folder',()=>newFolder()],['New section',()=>$('sectionBtn').onclick()],['Settings',()=>settings(true)],
  ['Show or hide the style bar',()=>set({bar:!S.bar})],['Switch between the formatted page and markdown source',()=>flipView()],['Reading settings',()=>togglePanel(true)],['Easy reading preset',()=>set(EASY)],
  ['Theme: Auto',()=>set({skin:''})],['Theme: Paper',()=>set({skin:'paper'})],['Theme: Sepia',()=>set({skin:'sepia'})],['Theme: Dusk',()=>set({skin:'dusk'})],
  ['Show or hide the table of contents',()=>set({toc:!S.toc})],['Dim other paragraphs while writing',()=>set({focus:!S.focus})],['Open another notes folder',()=>chooseRoot()],['Show the notes folder in Finder',()=>API.reveal().catch(()=>{})],
  ...(curId?[['Pin or unpin this note',()=>togglePin()],['Note details',()=>{toggleInfo(true);showTab('stats')}],['Echoes',()=>{toggleInfo(true);showTab('echo')}],['Shape: show or hide writing hints',()=>Shape.toggle()],['Shape: refine the whole note',()=>aiGo('shape',null,[0,text.length])],['Back',()=>go(-1)],['Forward',()=>go(1)],['Show or hide the side panel',()=>set({side:!S.side})],['Writing help',()=>openAssist(true)],
    ['Export this note as Markdown',()=>exportNote(cur(),'md')],['Export this note as a web page',()=>exportNote(cur(),'html')],['Move this note to the Trash',()=>trashNote()],
    ...allFolders().filter(f=>f!==cur().folder).map(f=>['Move this note to '+base(f),()=>moveNote(curId,f)]),...(cur().folder?[['Move this note out of its folder',()=>moveNote(curId,'')]]:[])]:[])];
function parseQ(q){const f={terms:[],words:[],not:[],in:null,pinned:false,task:false,image:false};
  for(const m of q.matchAll(/"([^"]+)"|(\S+)/g)){const t=m[1]||m[2],low=t.toLowerCase();
    if(m[1]){f.terms.push(low);f.words.push(t)}else if(low.startsWith('in:')&&low.length>3)f.in=low.slice(3);else if(low==='is:pinned')f.pinned=true;else if(low==='has:task'||low==='has:tasks')f.task=true;
    else if(low==='has:image'||low==='has:images')f.image=true;else if(low[0]==='-'&&low.length>1)f.not.push(low.slice(1));else if(!/^(in|is|has):?$/.test(low)){f.terms.push(low);f.words.push(t)}}
  return f}
const subseq=(q,s)=>{let i=0;for(const c of s)if(c===q[i])i++;return i===q.length&&q.length>1};
function hl(s,terms){s=esc(s);if(!terms.length)return s;return s.replace(new RegExp('('+terms.map(t=>esc(t).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','gi'),'<mark>$1</mark>')}
function searchNotes(f){const res=[];
  for(const n of NOTES){const tl=titleOf(n).toLowerCase(),bl=n.body.toLowerCase(),fo=(n.folder||'').toLowerCase().replace(/\s+/g,'');
    if(f.pinned&&!n.pinned)continue;if(f.task&&!/^\s*[-*]\s+\[ \]/m.test(n.body))continue;if(f.image&&!/!\[[^\]]*\]\(/.test(n.body))continue;
    if(f.in&&!fo.includes(f.in))continue;if(f.not.some(t=>bl.includes(t)))continue;
    let score=0,ok=true,fuzzy=false;
    for(const t of f.terms){const it=tl.indexOf(t),c=Math.min(bl.split(t).length-1,6);if(it>=0)score+=it===0?16:10;if(c)score+=c;else if(it<0){ok=false;break}}
    if(!ok){if(f.terms.length===1&&subseq(f.terms[0],tl)){score=2;fuzzy=true}else continue}
    const snips=[];
    if(f.terms.length&&!fuzzy){const lines=n.body.split('\n'),first=lines.findIndex(l=>l.trim());
      for(let i=0;i<lines.length&&snips.length<2;i++){if(i===first)continue;const ll=lines[i].toLowerCase(),t=f.terms.find(t=>ll.includes(t));if(!t)continue;
        const p=plain(lines[i]),at=Math.max(0,p.toLowerCase().indexOf(t)),st=Math.max(0,at-34);snips.push({i,html:hl((st?'…':'')+p.slice(st,st+120)+(p.length>st+120?'…':''),f.terms)})}}
    res.push({n,score:score+(n.pinned?1:0),snips,line:snips.length?snips[0].i:null})}
  return res.sort((a,b)=>b.score-a.score||(b.n.mt||0)-(a.n.mt||0)).slice(0,40)}
const rowHTML=(n,terms,snips)=>`<div class="rt"><b>${hl(titleOf(n),terms)}</b><i>${n.pinned?'Pinned · ':''}${n.folder?esc(base(n.folder))+' · ':''}${fmt(n.date)}</i></div>`+snips.map(s=>`<div class="rs">${s.html}</div>`).join('');
function openAt(id,line){jump=line==null?null:{id,line};openNote(id)}
function drawFilters(){const cur=palIn.value.toLowerCase().split(/\s+/),toks=['is:pinned','has:task','has:image',...allFolders().slice(0,6).map(f=>'in:'+base(f).toLowerCase().split(/\s+/)[0])];
  $('palFilters').innerHTML=palIn.value.trim().startsWith('>')?'':[...new Set(toks)].map(t=>`<button data-t="${esc(t)}" class="${cur.includes(t)?'on':''}">${esc(t)}</button>`).join('')}
function drawPal(){const q=palIn.value.trim();let html='';palItems=[];const add=(f,h)=>{html+=`<li data-i="${palItems.length}">${h}</li>`;palItems.push(f)};
  if(q.startsWith('>')){const c=q.slice(1).trim().toLowerCase();html+='<li class="gh">Commands</li>';CMDS().filter(x=>!c||x[0].toLowerCase().includes(c)).forEach(x=>add(x[1],`<div class="rt"><b>${esc(x[0])}</b></div>`))}
  else if(!q){html+='<li class="gh">Recent notes</li>';NOTES.slice().sort((a,b)=>(b.mt||0)-(a.mt||0)).slice(0,7).forEach(n=>add(()=>openNote(n.id),rowHTML(n,[],[])))}
  else{const f=parseQ(q),res=searchNotes(f);if(res.length)html+=`<li class="gh">${res.length} ${res.length===1?'note':'notes'}</li>`;
    res.forEach(r=>add(()=>openAt(r.n.id,r.line),rowHTML(r.n,f.terms,r.snips)));
    const name=f.words.join(' ');if(name&&!NOTES.some(n=>titleOf(n).toLowerCase()===name.toLowerCase())){html+=`<li class="gh">${res.length?'Or':'No notes match'}</li>`;add(()=>newNote(name),`<div class="rt"><b>Create a note called “${esc(name)}”</b></div>`)}
    else if(!res.length)html+='<li class="gh">No notes match.</li>'}
  palSel=Math.min(palSel,Math.max(0,palItems.length-1));palList.innerHTML=html;
  const s=palList.querySelector(`li[data-i="${palSel}"]`);if(s){s.classList.add('sel');s.scrollIntoView({block:'nearest'})}drawFilters()}
function pal(on,seed){veil.classList.toggle('open',on);if(on){closeMenu();togglePanel(false);toggleInfo(false);palIn.value=seed||'';palSel=0;drawPal();palIn.focus()}}
const runPal=i=>{const f=palItems[i];pal(false);if(f)f()};
$('searchBtn').onclick=()=>pal(true);
palIn.addEventListener('input',()=>{palSel=0;drawPal()});
palIn.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();palSel=Math.min(palSel+1,palItems.length-1);drawPal()}else if(e.key==='ArrowUp'){e.preventDefault();palSel=Math.max(palSel-1,0);drawPal()}else if(e.key==='Enter'){e.preventDefault();runPal(palSel)}});
palList.onclick=e=>{const li=e.target.closest('li[data-i]');if(li)runPal(+li.dataset.i)};
palList.onmousemove=e=>{const li=e.target.closest('li[data-i]');if(li&&+li.dataset.i!==palSel){palSel=+li.dataset.i;palList.querySelectorAll('.sel').forEach(x=>x.classList.remove('sel'));li.classList.add('sel')}};
$('palFilters').onmousedown=e=>e.preventDefault();
$('palFilters').onclick=e=>{const b=e.target.closest('button');if(!b)return;const t=b.dataset.t,parts=palIn.value.split(/\s+/).filter(Boolean),i=parts.findIndex(p=>p.toLowerCase()===t);i<0?parts.push(t):parts.splice(i,1);palIn.value=parts.join(' ')+(parts.length?' ':'');palSel=0;drawPal();palIn.focus()};
veil.addEventListener('mousedown',e=>{if(e.target===veil)pal(false)});
document.addEventListener('keydown',e=>{const mod=e.metaKey||e.ctrlKey,k=e.key.toLowerCase();
  if(mod&&(k==='k'||(k==='f'&&e.shiftKey)||k==='p')){e.preventDefault();pal(k==='p'?true:!veil.classList.contains('open'),k==='p'?'> ':'')}
  else if(mod&&!e.shiftKey&&!e.altKey&&(e.key==='['||e.key===']')){e.preventDefault();go(e.key==='['?-1:1)}
  else if(mod&&k==='e'){e.preventDefault();flipView()}
  else if(mod&&k===','){e.preventDefault();settings(!setVeil.classList.contains('open'))}
  else if(e.key==='Escape'){closeMenu();listMenu(false);pal(false);settings(false);togglePanel(false);toggleInfo(false);openAssist(false);hideBubble()}});


let lastSig='';
const sigOf=d=>d.root+'#'+d.notes.map(n=>n.path+':'+n.mtime).join('|')+'#'+d.dirs.join('|');
function adopt(d){lastSig=sigOf(d);ROOT=d.root;HOME=d.home||'';STATE=Object.assign({pinned:[],closed:[]},d.state||{});
  closed.clear();(STATE.closed||[]).forEach(c=>closed.add(c));
  NOTES=d.notes.map(toNote);idx=null;
  SECTIONS=d.dirs.filter(p=>!p.includes('/')).sort(secCmp).map(s=>({name:s,folders:d.dirs.filter(p=>p.startsWith(s+'/')).sort(cmp)}));
  if(sel.t==='folder'&&!allFolders().includes(sel.name))sel=home();
  $('rootPath').textContent=tilde(ROOT);$('vaultName').textContent=ROOT.split('/').filter(Boolean).pop()||ROOT;$('vaultBtn').title='Notes folder: '+tilde(ROOT);rememberRoot(ROOT)}
/* The Getting started notes go into a brand-new notes folder, and once into a folder Unfold seeded before. Notes that
   already exist are never overwritten. A folder of someone's own notes is left alone unless they ask (⌘P). */
async function addGuide(d){d=d||await API.load();const st=d.state||{},have=new Set(d.notes.map(n=>n.path)),uniq=x=>[...new Set(x)];
  for(const[name,body]of GUIDE)if(!have.has(GUIDE_DIR+name))await API.write(GUIDE_DIR+name,body);
  await API.saveState({...st,pinned:uniq([...(st.pinned||[]).filter(p=>p!=='Welcome to Unfold.md'),...GUIDE_PIN.map(n=>GUIDE_DIR+n)]),
    order:uniq([GUIDE_DIR.split('/')[0],...(st.order||[])]),closed:st.closed||[],seeded:true,guide:3});
  try{localStorage.setItem('unfold-last',GUIDE_DIR+'Welcome to Unfold.md')}catch(e){}}
async function boot(){let d;
  try{d=await API.load();
    const st=d.state||{};if(!st.guide&&(st.seeded||(!d.notes.length&&!d.dirs.length))){await addGuide(d);d=await API.load()}
    /* Earlier builds kept these notes in Unfold > Getting started (and once pinned that folder). They now live in Getting started > Welcome, first in the panel. */
    else if(st.guide<3){const OLD='Unfold/Getting started',NEW=GUIDE_DIR.slice(0,-1),s={...st,guide:3},mv=p=>p.startsWith(OLD+'/')?NEW+p.slice(OLD.length):p;
      s.pinnedFolders=(s.pinnedFolders||[]).filter(f=>f!==OLD);
      if(d.dirs.includes(OLD)&&!d.dirs.includes(NEW))try{await API.move(OLD,NEW)}catch(e){}
      s.pinned=(s.pinned||[]).map(mv);if(s.dismissed)s.dismissed=Object.fromEntries(Object.entries(s.dismissed).map(([k,v])=>[mv(k),v]));
      try{const l=localStorage.getItem('unfold-last');if(l)localStorage.setItem('unfold-last',mv(l))}catch(e){}
      s.order=[...new Set([GUIDE_DIR.split('/')[0],...(s.order||[])])];await API.saveState(s);
      /* The old section folder is removed only if it is empty; anything else in it is left alone. */
      if(!d.notes.some(n=>n.path.startsWith('Unfold/')&&!n.path.startsWith(OLD+'/'))&&!d.dirs.some(x=>x.startsWith('Unfold/')&&x!==OLD))await API.rmdir('Unfold').catch(()=>{});
      d=await API.load()}}
  catch(e){document.body.classList.add('nonote');$('emptyCount').textContent='Could not open the notes folder';$('emptyHint').textContent=String(e);return}
  adopt(d);curId=null;
  let last=null;try{last=localStorage.getItem('unfold-last')}catch(e){}
  const want=NOTES.some(n=>n.id===last)?last:(NOTES.slice().sort(byDate)[0]||{}).id;
  {const wn=NOTES.find(n=>n.id===want);sel=wn?selOf(wn):home();drawNav();drawList()}
  if(want)openNote(want);else updateEmpty()}
/* Pick up changes made outside Unfold (Finder, another editor) when the window comes back. */
async function refresh(){if(adding||composing||NOTES.some(n=>n.dirty||n.moving))return;let d,s=null;
  /* A cheap look first (names and dates only). The notes are read again only when something changed. */
  try{s=await API.sig()}catch(e){}
  if(s!==null&&s===diskSig)return;
  try{d=await API.load()}catch(e){return}
  if(NOTES.some(n=>n.dirty||n.moving))return;diskSig=s;
  if(sigOf(d)===lastSig)return;
  const id=curId,was=cur(),gone=was&&!d.notes.some(n=>n.path===id);adopt(d);const n=cur();
  if(id&&!n){curId=id;closeNote(true);if(gone)toast('“'+titleOf(was)+'” was removed outside Unfold.')}else if(n&&n.body!==text){text=n.body;undo=[];redo=[];tocKey='~';paint(null)}
  drawNav();drawList()}
/* While the window is showing, the notes folder is checked once a second, so a note or folder added, renamed or
   deleted in Finder shows up here almost at once. The check reads no note contents. */
setInterval(()=>{if(!document.hidden)refresh()},1000);
window.addEventListener('focus',refresh);
window.addEventListener('blur',()=>{const n=cur();n?leave(n):flush()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});
window.addEventListener('pagehide',()=>{flush()});
apply();boot();
