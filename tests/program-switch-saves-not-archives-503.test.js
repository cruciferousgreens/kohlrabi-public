'use strict';
/* #503 (user 2026-09-15, phone QA): switching programs moves the outgoing
   active program into the SAVED programs library (savedAt + unshift onto
   savedPrograms, never deleted) — not into archived programs. This
   supersedes the #432 archive convention on all three activation paths:
   activateSavedProgramById (programs.js), activateSharedProgram (share.js),
   and the #445 deep-link "start new anyway" handler (programs.js).
   - The outgoing program lands in Saved with savedAt stamped and no
     archivedAt, and never touches archivedPrograms.
   - Replace, never skip: if a stale Saved copy with the same id exists
     (e.g. the user saved a snapshot earlier, then kept editing the active
     program), the outgoing live object is always newer and WINS — the stale
     entry is removed first so live edits are never silently discarded.
   - With no active program there is nothing to move: Saved/archive stay
     empty and activation still proceeds. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

/* Fake DOM: canned elements per selector, mirroring saved-programs-455. */
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
    appendChild(){return {};},
    setAttribute(){}, getAttribute:()=>null,
  };
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

const calls={persist:0,renderProgram:0,renderDashboard:0,toasts:[]};
const role=loadRole('program-muscle-view',{globals:{
  document:fakeDocument(),
  schedulePersist(){calls.persist++;},
  renderProgram(){calls.renderProgram++;},
  renderDashboard(){calls.renderDashboard++;},
  showToast(msg){calls.toasts.push(String(msg));},
}});
const {workoutState,activateSavedProgramById}=role;

const ACTIVE={id:'p-active',name:'Active Plan',length:8,startWeek:1,focus:'strength',workouts:[]};
const NEXT={id:'p-next',name:'Next Plan',length:4,startWeek:1,focus:'hypertrophy',
  savedAt:'2026-09-14',workouts:[]};

function reset(){
  for(const k of Object.keys(els))delete els[k];
  calls.persist=0;calls.renderProgram=0;calls.renderDashboard=0;calls.toasts=[];
  workoutState.activeProgram=null;
  workoutState.savedPrograms=[];
  workoutState.archivedPrograms=[];
  workoutState.completed=[];
}
beforeEach(reset);
function clone(o){return JSON.parse(JSON.stringify(o));}

describe('#503: switching programs moves the outgoing program into Saved, not the archive',()=>{
  it('the outgoing active program lands in Saved with savedAt, not in the archive',()=>{
    workoutState.activeProgram=clone(ACTIVE);
    workoutState.savedPrograms=[clone(NEXT)];
    assert.strictEqual(activateSavedProgramById('p-next'),true);
    assert.strictEqual(workoutState.activeProgram.id,'p-next','the new program is active');
    assert.strictEqual(workoutState.activeProgram.savedAt,undefined,'savedAt cleared on the incoming program');
    assert.strictEqual(workoutState.archivedPrograms.length,0,'nothing went to the archive');
    assert.strictEqual(workoutState.savedPrograms.length,1,'the outgoing program is in Saved');
    assert.strictEqual(workoutState.savedPrograms[0].id,'p-active','Saved holds the old active program');
    assert.ok(workoutState.savedPrograms[0].savedAt,'moved program carries savedAt');
    assert.strictEqual(workoutState.savedPrograms[0].archivedAt,undefined,'moved program carries no archivedAt');
    assert.ok(calls.persist>=1,'state persisted');
  });
  it('replace, never skip: a stale Saved copy with the same id is replaced by the live program',()=>{
    /* Data-loss regression: the user saved a snapshot of the active
       program earlier (older name), kept editing the live program (newer
       name), then switched programs. The outgoing live object must WIN —
       the stale Saved copy must not shadow the newer edits. */
    const stale=clone(ACTIVE);stale.name='Stale Saved Copy';stale.savedAt='2026-09-01';
    workoutState.activeProgram=clone(ACTIVE);
    workoutState.activeProgram.name='Live Edited Plan';
    workoutState.savedPrograms=[stale,clone(NEXT)];
    assert.strictEqual(activateSavedProgramById('p-next'),true);
    const matching=workoutState.savedPrograms.filter(p=>p.id==='p-active');
    assert.strictEqual(matching.length,1,'exactly one entry with the outgoing id');
    assert.strictEqual(matching[0].name,'Live Edited Plan','the live (newer) program won');
    assert.strictEqual(workoutState.archivedPrograms.length,0,'nothing went to the archive');
  });
  it('no active program -> activation proceeds, Saved and archive stay untouched',()=>{
    workoutState.savedPrograms=[clone(NEXT)];
    assert.strictEqual(activateSavedProgramById('p-next'),true);
    assert.strictEqual(workoutState.activeProgram.id,'p-next','the new program is active');
    assert.strictEqual(workoutState.savedPrograms.length,0,'Saved only lost the activated program');
    assert.strictEqual(workoutState.archivedPrograms.length,0,'nothing went to the archive');
  });
});
