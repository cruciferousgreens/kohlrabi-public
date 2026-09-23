'use strict';
/* Persona-4 finding 5 (user 2026-09-15): restore-from-archive must never let
   a stale archived copy silently replace the live active program on id
   collision (reachable via sync merge from another device). The live object
   always wins — the archived duplicate is dropped, the active program stays
   untouched. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');
const programs=fs.readFileSync(path.join(ROOT,'assets/js/pages/programs.js'),'utf8');

function loadRestore(){
  const m=programs.match(/function restoreArchivedProgramAt\(index\)\{[\s\S]*?\n    \}/);
  assert.ok(m,'restoreArchivedProgramAt found in programs.js');
  const calls={persist:0,renderProgram:0,renderDashboard:0};
  const sandbox={
    workoutState:{activeProgram:null,archivedPrograms:[]},
    localIsoDate:()=>'2026-09-15',
    schedulePersist(){calls.persist++;},
    renderProgram(){calls.renderProgram++;},
    renderDashboard(){calls.renderDashboard++;},
    __calls:calls,
  };
  vm.createContext(sandbox);
  vm.runInContext(m[0]+'\nthis.__restore=restoreArchivedProgramAt;',sandbox);
  return sandbox;
}

const ARCHIVED={id:'p-arch',name:'Archived Plan',length:4,archivedAt:'2026-09-01',workouts:[]};

describe('persona-4 finding 5: restoreArchivedProgramAt',()=>{
  it('restores normally when nothing is active',()=>{
    const sb=loadRestore();
    sb.workoutState.archivedPrograms=[{...ARCHIVED}];
    sb.__restore(0);
    assert.strictEqual(sb.workoutState.archivedPrograms.length,0,'archived entry removed');
    assert.strictEqual(sb.workoutState.activeProgram.name,'Archived Plan','program is active');
    assert.strictEqual(sb.workoutState.activeProgram.archivedAt,undefined,'archivedAt cleared');
    assert.strictEqual(sb.__calls.persist,1,'state persisted');
  });
  it('archives the outgoing active program when ids differ',()=>{
    const sb=loadRestore();
    const outgoing={id:'p-live',name:'Live Plan',length:6,workouts:[]};
    sb.workoutState.activeProgram=outgoing;
    sb.workoutState.archivedPrograms=[{...ARCHIVED}];
    sb.__restore(0);
    assert.strictEqual(sb.workoutState.activeProgram.name,'Archived Plan','restored program is active');
    assert.strictEqual(sb.workoutState.archivedPrograms.length,1,'outgoing moved to archived');
    assert.strictEqual(sb.workoutState.archivedPrograms[0],outgoing,'outgoing object archived');
    assert.strictEqual(sb.workoutState.archivedPrograms[0].archivedAt,'2026-09-15','outgoing stamped');
  });
  it('prefers the LIVE program on id collision — never overwrites newer with older',()=>{
    const sb=loadRestore();
    const live={id:'p-same',name:'Live Plan (edited)',length:6,workouts:[{uid:'w-new'}]};
    sb.workoutState.activeProgram=live;
    sb.workoutState.archivedPrograms=[{id:'p-same',name:'Stale Archived Copy',length:4,archivedAt:'2026-09-01',workouts:[]}];
    sb.__restore(0);
    assert.strictEqual(sb.workoutState.archivedPrograms.length,0,'stale archived duplicate dropped');
    assert.strictEqual(sb.workoutState.activeProgram,live,'live object identity preserved');
    assert.strictEqual(sb.workoutState.activeProgram.name,'Live Plan (edited)','newer edits intact');
    assert.deepStrictEqual(sb.workoutState.activeProgram.workouts,[{uid:'w-new'}],'live workouts intact');
    assert.strictEqual(sb.workoutState.activeProgram.archivedAt,undefined,
      'live program was not stamped archived');
    assert.strictEqual(sb.__calls.persist,1,'the archive-list change persisted');
  });
  it('ignores an out-of-range index',()=>{
    const sb=loadRestore();
    sb.workoutState.archivedPrograms=[{...ARCHIVED}];
    sb.__restore(7);
    assert.strictEqual(sb.workoutState.archivedPrograms.length,1,'archived untouched');
    assert.strictEqual(sb.workoutState.activeProgram,null,'nothing activated');
    assert.strictEqual(sb.__calls.persist,0,'nothing persisted');
  });
  it('the restore button is wired to the named function',()=>{
    const wire=programs.match(/document\.querySelectorAll\('\.restore-program'\)\.forEach\(([\s\S]*?)\);/);
    assert.ok(wire,'restore wiring found');
    assert.ok(wire[1].includes('restoreArchivedProgramAt('),'button calls restoreArchivedProgramAt');
    assert.ok(!wire[1].includes('workoutState.activeProgram=restored'),
      'the old inline overwrite is gone');
  });
});
