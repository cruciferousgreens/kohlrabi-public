'use strict';
/* Role: focus-preset — pins #337 (user 2026-09-13): a workout started from a
   program workout opens with a BLANK name, so the input shows its "Workout"
   placeholder and the user names the session themselves. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {
  doStartProgramWorkout,
  workoutState, progressionSetup, DEFAULT_PROGRESSION_SETUP,
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

function testProgram(){
  return {
    id:'p1', name:'Test Block', length:8, startDate:'2026-09-07',
    workouts:[{uid:'w1', name:'Chest', template:{exercises:[
      {exerciseId:'bench-press', tracking:'reps', note:'', progression:{}},
    ]}}],
    progression:{scheme:'rpe', threshold:8, incrementType:'fixed', incrementValue:5,
      defaultRange:{preset:'strength', min:1, max:5}},
  };
}

describe('program workout start (#337: blank session name)',()=>{
  it('starts the draft with an empty name so the placeholder shows',()=>{
    const program=testProgram();
    doStartProgramWorkout(program,program.workouts[0]);
    assert.equal(workoutState.draft.name,'','name is blank, not pre-filled');
  });
  it('still starts the right program workout (identity kept)',()=>{
    const program=testProgram();
    doStartProgramWorkout(program,program.workouts[0]);
    assert.equal(workoutState.draft.programId,'p1');
    assert.equal(workoutState.draft.programWorkoutUid,'w1');
    assert.equal(workoutState.draft.exercises.length,1);
  });
});
