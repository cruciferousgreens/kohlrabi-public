'use strict';
/* #520 (2026-09-17, instrumented retest on v1.801-diag): the delete itself
   was proven durable — durable:true, IDB re-read null, boot took the empty
   branch. The resurrection came from a hidden peer tab whose 5s persistNow
   tick fired in the post-wipe empty window: with storage ABSENT it saw a
   null external, skipped its read-before-write merge, and blind-wrote its
   stale full memory with a fresh savedAt, which this tab then adopted.
   The fix (v1.801): wipeLocalUserData synchronously plants the emptied
   payload to localStorage — before the first await (ungated by
   lastWrittenHash, which would make persistSyncForUnload skip it as
   "clean") and again after the IDB delete verifies — so no execution
   context ever observes absent storage post-wipe. A peer's read-before-write
   takes the newer of the IDB blob and this LS copy (newerBlob) and adopts
   the explicit empty, the same convergence the two-tab case already shows.
   The plant self-cleans: persistNow drops the LS copy once it durably
   writes anything newer (savedAt-guarded), and boot's migrateBlobToIdb
   moves it into IDB. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const REPO_ROOT=path.join(__dirname,'..');
const PERSIST_KEY='workout-app:v1';

function loadPersistence(initialLS){
  const store=new Map();
  if(initialLS)for(const [k,v] of Object.entries(initialLS))store.set(k,String(v));
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
    activeProgram:null,archivedPrograms:[],savedPrograms:[],draft:null};
  sandbox.state={customExercises:[],favorites:new Set(),muscles:new Set(),
    savedBuilder:null,savedFilter:null,dashboardPeriod:'week',statsPeriod:'week',
    logPeriod:'week'};
  sandbox.exercises=[];
  sandbox.progressionSetup={};
  sandbox.cloneWorkoutTemplates=function(){return [];};
  sandbox.DEFAULT_SET_TAGS=[];
  sandbox.DEFAULT_EXERCISE_TAG_PRESETS=[];
  sandbox.mergeTagLists=function(def,list){return Array.isArray(list)?list:def;};
  sandbox.normalizeProgression=function(){};
  sandbox.resetProgressionSetup=function(){};
  vm.createContext(sandbox);
  const storageCode=fs.readFileSync(path.join(REPO_ROOT,'assets/js/core/storage.js'),'utf8');
  vm.runInContext(storageCode,sandbox,{filename:'assets/js/core/storage.js'});
  const code=fs.readFileSync(path.join(REPO_ROOT,'assets/js/core/persistence.js'),'utf8');
  vm.runInContext(code,sandbox,{filename:'assets/js/core/persistence.js'});
  return {sandbox,store};
}

/* In-memory Map standing in for a working IndexedDB behind the Storage
   adapter (Node has no indexedDB). */
function simulateIdb(sandbox){
  vm.runInContext(`
    (function(){
      const idbStore=new Map();
      Storage.idbGet=async function(k){return idbStore.has(k)?idbStore.get(k):null;};
      Storage.idbSet=async function(k,v){idbStore.set(k,String(v));return true;};
      Storage.idbDel=async function(k){idbStore.delete(k);return true;};
      Storage.backend='idb';
      Storage.probe=async function(){return 'idb';};
      Storage._idbStore=idbStore;
    })();
  `,sandbox);
}

const W1={id:'w1',name:'Squat day',exercises:[{id:'e1',sets:[{weight:135,reps:5}]}]};
const FULL_BLOB={version:1,savedAt:100,completed:[W1],templates:[{id:'t1'}],tags:[],
  exerciseTagPresets:[],activeProgram:{id:'p1'},archivedPrograms:[],savedPrograms:[],
  customExercises:[],favorites:[]};

function seedFullState(sandbox){
  vm.runInContext(`
    Storage._idbStore.set('${PERSIST_KEY}',${JSON.stringify(JSON.stringify(FULL_BLOB))});
    workoutState.completed=${JSON.stringify([W1])};
    workoutState.templates=${JSON.stringify([{id:'t1'}])};
    workoutState.activeProgram=${JSON.stringify({id:'p1'})};
  `,sandbox);
}

