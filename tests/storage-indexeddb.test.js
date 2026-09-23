'use strict';
/* Post-v1 storage migration (user 2026-09-13): the blob moves from localStorage
   to IndexedDB via assets/js/core/storage.js. persistence.js must:
   - migrate the old localStorage blob into the storage adapter exactly once,
     verifying byte-identical read-back before keeping a renamed backup;
   - fall back to localStorage behavior when IndexedDB is unavailable;
   - skip writes when the state hash is unchanged (autosave change detection);
   - remove the migration backup on explicit data wipe (no resurrection).
   In Node, indexedDB is undefined so the Storage adapter falls back to
   localStorage — the migration/verify/wipe logic is identical. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const REPO_ROOT=path.join(__dirname,'..');

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

/* Simulate a working IndexedDB behind the Storage adapter: swap the idb
   get/set pair for an in-memory Map and force the backend flag. This drives
   the exact same migrate/load paths the browser takes. */
function simulateIdb(sandbox){
  vm.runInContext(`
    (function(){
      const idbStore=new Map();
      Storage.idbGet=async function(k){return idbStore.has(k)?idbStore.get(k):null;};
      Storage.idbSet=async function(k,v){idbStore.set(k,String(v));return true;};
      Storage.idbDel=async function(k){idbStore.delete(k);return true;};
      Storage.backend='idb';
      const origProbe=Storage.probe;
      Storage.probe=async function(){return 'idb';};
      Storage._idbStore=idbStore;
    })();
  `,sandbox);
}

const W1={id:'w1',name:'Squat day',exercises:[{id:'e1',sets:[{weight:135,reps:5}]}]};

describe('IndexedDB migration (one-time, verified)',()=>{
  it('migrates the localStorage blob and keeps a renamed backup',async ()=>{
    const blob=JSON.stringify({version:1,savedAt:100,completed:[W1],templates:[],tags:[],exerciseTagPresets:[],archivedPrograms:[],customExercises:[],favorites:[]});
    const {sandbox,store}=loadPersistence({'workout-app:v1':blob});
    simulateIdb(sandbox);
    await vm.runInContext('restorePersisted()',sandbox);
    /* Backup kept under the renamed key. */
    assert.equal(store.get('workout-app:v1.ls-backup'),blob,'backup retained verbatim');
    /* The adapter now serves the blob (read-back verified byte-identical). */
    const back=await vm.runInContext('Storage.loadBlob("workout-app:v1")',sandbox);
    assert.equal(back,blob,'storage adapter serves the migrated blob');
    /* In-memory state reflects it. */
    const ids=vm.runInContext('workoutState.completed.map(w=>w.id)',sandbox);
    assert.deepEqual(ids,['w1']);
  });
  it('does not migrate twice — an existing backup means the migration ran',async ()=>{
    const blob=JSON.stringify({version:1,savedAt:100,completed:[W1],templates:[],tags:[],exerciseTagPresets:[],archivedPrograms:[],customExercises:[],favorites:[]});
    const {sandbox,store}=loadPersistence({'workout-app:v1.ls-backup':blob});
    simulateIdb(sandbox);
    await vm.runInContext('restorePersisted()',sandbox);
    /* No fresh migration attempt; backup untouched. */
    assert.equal(store.get('workout-app:v1.ls-backup'),blob);
    assert.equal(store.has('workout-app:v1'),false,'no stray new LS blob');
  });
});

describe('async persist + change detection',()=>{
  it('persistNow writes through the storage adapter',async ()=>{
    const {sandbox}=loadPersistence({});
    simulateIdb(sandbox);
    await vm.runInContext('restorePersisted()',sandbox);
    vm.runInContext('workoutState.completed.push('+JSON.stringify(W1)+')',sandbox);
    assert.equal(await vm.runInContext('persistNow()',sandbox),true);
    const back=await vm.runInContext('Storage.loadBlob("workout-app:v1")',sandbox);
    assert.ok(back.includes('w1'),'workout reached the adapter');
  });
  it('unchanged state skips the write (hash no-change detection)',async ()=>{
    const {sandbox}=loadPersistence({});
    simulateIdb(sandbox);
    await vm.runInContext('restorePersisted()',sandbox);
    vm.runInContext('workoutState.completed.push('+JSON.stringify(W1)+')',sandbox);
    assert.equal(await vm.runInContext('persistNow()',sandbox),true);
    const first=await vm.runInContext('Storage.loadBlob("workout-app:v1")',sandbox);
    /* Second persist with identical state: still "ok" but no rewrite. */
    assert.equal(await vm.runInContext('persistNow()',sandbox),true);
    const second=await vm.runInContext('Storage.loadBlob("workout-app:v1")',sandbox);
    assert.equal(second,first,'bytes unchanged across the no-op persist');
  });
});

describe('explicit wipe removes the migration backup',()=>{
  it('wipeLocalUserData deletes the ls-backup key too',async ()=>{
    const blob=JSON.stringify({version:1,savedAt:100,completed:[W1],templates:[],tags:[],exerciseTagPresets:[],archivedPrograms:[],customExercises:[],favorites:[]});
    const {sandbox,store}=loadPersistence({'workout-app:v1.ls-backup':blob});
    simulateIdb(sandbox);
    await vm.runInContext('restorePersisted()',sandbox);
    assert.equal(store.has('workout-app:v1.ls-backup'),true,'backup present before wipe');
    await vm.runInContext('wipeLocalUserData()',sandbox);
    assert.equal(store.has('workout-app:v1.ls-backup'),false,'backup gone after wipe');
    assert.equal(await vm.runInContext('Storage.loadBlob("workout-app:v1")',sandbox),null,'adapter blob gone');
  });
});

/* Public fork: DATA_SYNC_KEYS is gone with sync. PERSISTED_KEYS is the
   local persisted-key list (restore path) and deliberately includes UI
   prefs — nothing syncs, so the data-vs-UI split no longer exists. */
