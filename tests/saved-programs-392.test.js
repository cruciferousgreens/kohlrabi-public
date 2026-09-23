'use strict';
/* #392 (user 2026-09-13): saved programs — a "Saved programs" home above
   Archived in the Program tab. Shared programs land there instead of
   auto-archiving. The savedPrograms list must persist, restore, and sync
   like archivedPrograms; legacy blobs (no savedPrograms key) must not break. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const REPO_ROOT=path.join(__dirname,'..');

function loadPersistence(){
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
  /* Legacy in-memory shape: no savedPrograms yet (pre-#392 session). */
  sandbox.workoutState={completed:[],templates:[],tags:[],exerciseTagPresets:[],
    activeProgram:null,archivedPrograms:[],draft:null};
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
  vm.createContext(sandbox);
  const storageCode=fs.readFileSync(path.join(REPO_ROOT,'assets/js/core/storage.js'),'utf8');
  vm.runInContext(storageCode,sandbox,{filename:'assets/js/core/storage.js'});
  const code=fs.readFileSync(path.join(REPO_ROOT,'assets/js/core/persistence.js'),'utf8');
  vm.runInContext(code,sandbox,{filename:'assets/js/core/persistence.js'});
  return sandbox;
}

const prog={id:'sp1',name:'Shared Plan',length:4,workouts:[],shared:true};

describe('saved programs (#392)',()=>{
  it('PERSISTED_KEYS includes savedPrograms',()=>{
    const sb=loadPersistence();
    const keys=vm.runInContext('PERSISTED_KEYS',sb);
    assert.ok(keys.includes('savedPrograms'),'sync key list must contain savedPrograms');
  });
  it('collectPersistable() carries savedPrograms',()=>{
    const sb=loadPersistence();
    vm.runInContext('setPersistedValue("savedPrograms",[null])',sb); /* placeholder, replaced below */
    const blob=vm.runInContext('collectPersistable()',sb);
    assert.ok('savedPrograms' in blob,'persist blob must contain savedPrograms');
  });
  it('the sync get/set shims round-trip savedPrograms',()=>{
    const sb=loadPersistence();
    /* getSyncableValue must not throw on the legacy shape (no key yet). */
    assert.equal(vm.runInContext("JSON.stringify(getSyncableValue('savedPrograms'))",sb),'[]');
    vm.runInContext(`setPersistedValue('savedPrograms',${JSON.stringify([prog])})`,sb);
    assert.equal(vm.runInContext("JSON.stringify(getSyncableValue('savedPrograms'))",sb),JSON.stringify([prog]));
  });
  it('restorePersisted() leaves savedPrograms empty for legacy blobs',async ()=>{
    const sb=loadPersistence();
    const legacy=vm.runInContext('collectPersistable()',sb);
    delete legacy.savedPrograms; /* a pre-#392 blob */
    sb.localStorage.setItem(vm.runInContext('PERSIST_KEY',sb),JSON.stringify(legacy));
    await vm.runInContext('restorePersisted()',sb);
    assert.equal(vm.runInContext("JSON.stringify(getSyncableValue('savedPrograms'))",sb),'[]',
      'legacy blob must restore to an empty saved list, not crash');
  });
  it('restorePersisted() restores a savedPrograms list from the blob',async ()=>{
    const sb=loadPersistence();
    const blob=vm.runInContext('collectPersistable()',sb);
    blob.savedPrograms=[prog];
    sb.localStorage.setItem(vm.runInContext('PERSIST_KEY',sb),JSON.stringify(blob));
    await vm.runInContext('restorePersisted()',sb);
    assert.equal(vm.runInContext("JSON.stringify(getSyncableValue('savedPrograms'))",sb),JSON.stringify([prog]));
  });
});
