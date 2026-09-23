'use strict';
/* #383 (user 2026-09-13): the "To failure" set tag is now "Failure". Pins
   the renamed preset and the boot migration that remaps the tag on every
   set that carries it (logs, templates, live draft, saved builder,
   programs) plus the tag list itself. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');

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
  return sandbox;
}
function blob(){
  return {version:1,
    tags:['Warmup','To failure','Dropset'],
    completed:[{id:'c1',exercises:[{exerciseId:'bench',sets:[{tags:['To failure']},{tags:['To failure','Failure']},{tags:['Paused']}]}]}],
    templates:[{id:'t1',exercises:[{exerciseId:'row',sets:[{tags:['To failure']}]}]}],
    draft:{exercises:[{exerciseId:'ohp',sets:[{tags:['To failure']}]}]},
    savedBuilder:{exercises:[{exerciseId:'curl',sets:[{tags:['To failure']}]}]},
    activeProgram:{name:'P',workouts:[{uid:'w1',template:{exercises:[{exerciseId:'squat',sets:[{tags:['To failure']}]}]}}]},
    archivedPrograms:[{name:'Old',workouts:[{uid:'w9',template:{exercises:[{exerciseId:'dip',sets:[{tags:['To failure']}]}]}}]}],
  };
}

describe('#383 Failure tag preset',()=>{
  it('DEFAULT_SET_TAGS carries Failure, not To failure',()=>{
    const src=fs.readFileSync(path.join(ROOT,'assets/js/core/state.js'),'utf8');
    const line=src.split('\n').find(l=>l.includes('DEFAULT_SET_TAGS='));
    assert.ok(line,'preset line found');
    const list=line.slice(0,line.indexOf(']')+1);
    assert.ok(list.includes("'Failure'"),'Failure preset present');
    assert.ok(!list.includes("'To failure'"),'To failure preset gone');
  });
});

describe('#383 set-tag-failure-rename migration',()=>{
  /* Arrays built inside the vm sandbox are not reference-equal to host
     arrays under assert/strict — compare through JSON. */
  const norm=v=>JSON.parse(JSON.stringify(v));
  it('remaps the tag list and every set that carries it, deduping',()=>{
    const sb=loadPersistence();
    sb.data=blob();
    vm.runInContext('runBlobMigrations(data)',sb);
    const d=sb.data;
    assert.deepEqual(norm(d.tags),['Warmup','Failure','Dropset']);
    assert.deepEqual(norm(d.completed[0].exercises[0].sets[0].tags),['Failure']);
    assert.deepEqual(norm(d.completed[0].exercises[0].sets[1].tags),['Failure'],'both tags collapse to one Failure');
    assert.deepEqual(norm(d.completed[0].exercises[0].sets[2].tags),['Paused'],'unrelated tags untouched');
    assert.deepEqual(norm(d.templates[0].exercises[0].sets[0].tags),['Failure']);
    assert.deepEqual(norm(d.draft.exercises[0].sets[0].tags),['Failure']);
    assert.deepEqual(norm(d.savedBuilder.exercises[0].sets[0].tags),['Failure']);
    assert.deepEqual(norm(d.activeProgram.workouts[0].template.exercises[0].sets[0].tags),['Failure']);
    assert.deepEqual(norm(d.archivedPrograms[0].workouts[0].template.exercises[0].sets[0].tags),['Failure']);
  });
  it('a blob without the legacy tag passes through unchanged',()=>{
    const sb=loadPersistence();
    sb.data={version:1,tags:['Failure'],completed:[],templates:[]};
    vm.runInContext('runBlobMigrations(data)',sb);
    assert.deepEqual(norm(sb.data.tags),['Failure']);
  });
});
