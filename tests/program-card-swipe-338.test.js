'use strict';
/* #338 regression (user 2026-09-13): the workout picker's card() rendered
   program-workout cards referencing `swipeOn` BEFORE its `const` declaration
   ran (the declaration sat after the program branch's early return), throwing
   "ReferenceError: Cannot access 'swipeOn' before initialization". That single
   TDZ error broke every flow that renders the template list: starting a
   workout from a program, the program + button, and adding exercises (all
   three reported together on prod v1.648). The declaration must precede both
   branches' uses.

   #240 correction (user 2026-09-13): Share lives on SAVED workouts only —
   the completed-log Share button (shareCompletedWorkoutBtn) was removed. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const saved=fs.readFileSync(path.join(ROOT,'assets/js/pages/saved-workouts.js'),'utf8');
const history=fs.readFileSync(path.join(ROOT,'assets/js/workout/workout-history.js'),'utf8');

function cardSrc(){
  const start=saved.indexOf('const card=item=>{');
  assert.ok(start>=0,'card() found');
  return saved.slice(start,start+6000);
}

describe('#338 card() swipeOn declaration order (TDZ guard)',()=>{
  it('declares swipeOn before either branch uses it',()=>{
    const src=cardSrc();
    const decl=src.indexOf('const swipeOn=');
    assert.ok(decl>=0,'swipeOn is declared inside card()');
    /* Code-shaped uses only (swipeOn?, swipeOn&&, !swipeOn) — the fix comment
       above the declaration also mentions the name, which is not a use. */
    const uses=[...src.matchAll(/(?<![\w$])swipeOn(?=[?&])|(?<=!)swipeOn/g)]
      .map(m=>m.index);
    assert.ok(uses.length>0,'card() uses swipeOn in code');
    assert.ok(decl<Math.min(...uses),'declaration precedes every swipeOn use in card()');
  });
  it('declares swipeOn before the program branch',()=>{
    const src=cardSrc();
    const decl=src.indexOf('const swipeOn=');
    const programBranch=src.indexOf("if(item.kind!=='template')");
    assert.ok(programBranch>=0,'program branch found');
    assert.ok(decl<programBranch,'declaration precedes the program branch');
  });
  it('program branch keeps its swipe rail / inline delete controls',()=>{
    const src=cardSrc();
    assert.ok(src.includes('delete-program-workout'),'program rail button present');
    assert.ok(src.includes('data-del-program-workout'),'program inline delete present');
  });
});

describe('#240 Share only on saved workouts, not completed logs',()=>{
  it('plain completed-log detail has no Share button',()=>{
    assert.ok(!history.includes('shareCompletedWorkoutBtn'),
      'shareCompletedWorkoutBtn is gone from workout-history.js');
  });
  it('a log saved as a template IS a saved workout — Share next to Start',()=>{
    /* User 2026-09-13 refinement: once the log has a template, the detail
       offers Share beside Start, sharing that template. */
    assert.ok(history.includes('shareCompletedTemplateBtn'),
      'shareCompletedTemplateBtn present in workout-history.js');
    assert.ok(/shareCompletedTemplateBtn[\s\S]{0,700}saveCompletedWorkoutTop/.test(history),
      'Share sits next to Start in the completed title actions');
    assert.ok(history.includes("shareCompletedTemplateBtn')?.addEventListener"),
      'completed-template Share is wired to the share flow');
    assert.ok(saved.includes("shareCompletedTemplateBtn"),
      'saveCompletedAsTemplate adds Share immediately after saving');
  });
  it('saved-workout detail keeps its Share button next to Start',()=>{
    assert.ok(saved.includes('shareSavedWorkoutBtn'),
      'shareSavedWorkoutBtn present in saved-workouts.js');
    assert.ok(/shareSavedWorkoutBtn[\s\S]{0,600}startSavedWorkoutBtn/.test(saved),
      'Share sits next to Start in the saved-workout title actions');
    assert.ok(saved.includes("shareSavedWorkoutBtn')?.addEventListener"),
      'saved-workout Share is wired to the share flow');
  });
});
