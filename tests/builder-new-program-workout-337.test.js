'use strict';
/* #337 (user 2026-09-13): tapping "+" on the program cover opens the
   saved-workout builder for a fresh program-workout shell. The shell is
   auto-named "Workout N" (so the program cover never shows a blank row),
   but the builder's name field must start EMPTY with the "Workout"
   placeholder — the auto name only sticks when the field is left blank at
   save. Discarding a never-saved shell removes it from the program instead
   of leaving an orphan "Workout N" row on the cover. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {
  openSavedBuilder, saveBuilderWorkout, clearBuilderDraft,
  state, workoutState,
}=loadRole('saved-workout-template',{globals:{
  /* workout-builder.js is outside this role; the builder only clones rows. */
  cloneTemplateExercises:(rows)=>JSON.parse(JSON.stringify(rows||[])),
  /* Factories live in workout-editor.js (DOM-heavy, not in this role);
     cloneExerciseItem only needs their shapes. Mirrors share-codec stubs. */
  __testUidCounter:0,
  newSet(){return {uid:'set-test-'+(++globalThis.__testUidCounter),w:'',r:'',seconds:'',rpe:'',targetRpe:'',tags:[],complete:false};},
  newExerciseItem(opts){opts=opts||{};return {uid:'ex-test-'+(++globalThis.__testUidCounter),exerciseId:opts.exerciseId||'',tracking:opts.tracking||'reps',note:opts.note||'',noteOpen:false,exerciseTags:opts.exerciseTags||[],supersetId:opts.supersetId||null,progression:opts.progression||null,sets:opts.sets||[]};},
  showWorkouts(){}, renderWorkoutScreen(){}, schedulePersist(){},
  showToast(){}, showProgram(){},
}});

beforeEach(()=>{
  state.activeView='workout';
  state.savedBuilder=null; state.builderOpen=false; state.builderReturn=null;
  state.programWorkoutUid=null;
  workoutState.activeProgram={id:'p1',name:'Test Block',workouts:[]};
  workoutState.templates=[];
});

describe('new program workout builder (#337)',()=>{
  it('opens with an empty name field; the auto shell name stays off-screen',()=>{
    openSavedBuilder({newProgramWorkout:true});
    const b=state.savedBuilder;
    assert.ok(b,'builder opened');
    assert.equal(b.name,'','name field starts empty');
    assert.equal(b.editTarget.kind,'program');
    assert.equal(b.isNewProgramShell,true);
    assert.equal(workoutState.activeProgram.workouts.length,1);
    assert.equal(workoutState.activeProgram.workouts[0].name,'Workout 1');
  });
  it('saving with a blank name keeps the auto "Workout N" shell name',()=>{
    openSavedBuilder({newProgramWorkout:true});
    const b=state.savedBuilder;
    b.exercises=[{uid:'ex-1',exerciseId:'bench-press',tracking:'reps',sets:[{r:'10'}]}];
    saveBuilderWorkout();
    const w=workoutState.activeProgram.workouts[0];
    assert.equal(w.name,'Workout 1');
    assert.equal(w.template.name,'Workout 1');
    assert.equal(state.savedBuilder,null);
  });
  it('saving with a typed name uses the typed name',()=>{
    openSavedBuilder({newProgramWorkout:true});
    const b=state.savedBuilder;
    b.name='Push Day';
    b.exercises=[{uid:'ex-1',exerciseId:'bench-press',tracking:'reps',sets:[{r:'10'}]}];
    saveBuilderWorkout();
    assert.equal(workoutState.activeProgram.workouts[0].name,'Push Day');
  });
  it('discarding a never-saved shell removes it from the program',()=>{
    openSavedBuilder({newProgramWorkout:true});
    assert.equal(workoutState.activeProgram.workouts.length,1);
    clearBuilderDraft();
    assert.equal(workoutState.activeProgram.workouts.length,0,'no orphan shell left');
    assert.equal(state.savedBuilder,null);
  });
  it('editing an existing program workout keeps its name; discard never removes it',()=>{
    workoutState.activeProgram.workouts.push({uid:'pw-9',name:'Leg Day',template:{name:'Leg Day',exercises:[]}});
    openSavedBuilder({programUid:'pw-9'});
    const b=state.savedBuilder;
    assert.equal(b.name,'Leg Day','existing name shown for edit');
    assert.equal(b.isNewProgramShell,false);
    clearBuilderDraft();
    assert.equal(workoutState.activeProgram.workouts.length,1,'existing workout survives discard');
    assert.equal(workoutState.activeProgram.workouts[0].name,'Leg Day');
  });
});
