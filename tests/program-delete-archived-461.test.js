'use strict';
/* #461 (user 2026-09-15): archived programs can be deleted. The pure
   removeArchivedProgramAt splices the program at the index and returns it;
   out-of-range indices return null and touch nothing. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {loadRole}=require('./harness');

const ROOT=path.resolve(__dirname,'..');
const programs=fs.readFileSync(path.join(ROOT,'assets/js/pages/programs.js'),'utf8');

function loadRemove(){
  const m=programs.match(/function removeArchivedProgramAt\(index\)\{[\s\S]*?\n    \}/);
  assert.ok(m,'removeArchivedProgramAt found in programs.js');
  const sandbox={workoutState:{archivedPrograms:[]}};
  vm.createContext(sandbox);
  vm.runInContext(m[0]+'\nthis.__remove=removeArchivedProgramAt;',sandbox);
  return sandbox;
}

describe('removeArchivedProgramAt (#461)',()=>{
  it('removes and returns the program at the index',()=>{
    const sb=loadRemove();
    sb.workoutState.archivedPrograms=[{id:'a',name:'Old A'},{id:'b',name:'Old B'}];
    const removed=sb.__remove(0);
    assert.equal(removed.id,'a');
    assert.deepEqual(sb.workoutState.archivedPrograms.map(p=>p.id),['b']);
  });
  it('out-of-range indices return null and change nothing',()=>{
    const sb=loadRemove();
    sb.workoutState.archivedPrograms=[{id:'a'}];
    assert.equal(sb.__remove(5),null);
    assert.equal(sb.__remove(-1),null);
    assert.equal(sb.workoutState.archivedPrograms.length,1);
  });
  it('the active program is never touched',()=>{
    const sb=loadRemove();
    sb.workoutState.archivedPrograms=[{id:'a'}];
    sb.workoutState.activeProgram={id:'live',name:'Live'};
    sb.__remove(0);
    assert.equal(sb.workoutState.activeProgram.id,'live');
    assert.equal(sb.workoutState.archivedPrograms.length,0);
  });
  /* Regression (user 2026-09-16): tapping Delete on an archived program did
     nothing — removeArchivedProgramAt was nested inside renderArchivedPrograms,
     so the module-scope #deleteArchivedProgramDialog confirm handler threw
     ReferenceError and the program stayed. It must resolve at module top
     level, where the confirm handler lives. */
  it('is defined at module top level (visible to the confirm handler)',()=>{
    const role=loadRole('empty-states-504');
    assert.equal(typeof role.removeArchivedProgramAt,'function',
      'removeArchivedProgramAt must be top-level: the delete-confirm handler calls it');
  });
});
