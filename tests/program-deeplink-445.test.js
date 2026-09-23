'use strict';
/* #445 (user 2026-09-14): a #program deep link with an active program must
   not drop into the active program — boot offers a modal with explicit
   choices (start a new program anyway / keep the active program).
   - No active program -> no modal; the Program tab's setup form is the
     landing as before.
   - Active program -> modal opens; the copy names the program and states
     the archive/saved-program boundary (only the active program is
     affected, saved programs are untouched).
   - "Keep active program" (or the x) dismisses with no state change.
   - "Start new program" moves the active program into Saved (#503
     supersedes the #432 archive convention: savedAt + unshift onto
     savedPrograms, never deleted), clears the active program, and resets
     the setup form for a fresh draft. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

/* Fake DOM: canned elements per selector, dialogs fire close events. */
function makeEl(id){
  const handlers={};
  const el={
    id, hidden:false, innerHTML:'', value:'', open:false,
    dataset:{}, style:{},
    classList:{add(){},remove(){},toggle(){},contains:()=>false},
    addEventListener(ev,fn){(handlers[ev]=handlers[ev]||[]).push(fn);},
    removeEventListener(){},
    showModal(){el.open=true;},
    close(){el.open=false;(handlers['close']||[]).forEach(fn=>fn());},
    click(){(handlers['click']||[]).forEach(fn=>fn());},
    scrollIntoView(){},
    appendChild(){return {};},
    setAttribute(){}, getAttribute:()=>null,
  };
  let _text='';
  Object.defineProperty(el,'textContent',{
    get:()=>_text,
    set:v=>{_text=String(v);},
  });
  return el;
}
let els={};
function fakeDocument(){
  els={};
  return {
    querySelector(sel){return els[sel]||(els[sel]=makeEl(sel));},
    querySelectorAll:()=>[],
    addEventListener(){}, removeEventListener(){},
    createElement:()=>makeEl('anon'), hidden:false, title:'',
  };
}

const calls={persist:0,renderProgram:0,renderDashboard:0,modals:[]};
const role=loadRole('program-muscle-view',{globals:{
  document:fakeDocument(),
  schedulePersist(){calls.persist++;},
  renderProgram(){calls.renderProgram++;},
  renderDashboard(){calls.renderDashboard++;},
  showToast(){},
  showModalPinned(dlg){calls.modals.push(dlg&&dlg.id);if(dlg&&dlg.showModal)dlg.showModal();},
}});
const {workoutState,wireProgramDeepLinkDialog,maybeOfferNewProgramForDeepLink}=role;

const CURRENT={id:'cur-1',name:'Current Program',length:6,startWeek:1,focus:'strength',workouts:[]};
const SAVED={id:'sp-1',name:'Saved Plan',length:4,startWeek:1,focus:'hypertrophy',savedAt:'2026-09-14',workouts:[]};

function reset(){
  for(const k of Object.keys(els))delete els[k];
  calls.persist=0;calls.renderProgram=0;calls.renderDashboard=0;calls.modals=[];
  workoutState.activeProgram=null;
  workoutState.savedPrograms=[];
  workoutState.archivedPrograms=[];
  /* Re-wire against the fresh fake document (production wires once at load). */
  wireProgramDeepLinkDialog();
}
beforeEach(reset);
function current(){return JSON.parse(JSON.stringify(CURRENT));}
function openModal(){
  workoutState.activeProgram=current();
  maybeOfferNewProgramForDeepLink();
}

describe('#445: #program deep link modal',()=>{
  it('no active program -> no modal offered',()=>{
    maybeOfferNewProgramForDeepLink();
    assert.strictEqual(calls.modals.length,0,'no dialog shown');
    assert.strictEqual(els['#programDeepLinkDialog']?.open,false,'dialog stays closed');
  });
  it('active program -> modal opens and names the Saved destination',()=>{
    openModal();
    assert.deepStrictEqual(calls.modals,['#programDeepLinkDialog'],'deep-link dialog shown');
    assert.strictEqual(els['#programDeepLinkDialog'].open,true);
    const desc=els['#programDeepLinkDesc'].textContent;
    assert.ok(desc.includes('Current Program'),'names the active program');
    assert.ok(desc.includes('saved programs'),'states the program moves to Saved');
    assert.ok(!desc.includes('archive'),'no longer promises the archive');
    assert.strictEqual(workoutState.activeProgram.name,'Current Program','nothing replaced yet');
    assert.strictEqual(workoutState.archivedPrograms.length,0,'nothing archived yet');
  });
  it('"Keep active program" dismisses with no state change',()=>{
    openModal();
    els['#keepActiveProgram'].click();
    assert.strictEqual(els['#programDeepLinkDialog'].open,false,'dialog closed');
    assert.strictEqual(workoutState.activeProgram.name,'Current Program','active program kept');
    assert.strictEqual(workoutState.archivedPrograms.length,0,'nothing archived');
    assert.strictEqual(calls.persist,0,'nothing persisted');
  });
  it('the x dismisses with no state change',()=>{
    openModal();
    els['#closeProgramDeepLink'].click();
    assert.strictEqual(els['#programDeepLinkDialog'].open,false,'dialog closed');
    assert.strictEqual(workoutState.activeProgram.name,'Current Program','active program kept');
    assert.strictEqual(workoutState.archivedPrograms.length,0,'nothing archived');
  });
  it('"Start new program" moves the active program into Saved and resets the form (#503)',()=>{
    workoutState.savedPrograms=[JSON.parse(JSON.stringify(SAVED))];
    openModal();
    els['#confirmStartNewProgram'].click();
    assert.strictEqual(els['#programDeepLinkDialog'].open,false,'dialog closed');
    assert.strictEqual(workoutState.activeProgram,null,'active program cleared');
    assert.strictEqual(workoutState.archivedPrograms.length,0,'nothing archived');
    assert.strictEqual(workoutState.savedPrograms.length,2,'old active program joined Saved');
    assert.strictEqual(workoutState.savedPrograms[0].name,'Current Program','old active is frontmost in Saved');
    assert.ok(workoutState.savedPrograms[0].savedAt,'savedAt stamped');
    assert.strictEqual(workoutState.savedPrograms[0].archivedAt,undefined,'no archivedAt on the moved program');
    assert.strictEqual(workoutState.savedPrograms[1].name,'Saved Plan','the pre-existing saved program intact');
    assert.ok(calls.persist>=1,'state persisted');
    assert.ok(calls.renderProgram>=1,'program view re-rendered');
    assert.ok(calls.renderDashboard>=1,'dashboard re-rendered');
    assert.strictEqual(els['#programName'].value,'','name field cleared for the fresh draft');
    assert.strictEqual(els['#createProgram'].textContent,'Create active program','create button reset');
  });
});
