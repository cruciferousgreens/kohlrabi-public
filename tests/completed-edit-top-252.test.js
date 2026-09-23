'use strict';
/* #252 revert (user 2026-09-13): the top-row Edit button on the completed
   workout view was unwanted — Edit is back at the bottom next to Delete,
   where it used to be. The title row keeps only Start/Save as template. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.join(__dirname,'..');
const history=fs.readFileSync(path.join(ROOT,'assets','js','workout','workout-history.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'assets','styles.css'),'utf8');

describe('#252 completed-view edit is a bottom-row action (revert)',()=>{
  it('title row has no Edit button',()=>{
    assert.ok(!history.includes('editCompletedWorkoutTop'),'top Edit button removed');
  });
  it('bottom row carries an Edit button next to Delete, wired to editCompletedWorkout',()=>{
    assert.ok(history.includes('id="editCompletedWorkout"'),'bottom Edit button in markup');
    assert.ok(history.includes('>Edit workout</button>'),'bottom Edit workout label');
    assert.ok(history.includes("$('#editCompletedWorkout').addEventListener('click',()=>editCompletedWorkout(workout.id))"),
      'bottom Edit button wired to the edit handler');
  });
  it('title actions have a layout rule',()=>{
    assert.ok(/\.detail-title-actions\s*\{[^}]*display:\s*flex/.test(css),'.detail-title-actions lays out as flex');
  });
});
