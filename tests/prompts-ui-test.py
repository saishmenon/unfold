'''Writing prompts: a question appears on a pause, Tab keeps it, Esc and typing put it away. Run by ui-test.py, or alone.'''
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
        shown=lambda:ev('Prompts.shown');vis=lambda:ev('document.querySelector(".ghost").classList.contains("on")')
        ok('on by default',await ev('S.prompts')==True)
        await ev('newNote()');await pg.wait_for_timeout(300);await pg.click('#ed');await pg.wait_for_timeout(700)
        q=await shown();ok('an empty note offers an opening question straight away',bool(q) and q in await ev('Prompts.OPEN') and await vis(),q)
        ok('it takes the place of “Start writing…”',await ev('ed.classList.contains("ghosted")&&getComputedStyle(ed,"::before").opacity==="0"'))
        await pg.keyboard.press('Tab');await pg.wait_for_timeout(200)
        ok('Tab keeps it as a quote line, cursor ready below',await ev('text')=='> '+q+'\n\n' and await ev('document.activeElement===ed&&readSel()[0]===text.length') and not await vis(),await ev('JSON.stringify(text)'))
        await pg.keyboard.type('We moved to Vancouver last winter and the first month was harder than I expected.');await pg.wait_for_timeout(400)
        ok('the note is named after your first line, not the kept prompt',await ev('titleOf(cur())')=='We moved to Vancouver last winter and the first month was harder than I expected.',await ev('titleOf(cur())'))
        ok('nothing shows while you are typing',not await vis())
        await pg.wait_for_timeout(1500);q2=await shown();ok('after a pause, a follow-up question appears below',bool(q2) and q2 in await ev('Prompts.NEXT') and await vis(),q2)
        ok('it sits under the text, not over it',await ev('(()=>{const g=document.querySelector(".ghost").getBoundingClientRect(),l=ed.lastChild.getBoundingClientRect();return g.top>=l.bottom-1&&Math.abs(g.left-ed.getBoundingClientRect().left)<2})()'))
        await pg.keyboard.type(' A');await pg.wait_for_timeout(250);ok('typing puts it away, and the note is untouched',not await vis() and await ev('text.endsWith("expected. A")'))
        await pg.wait_for_timeout(1800);ok('it does not come straight back after a few letters',not await vis())
        await pg.keyboard.type(' few more words here so that there is enough new writing to ask again.');await pg.wait_for_timeout(1900);ok('it returns after more writing',await vis())
        await pg.keyboard.press('Escape');await pg.wait_for_timeout(200);ok('Esc puts it away and keeps the cursor in the note',not await vis() and await ev('document.activeElement===ed'))
        await pg.keyboard.type(' And then another sentence that is long enough to count as new writing.');await pg.wait_for_timeout(1900);ok('after Esc it stays quiet for a while',not await vis())
        [await pg.keyboard.press('Meta+z') for _ in range(6)];ok('undo removes a kept prompt like any other edit',await ev('!text.includes(">")'),await ev('JSON.stringify(text)'))
        # with writing help on, the question is about what you wrote
        await ev('AI.provider="ollama";AI.model="qwen3.6:latest";FS.quick=0');await ev('newNote()');await pg.wait_for_timeout(300);await pg.click('#ed')
        await pg.keyboard.type('# Moving\n\nWe moved to Vancouver last winter and the first month was harder than I expected.');await pg.wait_for_timeout(1900)
        ok('the local model writes the question',await shown()=='What made that first month so hard?',await shown())
        ok('it is sent the title and what you wrote, and the model was woken first',await ev('FS.lastQuick.includes("Note title: Moving")&&FS.lastQuick.includes("harder than I expected")&&FS.quick>=2'),await ev('[FS.quick,FS.lastQuick]'))
        await ev('FS.quickReply="Sure! Here are some ideas:\\n1. Write more"');await pg.keyboard.type(' It rained for three weeks and we knew nobody on our street yet.');await pg.wait_for_timeout(1900)
        ok('an answer that is not one short question falls back to a built-in one',await shown() in await ev('Prompts.NEXT'),await shown())
        await ev('AI.provider="off"')
        # where it stays out of the way
        await pg.keyboard.type('\n\n- a list item that is long enough to have been worth asking a question about');await pg.wait_for_timeout(1900)
        ok('no prompt in a list, and Tab still indents',not await vis());await pg.keyboard.press('Tab');ok('Tab indents the list item',await ev('text.split("\\n").pop().startsWith("    - ")'))
        await ev('commit("Some text that is long enough to be a paragraph worth asking a question about, at the start.\\n\\nSecond paragraph.",40)');await pg.wait_for_timeout(1900);ok('no prompt in the middle of a note',not await vis())
        await ev('commit("Some text that is long enough to be a paragraph worth asking a question about, right here.",text.length);Shape.toggle(true)');await pg.keyboard.type(' More words, enough of them to count as new writing for the test.');await pg.wait_for_timeout(1900);ok('no prompt while writing hints are showing',not await vis());await ev('Shape.toggle(false)')
        # the setting
        await ev('settings(true,"general")');await pg.wait_for_timeout(200);ok('Settings has the switch, on',await ev('$("setPrompts").checked'));await pg.click('label[for=setPrompts]');ok('switching it off is saved',await ev('S.prompts===false&&JSON.parse(localStorage.getItem("unfold-reading")).prompts===false'))
        await ev('settings(false);newNote()');await pg.wait_for_timeout(300);await pg.click('#ed');await pg.wait_for_timeout(900);ok('off means no prompts at all',not await vis() and not await shown())
        ok('no page errors',not errs,errs);await b.close()
    print('\nprompts FAILED: '+', '.join(fails) if fails else '\nprompts: all passed')
asyncio.run(main())
