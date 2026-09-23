'use strict';
/* Persona P11#7 (2026-09-22): "+ Add saved workout" showed a success toast
   ("Added … to the program.") but the rotation stayed empty — the commit
   closure pushed onto the program object captured when the dialog OPENED,
   so a cross-tab/sync merge that replaced workoutState.activeProgram while
   the dialog was open sent the new workout into a detached object.
   Structural pin: addShellToProgram must read the live program at commit
   time. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const src=fs.readFileSync(path.join(__dirname,'..','assets','js','pages','programs.js'),'utf8');
const start=src.indexOf('    function openAddSavedToProgram(');
const fn=src.slice(start,src.indexOf('\n    function ',start+10));

describe('add-to-program live read (persona P11#7)',()=>{
  it('openAddSavedToProgram exists',()=>{
    assert.ok(start>0,'openAddSavedToProgram exists');
  });
  it('addShellToProgram reads workoutState.activeProgram at commit time',()=>{
    assert.ok(fn.includes('Persona P11#7'),'fix comment marker present');
    assert.ok(fn.includes('const live=workoutState.activeProgram'),'live read at commit');
    assert.ok(fn.includes('live.workouts.push(shell)'),'push goes to the live program');
  });
  it('does not push to the dialog-open closure variable',()=>{
    /* The old code pushed to `program` (captured at dialog open). The push
       must now target `live`. */
    assert.ok(!/[^.]program\.workouts\.push\(shell\)/.test(fn),'no push to the stale closure variable');
  });
});
