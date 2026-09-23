'use strict';
/* Role: progression-logic — pins #359: scheduled deloads apply to
   bodyweight (weight-0) exercises too. Before the fix the deload branch
   required latest.weight>0, so a deload week prescribed normal progression
   (rep + / load +) for bodyweight work. Bodyweight REP work scales the
   effort instead: reps drop to the deload %, never below the range floor.
   Timed bodyweight work is NEVER reduced (#285, user call): the seconds
   hold steady through a deload week, so the #79 no-change check suppresses
   the card and the workout keeps the latest target. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const {
  progressionForExercise, workoutState, progressionSetup,
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

describe('progressionForExercise — #359 bodyweight deloads',()=>{
  const BW_LOGS=()=>[mkLog('w1','2026-09-10',[
    mkItem('pullup',[{w:0,r:10,rpe:7}])])];
  it('deload week on a bodyweight exercise → kind deload, reps scaled to the deload %',()=>{
    workoutState.completed=BW_LOGS();
    const s=progressionForExercise('pullup',PROF(),
      {...CFG(),currentWeek:4,pctWave:true,weeklyDeloads:[false,false,false,true],deloadPct:60});
    assert.equal(s.kind,'deload');
    assert.equal(s.nextWeight,0);
    assert.equal(s.nextReps,6); // 10×0.6
    assert.match(s.reason,/Week 4 is a scheduled deload/);
    assert.match(s.reason,/bodyweight/);
  });
  it('deload week no longer prescribes progression for bodyweight (the bug)',()=>{
    workoutState.completed=BW_LOGS();
    const s=progressionForExercise('pullup',PROF(),
      {...CFG(),currentWeek:4,pctWave:true,weeklyDeloads:[false,false,false,true],deloadPct:60});
    assert.notEqual(s.kind,'reps');
    assert.notEqual(s.kind,'load');
  });
  it('non-deload week holds bodyweight at the rep ceiling (no load to add)',()=>{
    workoutState.completed=BW_LOGS();
    const s=progressionForExercise('pullup',PROF(),
      {...CFG(),currentWeek:3,pctWave:true,weeklyDeloads:[false,false,false,true]});
    // QA batch (user 2026-09-22): 10 @ RPE 7 → +3 would overshoot the 6–12
    // range, and the old code advanced the LOAD off a 0-lb basis — the
    // meaningless "Add weight" card. With no load to add, the engine holds
    // instead (#387 still forbids faking the rep jump down to stay inside
    // the range); #79 suppresses the no-change card and the workout keeps
    // the 10-rep target.
    assert.equal(s,null);
  });
  it('time-mode bodyweight deload never reduces seconds (#285) — no card, target holds',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('plank',[{w:0,seconds:60,rpe:7}],{tracking:'time'})])];
    const s=progressionForExercise('plank',
      {mode:'time',timeMin:30,timeMax:90},
      {...CFG(),currentWeek:4,pctWave:true,weeklyDeloads:[false,false,false,true],deloadPct:60});
    // Unweighted timed work holds steady on a deload week, so the #79
    // no-change check suppresses the suggestion (null) and the workout
    // keeps the latest 60s target — never 36s.
    assert.equal(s,null);
  });
  it('time-mode bodyweight still progresses on non-deload weeks',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('plank',[{w:0,seconds:60,rpe:7}],{tracking:'time'})])];
    const s=progressionForExercise('plank',
      {mode:'time',timeMin:30,timeMax:120},
      {...CFG(),currentWeek:3,pctWave:true,weeklyDeloads:[false,false,false,true]});
    assert.ok(s);
    assert.equal(s.kind,'time');
    assert.equal(s.nextSeconds,75); // 60 + 5s step × 3 (RPE 7 → +3)
  });
  it('all-sets bodyweight timed deload: back-off sets hold their seconds too',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('plank',[{w:0,seconds:60,rpe:7},{w:0,seconds:45,rpe:8}],{tracking:'time'})])];
    const s=progressionForExercise('plank',
      {mode:'time',timeMin:30,timeMax:120},
      {...CFG(),currentWeek:4,pctWave:true,weeklyDeloads:[false,false,false,true],deloadPct:60,progressAllSets:true});
    // Top set and back-off both hold → no set moves → no suggestion at all.
    assert.equal(s,null);
  });
  it('weighted deload behavior is unchanged (load still scales)',()=>{
    workoutState.completed=[mkLog('w1','2026-09-10',[
      mkItem('bench-press',[{w:140,r:8,rpe:7}])])];
    const s=progressionForExercise('bench-press',PROF(),
      {...CFG(),currentWeek:4,pctWave:true,weeklyDeloads:[false,false,false,true],deloadPct:60});
    assert.equal(s.kind,'deload');
    assert.equal(s.nextWeight,85); // 140×0.6=84 → snapped to 85
  });
});
