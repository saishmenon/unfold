/* Markdown colours: each part of a note (headings, links, quotes…) can take a colour from a small palette.
   Every colour is adjusted against the current theme's background until it is readable, so no choice can
   end up too faint. Loaded after app.js and shares its globals. Settings → Appearance draws the controls. */
(function(){
'use strict';
const root=document.documentElement;
const PARTS=[['h1','Heading 1'],['h2','Heading 2'],['h3','Heading 3'],['bold','Bold'],['italic','Italic'],['link','Links'],['wl','Note links'],
  ['code','Inline code'],['quote','Quote bar'],['list','List markers'],['hl','Highlight']];
/* name, shade for light themes, shade for dark themes */
const HUES={ink:['Ink'],soft:['Soft'],clay:['Clay','#C2613F','#DD8361'],ochre:['Ochre','#A8741A','#D9A441'],sage:['Sage','#5F7A5A','#A3BF9A'],
  teal:['Teal','#2F7F79','#7CC4BC'],blue:['Blue','#3F6E8C','#8FB6CF'],plum:['Plum','#8A4B6B','#D8A6C0'],rose:['Rose','#B4506A','#E79AAE']};
const PRESETS={
  calm:{h1:'ink',h2:'ink',h3:'soft',bold:'ink',italic:'ink',link:'clay',wl:'blue',code:'plum',quote:'sage',list:'clay',hl:'clay'},
  vivid:{h1:'clay',h2:'blue',h3:'teal',bold:'ink',italic:'plum',link:'clay',wl:'teal',code:'plum',quote:'sage',list:'ochre',hl:'ochre'},
  plain:{h1:'ink',h2:'ink',h3:'ink',bold:'ink',italic:'ink',link:'ink',wl:'ink',code:'ink',quote:'soft',list:'soft',hl:'soft'}};
const PNAME={calm:'Calm',vivid:'Vivid',plain:'Plain'};

/* ---- colour maths ---- */
const rgb=h=>{h=h.replace('#','');if(h.length===3)h=h.replace(/./g,'$&$&');return[0,2,4].map(i=>parseInt(h.slice(i,i+2),16))};
const lum=h=>{const[r,g,b]=rgb(h).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b};
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const hex=(r,g,b)=>'#'+[r,g,b].map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
function toHsl(h){let[r,g,b]=rgb(h).map(v=>v/255);const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;if(!d)return[0,0,l];
  const s=d/(1-Math.abs(2*l-1));let hh=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;return[(hh*60+360)%360,s,l]}
function fromHsl(h,s,l){const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2,i=Math.floor(h/60)%6,
  [r,g,b]=[[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][i];return hex((r+m)*255,(g+m)*255,(b+m)*255)}
/* Nudge a colour darker (on light paper) or lighter (on dark paper) until it clears the contrast it needs. */
function fit(col,bg,min){let[h,s,l]=toHsl(col);const up=lum(bg)<.2;let out=col;
  for(let i=0;i<80&&ratio(out,bg)<min;i++){l=Math.max(0,Math.min(1,l+(up?.01:-.01)));out=fromHsl(h,s,l)}return out}

const theme=()=>{const cs=getComputedStyle(root),v=n=>cs.getPropertyValue(n).trim();return{bg:v('--bg'),tint:v('--tint'),ink:v('--ink'),soft:v('--soft'),mark:v('--mark')}};
const cur=()=>({...PRESETS.calm,...(S.mc||{})});
/* Text needs 4.5:1. The quote bar is a shape, so 3:1. Inline code sits on a tinted chip, so it is checked against that. */
function shade(part,hue,t){t=t||theme();if(hue==='ink')return t.ink;const H=HUES[hue]||HUES.clay;
  return fit(hue==='soft'?t.soft:H[lum(t.bg)<.2?2:1],part==='code'?t.tint:t.bg,part==='quote'?3:4.5)}
function value(part,hue,t){const c=shade(part,hue,t);
  if(part==='hl')return hue==='ink'||hue==='soft'?t.mark:`color-mix(in srgb,${c} 26%,${t.bg})`;
  if((part==='bold'||part==='italic')&&hue==='ink')return'inherit';return c}
function applyMC(){const t=theme();if(!/^#[0-9a-f]{3,6}$/i.test(t.bg))return;const m=cur();for(const[p]of PARTS)root.style.setProperty('--c-'+p,value(p,m[p],t));drawMC()}

/* ---- Settings → Appearance ---- */
const SAMPLE={h1:'font-weight:650;font-size:15px',h2:'font-weight:650;font-size:14px',h3:'font-weight:650',bold:'font-weight:650',italic:'font-style:italic',
  link:'text-decoration:underline;text-underline-offset:3px',wl:'text-decoration:underline;text-underline-offset:3px',code:'font:12px var(--mono);background:var(--tint);border-radius:5px;padding:2px 6px'};
function drawMC(){const box=$('mcBox');if(!box||!$('setVeil').classList.contains('open'))return;const t=theme(),m=cur();
  const same=k=>PARTS.every(([p])=>PRESETS[k][p]===m[p]);
  let h='<div class="mc-pre" role="group" aria-label="Colour presets">'+Object.keys(PRESETS).map(k=>`<button data-pre="${k}" aria-pressed="${same(k)}">${PNAME[k]}</button>`).join('')+'</div>';
  for(const[p,name]of PARTS){const c=value(p,m[p],t);
    const lab=p==='quote'?`<span class="mc-n" style="border-left:2px solid ${c};padding-left:8px">${name}</span>`:p==='list'?`<span class="mc-n"><b style="color:${c}">•</b> ${name}</span>`
      :p==='hl'?`<span class="mc-n"><mark style="background:${c};color:inherit;border-radius:3px;padding:1px 4px">${name}</mark></span>`:`<span class="mc-n" style="color:${c==='inherit'?t.ink:c};${SAMPLE[p]||''}">${name}</span>`;
    h+=`<div class="mc-row">${lab}<div class="mc-sw" role="radiogroup" aria-label="${name} colour">`+Object.keys(HUES).map(k=>
      `<button role="radio" data-p="${p}" data-h="${k}" aria-checked="${m[p]===k}" title="${HUES[k][0]}" aria-label="${HUES[k][0]}" style="--sw:${shade(p,k,t)}"></button>`).join('')+'</div></div>'}
  box.innerHTML=h}
document.addEventListener('click',e=>{const b=e.target.closest('#mcBox button');if(!b)return;
  if(b.dataset.pre)set({mc:{...PRESETS[b.dataset.pre]}});else if(b.dataset.p)set({mc:{...cur(),[b.dataset.p]:b.dataset.h}})});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>setTimeout(applyMC,0));
window.applyMC=applyMC;window.MC={PARTS,HUES,PRESETS,ratio,shade,value,theme,cur};
applyMC();
})();
