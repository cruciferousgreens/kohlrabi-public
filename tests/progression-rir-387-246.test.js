'use strict';
/* #387 (user 2026-09-14): rep jumps scale with RPE headroom — +2 at RPE 8,
   +3 at RPE 7, +4 at RPE 6 — never a token +1. Overshoot advances the load
   instead (existing load-increase/reset path). Timed work scales the time
   step by the same jump. #246 (user 2026-09-14): suggestion loads snap to
   the configured increment step, never decimals; "1 rep" not "1 reps". */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const role=loadRole('progression-logic',{globals:{exercises:[]}});
const {progressionForExercise,suggestionCardMarkup,workoutState,progressionSetup}=role;

const seed=(sets)=>{
  const item=mkItem('bench-press',sets,{progression:{mode:'reps',min:6,max:12}});
  workoutState.completed=[mkLog('w1','2026-09-10',[item])];
};
beforeEach(()=>{
  /* #577: linear is now the app default; these tests exercise RPE mechanics. */
  progressionSetup.scheme='rpe';
  progressionSetup.threshold=8;
  progressionSetup.progressionOff=false;
  progressionSetup.incrementType='lb';
  progressionSetup.incrementValue=5;
  progressionSetup.timeStep=5;
  workoutState.completed=[];
  workoutState.activeProgram=null;
});

