import asyncio,json,os
LEGACY=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'legacy-seed.json')))
from playwright.async_api import async_playwright
MOCK='''
try{localStorage.setItem('unfold-onboarded','1');localStorage.setItem('unfold-folder','1')}catch(e){}
window.FS={files:{},dirs:new Set(),state:{},t:1700000000000};window.LEGACY=__LEGACY__;if(!window.FRESH_DISK){for(const[n,b]of LEGACY)FS.files[n]={b,m:++FS.t};FS.state={pinned:['Welcome to Unfold.md'],closed:[],seeded:true,guide:3}}
window.EV={};window.__TAURI__={event:{listen:async(n,f)=>{const L=EV[n]&&EV[n].L||[];L.push(f);EV[n]=x=>L.forEach(g=>g(x));EV[n].L=L}},core:{invoke:async(c,a)=>{const F=window.FS;window.LOG=(window.LOG||[]);LOG.push(c+' '+JSON.stringify(a||{}).slice(0,80));
 const uniq=p=>{if(!(p in F.files))return p;const m=p.match(/^(.*?)(\\.[^.\\/]+)?$/);for(let i=2;;i++){const q=m[1]+' '+i+(m[2]||'');if(!(q in F.files))return q}};
 if(c==='scan')return{root:'/Users/me/Documents/Unfold',home:'/Users/me',notes:Object.entries(F.files).filter(([p])=>/\\.md$/i.test(p)).map(([path,f])=>({path,mtime:f.m,created:f.m,body:f.b})),dirs:[...new Set([...F.dirs,...Object.keys(F.files).flatMap(p=>{const a=p.split('/');return a.length>2?[a[0],a[0]+'/'+a[1]]:a.length>1?[a[0]]:[]})])],state:F.state};
 if(c==='write_note'){if(!/\\.(md|markdown|txt|svg)$/i.test(a.path))throw 'Unfold can only save notes.';F.files[a.path]={b:a.body,m:++F.t};return F.t}
 if(c==='create_note'){const p=uniq((a.dir?a.dir+'/':'')+a.name+'.md');F.files[p]={b:'',m:++F.t};return{path:p,mtime:F.t,body:''}}
 if(c==='move_path'){if(a.from===a.to)return a.from;if(!(a.from in F.files)){for(const k of Object.keys(F.files))if(k.startsWith(a.from+'/')){F.files[a.to+k.slice(a.from.length)]=F.files[k];delete F.files[k]}for(const x of[...F.dirs])if(x===a.from||x.startsWith(a.from+'/')){F.dirs.delete(x);F.dirs.add(a.to+x.slice(a.from.length))}return a.to}const p=uniq(a.to);F.files[p]=F.files[a.from];delete F.files[a.from];return p}
 if(c==='make_dir'){F.dirs.add(a.path);F.dirs.add(a.path.split('/')[0]);return null}
 if(c==='scan_sig'){const d=await window.__TAURI__.core.invoke('scan');return d.root+'#'+d.notes.map(n=>n.path+':'+n.mtime).join('|')+'#'+d.dirs.join('|')}
 if(c==='reveal_path'){F.revealed=a.path;return null}
 if(c==='remove_empty_dir'){if(Object.keys(F.files).some(k=>k.startsWith(a.path+'/')))throw 'not empty';for(const x of[...F.dirs])if(x===a.path||x.startsWith(a.path+'/'))F.dirs.delete(x);return null}
 if(c==='trash_path'){delete F.files[a.path];return null}
 if(c==='save_state'){F.state=a.state;return null}
 if(c==='read_image'){const f=F.files[a.path];return f&&/\\.svg$/.test(a.path)?'data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(f.b))):null}
 if(c==='ai_models'){if(F.running===false)throw 'Ollama was not found';return F.models||['qwen3.6:latest']}
 if(c==='ai_quick'){F.quick=(F.quick||0)+1;F.lastQuick=a.prompt;await new Promise(r=>setTimeout(r,40));return a.prompt?(F.quickReply||'What made that first month so hard?'):''}
 if(c==='open_url'){F.opened=a.url;return null}
 if(c==='ai_start'){if(!F.ollama)throw 'Ollama is not installed';F.running=true;return null}
 if(c==='ai_pull'){for(const d of[1,50,100]){await new Promise(r=>setTimeout(r,20));EV['ai-pull']({payload:{model:a.model,status:'pulling',done:d,total:100}})}F.models=[a.model];return null}
if(c==='ai_apple_status')return'license';if(c==='ai_stop')return null;
 if(c==='ai_run'){for(const t of['- Point one\\n','- Point two']){await new Promise(r=>setTimeout(r,30));EV['ai-chunk']({payload:{id:a.id,text:t}})}return null}
 if(c==='export_file'){F.exported=[a.name,a.content];return'/Users/me/Desktop/'+a.name}
 if(c==='pick_root')return null;
 throw 'unknown '+c}}};
'''
MOCK=MOCK.replace('__LEGACY__',json.dumps(LEGACY))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':1440,'height':900})
        errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(m.text))
        await pg.add_init_script(MOCK)
        await pg.goto('file:///home/claude/app/ui/index.html');await pg.wait_for_timeout(900)
        files=lambda:pg.evaluate('Object.keys(FS.files)')
        print('seed',await files(),await pg.evaluate('[curId,NOTES.length,$("rootPath").textContent,FS.state.pinned]'))
        await pg.click('.ln >> nth=2');await pg.keyboard.press('End');await pg.keyboard.type(' EDITED');await pg.wait_for_timeout(600)
        print('saved','EDITED' in await pg.evaluate('FS.files[curId].b'),await pg.evaluate('text===readText()'))
        # sections, folders, move folder, pin folder
        await pg.click('#sectionBtn');await pg.keyboard.type('Work');await pg.keyboard.press('Enter')
        await pg.click('#sectionBtn');await pg.keyboard.type('Home');await pg.keyboard.press('Enter')
        await pg.click('#newFolderBtn');await pg.keyboard.type('Clients');await pg.keyboard.press('Enter');await pg.wait_for_timeout(100)
        print('dirs',await pg.evaluate('[...FS.dirs]'),await pg.evaluate('JSON.stringify(SECTIONS)'))
        await pg.click('.nrow >> text=Clients',button='right');await pg.wait_for_timeout(100);print('fmenu',await pg.evaluate('[...document.querySelectorAll(".ctx button,.ctx .ch")].map(b=>b.textContent)'))
        await pg.click('.ctx button >> text=Pin folder');await pg.wait_for_timeout(100)
        await pg.evaluate('FS.files["Home/Clients/x.md"]={b:"# In folder\\n\\nbody about invoices",m:++FS.t};FS.dirs.add("Home/Clients")');
        await pg.evaluate('window.dispatchEvent(new Event("focus"))');await pg.wait_for_timeout(300)
        await pg.evaluate('moveFolder("Home/Clients","Work")');await pg.wait_for_timeout(300)
        print('movedF',await pg.evaluate('[JSON.stringify(SECTIONS),NOTES.map(n=>n.id),JSON.stringify(FS.state)]'))
        # note context menu
        await pg.evaluate('pick({t:"all"})');await pg.wait_for_timeout(200)
        await pg.click('.note >> text=Markdown',button='right');await pg.wait_for_timeout(100);print('nmenu',await pg.evaluate('[...document.querySelectorAll(".ctx button")].map(b=>b.textContent)'))
        await pg.click('.ctx button >> text=web page');await pg.wait_for_timeout(200);print('export',await pg.evaluate('[FS.exported[0],FS.exported[1].length,FS.exported[1].includes("<h2>Lists</h2>"),FS.exported[1].includes("<mark")]'))
        # search
        await pg.keyboard.press('Control+k');await pg.keyboard.type('invoices');await pg.wait_for_timeout(150)
        print('search',await pg.evaluate('[...palList.querySelectorAll("li")].map(l=>l.textContent.slice(0,60))'))
        await pg.keyboard.press('Enter');await pg.wait_for_timeout(600);print('opened',await pg.evaluate('[curId,!!document.querySelector(".flash")]'))
        await pg.keyboard.press('Control+k');await pg.keyboard.type('"plain bullet" -zzz is:pinned');await pg.wait_for_timeout(100);print('filt',await pg.evaluate('palItems.length'))
        await pg.fill('#palIn','> theme');await pg.wait_for_timeout(100);print('cmds',await pg.evaluate('[...palList.querySelectorAll("li[data-i]")].map(l=>l.textContent)'));await pg.keyboard.press('Escape')
        # style bar
        await pg.click('#barBtn');await pg.evaluate('openNote("Welcome to Unfold.md")');await pg.wait_for_timeout(500)
        await pg.click('.ln >> nth=2');await pg.click('#sbar button[data-a=h]');await pg.click('#sbar button[data-a=h]');l=await pg.evaluate('text.split("\\n")[2].slice(0,12)');print('H',repr(l))
        await pg.click('#listBtn');await pg.click('#listMenu button[data-a=task]');print('task',repr(await pg.evaluate('text.split("\\n")[2].slice(0,12)')))
        await pg.click('#listBtn');await pg.click('#listMenu button[data-a=task]');await pg.keyboard.press('Home');await pg.keyboard.press('Shift+End');await pg.click('#sbar button[data-a=b]');print('bold',await pg.evaluate('(text.split("\\n")[2].match(/\\*\\*/g)||[]).length'),await pg.evaluate('text===readText()'))
        await pg.click('#sbar button[data-a=b]');print('unbold',await pg.evaluate('(text.split("\\n")[2].match(/\\*\\*/g)||[]).length'))
        # info + writing help
        await pg.click('#infoBtn');await pg.wait_for_timeout(150);print('stats',await pg.evaluate('[$("stW").textContent,$("stR").textContent,document.querySelectorAll("#infoTabs button").length]'));await pg.keyboard.press('Escape')
        await pg.click('#fab');await pg.wait_for_timeout(150);print('assist off',await pg.evaluate('[$("aiScope").textContent.slice(0,28),$("aiSetup").hidden,document.querySelectorAll(".sug").length]'))
        await pg.click('#aiSetup');await pg.wait_for_timeout(300);await pg.click('.mrow >> text=qwen');await pg.click('#setClose')
        await pg.click('.ln >> nth=14');await pg.wait_for_timeout(100);await pg.click('#fab');await pg.wait_for_timeout(150);print('sugs',await pg.evaluate('[...document.querySelectorAll(".sug b")].map(b=>b.textContent)'));await pg.keyboard.press('Escape')
        await pg.click('.ln >> nth=14');await pg.keyboard.press('Home');await pg.keyboard.press('Shift+End');await pg.wait_for_timeout(500)
        print('bubble',await pg.evaluate('[bubble.classList.contains("open"),fab.classList.contains("hot")]'))
        await pg.click('#bubble button[data-a=fix]');await pg.wait_for_timeout(350);print('ai',await pg.evaluate('[$("aiWhat").textContent,$("aiOut").textContent,$("aiReplace").hidden,$("aiDone").hidden]'))
        await pg.click('#aiReplace');await pg.wait_for_timeout(150);print('replaced',await pg.evaluate('[text.includes("- Point one"),text===readText(),assist.classList.contains("open")]'))
        await pg.keyboard.press('Control+z');await pg.wait_for_timeout(100);print('undone',await pg.evaluate('!text.includes("- Point one")'))
        # lists: Tab nests, letters for children, Enter on empty item steps back out
        await pg.evaluate('(()=>{const n=cur();n.body="# Lists\\n\\n1. One\\n2. Two\\n\\n- [x] Done thing\\n- [ ] Open thing";openNote(n.id)})()');await pg.wait_for_timeout(300)
        await pg.click('.ln >> nth=3');await pg.keyboard.press('End');await pg.keyboard.press('Enter');await pg.keyboard.type('Child A');await pg.keyboard.press('Tab');await pg.keyboard.press('Enter');await pg.keyboard.type('Child B');await pg.keyboard.press('Enter');await pg.keyboard.type('Deep');await pg.keyboard.press('Tab')
        print('nest',await pg.evaluate('text.split("\\n").slice(2,7)'),await pg.evaluate('[...ed.querySelectorAll(".num")].map(s=>s.dataset.l||s.textContent.trim())'),await pg.evaluate('text===readText()'))
        await pg.keyboard.press('Enter');await pg.keyboard.press('Enter');await pg.keyboard.press('Enter');print('outdent',repr(await pg.evaluate('text.split("\\n")[7]')))
        await pg.keyboard.press('Escape');await pg.wait_for_timeout(200)
        print('tick',await pg.evaluate('(()=>{const d=ed.querySelector(".task.done");const a=getComputedStyle(d,"::after");return [a.opacity,a.maskImage.slice(0,20)||a.webkitMaskImage.slice(0,20)]})()'),'bullet',await pg.evaluate('(()=>{pick({t:"all"});return 1})()'))
        print('header',await pg.evaluate('[$("listTitle").textContent,$("listCount").textContent,!!document.querySelector(".margin #echoes"),document.querySelector(".side-foot").textContent.trim()]'))
        await pg.click('#navBtn');await pg.wait_for_timeout(100);print('nav hidden',await pg.evaluate('[document.body.classList.contains("nonav"),getComputedStyle(document.querySelector(".nav")).display,getComputedStyle($("navShow")).display]'));await pg.click('#navShow')
        await pg.click('#settingsBtn');await pg.wait_for_timeout(200);await pg.click('#setTabs button[data-t=ai]');await pg.wait_for_timeout(200);print('settings',await pg.evaluate('[...document.querySelectorAll(".spane section")].map(s=>s.dataset.p+":"+!s.hidden)'));await pg.screenshot(path='/home/claude/set.png');await pg.click('#setClose')
        await pg.screenshot(path='/home/claude/lists.png')
        # speed: a 4,000-line note
        await pg.evaluate('(()=>{const n=cur();n.body=Array.from({length:4000},(_,i)=>i%5?"Line "+i+" with **bold** and `code` and a [[link]] to see.":"").join("\\n");openNote(n.id)})()');await pg.wait_for_timeout(400)
        await pg.evaluate('paint(text.length>>1)');t=await pg.evaluate('(()=>{const t0=performance.now();for(let i=0;i<50;i++){const c=lastCaret;commit(text.slice(0,c)+"x"+text.slice(c),c+1)}return (performance.now()-t0)/50})()')
        t2=await pg.evaluate('(()=>{const t0=performance.now();for(let i=0;i<20;i++){const c=lastCaret;commit(text.slice(0,c)+"\\n"+text.slice(c),c+1)}return (performance.now()-t0)/20})()')
        t3=await pg.evaluate('(()=>{const t0=performance.now();for(let i=0;i<200;i++)mark();return (performance.now()-t0)/200})()')
        print('ms per key %.2f, per Enter %.2f, per cursor move %.3f'%(t,t2,t3),await pg.evaluate('text===readText()'))
        await pg.evaluate('openNote("Markdown I actually use.md")') if False else None
        await pg.evaluate('pick({t:"folder",name:"Home"})') if False else None
        await pg.evaluate('(()=>{const n=NOTES.find(n=>/Welcome/.test(n.id));n.body=LEGACY[0][1];openNote(n.id)})()');await pg.wait_for_timeout(500)
        await pg.click('.ln >> nth=2');await pg.click('#fab');await pg.wait_for_timeout(250);await pg.screenshot(path='/home/claude/app2.png')
        await pg.keyboard.press('Escape');await pg.evaluate('closeNote()');await pg.wait_for_timeout(500);await pg.screenshot(path='/home/claude/app3.png')
        print(errs);await b.close()
asyncio.run(main())
# Draft / Shape cases (modes, rules, ignore) live beside this file.
import os,runpy;runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)),'shape-ui-test.py'),run_name='__main__')
runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)),'onboard-ui-test.py'),run_name='__main__')
runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)),'colors-ui-test.py'),run_name='__main__')
runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)),'prompts-ui-test.py'),run_name='__main__')
