'use strict';
/* Scroll-jank cluster: #488 / #491 / #496.
   Shared root cause: a tap handler synchronously destroys the tapped
   (focused) element via an innerHTML re-render, and iOS Safari drops focus
   to <body> and fires an unpredictable scroll (the same family as the
   dashboard period tabs / #404 guards).

   - #496 (set-tags.js): tapping a tag pill used to call renderTagDialog(),
     rebuilding the picker and destroying the focused pill. The toggle now
     flips aria-pressed in place; the delete-x path blurs before the rebuild;
     the dialog-close catch-up render blurs and pins the scroll position.
     These tests drive the REAL handlers against a fake DOM and assert a
     toggle tap never rebuilds the dialog.
   - #491 (styles.css): the exercise-card hover lift (translateY(-2px)) was
     unguarded, so iOS sticky-:hover kept the card shifted after a tap. It
     must live inside @media (hover: hover) like every other hover rule.
   - #491 (dashboard-stats.js): calendar day chips / week chevrons re-render
     the whole dashboard, destroying the tapped control - now routed through
     rerenderDashboardKeepingPlace (scroll pin + preventScroll refocus).
   - #488 (settings): investigated - every settings tap handler was audited
     and none destroys the tapped control (attribute/hidden flips only; the
     one programmatic scroll is the intentional backup-nudge scrollIntoView).
     No defect found in editable code; the wiring lives in app-bootstrap.js,
     which another worker owns this batch. No test pinned here on purpose. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole,REPO_ROOT}=require('./harness');

/* ---------- fake DOM: just enough for the tag-dialog tap paths ---------- */
const dashToCamel=s=>s.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
function makeFakeDom(){
  const byId={};
  const rafQueue=[];
  const scrollToCalls=[];
  const document={
    _byId:byId,
    activeElement:null,
    querySelector(sel){
      if(sel[0]==='#')return byId[sel.slice(1)]||null;
      return null;
    },
    querySelectorAll(sel){
      const m=/^#([\w-]+)\s+(.+)$/.exec(sel);
      if(!m)return[];
      const host=byId[m[1]];
      if(!host)return[];
      const sub=m[2].trim();
      return host.children.filter(el=>{
        if(sub[0]==='.'){
          const cls=(el._attrs.class||'').split(/\s+/);
          return cls.includes(sub.slice(1));
        }
        const dm=/^\[data-([\w-]+)\]$/.exec(sub);
        if(dm)return el.dataset[dashToCamel(dm[1])]!==undefined;
        return false;
      });
    },
    createElement(){
      /* escapeHtml builds a div, sets textContent, reads innerHTML. */
      let text='';
      return {
        set textContent(v){text=String(v);},
        get textContent(){return text;},
        get innerHTML(){return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');},
        set innerHTML(v){text=String(v);},
      };
    },
    addEventListener(){}, removeEventListener(){},
  };
  function makeButton(attrStr,label,host){
    const btn={
      tagName:'BUTTON', parent:host, children:[],
      _attrs:{}, dataset:{}, _listeners:{}, blurred:false,
      setAttribute(k,v){this._attrs[String(k)]=String(v);},
      getAttribute(k){return Object.prototype.hasOwnProperty.call(this._attrs,k)?this._attrs[k]:null;},
      addEventListener(t,fn){(this._listeners[t]=this._listeners[t]||[]).push(fn);},
      removeEventListener(){},
      click(){(this._listeners.click||[]).forEach(fn=>fn.call(this));},
      blur(){this.blurred=true;if(document.activeElement===this)document.activeElement=null;},
      focus(){document.activeElement=this;},
      /* Every button parsed here lives inside a tag dialog. */
      closest(){return {__dialogScope:true};},
    };
    const attrRe=/([\w-]+)="([^"]*)"/g;
    let a;
    while((a=attrRe.exec(attrStr))){
      const k=a[1],v=a[2];
      if(k.startsWith('data-'))btn.dataset[dashToCamel(k.slice(5))]=v;
      else btn.setAttribute(k,v);
    }
    btn.textContent=String(label).replace(/<[^>]*>/g,'');
    return btn;
  }
  function makeHost(id){
    const host={
      tagName:'DIV', children:[], _attrs:{id}, dataset:{}, value:'',
      _htmlSetCount:0, _rawHtml:'', open:false, _listeners:{},
      set innerHTML(v){
        this._htmlSetCount++;
        this._rawHtml=String(v);
        this.children=[];
        const re=/<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
        let m;
        while((m=re.exec(this._rawHtml)))this.children.push(makeButton(m[1],m[2],this));
      },
      get innerHTML(){return this._rawHtml;},
      set textContent(v){this._text=String(v);},
      get textContent(){return this._text||'';},
      setAttribute(){}, getAttribute:()=>null,
      addEventListener(t,fn){(this._listeners[t]=this._listeners[t]||[]).push(fn);},
      removeEventListener(){},
      showModal(){this.open=true;},
      close(){this.open=false;(this._listeners.close||[]).forEach(fn=>fn.call(this));},
      blur(){if(document.activeElement===this)document.activeElement=null;},
      focus(){document.activeElement=this;},
      closest(){return null;},
      querySelector:()=>null, querySelectorAll:()=>[],
    };
    byId[id]=host;
    return host;
  }
  ['newTagInput','tagPickerOptions','editableTagList','setTagsDialog',
   'newExerciseTagInput','exerciseTagPickerOptions','exerciseTagsDialog'
  ].forEach(makeHost);
  const win={
    scrollY:0, scrollToCalls,
    scrollTo(x,y){scrollToCalls.push([x,y]);},
  };
  return {
    document, window:win, rafQueue, scrollToCalls, byId,
    requestAnimationFrame(cb){rafQueue.push(cb);return rafQueue.length;},
    flushRaf(){const q=rafQueue.splice(0);q.forEach(cb=>cb());},
    reset(){
      Object.values(byId).forEach(h=>{h.children=[];h._htmlSetCount=0;h._rawHtml='';h.value='';h.open=false;});
      document.activeElement=null;
      rafQueue.length=0; scrollToCalls.length=0; win.scrollY=0;
    },
  };
}

