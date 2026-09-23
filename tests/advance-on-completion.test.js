'use strict';
/* #565 (user 2026-09-19): "Advance on completion" — a Settings → Progression
   defaults option. When on, finishing the sets is the progression trigger:
   RPE never blocks a suggestion and missing RPE reads as the conservative
   trigger-sized step. When off, the #565 informational notice behavior is
   preserved. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const role=loadRole('progression-logic',{
  globals:{exercises:[{id:'bench-press',name:'Bench Press'},{id:'run',name:'Run',metrics:['load','distance']}]},
});
const {progressionForExercise,workoutState,progressionSetup}=role;

const CFG=()=>({scheme:'rpe',threshold:8,incrementType:'lb',incrementValue:5,timeStep:5});
const ON=()=>({...CFG(),advanceOnCompletion:true});
const repsProfile={mode:'reps',min:6,max:12};
const distProfile={mode:'distance',distanceTarget:5000};
beforeEach(()=>{
  /* #577: linear is now the app default; these tests exercise RPE mechanics. */
  progressionSetup.scheme='rpe';workoutState.completed=[];workoutState.activeProgram=null;progressionSetup.units='imperial';});

describe('#565: advance-on-completion advances without RPE',()=>{
  it('no RPE advances with the conservative trigger-sized jump and says so',()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('bench-press',[{w:100,r:8}],{progression:repsProfile})])];
    const s=progressionForExercise('bench-press',repsProfile,ON());
    assert.ok(s,'suggestion is not suppressed');
    assert.equal(s.kind,'reps');
    assert.equal(s.nextReps,10,'trigger-sized jump: 8 + 2, not a headroom jump');
    assert.ok(!s.notice,'no "No RPE logged" notice when completion drives');
    assert.ok(s.reason.includes('Advancing on completion'),'reason says completion drove it: '+s.reason);
  });
  it('a high RPE is ignored when the setting is on',()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('bench-press',[{w:100,r:8,rpe:10}],{progression:repsProfile})])];
    const s=progressionForExercise('bench-press',repsProfile,ON());
    assert.ok(s&&s.kind==='reps','RPE 10 does not block: '+JSON.stringify(s&&s.kind));
    assert.equal(s.nextReps,10);
    assert.ok(s.reason.includes('Advancing on completion'),'reason says completion drove it');
  });
  it('RPE 0 advances when the setting is on (not the #497 hold)',()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('bench-press',[{w:100,r:8,rpe:0}],{progression:repsProfile})])];
    const s=progressionForExercise('bench-press',repsProfile,ON());
    assert.ok(s&&s.kind==='reps','RPE 0 advances with the setting on: '+JSON.stringify(s&&s.kind));
    assert.equal(s.nextReps,10,'conservative jump, never the 10-RIR jump');
  });
  it('distance mode advances on missing RPE when the setting is on',()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('run',[{w:90,distance:5000}],{progression:distProfile})])];
    const s=progressionForExercise('run',distProfile,ON());
    assert.ok(s&&s.kind==='load'&&s.nextWeight===95,'sled advances without RPE: '+JSON.stringify(s&&{kind:s.kind,nextWeight:s.nextWeight}));
    assert.ok(s.reason.includes('Advancing on completion'),'reason says completion drove it');
  });
});

describe('#565: setting off preserves the informational notice',()=>{
  it('no RPE holds with the "No RPE logged" notice',()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('bench-press',[{w:100,r:8}],{progression:repsProfile})])];
    const s=progressionForExercise('bench-press',repsProfile,CFG());
    assert.ok(s,'suggestion is not suppressed');
    assert.equal(s.kind,'hold');
    assert.ok(s.notice,'notice present');
    assert.equal(s.notice.title,'No RPE logged');
  });
  it('RPE 0 advances with the setting off too (#497 removed)',()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('bench-press',[{w:100,r:8,rpe:0}],{progression:repsProfile})])];
    const s=progressionForExercise('bench-press',repsProfile,CFG());
    assert.ok(s&&s.kind==='reps','RPE 0 advances with the setting off: '+JSON.stringify(s&&s.kind));
    assert.equal(s.nextReps,10,'trigger-sized jump, not the 10-RIR jump');
  });
  it('distance mode advances on RPE 0 with the setting off (pins the #551 revert)',()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('run',[{w:90,distance:5000,rpe:0}],{progression:distProfile})])];
    const s=progressionForExercise('run',distProfile,CFG());
    assert.ok(s&&s.kind==='load'&&s.nextWeight===95,'RPE 0 advances in distance mode: '+JSON.stringify(s&&{kind:s.kind,nextWeight:s.nextWeight}));
  });
});

/* QA batch (user 2026-09-22): "Advance on completion" is now the fourth
   RPE-threshold choice ("On completion", stored as threshold:'completion') —
   the standalone toggle is gone. normalizeProgression and
   DEFAULT_PROGRESSION_SETUP ride on the already-loaded progression-logic
   role (no second loadRole — extra roles disturb shared global state). */
const {normalizeProgression,DEFAULT_PROGRESSION_SETUP}=role;

describe("QA batch 2026-09-22: threshold 'completion' replaces the toggle",()=>{
  const COMPLETION=()=>({...CFG(),threshold:'completion'});
  it("threshold 'completion' behaves like the legacy advanceOnCompletion flag",()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('bench-press',[{w:100,r:8}],{progression:repsProfile})])];
    const s=progressionForExercise('bench-press',repsProfile,COMPLETION());
    assert.ok(s,'suggestion is not suppressed');
    assert.equal(s.kind,'reps');
    assert.equal(s.nextReps,10,'trigger-sized jump with default-8 sizing');
    assert.ok(!s.notice,'no "No RPE logged" notice when completion drives');
    assert.ok(s.reason.includes('Advancing on completion'),'reason says completion drove it: '+s.reason);
  });
  it("a high RPE is ignored with threshold 'completion'",()=>{
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('bench-press',[{w:100,r:8,rpe:10}],{progression:repsProfile})])];
    const s=progressionForExercise('bench-press',repsProfile,COMPLETION());
    assert.ok(s&&s.kind==='reps','RPE 10 does not block: '+JSON.stringify(s&&s.kind));
    assert.equal(s.nextReps,10);
  });
});

describe('QA batch 2026-09-22: advanceOnCompletion flag migration',()=>{
  it('advanceOnCompletion:true migrates to threshold completion',()=>{
    const p={threshold:8,advanceOnCompletion:true};
    normalizeProgression(p);
    assert.equal(p.threshold,'completion');
    assert.ok(!('advanceOnCompletion' in p),'legacy flag is removed');
  });
  it('advanceOnCompletion:false leaves a numeric threshold alone',()=>{
    const p={threshold:7,advanceOnCompletion:false};
    normalizeProgression(p);
    assert.equal(p.threshold,7);
    assert.ok(!('advanceOnCompletion' in p),'legacy flag is removed');
  });
  it("junk thresholds coerce to 8; 'completion' survives",()=>{
    const p={threshold:'bogus'};
    normalizeProgression(p);
    assert.equal(p.threshold,8);
    const q={threshold:'completion'};
    normalizeProgression(q);
    assert.equal(q.threshold,'completion');
  });
  it('fresh defaults carry no advanceOnCompletion flag',()=>{
    assert.ok(!('advanceOnCompletion' in DEFAULT_PROGRESSION_SETUP));
  });
});
