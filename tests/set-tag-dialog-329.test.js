'use strict';
/* #329 (user 2026-09-13): the set-tag dialog (and exercise-tag dialog) must
   not full re-render the exercise list behind the open modal — every toggle
   was calling renderWorkoutExercises(), causing jumping/expanding/re-firing
   animations. Tag changes persist immediately; the re-render is deferred to a
   single catch-up on dialog close. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const tags=fs.readFileSync(path.join(ROOT,'assets/js/workout/set-tags.js'),'utf8');

describe('#329 tag changes defer the exercise re-render until dialog close',()=>{
  it('afterTagChange() persists but does not render synchronously for live sets',()=>{
    const m=tags.match(/function afterTagChange\(\)\s*\{([\s\S]*?)\n    \}/);
    assert.ok(m,'afterTagChange found');
    const liveBranch=m[1].split('else')[1]||'';
    assert.ok(!liveBranch.includes('renderWorkoutExercises'),
      'no synchronous renderWorkoutExercises in the live branch');
    assert.ok(liveBranch.includes('markDraftSaved'),
      'persistence still happens immediately');
    assert.ok(liveBranch.includes('pendingLiveTagRender=true'),
      'the re-render is deferred via the pending flag');
  });
  it('the set-tag dialog close event syncs the row in place, not a full rerender (user 2026-09-21, #6)',()=>{
    assert.ok(tags.includes("$('#setTagsDialog')?.addEventListener('close'"),
      'close listener registered on #setTagsDialog');
    const m=tags.match(/#setTagsDialog'\)\?\.addEventListener\('close',\(\)=>\{([\s\S]*?)\n\s*\}\);/);
    assert.ok(m&&m[1].includes('syncLiveSetTagRow('),
      'live close syncs the single row in place (no layout flash)');
    assert.ok(!m[1].includes('renderAfterTagDialog(renderWorkoutExercises)'),
      'live close no longer triggers the full exercise rerender');
  });
  it('the exercise-tag dialog defers the same way',()=>{
    assert.ok(tags.includes('pendingLiveExerciseTagRender=true'),
      'exercise-tag toggles defer instead of rendering');
    assert.ok(tags.includes("$('#exerciseTagsDialog')?.addEventListener('close'"),
      'close listener registered on #exerciseTagsDialog');
  });
  it('builder mode defers too (#365) — no immediate renderSavedBuilder',()=>{
    const m=tags.match(/function afterTagChange\(\)\s*\{([\s\S]*?)\n    \}/);
    assert.ok(m,'afterTagChange found');
    const builderBranch=(m[1].split('if')[1]||'').split('else')[0]||'';
    assert.ok(!builderBranch.includes('renderSavedBuilder()'),
      'no synchronous renderSavedBuilder in the builder branch');
    assert.ok(builderBranch.includes('schedulePersist()'),
      'persistence still happens immediately');
    assert.ok(builderBranch.includes('pendingBuilderTagRender=true'),
      'the re-render is deferred via the pending flag');
  });
  it('builder exercise-tag toggles defer instead of rendering',()=>{
    assert.ok(tags.includes('pendingBuilderExerciseTagRender=true'),
      'exercise-tag toggles set the builder pending flag');
    const m=tags.match(/#exerciseTagsDialog'\)\?\.addEventListener\('close',\(\)=>\{([\s\S]*?)\n\s*\}\);/);
    assert.ok(m&&m[1].includes('renderAfterTagDialog('),
      'exercise-tag close handler routes through the scroll-pin helper (#496)');
    assert.ok(m[1].includes('renderAfterTagDialog(renderSavedBuilder)'),
      'exercise-tag dialog close handler re-renders the builder when pending (via the scroll-pin helper)');
  });
  it('builder set-tag dialog close performs the single catch-up render',()=>{
    const m=tags.match(/#setTagsDialog'\)\?\.addEventListener\('close',\(\)=>\{([\s\S]*?)\n\s*\}\);/);
    assert.ok(m&&m[1].includes('pendingBuilderTagRender')&&m[1].includes('renderAfterTagDialog(renderSavedBuilder)'),
      'set-tag dialog close handler re-renders the builder when pending');
  });
});