const dom=makeFakeDom();
/* One loadRole per file: re-evaluating would redeclare the module globals.
   The fake browser globals ride in via opts.globals (assigned after the
   harness stubs, before any test runs). */
const api=loadRole('tag-dialog-jank',{globals:{
  document:dom.document,
  window:dom.window,
  requestAnimationFrame:dom.requestAnimationFrame,
}});

function seedLiveDraft(){
  const ws=api.workoutState;
  ws.tags=['Warmup','Dropset'];
  ws.tagTarget=null;
  ws.draft={exercises:[{uid:'e1',sets:[{uid:'s1',tags:[],complete:false}]}]};
  return ws.draft.exercises[0].sets[0];
}
beforeEach(()=>{dom.reset();seedLiveDraft();});

describe('#496: set-tag dialog taps never rebuild the dialog',()=>{
  it('toggling a pill flips aria-pressed in place and never rebuilds the picker',()=>{
    api.openTagDialog('e1','s1');
    const picker=dom.byId.tagPickerOptions;
    const pills=dom.document.querySelectorAll('#tagPickerOptions .form-pill');
    assert.equal(pills.length,2,'both tag pills render');
    assert.equal(picker._htmlSetCount,1,'one build for the dialog open');
    /* A tap focuses the pill - the exact condition that used to trigger the
       iOS focus-drop scroll when the re-render destroyed it. */
    dom.document.activeElement=pills[0];
    pills[0].click();
    const set=api.workoutState.draft.exercises[0].sets[0];
    assert.deepEqual(set.tags,['Warmup'],'tag added to the set');
    assert.equal(pills[0].getAttribute('aria-pressed'),'true','pill reflects selection in place');
    assert.equal(picker._htmlSetCount,1,'toggle did NOT rebuild the picker');
    /* Toggle off: same path, still no rebuild. */
    pills[0].click();
    assert.deepEqual(set.tags,[],'tag removed from the set');
    assert.equal(pills[0].getAttribute('aria-pressed'),'false','pill reflects deselection in place');
    assert.equal(picker._htmlSetCount,1,'second toggle did NOT rebuild the picker');
  });

  it('deleting a tag blurs the tapped x before the list rebuild',()=>{
    api.openTagDialog('e1','s1');
    const delBtns=dom.document.querySelectorAll('#editableTagList [data-delete-tag]');
    assert.equal(delBtns.length,2,'both delete buttons render');
    dom.document.activeElement=delBtns[0];
    delBtns[0].click();
    assert.ok(delBtns[0].blurred,'tapped x blurred before its destruction');
    assert.deepEqual(api.workoutState.tags,['Dropset'],'tag removed from the global list');
  });

  it('addTag keeps input focus for rapid entry (no blur on the add path)',()=>{
    api.openTagDialog('e1','s1');
    const input=dom.byId.newTagInput;
    input.value='MyTag';
    dom.document.activeElement=input;
    api.addTag();
    const set=api.workoutState.draft.exercises[0].sets[0];
    assert.ok(set.tags.includes('MyTag'),'new tag applied to the set');
    assert.equal(input.value,'','input cleared');
    assert.equal(dom.document.activeElement,input,'input keeps focus (keyboard stays up)');
    assert.ok(api.workoutState.tags.includes('MyTag'),'new tag added to the global list');
  });

  it('dialog-close catch-up render blurs focus and pins the scroll position',()=>{
    const standIn=dom.byId.setTagsDialog;
    dom.document.activeElement=standIn;
    dom.window.scrollY=512;
    let rendered=false;
    api.renderAfterTagDialog(()=>{rendered=true;});
    assert.ok(rendered,'the catch-up render ran');
    assert.equal(dom.document.activeElement,null,'focused control blurred before the rebuild');
    assert.deepEqual(dom.scrollToCalls,[],'no synchronous scroll jump');
    dom.flushRaf();
    assert.deepEqual(dom.scrollToCalls,[[0,512]],'scroll position restored after the render');
  });
});

