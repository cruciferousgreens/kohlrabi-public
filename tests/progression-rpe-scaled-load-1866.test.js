'use strict';
/* RPE-scaled load increments (user 2026-09-19, approved as proposed): on the
   RPE-scheme add-load-and-reset paths (reps mode and timed-ceiling mode), the
   base increment scales by m = 1 + headroom/2, capped at 2×, where headroom =
   trigger − RPE. RPE 8 @ trigger 8 → 1×; RPE 7 → 1.5×; RPE 6 or lower → 2×
   cap; fractional RPEs work naturally (7.5 → 1.25×). Excluded: %1RM, linear,
   reps-only (moot), distance. RPE ≤ 0 and completion mode → 1×, never scaled.
   When m > 1 the reason gains one plain line; snapping/guards are untouched. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const role=loadRole('progression-logic',{
  globals:{exercises:[{id:'bench-press',name:'Bench Press'},{id:'plank',name:'Plank'},{id:'run',name:'Run',metrics:['load','distance']}]},
});
const {progressionForExercise,workoutState,progressionSetup}=role;

const CFG=(inc)=>({scheme:'rpe',threshold:8,incrementType:'lb',incrementValue:inc||5,timeStep:5});
const ON=(inc)=>({...CFG(inc),advanceOnCompletion:true});
const repsProfile={mode:'reps',min:6,max:12};
const timeProfile={mode:'time',timeMin:30,timeMax:60,timeStep:5};
const distProfile={mode:'distance',distanceTarget:5000};
beforeEach(()=>{
  /* #577: linear is now the app default; these tests exercise RPE mechanics. */
  progressionSetup.scheme='rpe';workoutState.completed=[];workoutState.activeProgram=null;progressionSetup.units='imperial';});

/* The load branch is reached when the rep jump would overshoot the range top:
   100 × 12 in a 6–12 range, so any advancing RPE takes the add-load-and-reset path. */
const loadBranchLog=(sets,opts)=>mkLog('w1','2026-09-12',[mkItem('bench-press',sets,{progression:repsProfile,...(opts||{})})]);

describe('RPE-scaled load increments: multipliers',()=>{
  it('h=0 (RPE 8 @ trigger 8) → 1×: flat step, no scaled line',()=>{
    workoutState.completed=[loadBranchLog([{w:100,r:12,rpe:8}])];
    const s=progressionForExercise('bench-press',repsProfile,CFG());
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,105,'flat 5 lb step');
    assert.equal(s.nextReps,6);
    assert.ok(!s.reason.includes('under the RPE trigger'),'no scaled line at 1×: '+s.reason);
  });
  it('h=1 (RPE 7) → 1.5×: 10 lb base becomes a 15 lb step, snapped to the 10 lb grid',()=>{
    workoutState.completed=[loadBranchLog([{w:100,r:12,rpe:7}])];
    const s=progressionForExercise('bench-press',repsProfile,CFG(10));
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,120,'100 + 15 snapped to the configured 10 lb grid');
    assert.ok(s.reason.includes('1 under the RPE trigger'),'headroom line: '+s.reason);
    assert.ok(s.reason.includes('1.5×'),'multiplier named: '+s.reason);
    assert.ok(s.reason.includes('to 20 lb'),'final grid-snapped step named honestly: '+s.reason);
  });
  it('h=2 (RPE 6) → 2×: doubled jump',()=>{
    workoutState.completed=[loadBranchLog([{w:100,r:12,rpe:6}])];
    const s=progressionForExercise('bench-press',repsProfile,CFG(10));
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,120,'100 + 2×10 lb');
    assert.ok(s.reason.includes('2 under the RPE trigger'),'headroom line: '+s.reason);
    assert.ok(s.reason.includes('doubled'),'doubled wording: '+s.reason);
    assert.ok(s.reason.includes('to 20 lb'),'final step named: '+s.reason);
  });
  it('h=3 (RPE 5) → still 2×: the cap holds',()=>{
    workoutState.completed=[loadBranchLog([{w:100,r:12,rpe:5}])];
    const s=progressionForExercise('bench-press',repsProfile,CFG(10));
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,120,'capped at 2×, not 2.5×');
    assert.ok(s.reason.includes('doubled'),'cap wording: '+s.reason);
  });
  it('fractional RPE 7.5 → 1.25×, still on the increment grid',()=>{
    workoutState.completed=[loadBranchLog([{w:100,r:12,rpe:7.5}])];
    const s=progressionForExercise('bench-press',repsProfile,CFG(10));
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,110,'100 + 12.5 snapped to the 10 lb grid');
    assert.ok(s.reason.includes('1.25×'),'fractional multiplier named: '+s.reason);
  });
  it('timed-ceiling mode scales too',()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('plank',[{w:100,seconds:60,rpe:6}],{tracking:'time',progression:timeProfile})])];
    const s=progressionForExercise('plank',timeProfile,CFG(10));
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,120,'100 + 2×10 lb');
    assert.equal(s.nextSeconds,30,'reset to the time floor');
    assert.ok(s.reason.includes('doubled'),'scaled line on the timed path: '+s.reason);
  });
});

describe('RPE-scaled load increments: never scaled',()=>{
  it('RPE 0 → 1×, never scaled',()=>{
    workoutState.completed=[loadBranchLog([{w:100,r:12,rpe:0}])];
    const s=progressionForExercise('bench-press',repsProfile,CFG());
    assert.equal(s.kind,'load','RPE 0 still advances');
    assert.equal(s.nextWeight,105,'flat 5 lb step');
    assert.ok(!s.reason.includes('under the RPE trigger'),'no scaled line at RPE 0: '+s.reason);
  });
  it('completion mode → 1× even when completion drives the jump',()=>{
    workoutState.completed=[loadBranchLog([{w:100,r:12}])]; /* no RPE: completion drives */
    const s=progressionForExercise('bench-press',repsProfile,ON());
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,105,'flat 5 lb step under advance-on-completion');
    assert.ok(s.reason.includes('Advancing on completion'),'completion drove it: '+s.reason);
    assert.ok(!s.reason.includes('under the RPE trigger'),'no scaled line in completion mode: '+s.reason);
  });
  it('%1RM mode is excluded',()=>{
    workoutState.completed=[loadBranchLog([{w:100,r:12,rpe:6}])];
    const s=progressionForExercise('bench-press',{scheme:'onerm',trainingMax:200,percentOf1RM:80,min:6,max:12},CFG());
    assert.equal(s.kind,'onerm');
    assert.equal(s.nextWeight,160,'the %1RM prescription, unscaled');
    assert.ok(!s.reason.includes('under the RPE trigger'),'no scaled line in %1RM mode: '+s.reason);
  });
  it('linear mode is excluded',()=>{
    workoutState.completed=[loadBranchLog([{w:100,r:12,rpe:6}])];
    const s=progressionForExercise('bench-press',{...repsProfile,scheme:'linear'},CFG());
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,105,'flat 5 lb step every session');
    assert.ok(!s.reason.includes('under the RPE trigger'),'no scaled line in linear mode: '+s.reason);
  });
  it('distance mode stays on the flat base increment',()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('run',[{w:90,distance:5000,rpe:6}],{progression:distProfile})])];
    const s=progressionForExercise('run',distProfile,CFG());
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,95,'flat 5 lb step at 5000 m');
    assert.ok(!s.reason.includes('under the RPE trigger'),'no scaled line in distance mode: '+s.reason);
  });
});
