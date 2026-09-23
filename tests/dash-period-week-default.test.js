'use strict';
/* (user 2026-09-14): Home → At a glance now defaults to Week, not Today.
   Fresh installs already get 'week' from freshNavState; this pins the
   one-shot boot migration that moves existing 'today' blobs to 'week'
   without touching an explicit Today choice made afterwards. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');
const MARK='workout-app:dash-week-default';

function loadPersistence(){
  const src=fs.readFileSync(path.join(ROOT,'assets/js/core/persistence.js'),'utf8');
  const store={};
  const sandbox={
    window:{addEventListener(){}},
    localStorage:{
      getItem(k){return Object.prototype.hasOwnProperty.call(store,k)?store[k]:null;},
      setItem(k,v){store[k]=String(v);},
      removeItem(k){delete store[k];},
      key(i){return Object.keys(store)[i]||null;},
      get length(){return Object.keys(store).length;},
    },
    $(){return null;},
    setTimeout(){return 0;},clearTimeout(){},
    setInterval(){return 0;},clearInterval(){},
    cloneWorkoutTemplates(){return [];},
    DEFAULT_SET_TAGS:[],DEFAULT_EXERCISE_TAG_PRESETS:[],
    document:{},
    'ADOPTED_UID_KEY':'adopted-uid',
    workoutState:{completed:[],templates:[],tags:[],exerciseTagPresets:[],draft:null,activeProgram:null,archivedPrograms:[]},
    state:{customExercises:[],favorites:new Set(),muscles:new Set(),savedBuilder:null},
    exercises:[],
    progressionSetup:{},
    resetProgressionSetup(){},
  };
  vm.createContext(sandbox);
  vm.runInContext(src,sandbox,{filename:'persistence.js'});
  return {sandbox,store};
}

describe('at-a-glance week-default migration',()=>{
  it('moves a persisted today default to week, once',()=>{
    const {sandbox,store}=loadPersistence();
    sandbox.data={version:1,dashboardPeriod:'today',completed:[],templates:[]};
    vm.runInContext('runBlobMigrations(data)',sandbox);
    assert.equal(sandbox.data.dashboardPeriod,'week');
    assert.equal(store[MARK],'1','one-shot marker set');
  });
  it('leaves other periods alone',()=>{
    for(const p of ['month','year','all','week']){
      const {sandbox}=loadPersistence();
      sandbox.data={version:1,dashboardPeriod:p,completed:[],templates:[]};
      vm.runInContext('runBlobMigrations(data)',sandbox);
      assert.equal(sandbox.data.dashboardPeriod,p,`period ${p} untouched`);
    }
  });
  it('does not override an explicit Today re-tap after the migration ran',()=>{
    const {sandbox,store}=loadPersistence();
    store[MARK]='1';
    sandbox.data={version:1,dashboardPeriod:'today',completed:[],templates:[]};
    vm.runInContext('runBlobMigrations(data)',sandbox);
    assert.equal(sandbox.data.dashboardPeriod,'today','deliberate Today choice kept');
  });
  it('a blob without a stored period is untouched',()=>{
    const {sandbox}=loadPersistence();
    sandbox.data={version:1,completed:[],templates:[]};
    vm.runInContext('runBlobMigrations(data)',sandbox);
    assert.equal(sandbox.data.dashboardPeriod,undefined);
  });
});
