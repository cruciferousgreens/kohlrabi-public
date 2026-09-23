'use strict';
/* #431 (user 2026-09-13): opening a program workout showed the right focus
   pill (the program week's range) but suggestions computed for the WRONG
   range. Root cause: doStartProgramWorkout let a range stored on the
   template (copied from wherever the template came from — e.g. a strength
   session) win over the program week's inherited range via
   `base.min ?? inheritedRange.min`. The pill and the suggestions
   contradicted each other until the user re-tapped the pill (which stamps
   the range via applyWorkoutFocus). Fix: the program week's range governs
   on program start; other per-exercise settings are still preserved. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const {
  doStartProgramWorkout, workoutState, progressionSetup, DEFAULT_PROGRESSION_SETUP,
}=loadRole('focus-preset');

const freshSetup=()=>JSON.parse(JSON.stringify(DEFAULT_PROGRESSION_SETUP));

beforeEach(()=>{
  workoutState.completed=[];
  workoutState.templates=[];
  workoutState.activeProgram=null;
  workoutState.draft=null;
  Object.keys(progressionSetup).forEach(k=>delete progressionSetup[k]);
  Object.assign(progressionSetup,freshSetup());
  progressionSetup.units='imperial';
});

/* The user's scenario: "Fall training", week 1 = hypertrophy, but the
   workout template was copied from a strength session so its exercises
   carry a stale {min:1,max:5} progression. */
function fallTraining(){
  return {
    id:'p1', name:'Fall training', length:8,
    workouts:[{uid:'w1', name:'Chest', template:{exercises:[
      {exerciseId:'bench-press', tracking:'reps', note:'',
       progression:{mode:'reps',min:1,max:5}},
    ]}}],
    progression:{scheme:'rpe', threshold:8, incrementType:'lb', incrementValue:5,
      undulating:true, weeklyRanges:['hypertrophy'],
      defaultRange:{preset:'hypertrophy',min:6,max:12}},
  };
}

describe('#431: program start uses the program week range, not stale template ranges',()=>{
  it('the draft items get the week range and the pill matches',()=>{
    const program=fallTraining();
    doStartProgramWorkout(program,program.workouts[0]);
    assert.equal(workoutState.draft.focusPreset,'hypertrophy');
    const p=workoutState.draft.exercises[0].progression;
    assert.equal(p.min,6,'stale template min is replaced');
    assert.equal(p.max,12,'stale template max is replaced');
  });
  it('suggestions are computed for the week range on first render',()=>{
    // Latest top set: 110x10 @ RPE 8 — inside the hypertrophy zone.
    workoutState.completed=[mkLog('w0','2026-09-12',[
      mkItem('bench-press',[{w:110,r:10,rpe:8}],
        {progression:{mode:'reps',min:6,max:12}})])];
    const program=fallTraining();
    doStartProgramWorkout(program,program.workouts[0]);
    const sug=(workoutState.draft.progressionSuggestions||[])
      .find(s=>s.exerciseId==='bench-press');
    assert.ok(sug,'a suggestion is computed');
    // Hypertrophy double progression: 10 < 12 → add two reps (#387) at the
    // same load. The bug produced the strength rebase: 130 lb x 5.
    assert.equal(sug.kind,'reps');
    assert.equal(sug.nextWeight,110);
    assert.equal(sug.nextReps,12);
  });
  it('other per-exercise template settings survive',()=>{
    const program=fallTraining();
    program.workouts[0].template.exercises[0].progression.dbEntry='total';
    program.workouts[0].template.exercises[0].progression.incrementValue=2.5;
    doStartProgramWorkout(program,program.workouts[0]);
    const p=workoutState.draft.exercises[0].progression;
    assert.equal(p.min,6);
    assert.equal(p.max,12);
    assert.equal(p.dbEntry,'total','dbEntry override preserved');
    assert.equal(p.incrementValue,2.5,'increment override preserved');
  });
});
