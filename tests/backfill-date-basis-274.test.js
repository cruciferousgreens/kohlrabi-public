'use strict';
/* #274 (user 2026-09-13): suggestions and exercise-history "latest" must key
   off most-recently-DONE (workout date), not most-recently-logged. A new
   finish stamps completedAt=now even when the workout date is set months in
   the past — that backfilled session must NOT become the suggestion basis. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const {
  getExerciseLogs, progressionForExercise, workoutState, progressionSetup,
}=loadRole('progression-logic');

const CFG=()=>({scheme:'rpe',threshold:8,incrementType:'lb',incrementValue:5,timeStep:5});
const PROF=()=>({mode:'reps',min:6,max:12});

beforeEach(()=>{
  /* #577: linear is now the app default; these tests exercise RPE mechanics. */
  progressionSetup.scheme='rpe';
  workoutState.completed=[];
  workoutState.activeProgram=null;
  progressionSetup.units='imperial';
});

function backfilledLog(id,date,loggedAt,items){
  const log=mkLog(id,date,items);
  log.completedAt=loggedAt; /* backfilled: logged days after the workout date */
  return log;
}

describe('#274 backfilled past-date workouts do not hijack latest',()=>{
  it('getExerciseLogs orders most-recently-DONE first, not most-recently-logged',()=>{
    workoutState.completed=[
      backfilledLog('old','2026-07-01','2026-09-13T12:00:00',[
        mkItem('bench-press',[{w:100,r:5,rpe:7}])]),
      mkLog('recent','2026-09-10',[
        mkItem('bench-press',[{w:140,r:8,rpe:7}])]),
    ];
    const logs=getExerciseLogs('bench-press');
    assert.equal(logs.length,2);
    assert.equal(logs[0].workoutId,'recent');
    assert.equal(logs[1].workoutId,'old');
  });
  it('progressionForExercise bases the suggestion on the most-recently-DONE session',()=>{
    workoutState.completed=[
      backfilledLog('old','2026-07-01','2026-09-13T12:00:00',[
        mkItem('bench-press',[{w:100,r:5,rpe:7}])]),
      mkLog('recent','2026-09-10',[
        mkItem('bench-press',[{w:140,r:8,rpe:7}])]),
    ];
    const s=progressionForExercise('bench-press',PROF(),CFG());
    /* 140x8 @ RPE 7 → add three reps (11, #387), not the backfilled 100x5 basis. */
    assert.equal(s.kind,'reps');
    assert.equal(s.nextWeight,140);
    assert.equal(s.nextReps,11);
  });
  it('same-day tie still breaks by completedAt (sync-union chronology)',()=>{
    workoutState.completed=[
      mkLog('a','2026-09-10',[mkItem('bench-press',[{w:140,r:8,rpe:7}])]),
    ];
    const later=mkLog('b','2026-09-10',[mkItem('bench-press',[{w:145,r:8,rpe:7}])]);
    later.completedAt='2026-09-10T18:00:00';
    workoutState.completed[0].completedAt='2026-09-10T09:00:00';
    workoutState.completed.push(later);
    const logs=getExerciseLogs('bench-press');
    assert.equal(logs[0].workoutId,'b');
  });
});
