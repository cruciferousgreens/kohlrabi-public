'use strict';
/* #365 (user 2026-09-13): the saved-builder tag dialog must not full
   re-render the builder behind the open modal on every toggle — same
   defer-until-close pattern #329 gave the live-workout dialog. Tag changes
   persist immediately; a single catch-up renderSavedBuilder() runs on
   dialog close, no matter how many toggles happened while open. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const tags=fs.readFileSync(path.join(ROOT,'assets/js/workout/set-tags.js'),'utf8');

describe('#365 builder tag dialog defers the re-render until close',()=>{
  it('set-tag toggles in builder mode persist but do not render synchronously',()=>{
    const m=tags.match(/function afterTagChange\(\)\s*\{([\s\S]*?)\n    \}/);
    assert.ok(m,'afterTagChange found');
    const builderBranch=(m[1].split('if')[1]||'').split('else')[0]||'';
    assert.ok(builderBranch.includes('pendingBuilderTagRender=true'),'deferred via pending flag');
    assert.ok(!builderBranch.includes('renderSavedBuilder('),'no immediate render');
  });
  it('exercise-tag toggles in builder mode persist but do not render synchronously',()=>{
    const toggle=tags.match(/data-exercise-tag[\s\S]*?workoutState\.exerciseTagTarget\?\.\mode==='builder'\)\{([^}]*)\}/);
    assert.ok(toggle,'builder branch of the exercise-tag toggle found');
    assert.ok(toggle[1].includes('pendingBuilderExerciseTagRender=true'),'deferred via pending flag');
    assert.ok(!toggle[1].includes('renderSavedBuilder('),'no immediate render');
    assert.ok(tags.match(/function addExerciseTag\(\)[\s\S]*?mode==='builder'\)\{[^}]*pendingBuilderExerciseTagRender=true/),
      'addExerciseTag defers the same way');
  });
  it('one catch-up render per dialog close, per mode',()=>{
    /* The closing }); sits at line start, seeing through the nested
       renderAfterTagDialog callback (#496). */
    const setClose=tags.match(/#setTagsDialog'\)\?\.addEventListener\('close',\(\)=>\{([\s\S]*?)\n\s*\}\);/);
    assert.ok(setClose,'set-tag close listener found');
    assert.ok(setClose[1].includes('pendingBuilderTagRender'),'builder flag checked');
    assert.ok((setClose[1].match(/renderAfterTagDialog\(renderSavedBuilder\)/g)||[]).length===1,
      'exactly one builder catch-up render on set-tag close');
    /* QA batch (user 2026-09-21, #6): the live path syncs the row in place —
       no full rerender, no layout flash. */
    assert.ok(setClose[1].includes('syncLiveSetTagRow('),
      'live close syncs the single row in place');
    assert.ok(!setClose[1].includes('renderAfterTagDialog(renderWorkoutExercises)'),
      'no live full-rerender on set-tag close');
    const exClose=tags.match(/#exerciseTagsDialog'\)\?\.addEventListener\('close',\(\)=>\{([\s\S]*?)\n\s*\}\);/);
    assert.ok(exClose,'exercise-tag close listener found');
    assert.ok(exClose[1].includes('pendingBuilderExerciseTagRender'),'builder flag checked');
    assert.ok((exClose[1].match(/renderAfterTagDialog\(renderSavedBuilder\)/g)||[]).length===1,
      'exactly one builder catch-up render on exercise-tag close');
  });
  it('template-picker mode still re-renders immediately (no modal-over-list there)',()=>{
    assert.ok(tags.includes("mode==='template'){schedulePersist();renderPickerRules();}"),
      'picker path untouched');
  });
});
