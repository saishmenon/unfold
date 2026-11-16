'''Markdown colours: defaults, contrast in every theme, presets and per-part choices. Run by ui-test.py, or alone.'''
import asyncio,re,os
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__))
MOCK=re.search(r"MOCK='''(.*?)'''",open(os.path.join(HERE,'ui-test.py')).read(),re.S).group(1).replace('\\\\','\\')
MOCK=MOCK.replace('__LEGACY__',open(os.path.join(HERE,'legacy-seed.json')).read())
fails=[]
def ok(name,cond,extra=''):
    print(('  ok  ' if cond else 'FAIL  ')+name+(' '+str(extra) if not cond else ''))
    if not cond:fails.append(name)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':1440,'height':900});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.add_init_script(MOCK);await pg.goto('file://'+os.path.join(HERE,'..','ui','index.html'));await pg.wait_for_timeout(900);ev=pg.evaluate
        await ev('commit("# One\\n## Two\\n### Three\\n\\nA [link](https://x.com) and [[Note]] with **bold**, *italic*, `code` and ==mark==.\\n\\n> quote\\n\\n- item\\n1. num",0)');await pg.wait_for_timeout(300)
        col=lambda sel:ev('getComputedStyle(document.querySelector(%r)).color'%sel)
        hexrgb=lambda h:'rgb(%d, %d, %d)'%tuple(int(h[i:i+2],16) for i in (1,3,5))
        clay=await ev('MC.shade("link","clay")')
        ok('links are orange by default',await col('.ed .lk')==hexrgb(clay) and await ev('MC.cur().link')=='clay',[await col('.ed .lk'),clay])
        ok('note links, code and list markers each have their own colour',len({await col('.ed .lk'),await col('.ed .wl'),await col('.ed code'),await col('.ed .ln.h1')})==4 and await col('.ed .bul')==hexrgb(clay))
        bad=await ev('''(()=>{const bad=[];for(const skin of["paper","sepia","dusk"]){set({skin});const t=MC.theme();
          for(const[p]of MC.PARTS)for(const h of Object.keys(MC.HUES)){if(p==="hl")continue;const c=MC.shade(p,h,t),r=MC.ratio(c,p==="code"?t.tint:t.bg),min=p==="quote"?3:4.5;if(r<min-0.01)bad.push([skin,p,h,c,r.toFixed(2)])}}set({skin:""});return bad})()''')
        ok('every colour clears its contrast in Paper, Sepia and Dusk',bad==[],bad[:6])
        low=await ev('''(()=>{const out=[];for(const skin of["paper","sepia","dusk"]){set({skin});const t=MC.theme();out.push(+MC.ratio(MC.shade("link","clay",t),t.bg).toFixed(2))}set({skin:""});return out})()''')
        print('   orange link contrast (paper, sepia, dusk):',low)
        await ev('settings(true,"look")');await pg.wait_for_timeout(300)
        ok('Appearance shows presets and a row per part',await ev('document.querySelectorAll("#mcBox .mc-pre button").length===3&&document.querySelectorAll("#mcBox .mc-row").length===MC.PARTS.length&&document.querySelector("#mcBox [data-pre=calm]").getAttribute("aria-pressed")')=='true')
        
        await pg.click('#mcBox button[data-p=h2][data-h=teal]');await pg.wait_for_timeout(150)
        ok('picking a swatch recolours that part',await col('.ed .ln.h2')==hexrgb(await ev('MC.shade("h2","teal")')) and await ev('S.mc.h2')=='teal' and await ev('JSON.parse(localStorage.getItem("unfold-reading")).mc.h2')=='teal')
        await pg.click('#mcBox button[data-pre=vivid]');await pg.wait_for_timeout(150)
        ok('Vivid preset applies',await ev('S.mc.h1')=='clay' and await col('.ed .ln.h1')==hexrgb(await ev('MC.shade("h1","clay")')))
        await ev('settings(false)');await pg.wait_for_timeout(250);
        await ev('set({skin:"dusk"})');await pg.wait_for_timeout(150)
        ok('colours re-fit when the theme changes',await col('.ed .lk')==hexrgb(await ev('MC.shade("link","clay")')) and await ev('MC.ratio(MC.shade("link","clay"),MC.theme().bg)')>=4.5)
        
        await ev('set({skin:"",mc:{...MC.PRESETS.plain}})');ok('Plain preset removes the colour',await col('.ed .lk')==await col('.ed .ln.h1'))
        await ev('set({mc:null})');await pg.keyboard.press('Meta+e');await pg.wait_for_timeout(250)
        ok('source view keeps its own colours',await col('.ed .lk')!=hexrgb(await ev('MC.shade("link","clay")')))
        # external-link arrow
        await pg.keyboard.press('Meta+e');await ev('set({skin:"",font:"inter"});commit("# Links\\n\\nRead the [CommonMark spec](https://commonmark.org) and [[Note]].\\n\\nlast",0)');await pg.wait_for_timeout(500)
        aft=lambda sel:ev('getComputedStyle(document.querySelector(%r),"::after").content'%sel)
        ok('external links get an arrow glyph',"\u2197" in await aft('.ed .ln:nth-child(3) .lk'),await aft('.ed .ln:nth-child(3) .lk'))
        await ev('commit("- Another, with a [link](https://commonmark.org)\\n\\nlast",text.length)');await pg.wait_for_timeout(300)
        gap=await ev('(()=>{const l=document.querySelector(".ed .ln.ul .lk"),r=document.createRange();r.selectNodeContents(l);const t=r.getBoundingClientRect(),w=parseFloat(getComputedStyle(l,"::after").width),box=l.getBoundingClientRect();return[getComputedStyle(l,"::after").textIndent,Math.round(box.right-t.right),Math.round(w)]})()')
        ok('in a list the arrow sits after the word, not over it',gap[0]=='0px' and gap[1]>=gap[2]-1,gap)
        await ev('FS.opened=null');await pg.click('.ed .ln.ul .lk');await pg.wait_for_timeout(150);ok('clicking a web link opens it in the browser',await ev('FS.opened')=='https://commonmark.org')
        await ev('commit("# Links\\n\\nRead the [CommonMark spec](https://commonmark.org) and [[Note]].\\n\\nlast",0)');await pg.wait_for_timeout(300)
        ok('note links do not',await aft('.ed .wl') in('none','normal',''),await aft('.ed .wl'))
        ok('the arrow comes from Inter, not an emoji font',await ev('[...document.fonts].some(f=>/Inter/.test(f.family)&&/2197/.test(f.unicodeRange)&&f.status==="loaded")'),await ev('[...document.fonts].map(f=>f.family+" "+f.unicodeRange+" "+f.status).join("; ")'))
        ok('the note text is untouched',await ev('text.includes("[CommonMark spec](https://commonmark.org)")&&!text.includes("\u2197")'))
        await ev('set({font:"inter"})');await pg.click('.ed .ln:nth-child(3)');await pg.wait_for_timeout(150)
        ok('no arrow while the line is being edited',await aft('.ed .ln:nth-child(3) .lk') in('none','normal',''))
        await pg.keyboard.press('Meta+e');await pg.wait_for_timeout(200);ok('no arrow in the source view',await aft('.ed .lk') in('none','normal',''));await pg.keyboard.press('Meta+e')
        ok('no page errors',not errs,errs);await b.close()
    print('\ncolors FAILED: '+', '.join(fails) if fails else '\ncolors: all passed')
asyncio.run(main())