describe('#520: the wipe plants the emptied state synchronously (no empty window)',()=>{
  it('the LS plant exists before the first await — with the emptied payload',async ()=>{
    const {sandbox,store}=loadPersistence({});
    simulateIdb(sandbox);
    seedFullState(sandbox);
    /* The wipe returns the durability promise; the plant must already be in
       localStorage the moment the synchronous prefix returns — a peer tick
       firing at any point after this line must see it. */
    const wipePromise=vm.runInContext('wipeLocalUserData()',sandbox);
    const planted=store.get(PERSIST_KEY);
    assert.ok(planted,'emptied payload planted synchronously, before any await');
    const data=JSON.parse(planted);
    assert.deepEqual(data.completed,[],'plant holds the emptied state, not the stale memory');
    assert.deepEqual(data.templates,[],'templates emptied in the plant');
    assert.equal(data.activeProgram,null,'active program emptied in the plant');
    assert.ok(Number(data.savedAt)>100,'plant savedAt is fresh (post-wipe)');
    await wipePromise;
  });
  it('a peer read-before-write after the wipe sees the plant, never absent storage',async ()=>{
    /* This mirrors persistNow's external selection exactly:
       newerBlob(await Storage.loadBlob(PERSIST_KEY), localStorage.getItem(PERSIST_KEY)).
       Before the fix the wipe removed the LS copy, so a peer whose tick
       fired after the IDB delete saw null and blind-wrote its stale memory. */
    const {sandbox}=loadPersistence({});
    simulateIdb(sandbox);
    seedFullState(sandbox);
    await vm.runInContext('wipeLocalUserData()',sandbox);
    assert.equal(await vm.runInContext(`Storage.idbGet('${PERSIST_KEY}')`,sandbox),null,'IDB copy deleted');
    const ext=await vm.runInContext(
      `(async()=>newerBlob(await Storage.idbGet('${PERSIST_KEY}'),localStorage.getItem('${PERSIST_KEY}')))()`,sandbox);
    assert.ok(ext,'peer sees an explicit blob, not absent storage');
    assert.deepEqual(JSON.parse(ext).completed,[],'the blob the peer sees is the emptied state');
  });
  it('the post-verify plant is strictly newer than a peer write that landed mid-wipe',async ()=>{
    /* The adversarial interleaving: a peer tick already in flight blind-writes
       its stale full blob to IDB after the first plant. The verified delete
       (with retry) removes it; the post-verify re-plant must then beat it so
       boot's newest-copy selection prefers the empty state. */
    const {sandbox,store}=loadPersistence({});
    simulateIdb(sandbox);
    seedFullState(sandbox);
    /* Deterministic stand-in for deleteBlobDurable: inject the peer's
       blind write mid-flight, then perform the verified delete. */
    vm.runInContext(`(function(){
      const idbStore=Storage._idbStore;
      const full=${JSON.stringify(JSON.stringify(FULL_BLOB))};
      Storage.deleteBlobDurable=async function(k){
        const peerTs=Date.now();
        window.__peerTs=peerTs;
        const peerBlob=JSON.stringify(Object.assign(JSON.parse(full),{savedAt:peerTs}));
        idbStore.set(k,peerBlob); /* the hidden peer's in-flight blind write */
        idbStore.delete(k);       /* ...removed by the verified delete */
        while(Date.now()<=peerTs){} /* post-verify plant lands strictly later */
        return true;
      };
    })()`,sandbox);
    await vm.runInContext('wipeLocalUserData()',sandbox);
    const peerTs=vm.runInContext('window.__peerTs',sandbox);
    assert.ok(peerTs>0,'peer write was injected mid-wipe');
    const plant=JSON.parse(store.get(PERSIST_KEY));
    assert.ok(Number(plant.savedAt)>peerTs,'post-verify plant supersedes the mid-wipe peer write');
    assert.deepEqual(plant.completed,[],'plant is the emptied state');
    assert.equal(await vm.runInContext(`Storage.idbGet('${PERSIST_KEY}')`,sandbox),null,'IDB copy gone');
  });
  it('a fresh boot restores the emptied state from the plant',async ()=>{
    const {sandbox}=loadPersistence({});
    simulateIdb(sandbox);
    seedFullState(sandbox);
    await vm.runInContext('wipeLocalUserData()',sandbox);
    /* Fresh boot in the same profile: IDB absent, LS plant present. */
    await vm.runInContext('restorePersisted()',sandbox);
    assert.equal(vm.runInContext('workoutState.completed.length',sandbox),0,'boot restores empty, not the wiped data');
    assert.equal(vm.runInContext('workoutState.activeProgram',sandbox),null,'no program resurrected at boot');
  });
  it('the pagehide safety net still sees the wipe as clean (no rewrite of the plant)',async ()=>{
    const {sandbox,store}=loadPersistence({});
    simulateIdb(sandbox);
    seedFullState(sandbox);
    await vm.runInContext('wipeLocalUserData()',sandbox);
    const before=store.get(PERSIST_KEY);
    vm.runInContext('persistSyncForUnload()',sandbox);
    assert.equal(store.get(PERSIST_KEY),before,'pagehide leaves the plant untouched (hash already seeded)');
  });
});