describe('#491: cards never shift on tap (CSS hover guard)',()=>{
  /* Strip every @media (hover: hover){...} block (brace-matched); the
     exercise-card lift must not survive the strip. translateY(-2px) is
     unique to that rule (other translateY uses are -50% / keyframes). */
  function stripHoverHoverBlocks(css){
    let out='',i=0;
    const re=/@media\s*\(\s*hover\s*:\s*hover\s*\)/g;
    let m;
    while((m=re.exec(css))){
      out+=css.slice(i,m.index);
      const open=css.indexOf('{',m.index);
      let depth=0,j=open;
      for(;j<css.length;j++){
        if(css[j]==='{')depth++;
        else if(css[j]==='}'){depth--;if(depth===0)break;}
      }
      i=j+1;
      re.lastIndex=i;
    }
    return out+css.slice(i);
  }
  const css=fs.readFileSync(path.join(REPO_ROOT,'assets/styles.css'),'utf8');
  it('exercise-card hover lift only exists inside @media (hover: hover)',()=>{
    assert.ok(css.includes('.exercise-card:has(.exercise-card-main:hover)'),'the hover rule exists');
    const stripped=stripHoverHoverBlocks(css);
    assert.ok(!stripped.includes('translateY(-2px)'),
      'no unguarded translateY(-2px): sticky :hover on touch can no longer shift a card');
  });
});

describe('#491: dashboard calendar taps keep scroll + focus',()=>{
  const src=fs.readFileSync(path.join(REPO_ROOT,'assets/js/pages/dashboard-stats.js'),'utf8');
  it('calendar taps route through the scroll/focus guard',()=>{
    assert.ok(src.includes('function rerenderDashboardKeepingPlace'),
      'rerenderDashboardKeepingPlace exists');
    const helper=src.slice(src.indexOf('function rerenderDashboardKeepingPlace'));
    const helperBody=helper.slice(0,helper.indexOf('\n    }\n')+6);
    assert.ok(helperBody.includes('window.scrollY'),'pins the scroll position');
    assert.ok(helperBody.includes('requestAnimationFrame'),'restores after async hydration');
    assert.ok(helperBody.includes('preventScroll:true'),'refocuses without scrolling');
    assert.ok(!src.includes("button.dataset.calendarDate;renderDashboard()"),
      'day chips no longer call the bare re-render');
    assert.ok(src.includes("rerenderDashboardKeepingPlace('[data-calendar-date=\"'+date+'\"]')"),
      'day-chip tap keeps place');
    assert.ok(src.includes("rerenderDashboardKeepingPlace('#previousWeek')"),'prev-week keeps place');
    assert.ok(src.includes("rerenderDashboardKeepingPlace('#nextWeek')"),'next-week keeps place');
  });
});
