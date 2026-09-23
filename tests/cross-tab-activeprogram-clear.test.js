'use strict';
/* Role: cross-tab active-program clear propagation (persona-5 finding 2).
   mergeExternalBlob only adopted blob.activeProgram when truthy, so an
   explicit null (the "clear") never propagated: a stale sibling tab kept its
   old program and its next write resurrected it. The merge now adopts an
   explicit null under last-write-wins (incoming savedAt newer than everything
   this tab has seen) — but only from a blob whose world previously possessed
   a program (activeProgramWasSet), so a fresh tab's empty blob can never null
   out a live program. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const REPO_ROOT=path.join(__dirname,'..');

function loadTab(){
  const store=new Map();
  const localStorage={
    getItem:k=>store.has(k)?store.get(k):null,
    setItem:(k,v)=>store.set(k,String(v)),
    removeItem:k=>store.delete(k),
    clear:()=>store.clear(),
  };
  const sandbox={
    console:console,
    localStorage:localStorage,
    window:{addEventListener:function(){}},
    navigator:{onLine:true},
    $:function(){return null;},
    setTimeout:setTimeout,clearTimeout:clearTimeout,
    setInterval:function(){return 0;},clearInterval:function(){},
    Date:Date,JSON:JSON,Math:Math,Number:Number,String:String,Array:Array,
    Object:Object,Map:Map,Set:Set,Promise:Promise,isFinite:isFinite,isNaN:isNaN,
  };
  sandbox.globalThis=sandbox;
  sandbox.workoutState={completed:[],templates:[],tags:[],exerciseTagPresets:[],
    activeProgram:null,archivedPrograms:[],draft:null};
  sandbox.state={customExercises:[],favorites:new Set(),muscles:new Set(),
    savedBuilder:null,savedFilter:null,dashboardPeriod:'week',statsPeriod:'week',
    logPeriod:'week',topExercisesMode:'weight'};
  sandbox.exercises=[];
  sandbox.progressionSetup={};
  sandbox.PERSISTED_KEYS=['completed','templates','archivedPrograms','customExercises'];
  vm.createContext(sandbox);
  for(const rel of ['assets/js/core/persistence.js']){
    const code=fs.readFileSync(path.join(REPO_ROOT,rel),'utf8');
    vm.runInContext(code,sandbox,{filename:rel});
  }
  return sandbox;
}

function prog(id){return {id:id,name:'Program '+id,workouts:[]};}

/* A persist blob as collectPersistable writes it. wasSet=undefined omits the
   possession flag entirely (pre-fix / hand-rolled blobs). */
function blob(activeProgram,savedAt,wasSet,omitKey){
  const b={version:1,savedAt:savedAt,completed:[],templates:[],archivedPrograms:[],
    tags:[],exerciseTagPresets:[],favorites:[],customExercises:[]};
  if(!omitKey)b.activeProgram=activeProgram;
  if(wasSet!==undefined)b.activeProgramWasSet=wasSet;
  return b;
}

function merge(sandbox,b){
  return vm.runInContext('mergeExternalBlob('+JSON.stringify(b).replace(/</g,'\\u003c')+')',sandbox);
}

function programId(sandbox){
  const p=sandbox.workoutState.activeProgram;
  return p?p.id:null;
}

describe('cross-tab active-program clear (persona-5 finding 2)',()=>{
  it('a newer explicit clear (null) is adopted — the stale tab stops resurrecting it',()=>{
    const s=loadTab();
    s.workoutState.activeProgram=prog('p1');       // stale tab still holds P1
    vm.runInContext('lastSeenSavedAt=1000',s);     // its last write was T1
    // Tab A cleared at T2: null from a world that possessed a program.
    assert.equal(merge(s,blob(null,2000,true)),true);
    assert.equal(programId(s),null);
  });

  it('a stale clear loses to a newer program (last-write-wins)',()=>{
    const s=loadTab();
    s.workoutState.activeProgram=null;             // this tab cleared at T2
    vm.runInContext('lastSeenSavedAt=2000',s);
    // Another tab's blob carries a live program written at T3 — newer wins.
    assert.equal(merge(s,blob(prog('p1'),3000,true)),true);
    assert.equal(programId(s),'p1');
  });

  it("a fresh tab's empty blob (flag false) never clears a live program",()=>{
    const s=loadTab();
    s.workoutState.activeProgram=prog('p1');
    vm.runInContext('lastSeenSavedAt=1000',s);
    assert.equal(merge(s,blob(null,2000,false)),true);
    assert.equal(programId(s),'p1');
  });

  it("a fresh tab's empty blob (flag absent) never clears a live program",()=>{
    const s=loadTab();
    s.workoutState.activeProgram=prog('p1');
    vm.runInContext('lastSeenSavedAt=1000',s);
    assert.equal(merge(s,blob(null,2000)),true);
    assert.equal(programId(s),'p1');
  });

  it('a blob missing the activeProgram key entirely never clears',()=>{
    const s=loadTab();
    s.workoutState.activeProgram=prog('p1');
    vm.runInContext('lastSeenSavedAt=1000',s);
    assert.equal(merge(s,blob(undefined,2000,true,true)),true);
    assert.equal(programId(s),'p1');
  });

  it('an older null blob does not beat a newer local program',()=>{
    const s=loadTab();
    s.workoutState.activeProgram=prog('p1');
    vm.runInContext('lastSeenSavedAt=3000',s);     // this tab wrote at T3
    assert.equal(merge(s,blob(null,2000,true)),true); // clear from T2 is stale
    assert.equal(programId(s),'p1');
  });

  it('the possession flag is stamped on write and propagates through merges',()=>{
    // A tab holding a program stamps the flag on its own blobs.
    const s=loadTab();
    s.workoutState.activeProgram=prog('p1');
    const cp=vm.runInContext('collectPersistable()',s);
    assert.equal(cp.activeProgramWasSet,true);
    // A tab that never had a program adopts the flag from a merged blob, so
    // a clear keeps reading as a clear as it propagates tab to tab.
    const s2=loadTab();
    assert.equal(vm.runInContext('activeProgramWasSet',s2),false);
    merge(s2,blob(null,2000,true));
    assert.equal(vm.runInContext('activeProgramWasSet',s2),true);
    assert.equal(vm.runInContext('collectPersistable()',s2).activeProgramWasSet,true);
  });
});
