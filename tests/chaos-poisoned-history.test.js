'use strict';
/* Persona 8 chaos sweep (2026-09-15): a single poisoned entry in
   workoutState.completed (null workout, non-array exercises, null item,
   null set entry, garbage date string, or a non-array `completed` at all)
   used to throw uncaught out of getExerciseLogs — breaking suggestions,
   editor history, and exercise detail app-wide. Reachable via corrupted
   localStorage or poisoned sync rows. These pins prove every poison shape
   is skipped at read time and valid entries still come through byte-
   identical to before. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkSet,mkItem,mkLog}=require('./fixtures/logs');

const {getExerciseLogs, formatLogDate, workoutState}=loadRole('exercise-detail-logic',{
  globals:{exercises:[{id:'bench-press',name:'Bench Press',equipment:'barbell'}]},
});

const EX='bench-press';
const goodLog=()=>mkLog('good','2026-09-10',[mkItem(EX,[{w:135,r:5,rpe:8}])],'Chest day');

beforeEach(()=>{workoutState.completed=[];});

describe('getExerciseLogs skips poisoned completed entries',()=>{
  const poisons={
    'null workout':[null],
    'exercises null':[{id:'x',date:'2026-09-10',exercises:null}],
    'exercises string':[{id:'x',date:'2026-09-10',exercises:'nope'}],
    'null item':[{id:'x',date:'2026-09-10',exercises:[null]}],
    'null set entry':[{id:'x',date:'2026-09-10',
      exercises:[{exerciseId:EX,tracking:'reps',sets:[{w:135,r:5,rpe:8},null]}]}],
    'sets null':[{id:'x',date:'2026-09-10',
      exercises:[{exerciseId:EX,tracking:'reps',sets:null}]}],
    'sets string':[{id:'x',date:'2026-09-10',
      exercises:[{exerciseId:EX,tracking:'reps',sets:'nope'}]}],
    'garbage date':[{id:'x',date:'soon',exercises:[{exerciseId:EX,sets:[{w:135,r:5}]}]}],
  };
  for(const [label,completed] of Object.entries(poisons)){
    it(`does not throw on ${label}`,()=>{
      workoutState.completed=completed;
      assert.doesNotThrow(()=>getExerciseLogs(EX));
    });
  }
  it('does not throw when completed is not an array',()=>{
    workoutState.completed='oops';
    assert.doesNotThrow(()=>getExerciseLogs(EX));
    assert.deepEqual(getExerciseLogs(EX),[]);
  });
  it('keeps valid entries and drops only the poison',()=>{
    workoutState.completed=[null,{id:'x',date:'soon',exercises:'nope'},goodLog(),
      {id:'y',date:'2026-09-11',exercises:[null]}];
    const logs=getExerciseLogs(EX);
    assert.equal(logs.length,1);
    assert.equal(logs[0].workoutId,'good');
  });
  it('happy path is unchanged: sets mapped, tracking defaulted',()=>{
    workoutState.completed=[goodLog()];
    const logs=getExerciseLogs(EX);
    assert.equal(logs.length,1);
    const log=logs[0];
    assert.equal(log.date,'Sep 10, 2026');
    assert.equal(log.isoDate,'2026-09-10');
    assert.equal(log.tracking,'reps');
    assert.deepEqual(log.sets,[{w:135,r:5,seconds:null,distance:null,rpe:8,tags:[]}]);
  });
  it('time tracking is still detected when a null set entry is dropped',()=>{
    workoutState.completed=[{id:'x',date:'2026-09-10',exercises:[{
      exerciseId:EX,sets:[null,{w:'',r:'',seconds:60,rpe:null,tags:[]}]}]}];
    const logs=getExerciseLogs(EX);
    assert.equal(logs.length,1);
    assert.equal(logs[0].tracking,'time');
    assert.equal(logs[0].sets.length,1);
  });
});

describe('formatLogDate degrades on garbage dates',()=>{
  it('returns empty string for unparseable dates',()=>{
    assert.equal(formatLogDate('soon'),'');
    assert.equal(formatLogDate('not-a-date'),'');
  });
  it('unchanged for blank and valid inputs',()=>{
    assert.equal(formatLogDate(''),'');
    assert.equal(formatLogDate(null),'');
    assert.equal(formatLogDate('2026-09-10'),'Sep 10, 2026');
  });
});
