'use strict';
/* #98 (user 2026-09-16): optional desktop layout — a Settings option, OFF by
   default. The phone layout stays the default and there is no automatic
   breakpoint; the wide shell only applies when the user opts in, and it
   speaks the marketing site's design language (wide centered column,
   generous spacing, multi-column card grids). user 2026-09-16 follow-up:
   the stored choice is viewport-gated — it only takes effect at desktop
   widths (>=900px) and never alters the phone header/UI; the toggle row is
   hidden on mobile viewports; dark-mode accent/danger are pinned to the
   marketing greens so header options keep contrast. Structural pins on
   index.html markup plus source-text assertions on app-bootstrap.js and
   styles.css (the wiring lives inside the bootstrap IIFE, like #462). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const bootstrap=fs.readFileSync(path.join(ROOT,'assets/js/core/app-bootstrap.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'assets/styles.css'),'utf8');

/* The body.desktop block: everything from the #98 banner comment to the
   next top-level banner. Used for the theme-respect assertions. */
function desktopBlock(){
  const start=css.indexOf('===== #98: optional desktop layout');
  assert.ok(start>-1,'#98 desktop CSS block exists');
  const end=css.indexOf('/* =====',start+10);
  return css.slice(start,end===-1?undefined:end);
}

describe('#98 desktop layout opt-in',()=>{
  it('Settings has a Desktop layout switch, off by default, after Swipe to delete',()=>{
    const swipe=html.indexOf('id="swipeDeleteSetsToggle"');
    const toggle=html.indexOf('id="desktopLayoutToggle"');
    assert.ok(swipe>-1,'swipe toggle exists');
    assert.ok(toggle>-1,'desktopLayoutToggle exists');
    assert.ok(toggle>swipe,'desktop toggle renders after the swipe toggle');
    const tag=html.slice(html.lastIndexOf('<button',toggle),html.indexOf('>',toggle)+1);
    assert.ok(tag.includes('aria-pressed="false"'),'toggle defaults to off');
    assert.ok(tag.includes('role="switch"'),'toggle is a switch');
  });
  it('the switch carries a plain-language description',()=>{
    const rowStart=html.lastIndexOf('<div class="switch-row',html.indexOf('id="desktopLayoutToggle"'));
    const row=html.slice(rowStart,html.indexOf('</div>',html.indexOf('id="desktopLayoutToggle"'))+6);
    assert.ok(/Desktop layout/.test(row),'labels the option');
    assert.ok(/phone layout stays the default/i.test(row),'says the phone layout stays default');
  });
  it('pre-paint script applies body.desktop before first paint',()=>{
    const bodyOpen=html.indexOf('<body');
    const script=html.indexOf('workout-desktop-layout',bodyOpen);
    assert.ok(bodyOpen>-1&&script>-1,'pre-paint script exists after <body>');
    const firstDiv=html.indexOf('<div',bodyOpen);
    assert.ok(script<firstDiv,'script runs before any painted element');
    const block=html.slice(script-400,script+200);
    assert.ok(block.includes("classList.add('desktop')"),'adds the desktop class');
    assert.ok(block.includes('try'),'guarded against storage failures');
  });
});