describe('#387: RPE-headroom rep jumps',()=>{
  it('RPE 8 → +2 reps',()=>{
    seed([{w:100,r:8,rpe:8}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null);
    assert.equal(s.nextReps,10);
    assert.equal(s.kind,'reps');
  });
  it('RPE 7 → +3 reps',()=>{
    seed([{w:100,r:8,rpe:7}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null);
    assert.equal(s.nextReps,11);
    assert.equal(s.kind,'reps');
  });
  it('RPE 6 → +4 reps (capped by the range → load advances instead)',()=>{
    seed([{w:100,r:9,rpe:6}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null);
    // 9+4=13 > 12: overshoot → load increase, reset to range bottom.
    // RPE-scaled load (user 2026-09-19): RPE 6 → 2× → 100 + 10, not +5.
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,110);
    assert.equal(s.nextReps,6);
  });
  it('RPE 6 inside the range → +4 reps',()=>{
    seed([{w:100,r:6,rpe:6}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null);
    assert.equal(s.nextReps,10);
    assert.equal(s.kind,'reps');
  });
  it('minimum jump is 2 even at the trigger (RPE 9, threshold 9)',()=>{
    progressionSetup.threshold=9;
    seed([{w:100,r:8,rpe:9}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null);
    assert.equal(s.nextReps,10);
    assert.equal(s.kind,'reps');
  });
  it('open-top: jump applies without a ceiling',()=>{
    seed([{w:100,r:8,rpe:7}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:null,openTop:true},null);
    assert.equal(s.nextReps,11);
  });
  it('timed: time step scales by the jump (RPE 7 → 3×5s = 15s)',()=>{
    seed([{w:0,seconds:30,rpe:7}]);
    const s=progressionForExercise('bench-press',{mode:'time',timeMin:30,timeMax:90},null);
    assert.equal(s.nextSeconds,45);
    assert.equal(s.kind,'time');
  });
  it('timed: scaled step caps at the range top',()=>{
    seed([{w:0,seconds:85,rpe:6}]);
    const s=progressionForExercise('bench-press',{mode:'time',timeMin:30,timeMax:90},null);
    assert.equal(s.nextSeconds,90);
  });
});

describe('#246: increment snapping and grammar',()=>{
  it('snapToIncrement snaps to the configured step, never decimals',()=>{
    const {snapToIncrement}=role;
    assert.equal(snapToIncrement(108.6,'lb',5),110);
    assert.equal(snapToIncrement(107.3,'lb',5),105);
    assert.equal(snapToIncrement(108.6,'percent',2.5),110,'#473: percent snaps to the 5 lb grid');
    assert.equal(snapToIncrement(0,'lb',5),0);
  });
  it('snapUpToIncrement rounds up to the next grid multiple',()=>{
    const {snapUpToIncrement}=role;
    assert.equal(snapUpToIncrement(107.3,'lb',5),110);
    assert.equal(snapUpToIncrement(110,'lb',5),110,'exact multiples stay put');
    assert.equal(snapUpToIncrement(108.6,'percent',2.5),110,'#473: percent rounds up on the 5 lb grid');
  });
  it('a rebased load lands on the increment grid, never decimals',()=>{
    seed([{w:103.7,r:12,rpe:8}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:8,max:10},null);
    assert.equal(s.kind,'range');
    assert.ok(Number.isInteger(s.nextWeight),'no decimals: '+s.nextWeight);
    assert.equal(s.nextWeight%5,0,'on the 5-lb grid');
  });
  it('percent increments round to whole units, never decimals',()=>{
    progressionSetup.incrementType='percent';
    progressionSetup.incrementValue=2.5;
    seed([{w:103.7,r:12,rpe:8}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:8,max:10},null);
    assert.ok(Number.isInteger(s.nextWeight),'no decimals: '+s.nextWeight);
  });
  it('suggestion cards read "1 rep", not "1 reps"',()=>{
    const html=suggestionCardMarkup({
      exerciseId:'bench-press',kind:'reps',freeform:true,
      mode:'reps',amrap:false,
      latest:{weight:100,reps:8},
      nextWeight:100,nextReps:1,nextSeconds:0,
    },0,false);
    assert.ok(html.includes('1 rep'),'singular for 1');
    assert.ok(!html.includes('1 reps'),'no "1 reps"');
  });
  it('plural targets are untouched',()=>{
    const html=suggestionCardMarkup({
      exerciseId:'bench-press',kind:'reps',freeform:true,
      mode:'reps',amrap:false,
      latest:{weight:100,reps:8},
      nextWeight:100,nextReps:11,nextSeconds:0,
    },0,false);
    assert.ok(html.includes('11 reps'),'plural stays plural');
  });
});

describe('#246 audit: every formula-derived load snaps to the increment grid',()=>{
  const CFG=(over={})=>({scheme:'rpe',threshold:8,incrementType:'lb',incrementValue:5,timeStep:5,...over});
  it('linear scheme: the increment lands on the grid',()=>{
    seed([{w:103.7,r:8,rpe:8}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12,scheme:'linear'},CFG());
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,110); // 103.7+5=108.7 → 5-lb grid
  });
  it('double-progression overshoot: the load increase lands on the grid',()=>{
    seed([{w:103.7,r:11,rpe:8}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},CFG());
    assert.equal(s.kind,'load'); // 11+3=14 > 12 → load path
    assert.equal(s.nextWeight,110);
    assert.ok(Number.isInteger(s.nextWeight),'no decimals');
  });
  it('timed ceiling: the load increase lands on the grid',()=>{
    seed([{w:103.7,seconds:60,rpe:8}]);
    const s=progressionForExercise('bench-press',{mode:'time',timeMin:30,timeMax:60},CFG());
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,110);
    assert.equal(s.nextSeconds,30);
  });
  it('deloads snap to the increment grid, not plates',()=>{
    seed([{w:103.7,r:8,rpe:7}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},
      CFG({incrementValue:2.5,currentWeek:4,pctWave:true,weeklyDeloads:[false,false,false,true],deloadPct:60}));
    assert.equal(s.kind,'deload');
    assert.equal(s.nextWeight,62.5); // 103.7×0.6=62.22 → 2.5-lb grid (plates would give 60)
  });
  it('%1RM prescriptions snap to the increment grid, not plates',()=>{
    const s=progressionForExercise('bench-press',
      {scheme:'onerm',trainingMax:203,percentOf1RM:80,min:6,max:12},
      CFG({incrementValue:2.5}));
    assert.equal(s.kind,'onerm');
    assert.equal(s.nextWeight,162.5); // 203×0.8=162.4 → 2.5-lb grid (plates would give 160)
  });
  it('percent increments land on the 5 lb grid (#473)',()=>{
    seed([{w:103.7,r:8,rpe:8}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12,scheme:'linear'},
      CFG({incrementType:'percent',incrementValue:2.5}));
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,105); // 103.7×1.025=106.29 → 5 lb grid
    assert.ok(Math.abs(s.nextWeight/5-Math.round(s.nextWeight/5))<1e-9,'on the grid');
  });
});
