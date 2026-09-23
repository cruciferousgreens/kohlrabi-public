'use strict';
/* #338 (user 2026-09-13): saved-workout function parity — the program workout
   detail page gains Duplicate (copy the shell inside the program) and Archive
   (promote to a real saved workout, remove from the program, mirroring #257).
   The unified saved-workout list gives program cards the same swipe-delete
   rail / inline × as template rows. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');
const programs=fs.readFileSync(path.join(ROOT,'assets/js/pages/programs.js'),'utf8');
const savedWorkouts=fs.readFileSync(path.join(ROOT,'assets/js/pages/saved-workouts.js'),'utf8');

function extract(src,name){
  const m=src.match(new RegExp('function '+name+'\\(program,workout\\)\\{[\\s\\S]*?\\n    \\}'));
  assert.ok(m,name+' found in programs.js');
  return m[0];
}
function sandbox(extra={}){
  let n=0;
  const sb={
    newProgramWorkoutUid:()=>'pw-new-'+(++n),
    newTemplateId:()=>'t-new-'+(++n),
    cloneTemplateExercises:(rows)=>(rows||[]).map(r=>({clonedFrom:r.exerciseId||'x'})),
    schedulePersist(){}, showToast(){},
    renderProgramWorkoutPage(){}, renderProgram(){}, renderWorkoutTemplateList(){},
    workoutState:{templates:[]},
    state:{},
    ...extra,
  };
  vm.createContext(sb);
  return sb;
}

describe('#338 program-workout Duplicate',()=>{
  it('copies the shell inside the same program with a fresh uid',()=>{
    const sb=sandbox();
    vm.runInContext(extract(programs,'duplicateProgramWorkout')+'\nthis.__dup=duplicateProgramWorkout;',sb);
    const program={workouts:[{uid:'pw1',name:'Push Day',sourceTemplateId:null,template:{name:'Push Day',exercises:[{exerciseId:'bench'}]}}]};
    sb.__dup(program,program.workouts[0]);
    assert.equal(program.workouts.length,2,'shell duplicated');
    const copy=program.workouts[1];
    assert.equal(copy.name,'Push Day copy');
    assert.notEqual(copy.uid,'pw1','fresh uid');
    assert.equal(copy.exercises===undefined,true,'template-shaped copy');
    assert.equal(copy.template.exercises.length,1,'exercises cloned through');
    assert.equal(copy.template.exercises[0].clonedFrom,'bench');
  });
});

describe('#338 program-workout Archive',()=>{
  it('promotes a program-only shell to a saved workout and removes it',()=>{
    const sb=sandbox();
    vm.runInContext(extract(programs,'archiveProgramWorkout')+'\nthis.__arc=archiveProgramWorkout;',sb);
    const program={workouts:[{uid:'pw1',name:'Push Day',template:{exercises:[{exerciseId:'bench'}]}}]};
    sb.__arc(program,program.workouts[0]);
    assert.equal(program.workouts.length,0,'removed from program');
    assert.equal(sb.workoutState.templates.length,1,'promoted to saved workouts');
    assert.equal(sb.workoutState.templates[0].name,'Push Day');
    assert.equal(sb.workoutState.templates[0].exercises[0].clonedFrom,'bench');
  });
  it('does not double-promote a shell covered by a live template',()=>{
    const sb=sandbox();
    sb.workoutState.templates=[{id:'t-live',name:'Legs'}];
    vm.runInContext(extract(programs,'archiveProgramWorkout')+'\nthis.__arc=archiveProgramWorkout;',sb);
    const program={workouts:[{uid:'pw1',name:'Legs',sourceTemplateId:'t-live',template:{exercises:[]}}]};
    sb.__arc(program,program.workouts[0]);
    assert.equal(program.workouts.length,0,'removed from program');
    assert.equal(sb.workoutState.templates.length,1,'no duplicate template');
  });
});

describe('#338 unified list program cards',()=>{
  it('program cards render the delete rail and inline ×',()=>{
    assert.ok(savedWorkouts.includes('delete-program-workout" type="button" data-uid="${escapeHtml(item.uid)}'),
      'swipe rail on program cards');
    assert.ok(savedWorkouts.includes('data-del-program-workout="${escapeHtml(item.uid)}'),
      'inline × on program cards');
  });
  it('the rail and × reuse the program-workout delete confirmation',()=>{
    assert.ok(savedWorkouts.includes("confirmDeleteProgramWorkout(b.dataset.uid)"),
      'rail wired to confirmDeleteProgramWorkout');
    assert.ok(savedWorkouts.includes("confirmDeleteProgramWorkout(b.dataset.delProgramWorkout)"),
      'inline × wired to confirmDeleteProgramWorkout');
    assert.ok(programs.includes('function confirmDeleteProgramWorkout(uid){'),
      'confirmDeleteProgramWorkout hoisted to shared scope');
  });
  it('deleting from the list refreshes the unified list too',()=>{
    const h=programs.match(/\$\('#confirmDeleteProgramWorkout'\)\?\.addEventListener\('click',\(\)=>\{([\s\S]*?)\}\);/);
    assert.ok(h,'confirm handler found');
    assert.ok(h[1].includes("renderWorkoutTemplateList()"),'list refreshes after delete');
  });
});
