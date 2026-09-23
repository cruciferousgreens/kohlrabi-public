'use strict';
/* #404 (user 2026-09-13): deleting a saved workout must not jump the scroll
   to the top. The confirm handler pins window.scrollY across the
   renderWorkoutScreen() rebuild and restores it on the next frame — the same
   pattern as the log period tabs — clamped to the new max scroll height.

   The test drives the real UI flow: render the saved list, tap the row's
   delete (which arms pendingDeleteTemplateId and opens the confirmation),
   then tap confirm. The delete-confirm handler is wired at module load, so
   this uses a vm sandbox (like signout-confirm.test.js) where the fake
   document exists BEFORE the sources evaluate. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');

const calls={showModal:0,renderScreen:0};
const scrollToCalls=[];
let docScrollHeight=2000;

function fakeEl(extra){
  return Object.assign({
    textContent:'',hidden:false,
    style:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},
    dataset:{},addEventListener(){},removeEventListener(){},
    showModal(){},close(){},setAttribute(){},getAttribute:()=>null,
    querySelectorAll:()=>[],querySelector:()=>null,
  },extra||{});
}
const deleteRowBtn={
  dataset:{savedId:'t1'},
  _click:null,addEventListener(t,f){this._click=f;},click(){this._click();},
};
const confirmBtn={_click:null,addEventListener(t,f){this._click=f;},click(){this._click();}};
const scrollIntoViewCalls=[];
const sectionStub=fakeEl({scrollIntoView(...a){scrollIntoViewCalls.push(a);}});
const host=fakeEl({
  _html:'',set innerHTML(v){this._html=String(v);},get innerHTML(){return this._html;},
  querySelectorAll(sel){return sel==='.delete-saved-row'?[deleteRowBtn]:[];},
  closest(){return sectionStub;},
});
const byId={
  savedWorkoutList:host,
  deleteTemplateDesc:fakeEl(),
  deleteTemplateDialog:fakeEl(),
  confirmDeleteTemplate:confirmBtn,
  savedFilterCount:fakeEl(),
};
const fakeDoc={
  querySelector(sel){
    const id=String(sel).startsWith('#')?String(sel).slice(1):null;
    return id&&byId[id]?byId[id]:null;
  },
  querySelectorAll:()=>[],
  getElementById(id){return byId[id]||null;},
  createElement(){
    let t='';
    return {set textContent(v){t=String(v);},get textContent(){return t;},
      get innerHTML(){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');},
      set innerHTML(v){t=String(v);}};
  },
  addEventListener(){},removeEventListener(){},
  body:fakeEl(),documentElement:{get scrollHeight(){return docScrollHeight;}},
};
const fakeWin={
  scrollY:250,innerHeight:852,
  scrollTo(...a){scrollToCalls.push(a);},
  addEventListener(){},removeEventListener(){},
  location:{href:'http://localhost/'},
};

const sandbox={
  document:fakeDoc,window:fakeWin,
  /* requestAnimationFrame runs the scroll restore synchronously here. */
  requestAnimationFrame(cb){cb();return 1;},
  cancelAnimationFrame(){},setTimeout(){return 0;},clearTimeout(){},
  localStorage:{getItem(){return null;},setItem(){},removeItem(){}},
  navigator:{userAgent:'node-test-harness'},
  __calls:calls,
};
vm.createContext(sandbox);
for(const f of ['assets/js/core/state.js','assets/js/lib/utilities.js','assets/js/pages/saved-workouts.js']){
  vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),sandbox,{filename:f});
}
/* Collaborators outside this slice: the catalog, the debounced persist, the
   swipe installer, the modal helper, and the workout-screen renderer. */
vm.runInContext(`
  var exercises=[{id:'bench-press',name:'Barbell Bench Press',equipment:'barbell',primary:['chest']}];
  function schedulePersist(){}
  function attachSwipeDelete(){}
  function showModalPinned(){__calls.showModal++;}
  function renderWorkoutScreen(){__calls.renderScreen++;}
`,sandbox,{filename:'<404 stubs>'});

function deleteTemplate(editorId){
  const workoutState=vm.runInContext('workoutState',sandbox);
  const state=vm.runInContext('state',sandbox);
  workoutState.templates.push({id:'t1',name:'Legs',exercises:[]});
  state.savedWorkoutId=editorId===undefined?null:editorId;
  vm.runInContext('renderWorkoutTemplateList()',sandbox);
  deleteRowBtn.click();   /* arms the delete, opens the confirmation */
  confirmBtn.click();     /* confirms */
}
beforeEach(()=>{
  const workoutState=vm.runInContext('workoutState',sandbox);
  const state=vm.runInContext('state',sandbox);
  workoutState.templates.length=0;
  state.savedWorkoutId=null;
  calls.showModal=0;calls.renderScreen=0;scrollToCalls.length=0;scrollIntoViewCalls.length=0;
  fakeWin.scrollY=250;docScrollHeight=2000;
});

describe('confirmDeleteTemplate scroll pin (#404)',()=>{
  it('the template is deleted and the confirmation flow runs',()=>{
    deleteTemplate(null);
    const workoutState=vm.runInContext('workoutState',sandbox);
    const state=vm.runInContext('state',sandbox);
    assert.equal(workoutState.templates.length,0,'template removed');
    assert.equal(state.savedWorkoutId,null,'open editor id cleared');
    assert.equal(calls.showModal,1,'delete confirmation was shown');
    assert.equal(calls.renderScreen,1,'the list re-renders after delete');
  });
  it('scroll is restored to the pre-delete position, not the top',()=>{
    deleteTemplate(null);
    assert.equal(scrollToCalls.length,1,'one scroll restore after the re-render');
    assert.deepEqual(scrollToCalls[0],[0,250],'back to the pinned scrollY, not 0');
  });
  it('the restore clamps to the new max scroll height',()=>{
    docScrollHeight=500; /* page shrank below the old position */
    deleteTemplate(null);
    assert.deepEqual(scrollToCalls[0],[0,0],'clamped to the top of the shorter page');
  });
});

describe('editor delete returns to the list section (#258)',()=>{
  it('scrolls the saved-workouts list section into view, no scroll pin',()=>{
    deleteTemplate('t1'); /* the deleted workout IS the open editor */
    assert.equal(scrollIntoViewCalls.length,1,'list section scrolled into view');
    assert.equal(scrollIntoViewCalls[0][0].block,'start','scrollIntoView({block:start})');
    assert.equal(scrollToCalls.length,0,'no scroll-position pin on the editor path');
    const state=vm.runInContext('state',sandbox);
    assert.equal(state.savedWorkoutId,null,'open editor id cleared');
  });
});
