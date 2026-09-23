'use strict';
/* user 2026-09-17 (#536): the Add-exercise sheet works Hevy's way — tap
   selects with a checkmark inline in the results list, the sticky bottom
   button reads "Add N exercises" and commits, sets/reps are configured in
   the workout after adding. The beige selected-rules box is gone from the
   workout add-sheet (the template editor keeps its rules UI). Source-text
   assertions, following the #458 pattern — the picker handlers are
   DOM-inline. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const builderSrc=fs.readFileSync(path.join(ROOT,'assets/js/workout/workout-builder.js'),'utf8');
const bootstrapSrc=fs.readFileSync(path.join(ROOT,'assets/js/core/app-bootstrap.js'),'utf8');

describe('Hevy-style staged picker (user 2026-09-17, #536)',()=>{
  it('the workout add-sheet renders no rules block — renderPickerRules early-returns outside template mode',()=>{
    assert.ok(builderSrc.includes("if(!templateMode){"),
      'renderPickerRules gates on templateMode');
    const gate=builderSrc.indexOf("if(!templateMode){");
    const ret=builderSrc.indexOf('return;',gate);
    assert.ok(ret>gate&&ret-gate<200,'the non-template path returns before building rule rows');
  });
  it('a staged-selection set exists and resets every time the dialog opens',()=>{
    assert.ok(builderSrc.includes('let pickerStaged=new Set();'),'pickerStaged declared');
    assert.ok(builderSrc.includes('pickerStaged=new Set()'),'pickerStaged reset in resetPickerSession');
  });
  it('tapping a row stages/unstages — nothing is pushed to the draft on tap',()=>{
    assert.ok(builderSrc.includes('pickerStaged.add(id);nowChosen=true;'),'tap stages');
    assert.ok(builderSrc.includes('pickerStaged.delete(id);nowChosen=false;'),'tap again unstages');
    /* The old immediate push lived in the tap handler's draft branch; the
       only draft push left is inside commitPickerStaged. */
    const tapHandler=builderSrc.indexOf('STAGES the exercise');
    const commitFn=builderSrc.indexOf('function commitPickerStaged');
    assert.ok(tapHandler>0&&commitFn>tapHandler,'commit function defined after the handler');
    const between=builderSrc.slice(tapHandler,commitFn);
    assert.ok(!between.includes('draft.exercises.push('),'no immediate draft push in the tap path');
  });
  it('tapping an exercise already in the draft still removes it immediately',()=>{
    assert.ok(builderSrc.includes('workoutState.draft.exercises=workoutState.draft.exercises.filter(item=>item.exerciseId!==id);'),
      'in-draft tap removes from the draft');
  });
  it('the footer button reads "Add N exercises" and is disabled with nothing staged',()=>{
    assert.ok(builderSrc.includes('`Add ${n} exercise${n===1?\'\':\'s\'}`'),'Add N exercises label');
    assert.ok(builderSrc.includes('doneBtn.disabled=!n;'),'disabled with nothing staged');
  });
  it('the footer commits the staged selection (app-bootstrap wires commitPickerStaged)',()=>{
    assert.ok(bootstrapSrc.includes("typeof commitPickerStaged==='function')commitPickerStaged()"),
      'Done-button handler commits in draft mode');
    assert.ok(builderSrc.includes('function commitPickerStaged(){'),'commitPickerStaged defined');
    assert.ok(builderSrc.includes('pickerStaged.clear();'),'staging clears after commit');
  });
  it('committed exercises land with the same defaults a tap used to apply',()=>{
    const fn=builderSrc.indexOf('function stageExerciseItem');
    assert.ok(fn>0,'stageExerciseItem defined');
    const body=builderSrc.slice(fn,builderSrc.indexOf('function commitPickerStaged'));
    assert.ok(body.includes('focusPresetRange(workoutState.draft?.focusPreset)||progressionSetup.defaultRange'),
      'focus-pill range default preserved');
    assert.ok(body.includes('Array.from({length:defaultSetCount()},()=>newSet())'),
      'blank default sets preserved');
    assert.ok(body.includes('defaultExerciseProgression('),'progression profile preserved');
  });
  it('selected rows show the checkmark — staged ids join the pressed state',()=>{
    assert.ok(builderSrc.includes('(chosen.has(ex.id)||pickerStaged.has(ex.id))'),
      'row pressed state includes staged ids');
  });
  it('template mode keeps its immediate toggle and rules UI',()=>{
    assert.ok(builderSrc.includes('/* #74: add/remove exercises on the template being edited. */'),
      'template toggle path intact');
  });
});
