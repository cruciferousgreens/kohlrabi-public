'use strict';
/* Role: stats-toggle-persistence (#357, user 2026-09-13).
   The three Stats Volume|Sets segmented controls (muscle breakdown, top
   exercises, muscle map) must behave consistently: all session-only, never
   persisted. The Top-exercises toggle's old schedulePersist was the odd one
   out — these tests pin that topExercisesMode is absent from the persist
   blob, the localStorage restore path, and the sync key list, so a future
   re-add fails loudly. */
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
    // Minimal DOM helper stub: persistence.js wires click handlers at load.
    $:function(){return null;},
    setTimeout:setTimeout,clearTimeout:clearTimeout,
    // 5s autosave interval: stubbed to a no-op so tests don't hang.
    setInterval:function(){return 0;},clearInterval:function(){},
    Date:Date,JSON:JSON,Math:Math,Number:Number,String:String,Array:Array,
    Object:Object,Map:Map,Set:Set,Promise:Promise,isFinite:isFinite,isNaN:isNaN,
  };
  sandbox.globalThis=sandbox;
  sandbox.workoutState={completed:[],templates:[],tags:[],exerciseTagPresets:[],
    activeProgram:null,archivedPrograms:[],draft:null};
  sandbox.state={customExercises:[],favorites:new Set(),muscles:new Set(),
    savedBuilder:null,savedFilter:null,dashboardPeriod:'week',statsPeriod:'week',
    logPeriod:'week',topExercisesMode:'sets',muscleVolumeMode:'sets',muscleMapMode:'sets'};
  sandbox.exercises=[];
  sandbox.progressionSetup={};
  // restorePersisted() may merge templates via the app's template factory.
  sandbox.cloneWorkoutTemplates=function(){return [];};
  // Tag-list merges in setPersistedValue need the set-tags module's globals.
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

describe('stats toggle persistence (#357)',()=>{
  it('collectPersistable() carries no topExercisesMode key',()=>{
    const sb=loadPersistence();
    const blob=vm.runInContext('collectPersistable()',sb);
    assert.ok(!('topExercisesMode' in blob),'blob must not contain topExercisesMode');
  });
  it('PERSISTED_KEYS excludes topExercisesMode',()=>{
    const sb=loadPersistence();
    const keys=vm.runInContext('PERSISTED_KEYS',sb);
    assert.ok(!keys.includes('topExercisesMode'),'sync key list must not contain topExercisesMode');
  });
  it('the sync get/set shims ignore topExercisesMode',()=>{
    const sb=loadPersistence();
    assert.equal(vm.runInContext("getSyncableValue('topExercisesMode')",sb),undefined);
    vm.runInContext("setPersistedValue('topExercisesMode','sets')",sb);
    assert.equal(vm.runInContext('state.topExercisesMode',sb),'sets',
      'unknown key must leave live state untouched');
  });
  it('restorePersisted() does not resurrect a legacy topExercisesMode value',()=>{
    const sb=loadPersistence();
    const legacy=vm.runInContext('collectPersistable()',sb);
    legacy.topExercisesMode='sets'; /* a pre-#357 blob still carrying the key */
    sb.localStorage.setItem(vm.runInContext('PERSIST_KEY',sb),JSON.stringify(legacy));
    vm.runInContext("state.topExercisesMode='volume'",sb);
    vm.runInContext('restorePersisted()',sb);
    assert.equal(vm.runInContext('state.topExercisesMode',sb),'volume',
      'legacy persisted value must not override live state');
  });
});
