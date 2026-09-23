'use strict';
/* Persona-4 finding 2 (user 2026-09-15): duplicating a program workout must
   clear sourceTemplateId/sourceWorkoutId — a duplicate is a NEW shell, not a
   pointer at the source's template. Inheriting them hid the duplicate's
   divergent exercises as "covered" in the saved list
   (programShellCoveredByTemplate) and skipped it in
   promoteProgramShellsToTemplates on archive, silently losing the edits. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');
const programs=fs.readFileSync(path.join(ROOT,'assets/js/pages/programs.js'),'utf8');

function loadFn(name,stub){
  const m=programs.match(new RegExp('function '+name+'\\([^)]*\\)\\{[\\s\\S]*?\\n    \\}'));
  assert.ok(m,name+' found in programs.js');
  const sandbox=Object.assign({
    newProgramWorkoutUid:()=>'pw-test-'+(sandbox.n=(sandbox.n||0)+1),
    cloneTemplateExercises:(rows)=>(rows||[]).map(r=>JSON.parse(JSON.stringify(r))),
    schedulePersist(){}, showToast(){}, renderProgramWorkoutPage(){},
  },stub||{});
  vm.createContext(sandbox);
  vm.runInContext(m[0]+'\nthis.__fn='+name+';',sandbox);
  return sandbox.__fn;
}

const SRC_SHELL={
  uid:'pw-src', name:'Push Day',
  sourceTemplateId:'t-live', sourceWorkoutId:'log-123',
  template:{name:'Push Day',exercises:[{exerciseId:'bench-press',sets:[{w:'135',r:'5'}]}]},
};

describe('persona-4 finding 2: duplicateProgramWorkout clears source ids',()=>{
  it('the duplicate carries no sourceTemplateId/sourceWorkoutId',()=>{
    const dup=loadFn('duplicateProgramWorkout');
    const program={workouts:[{...SRC_SHELL}]};
    dup(program,program.workouts[0]);
    assert.strictEqual(program.workouts.length,2,'duplicate added');
    const copy=program.workouts[1];
    assert.strictEqual(copy.sourceTemplateId,null,'sourceTemplateId cleared');
    assert.strictEqual(copy.sourceWorkoutId,null,'sourceWorkoutId cleared');
    assert.strictEqual(copy.name,'Push Day copy','name copied with suffix');
    assert.notStrictEqual(copy.uid,'pw-src','fresh uid');
  });
  it('the duplicate clones the template instead of sharing it',()=>{
    const dup=loadFn('duplicateProgramWorkout');
    const program={workouts:[{...SRC_SHELL}]};
    dup(program,program.workouts[0]);
    const copy=program.workouts[1];
    copy.template.exercises[0].sets[0].w='999';
    assert.strictEqual(program.workouts[0].template.exercises[0].sets[0].w,'135',
      'editing the copy does not touch the source');
  });
  it('the duplicate is treated as program-only by the coverage check',()=>{
    /* programShellCoveredByTemplate (saved-workouts.js) hides a shell's
       exercises as "covered" when sourceTemplateId points at a live
       template — the cleared duplicate must NOT be covered. */
    const saved=fs.readFileSync(path.join(ROOT,'assets/js/pages/saved-workouts.js'),'utf8');
    const m=saved.match(/function programShellCoveredByTemplate\(workout,liveTemplateIds\)\{[\s\S]*?\n    \}/);
    assert.ok(m,'programShellCoveredByTemplate found');
    const sandbox={};
    vm.createContext(sandbox);
    vm.runInContext(m[0]+'\nthis.__covered=programShellCoveredByTemplate;',sandbox);
    const dup=loadFn('duplicateProgramWorkout');
    const program={workouts:[{...SRC_SHELL}]};
    dup(program,program.workouts[0]);
    const live=new Set(['t-live']);
    assert.strictEqual(sandbox.__covered(program.workouts[0],live),true,'source shell still covered');
    assert.strictEqual(sandbox.__covered(program.workouts[1],live),false,'duplicate gets its own card');
  });
  it('the duplicate is promoted to its own template on archive',()=>{
    const m=programs.match(/function promoteProgramShellsToTemplates\(program,templates\)\{[\s\S]*?\n    \}/);
    assert.ok(m,'promoteProgramShellsToTemplates found');
    const sandbox={
      newTemplateId:()=>'t-new-'+(sandbox.n=(sandbox.n||0)+1),
      cloneTemplateExercises:(rows)=>(rows||[]).map(r=>({clonedFrom:r.exerciseId||'x'})),
    };
    vm.createContext(sandbox);
    vm.runInContext(m[0]+'\nthis.__promote=promoteProgramShellsToTemplates;',sandbox);
    const dup=loadFn('duplicateProgramWorkout');
    const program={workouts:[{...SRC_SHELL}]};
    dup(program,program.workouts[0]);
    /* Edit the duplicate's exercises (the divergent-edits scenario). */
    program.workouts[1].template.exercises.push({exerciseId:'overhead-press'});
    const templates=[{id:'t-live',name:'Push Day'}];
    sandbox.__promote(program,templates);
    assert.strictEqual(templates.length,2,'duplicate promoted to its own template');
    assert.deepStrictEqual(
      templates[0].exercises.map(e=>e.clonedFrom),['bench-press','overhead-press'],
      'the promoted template carries the duplicate\'s edited exercises');
  });
});
