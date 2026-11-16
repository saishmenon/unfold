'''Draft / Shape UI cases: modes, rules, Fix, Strengthen, Ignore. Run by ui-test.py, or alone.'''
import asyncio,re,sys,os
HERE=os.path.dirname(os.path.abspath(__file__))
from playwright.async_api import async_playwright
src=open(os.path.join(HERE,'ui-test.py')).read()
MOCK=re.search(r"MOCK='''(.*?)'''",src,re.S).group(1).replace('\\\\','\\')
MOCK=MOCK.replace('__LEGACY__',open(os.path.join(HERE,'legacy-seed.json')).read())
MOCK=MOCK.replace("for(const t of['- Point one\\n','- Point two'])","for(const t of(/two different versions/.test(a.prompt)?(window.LASTP=a.prompt,['1. We think onboarding should be simpler.\\n','2. Onboarding should be simpler.']):/^Refine the text below/.test(a.prompt)?(window.LASTR=a.prompt,['We think onboarding ','should be simpler.']):['- Point one\\n','- Point two']))")
NOTE='''# Shape test

We are kind of thinking that maybe the onboarding could be made simpler.

This is very good. Run `maybe --very` now and see [[Very maybe note]].

```
maybe this is very bad
```

There are three reasons. The design works because the design is simple.
'''
fails=[]
def ok(name,cond,extra=''):
    print(('  ok  ' if cond else 'FAIL  ')+name+(' '+str(extra) if not cond else ''));
    if not cond:fails.append(name)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':1440,'height':900})
        errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(m.text))
        await pg.add_init_script(MOCK)
        await pg.add_init_script("window.FS.files['Shape.md']={b:%r,m:1700000000001};window.FS.files['Other.md']={b:'# Other',m:1700000000000};window.FS.files['Echo src.md']={b:'# Echo src\\n\\nCustomers abandon the signup form halfway through onboarding because pricing confuses them.',m:1700000000000};window.FS.files['Old one.md']={b:'# Old one\\n\\nAn opening paragraph that sits before the match in this older note.\\n\\nPricing confuses customers, so they abandon the signup form halfway through onboarding every week.\\n\\nA closing paragraph that sits after the match in this older note.',m:1600000000000};for(let i=0;i<40;i++)window.FS.files['F'+i+'.md']={b:'Filler paragraph number '+i+' talks about zebra'+i+' and quartz'+i+' in one long sentence.',m:1500000000000+i};window.FS.state={seeded:true,guide:3}"%NOTE)
        await pg.goto('file:///home/claude/app/ui/index.html');await pg.wait_for_timeout(900)
        await pg.evaluate('openNote("Shape.md")');await pg.wait_for_timeout(500)
        n=lambda:pg.evaluate('document.querySelectorAll(".sm").length')
        L=lambda:pg.evaluate('Shape.list.map(m=>m.rule+":"+m.text)')
        ok('draft shows nothing',await n()==0 and not await pg.evaluate('Shape.on'))
        await pg.keyboard.press('Meta+;');await pg.wait_for_timeout(500)
        l=await L();ok('cmd+; turns Shape on',await pg.evaluate('Shape.on') and await n()>0,l)
        for w in ['hedge:kind of','hedge:maybe','passive:be made','filler:very','opener:There are','repeat:design']:ok('flags '+w,w in l,l)
        ok('no flags in code / links',len([x for x in l if x in('filler:very','hedge:maybe')])==2,l)
        # hover → popover → Fix
        box=await pg.evaluate('(()=>{const m=Shape.list.find(m=>m.text==="kind of"),b=m.box[0],r=document.querySelector(".stage").getBoundingClientRect();return[r.left+(b.l+b.r)/2,r.top+b.b-6]})()')
        await pg.mouse.move(box[0]-30,box[1]-80);await pg.mouse.move(box[0],box[1]);await pg.wait_for_timeout(500)
        ok('hover opens popover',await pg.evaluate('!document.querySelector(".shape-pop").hidden&&/Hedge/.test(document.querySelector(".shape-pop").textContent)'))
        ok('no Strengthen without a model',await pg.evaluate('!document.querySelector(".shape-pop [data-a=str]")'))
        await pg.click('.shape-pop [data-a=fix]');await pg.wait_for_timeout(300)
        ok('Fix removes the phrase',await pg.evaluate('text.includes("We are thinking that maybe")'))
        ok('file text has no marks',await pg.evaluate('!/<|sm/.test(text.split("\\n")[2])'))
        await pg.keyboard.press('Meta+z');await pg.wait_for_timeout(300)
        ok('cmd+Z undoes Fix',await pg.evaluate('text.includes("kind of thinking")'))
        # keyboard: next suggestion + Return = Fix
        await pg.evaluate('setSel(0)');await pg.keyboard.press('Alt+ArrowDown');await pg.wait_for_timeout(250)
        ok('opt+down opens first',await pg.evaluate('!document.querySelector(".shape-pop").hidden'))
        await pg.keyboard.press('Enter');await pg.wait_for_timeout(300)
        ok('Return fixes',await pg.evaluate('text.includes("We are thinking that maybe")'))
        await pg.keyboard.press('Meta+z');await pg.wait_for_timeout(300)
        # ignore persists
        await pg.evaluate('setSel(0)');await pg.keyboard.press('Alt+ArrowDown');await pg.wait_for_timeout(250)
        c0=len(await L());await pg.click('.shape-pop [data-a=ign]');await pg.wait_for_timeout(300)
        ok('Ignore removes one',len(await L())==c0-1)
        ok('Ignore saved in state.json',await pg.evaluate('(FS.state.dismissed||{})["Shape.md"].length===1'),await pg.evaluate('JSON.stringify(FS.state)'))
        # strengthen with a model
        await pg.evaluate('AI.provider="ollama";AI.model="qwen3.6:latest"')
        await pg.evaluate('setSel(0)');await pg.keyboard.press('Alt+ArrowDown');await pg.wait_for_timeout(250)
        await pg.click('.shape-pop [data-a=str]');await pg.wait_for_timeout(500)
        ok('Strengthen gives 2 options + Keep mine',await pg.evaluate('document.querySelectorAll(".shape-pop .sp-opt").length===2&&/Keep mine/.test(document.querySelector(".shape-pop").textContent)'))
        await pg.click('.shape-pop .sp-opt >> nth=0');await pg.wait_for_timeout(300)
        ok('option replaces the sentence',await pg.evaluate('text.includes("\\nWe think onboarding should be simpler.\\n")'),await pg.evaluate('text.slice(0,120)'))
        await pg.keyboard.press('Meta+z');await pg.wait_for_timeout(300)
        ok('cmd+Z undoes Strengthen',await pg.evaluate('text.includes("kind of thinking")'))
        # typing
        await pg.evaluate('setSel(text.length)');await pg.keyboard.type('\nThis is really');await pg.wait_for_timeout(120)
        ok('word being typed is not marked',not 'filler:really' in await L())
        await pg.keyboard.type(' fine.');await pg.wait_for_timeout(700)
        ok('marked after a pause',('filler:really' in await L()))
        # source view, back to draft
        await pg.keyboard.press('Meta+e');await pg.wait_for_timeout(300);ok('no marks in source view',await n()==0)
        await pg.keyboard.press('Meta+e');await pg.wait_for_timeout(300);ok('marks return in page view',await n()>0)
        await pg.keyboard.press('Meta+;');await pg.wait_for_timeout(300);ok('cmd+; back to Draft clears marks',await n()==0)
        ok('Shape is not a side-panel tab',await pg.evaluate('document.querySelectorAll("#sideTabs button").length===2&&!document.querySelector("[data-tab=shape]")'))
        ok('Strengthen sends the note as context',await pg.evaluate('LASTP.includes("There are three reasons")'))
        # right-click menu in the note
        await pg.click('.ln >> nth=2',button='right');await pg.wait_for_timeout(200)
        labs=await pg.evaluate('[...document.querySelectorAll(".ctx button")].map(b=>b.textContent)');heads=await pg.evaluate('[...document.querySelectorAll(".ctx .ch")].map(b=>b.textContent)')
        ok('right-click has a Shape section',heads==['Shape'] and any(x.startswith('Show writing hints') for x in labs) and 'Refine this paragraph ✨' in labs and 'Refine the whole note ✨' in labs and 'Paste' in labs,labs)
        
        await pg.click('.ctx button:has-text("Show writing hints")');await pg.wait_for_timeout(400);ok('menu turns hints on',await pg.evaluate('Shape.on') and await n()>0)
        await pg.click('.ln >> nth=2',button='right');await pg.wait_for_timeout(200);await pg.click('.ctx button:has-text("Refine this paragraph")');await pg.wait_for_timeout(500)
        ok('refine sends the paragraph with the note as context',await pg.evaluate('LASTR.includes("Text to refine:\\nWe are kind of")&&LASTR.includes("There are three reasons")'),await pg.evaluate('LASTR.slice(-200)'))
        await pg.click('#aiReplace');await pg.wait_for_timeout(300);ok('Replace swaps the paragraph',await pg.evaluate('text.includes("\\nWe think onboarding should be simpler.\\n")'),await pg.evaluate('text.slice(0,90)'))
        await pg.keyboard.press('Escape');await pg.click('.ln >> nth=2');await pg.keyboard.press('Meta+z');await pg.wait_for_timeout(300);ok('cmd+Z undoes the refine',await pg.evaluate('text.includes("kind of thinking")'))
        await pg.click('.ln >> nth=2',button='right');await pg.wait_for_timeout(200);await pg.click('.ctx button:has-text("Refine the whole note")');await pg.wait_for_timeout(500)
        ok('whole-note refine sends everything once',await pg.evaluate('LASTR.includes("# Shape test")&&!LASTR.includes("Text to refine")'));await pg.keyboard.press('Escape')
        # per-note mode, reload keeps ignores
        other=await pg.evaluate('NOTES.find(n=>n.id!=="Shape.md").id');await pg.evaluate('openNote(%r)'%other);await pg.wait_for_timeout(500)
        ok('other note opens in Draft',not await pg.evaluate('Shape.on') and await n()==0)
        await pg.evaluate('openNote("Shape.md")');await pg.wait_for_timeout(500);ok('note remembers Shape this session',await pg.evaluate('Shape.on') and await n()>0)
        ok('ignored stays ignored',not any(x=='hedge:kind of' for x in await L()),await L())
        # big note stays quick
        await pg.evaluate('commit(Array(200).fill("We are kind of thinking that maybe the onboarding could be made simpler and very nice.").join("\\n\\n"),0)');await pg.wait_for_timeout(900)
        t=await pg.evaluate('(()=>{const t0=performance.now();for(let i=0;i<20;i++){commit(text.slice(0,30)+"x"+text.slice(30),31)}return (performance.now()-t0)/20})()')
        await pg.wait_for_timeout(700)
        t2=await pg.evaluate('(async()=>{const t0=performance.now();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.now()-t0})()')
        ok('2,000-word note: keystroke under 16ms',t<16,t);print('   keystroke %.1fms, frame %.1fms, marks %d'%(t,t2,await n()))
        t3=await pg.evaluate('(()=>{const t0=performance.now();for(let i=0;i<20;i++){document.dispatchEvent(new Event("selectionchange"));document.querySelector("#scroll").getBoundingClientRect()}return new Promise(r=>requestAnimationFrame(()=>{const a=performance.now();Shape.painted();r(performance.now()-a)}))})()')
        ok('big note draws only what is on screen',await n()<200,await n())
        # style bar list menu, tabs on the right, boxed header buttons
        await pg.evaluate('showTab("echo");set({bar:true});commit("Plain line",3)');await pg.wait_for_timeout(300)
        ok('one list button in the style bar',await pg.evaluate('document.querySelectorAll("#sbar>button[data-a=ul],#sbar>button[data-a=ol],#sbar>button[data-a=task]").length===0&&$("listMenu").hidden'))
        await pg.click('#listBtn');await pg.wait_for_timeout(250);await pg.click('#listMenu button[data-a=ol]');await pg.wait_for_timeout(250)
        ok('list menu makes a numbered list and closes',await pg.evaluate('text==="1. Plain line"&&$("listMenu").hidden'),await pg.evaluate('text'))
        await pg.click('#listBtn');await pg.wait_for_timeout(200);ok('current list kind is ticked',await pg.evaluate('$("listMenu").querySelector("[aria-checked=true]").dataset.a==="ol"'));await pg.keyboard.press('Escape')
        ok('side tabs sit at the right of the panel',await pg.evaluate('(()=>{const p=$("rpanel").getBoundingClientRect(),t=$("sideTabs").getBoundingClientRect();return p.right-t.right<16&&t.left-p.left>30})()'))
        ok('list and folder header buttons are boxed',await pg.evaluate('["searchBtn","newBtn","navBtn","newFolderBtn","sectionBtn"].every(id=>{const c=$(id).closest(".ctl");return c&&c.offsetHeight===32&&getComputedStyle(c).borderRadius==="9px"})'))
        ok('folder header fits',await pg.evaluate('document.querySelector(".nav .side-top").scrollWidth<=document.querySelector(".nav .side-top").clientWidth'))
        # echoes: peek, open, back and forward
        await pg.evaluate('showTab("echo");openNote("Echo src.md")');await pg.wait_for_timeout(600);await pg.click('.ln >> nth=2');await pg.keyboard.press('End');await pg.wait_for_timeout(900)
        ok('an echo shows',await pg.evaluate('document.querySelectorAll(".echo").length')>=1)
        car=await pg.evaluate('lastCaret');await pg.click('.echo >> nth=0');await pg.wait_for_timeout(350)
        ok('click peeks and the note stays',await pg.evaluate('curId==="Echo src.md"&&document.querySelector(".echo.open")&&document.querySelector(".echo.open .peek").offsetHeight>40&&document.querySelectorAll(".echo.open .dim").length===2&&document.activeElement===ed'))
        
        await pg.click('.echo.open .go');await pg.wait_for_timeout(700);ok('Open note goes to the echo',await pg.evaluate('curId')=='Old one.md')
        ok('back is on after the jump',await pg.evaluate('!$("backBtn").disabled&&$("fwdBtn").disabled'))
        await pg.keyboard.press('Meta+[');await pg.wait_for_timeout(700)
        ok('cmd+[ returns to the note and the cursor',await pg.evaluate('curId')=='Echo src.md' and await pg.evaluate('document.activeElement===ed&&readSel()[0]')==car,await pg.evaluate('[curId,lastCaret]'))
        await pg.keyboard.press('Meta+]');await pg.wait_for_timeout(700);ok('cmd+] goes forward',await pg.evaluate('curId')=='Old one.md')
        await pg.click('#backBtn');await pg.wait_for_timeout(700);ok('Back button works',await pg.evaluate('curId')=='Echo src.md')
        await pg.click('.ln >> nth=2');await pg.wait_for_timeout(900);await pg.click('.echo >> nth=0',modifiers=['Meta']);await pg.wait_for_timeout(700);ok('cmd-click opens the echo straight away',await pg.evaluate('curId')=='Old one.md')
        errs=[e for e in errs if 'ERR_FILE_NOT_FOUND' not in e]
        ok('no page errors',not errs,errs)
        await b.close()
    print('\nshape FAILED: '+', '.join(fails) if fails else '\nshape: all passed')
asyncio.run(main())
