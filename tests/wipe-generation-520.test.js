'use strict';
/* #520 (v1.803): wipe generation clock.
   The v1.801 "plant the emptied payload" fix failed in the real-browser
   retest because the cross-tab merge is a UNION: a peer tab merging the
   planted empty blob keeps its own records (unionById returns the local
   array unchanged when the incoming array is empty), then re-writes them
   on its next 5s autosave. The wipe also recorded no tombstones, so the
   peer had no signal its records were deleted.
   The fix: every wipe bumps a monotonic generation, persisted synchronously
   to localStorage ('workout-app:wipe-gen') and stamped on every blob
   (wipeGen). A tab that observes a newer generation — via the LS key or a
   blob — clears its own memory instead of union-merging; blobs older than
   its generation are pre-wipe and are never merged.
   Two "tabs" = two vm sandboxes sharing one localStorage Map. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const REPO_ROOT=path.join(__dirname,'..');
const PERSIST_KEY='workout-app:v1';
const WIPE_GEN_KEY='workout-app:wipe-gen';

function loadTab(store){
  const localStorage={
    getItem:k=>store.has(k)?store.get(k):null,
    setItem:(k,v)=>store.set(k,String(v)),
    removeItem:k=>store.delete(k),
    clear:()=>store.clear(),
    get length(){return store.size;},
    key:i=>{const ks=[...store.keys()];return i<ks.length?ks[i]:null;},
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
    Object:Object,Map:Map,Set:Set,Promise:Promise,isFinite:isFinite,
    isNaN:isNaN,parseInt:parseInt,
  };
  sandbox.globalThis=sandbox;
  sandbox.workoutState={completed:[],templates:[],tags:[],exerciseTagPresets:[],
    activeProgram:null,archivedPrograms:[],savedPrograms:[],draft:null,
    tagTarget:null,exerciseTagTarget:null,supersetTarget:null,pickerMode:'draft',
    programWorkoutTarget:null,pickerSwapUid:null};
  sandbox.state={customExercises:[],favorites:new Set(),muscles:new Set(),
    savedBuilder:null,builderReturn:null,builderOpen:false,
    sharePreview:null,shareReturn:null,workoutEditorOpen:false,savedWorkoutId:null,
    workoutHistoryOpen:false,programWorkoutUid:null,settingsSections:{},
    subscriptions:{},query:'',equipment:'',onlyFavorites:false,onlyCustom:false,
    selected:null,savedFilter:null,dashboardPeriod:'week',statsPeriod:'week',
    logPeriod:'week',emailSyncHash:''};
  sandbox.exercises=[];
  sandbox.progressionSetup={};
  sandbox.resetProgressionSetup=function(){sandbox.progressionSetup={};};
  sandbox.normalizeProgression=function(){};
  sandbox.cloneWorkoutTemplates=function(){return [];};
  sandbox.DEFAULT_SET_TAGS=[];
  sandbox.DEFAULT_EXERCISE_TAG_PRESETS=[];
  vm.createContext(sandbox);
  const storageCode=fs.readFileSync(path.join(REPO_ROOT,'assets/js/core/storage.js'),'utf8');
  vm.runInContext(storageCode,sandbox,{filename:'assets/js/core/storage.js'});
  const code=fs.readFileSync(path.join(REPO_ROOT,'assets/js/core/persistence.js'),'utf8');
  vm.runInContext(code,sandbox,{filename:'assets/js/core/persistence.js'});
  return sandbox;
}
function mkWorkout(id){return {id:id,name:'W '+id,sets:[],isoDate:'2026-09-16'};}
function mkTemplate(id){return {id:id,name:'T '+id,exercises:[]};}
function storedBlob(store){return JSON.parse(store.get(PERSIST_KEY));}
/* Module-scoped `let` bindings (wipeGeneration) don't attach to the vm
   global object — read them by evaluating in the tab's context. */
function gen(tab){return vm.runInContext('wipeGeneration',tab);}
/* Real tabs tick seconds apart; the savedAt recency guard needs strictly
   increasing timestamps, so let wall-clock time advance between steps. */
function tick(ms){return new Promise(r=>setTimeout(r,ms||12));}