describe('#98 desktop layout state plumbing',()=>{
  it('desktopLayout defaults to false',()=>{
    assert.match(bootstrap,/let desktopLayout=false;/,'off by default');
  });
  it('the choice travels with the appearance sync key',()=>{
    assert.ok(bootstrap.includes('desktopLayout:desktopLayout'),'getAppearanceState carries it');
    assert.ok(bootstrap.includes("typeof v.desktopLayout==='boolean'"),'setAppearanceState validates it');
  });
  it('applyDesktopLayout toggles the class (viewport-gated) and persists the flag',()=>{
    assert.ok(bootstrap.includes("document.body.classList.toggle('desktop',desktopLayout&&desktopViewport())"),'toggles body.desktop only when the stored choice is on AND the viewport is desktop-wide');
    assert.ok(bootstrap.includes("localStorage.setItem('workout-desktop-layout'"),'persists the flag');
  });
  it('a stored "on" never alters the phone UI: viewport gate + resize re-gate',()=>{
    assert.ok(bootstrap.includes('DESKTOP_MIN_WIDTH'),'breakpoint constant defined');
    assert.ok(bootstrap.includes("matchMedia('(min-width: '+DESKTOP_MIN_WIDTH+'px)')"),'gates on the 900px viewport');
    assert.ok(/addEventListener\('change',applyDesktopLayout\)|addListener\(applyDesktopLayout\)/.test(bootstrap),'re-applies when the viewport crosses the breakpoint');
  });
  it('pre-paint script gates body.desktop on the viewport too',()=>{
    const bodyOpen=html.indexOf('<body');
    const script=html.indexOf('workout-desktop-layout',bodyOpen);
    const block=html.slice(script-400,script+300);
    assert.ok(block.includes("matchMedia('(min-width: 900px)')"),'pre-paint checks the viewport before adding the class');
  });
  it('the Desktop layout row hides on mobile viewports',()=>{
    assert.ok(html.includes('desktop-layout-row'),'toggle row carries the hook class');
    assert.ok(/@media\s*\(max-width:\s*899px\)\s*\{\s*\.desktop-layout-row\s*\{\s*display:\s*none;/.test(css),'row hidden below 900px');
  });
  it('desktop mode pins accent/danger to the marketing greens (dark-mode contrast)',()=>{
    const block=desktopBlock();
    assert.ok(block.includes('--accent: #2e7d32'),'accent pinned to marketing green');
    assert.ok(block.includes('--danger: #d92d20'),'danger pinned to a light-bg red');
  });
  it('the toggle flips state and persists + syncs',()=>{
    const wire=bootstrap.indexOf("$('#desktopLayoutToggle').addEventListener('click'");
    assert.ok(wire>-1,'click wiring exists');
    const block=bootstrap.slice(wire,wire+400);
    assert.ok(block.includes('desktopLayout=!desktopLayout'),'flips the flag');
    assert.ok(block.includes('applyDesktopLayout()'),'re-applies');
    assert.ok(block.includes('schedulePersist()'),'persists + syncs');
  });
  it('boot restores the flag and renderSettings syncs the switch',()=>{
    assert.ok(bootstrap.includes("localStorage.getItem('workout-desktop-layout')==='1'"),'boot reads the flag');
    assert.ok(bootstrap.includes("$('#desktopLayoutToggle')"),'renderSettings syncs the switch');
  });
});

describe('#98 desktop CSS',()=>{
  it('widens .app and un-clamps the top bar',()=>{
    assert.ok(css.includes('body.desktop .app { max-width: 1120px; }'),'wide shell');
    assert.ok(css.includes('body.desktop .top-bar { top: 72px;'),'top bar spans the shell below the header');
  });
  it('keeps the laptop-testing 393px clamp for non-opted-in users',()=>{
    assert.ok(css.includes('.app { width: 100%; max-width: 393px;'), 'phone clamp intact');
  });
  it('hides the bottom nav — the tabs live in the header',()=>{
    const block=desktopBlock();
    assert.ok(block.includes('body.desktop .bottom-nav { display: none; }'),'bottom nav gone in desktop mode');
    assert.ok(!block.includes('repeat(5, minmax(0, 168px))'),'old tab-capping rule retired');
  });
  it('applies the marketing-site palette in desktop mode',()=>{
    const block=desktopBlock();
    assert.ok(/body\.desktop\s*\{\s*--bg:\s*#f8f9f3/.test(block),'paper background');
    assert.ok(block.includes('--surface: #ffffff'),'white cards');
    assert.ok(block.includes('--line: #dde2d2'),'marketing hairline');
    assert.ok(block.includes('--nav-bg: rgba(248,249,243,.94)'),'marketing nav blur');
  });
  it('styles the desktop header like the marketing site nav',()=>{
    const block=desktopBlock();
    assert.ok(block.includes('.desktop-header { display: none; }'),'hidden unless desktop mode');
    assert.ok(block.includes('body.desktop .desktop-header {'),'header shown in desktop mode');
    assert.ok(block.includes('height: 72px'),'marketing header height');
    assert.ok(block.includes('blur(14px)'),'marketing blur');
    assert.ok(block.includes('body.desktop .desktop-tab.active { background: var(--accent-soft);'),'active tab pill');
    assert.ok(block.includes('body.desktop #topBarSettings { display: none; }'),'top-bar gear redundant');
  });
  it('gives dashboard cards the marketing shadow',()=>{
    const block=desktopBlock();
    assert.ok(block.includes('box-shadow: 0 6px 18px rgba(28,28,30,.05)'),'marketing card shadow');
  });
});

describe('#98 desktop header markup',()=>{
  it('renders the header before the top bar',()=>{
    const header=html.indexOf('id="desktopHeader"');
    const topbar=html.indexOf('<header class="top-bar">');
    assert.ok(header>-1,'desktop header exists');
    assert.ok(topbar>-1,'top bar exists');
    assert.ok(header<topbar,'header renders before the top bar');
  });
  it('carries the brand mark and wordmark',()=>{
    const start=html.indexOf('id="desktopHeader"');
    const end=html.indexOf('</header>',start);
    const head=html.slice(start,end);
    assert.ok(head.includes('id="desktopBrand"'),'brand link exists');
    assert.ok(head.includes('<span>Kohlrabi</span>'),'wordmark present');
    assert.ok(head.includes('viewBox="0 0 192 192"'),'arrow mark svg');
    assert.ok(head.includes('aria-label="Kohlrabi home"'),'brand labelled');
  });
  it('has the five tabs with data-view keys',()=>{
    const start=html.indexOf('id="desktopHeader"');
    const end=html.indexOf('</header>',start);
    const head=html.slice(start,end);
    for (const view of ['dashboard','library','workout','program','stats']) {
      assert.ok(head.includes(`data-view="${view}"`),`tab for ${view}`);
    }
    assert.ok(head.includes('class="desktop-tab active"'),'Home tab starts active');
    assert.ok(head.includes('aria-label="Primary navigation"'),'tabs nav labelled');
  });
  it('has a settings gear',()=>{
    const start=html.indexOf('id="desktopHeader"');
    const end=html.indexOf('</header>',start);
    const head=html.slice(start,end);
    assert.ok(head.includes('id="desktopSettings"'),'header gear exists');
    assert.ok(head.includes('aria-label="Settings"'),'gear labelled');
  });
});

describe('#98 desktop header JS',()=>{
  const utilities=fs.readFileSync(path.join(ROOT,'assets/js/lib/utilities.js'),'utf8');
  it('setActiveNav lights the desktop tabs too',()=>{
    assert.ok(utilities.includes("document.querySelectorAll('#desktopHeader .desktop-tab')"),'mirrors tab state');
    assert.ok(utilities.includes('tab.dataset.view === highlight'),'matches the highlight key');
  });
  it('updateTopBar never shows a gear active state (C3 PP2)',()=>{
    assert.ok(utilities.includes("$('#desktopSettings')"),'desktop gear referenced');
    const idx=utilities.indexOf("$('#desktopSettings')");
    assert.ok(!utilities.slice(idx,idx+200).includes("view === 'settings'"),'no settings-active toggle');
    assert.ok(utilities.slice(idx,idx+200).includes("classList.remove('active')"),'active explicitly cleared');
  });
  it('header tabs proxy the bottom-nav buttons',()=>{
    assert.ok(bootstrap.includes('desktopNavTarget'),'view→button map exists');
    assert.ok(bootstrap.includes("$('#desktopBrand')"),'brand wired');
    assert.ok(bootstrap.includes("$('#desktopSettings')?.addEventListener('click'"),'gear wired');
    const wire=bootstrap.indexOf('desktopNavTarget[tab.dataset.view]');
    assert.ok(wire>-1,'tab clicks proxy bottom-nav buttons');
  });
});