describe('#520 wipe generation clock (v1.803)',()=>{
  it('a peer tab adopts the wipe via the LS generation key and its next autosave stays empty',async()=>{
    const store=new Map();
    const A=loadTab(store),B=loadTab(store);
    A.workoutState.completed=[mkWorkout('w1'),mkWorkout('w2')];
    A.workoutState.templates=[mkTemplate('t1')];
    await A.persistNow();
    await B.restorePersisted();
    assert.equal(B.workoutState.completed.length,2,'B boots with the data');
    assert.equal(gen(B),0,'generation starts at 0');
    /* A wipes: generation bumps synchronously, memory clears, plant lands. */
    A.wipeLocalUserData();
    assert.equal(gen(A),1,'A bumped to generation 1');
    assert.equal(store.get(WIPE_GEN_KEY),'1','LS generation key written');
    assert.equal(A.workoutState.completed.length,0,'A memory cleared');
    /* B ticks with stale full memory: it must clear, not union-merge. */
    await B.persistNow();
    assert.equal(B.workoutState.completed.length,0,'B cleared completed');
    assert.equal(B.workoutState.templates.length,0,'B cleared templates');
    assert.equal(gen(B),1,'B adopted generation 1');
    const blob=storedBlob(store);
    assert.equal(blob.completed.length,0,"B's autosave stayed empty");
    assert.equal(blob.wipeGen,1,'stored blob carries generation 1');
  });

  it('a pre-wipe blob with a NEWER savedAt is ignored after the wipe',async()=>{
    const store=new Map();
    const A=loadTab(store),B=loadTab(store);
    A.workoutState.completed=[mkWorkout('w1')];
    await A.persistNow();
    await B.restorePersisted();
    A.wipeLocalUserData();
    await B.persistNow();
    assert.equal(B.workoutState.completed.length,0,'B is empty post-wipe');
    /* A stale tab's autosave lands AFTER the wipe with a fresh savedAt —
       the exact resurrection vector. Generation must veto it. */
    const stale={version:1,savedAt:Date.now()+60000,wipeGen:0,
      completed:[mkWorkout('w-stale')],templates:[mkTemplate('t-stale')],
      tags:[],exerciseTagPresets:[],activeProgram:null,archivedPrograms:[],
      savedPrograms:[],customExercises:[],favorites:[]};
    store.set(PERSIST_KEY,JSON.stringify(stale));
    await B.persistNow();
    assert.equal(B.workoutState.completed.length,0,'stale blob did not resurrect');
    assert.equal(B.workoutState.templates.length,0,'stale templates did not resurrect');
    assert.equal(gen(B),1,'generation unchanged');
  });

  it('records created after the wipe sync across tabs normally',async()=>{
    const store=new Map();
    const A=loadTab(store),B=loadTab(store);
    A.workoutState.completed=[mkWorkout('w1')];
    await A.persistNow();
    await B.restorePersisted();
    A.wipeLocalUserData();
    await B.persistNow();
    await tick();
    /* Post-wipe life goes on: A logs a new workout. */
    A.workoutState.completed=[mkWorkout('w-new')];
    await A.persistNow();
    await B.persistNow();
    assert.equal(B.workoutState.completed.length,1,'B received the new workout');
    assert.equal(B.workoutState.completed[0].id,'w-new');
    assert.equal(gen(B),1,'same generation: normal union path');
  });

  it('cross-tab union merge is unchanged when no wipe happened',async()=>{
    const store=new Map();
    const C=loadTab(store),D=loadTab(store);
    C.workoutState.completed=[mkWorkout('c1')];
    await C.persistNow();
    await D.restorePersisted();
    await tick();
    D.workoutState.completed.push(mkWorkout('d1'));
    await D.persistNow();
    await tick();
    await C.persistNow();
    const ids=C.workoutState.completed.map(w=>w.id).sort();
    assert.deepEqual(ids,['c1','d1'],'union by id still works');
    assert.equal(gen(C),0,'no generation bump without a wipe');
    assert.equal(store.get(WIPE_GEN_KEY),undefined,'no LS key without a wipe');
  });

  it('boot ignores a pre-wipe blob when the LS generation key is newer',async()=>{
    const stale={version:1,savedAt:Date.now(),wipeGen:0,
      completed:[mkWorkout('w-old')],templates:[],tags:[],exerciseTagPresets:[],
      activeProgram:null,archivedPrograms:[],savedPrograms:[],customExercises:[],
      favorites:[]};
    const store=new Map([[PERSIST_KEY,JSON.stringify(stale)],[WIPE_GEN_KEY,'1']]);
    const E=loadTab(store);
    await E.restorePersisted();
    assert.equal(E.workoutState.completed.length,0,'booted empty, stale blob ignored');
    assert.equal(gen(E),1,'adopted the LS generation');
  });

  it('a second wipe bumps the generation again and converges',async()=>{
    const store=new Map();
    const A=loadTab(store),B=loadTab(store);
    A.workoutState.completed=[mkWorkout('w1')];
    await A.persistNow();
    await B.restorePersisted();
    A.wipeLocalUserData();
    await B.persistNow();
    assert.equal(gen(B),1,'B adopted generation 1 after first wipe');
    /* New data, then a second wipe from the other tab. */
    B.workoutState.completed=[mkWorkout('w2')];
    await B.persistNow();
    await tick();
    await A.persistNow();
    assert.equal(A.workoutState.completed.length,1,'A picked up post-wipe data');
    B.wipeLocalUserData();
    assert.equal(gen(B),2,'second wipe -> generation 2');
    await A.persistNow();
    assert.equal(A.workoutState.completed.length,0,'A honored the second wipe');
    assert.equal(gen(A),2);
    assert.equal(storedBlob(store).wipeGen,2);
  });
});
