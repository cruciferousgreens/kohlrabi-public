'use strict';
/* #538 (user 2026-09-17): single-dumbbell sets overcount volume 2x — a
   Bulgarian split squat holding one 25 lb dumbbell logged 1,000 lb instead
   of 500, because per-dumbbell entry mode doubles into canonical storage.
   Fix: a per-exercise "Dumbbells used: One | Pair" toggle in Exercise options
   (next to the #410 entry-mode control). "One" skips the per-mode doubling
   at storage and the halving at display, so canonical weight — and therefore
   volume, PRs, stats, history — counts the single dumbbell once.
   Regression pins:
   - DEFAULT_PROGRESSION_SETUP.singleDbPrefs={}; normalizeProgression
     repairs a bogus singleDbPrefs on old blobs.
   - dbSingleDumbbell: item.progression.singleDb override → singleDbPrefs
     [exerciseId] → false (pair, today's behavior).
   - dbDisplayWeight: single skips the per-mode halving; pair keeps it;
     total mode is untouched (flag inert there).
   - dbStorageWeight: single skips the per-mode doubling; pair keeps it.
   - setVolume stays canonical: the issue's example (25 lb × 20 reps)
     volumes as 500 single vs 1,000 pair.
   - defaultExerciseProgression carries singleDb, null unless overridden.
   - Exercise options renders the One/Pair segmented row for per-mode
     dumbbell exercises only; wireDbSingleToggle is wired in the live
     editor (both wire sites) and the saved-workout builder; the #473
     even-total suggestion snap is gated off for single-dumbbell exercises
     (it would corrupt 25 into 26). */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole}=require('./harness');

const role=loadRole('exercise-math');
const indirectEval=eval;
const dbSingleDumbbell=indirectEval('dbSingleDumbbell');
const dbDisplayWeight=indirectEval('dbDisplayWeight');
const dbStorageWeight=indirectEval('dbStorageWeight');
const setVolume=indirectEval('setVolume');
const normalizeProgression=indirectEval('normalizeProgression');
const defaultExerciseProgression=indirectEval('defaultExerciseProgression');
const progressionSetup=indirectEval('progressionSetup');
const DEFAULT_PROGRESSION_SETUP=indirectEval('DEFAULT_PROGRESSION_SETUP');

beforeEach(()=>{
  progressionSetup.dbEntry='per';
  progressionSetup.dbEntryPrefs={};
  progressionSetup.singleDbPrefs={};
  progressionSetup.units='imperial';
});

describe('#538 single-dumbbell flag',()=>{
  it('defaults to pair with an empty per-exercise map',()=>{
    assert.deepEqual(DEFAULT_PROGRESSION_SETUP.singleDbPrefs,{});
    assert.equal(dbSingleDumbbell('db1',null),false);
  });
  it('normalizeProgression repairs the singleDbPrefs map',()=>{
    const p={singleDbPrefs:[1,2]};
    normalizeProgression(p);
    assert.deepEqual(p.singleDbPrefs,{});
  });
  it('effective flag: item override beats prefs beats pair default',()=>{
    progressionSetup.singleDbPrefs={db1:true};
    assert.equal(dbSingleDumbbell('db1',null),true);
    assert.equal(dbSingleDumbbell('db2',null),false);
    assert.equal(dbSingleDumbbell('db1',{progression:{singleDb:false}}),false);
    assert.equal(dbSingleDumbbell('db2',{progression:{singleDb:true}}),true);
  });
  it('dbDisplayWeight skips the per-mode halving for single-dumbbell',()=>{
    progressionSetup.singleDbPrefs={db1:true};
    assert.equal(dbDisplayWeight(100,'db1',null,true),'100');
    assert.equal(dbDisplayWeight(100,'db2',null,true),'50');
    assert.equal(dbDisplayWeight(100,'db1',{progression:{singleDb:false}},true),'50');
  });
  it('flag is inert in total entry mode',()=>{
    progressionSetup.dbEntry='total';
    progressionSetup.singleDbPrefs={db1:true};
    assert.equal(dbDisplayWeight(100,'db1',null,true),'100');
    assert.equal(dbStorageWeight('25','db1',null,true),'25');
  });
  it('dbStorageWeight skips the per-mode doubling for single-dumbbell',()=>{
    progressionSetup.singleDbPrefs={db1:true};
    assert.equal(dbStorageWeight('25','db1',null,true),'25');
    assert.equal(dbStorageWeight('25','db2',null,true),'50');
    assert.equal(dbStorageWeight('25','db1',{progression:{singleDb:false}},true),'50');
  });
  it("the issue's example: 25 lb x 20 reps volumes as 500 single, 1000 pair",()=>{
    progressionSetup.singleDbPrefs={bulgarian:true};
    const singleCanonical=dbStorageWeight('25','bulgarian',null,true);
    assert.equal(singleCanonical,'25');
    assert.equal(setVolume({w:singleCanonical,r:20}),500);
    const pairCanonical=dbStorageWeight('25','other-db',null,true);
    assert.equal(pairCanonical,'50');
    assert.equal(setVolume({w:pairCanonical,r:20}),1000);
  });
  it('defaultExerciseProgression carries singleDb, null unless overridden',()=>{
    assert.equal(defaultExerciseProgression().singleDb,null);
    assert.equal(defaultExerciseProgression({singleDb:true}).singleDb,true);
    assert.equal(defaultExerciseProgression({singleDb:false}).singleDb,false);
    assert.equal(defaultExerciseProgression({singleDb:'yes'}).singleDb,null);
  });
  it('Exercise options renders the One/Pair row for per-mode dumbbell exercises',()=>{
    const ROOT=path.resolve(__dirname,'..');
    const utilities=fs.readFileSync(path.join(ROOT,'assets/js/lib/utilities.js'),'utf8');
    assert.ok(/data-db-single="one"/.test(utilities),'One button exists');
    assert.ok(/data-db-single="pair"/.test(utilities),'Pair button exists');
    assert.ok(/Dumbbells used/.test(utilities),'row is labeled');
    assert.ok(/function wireDbSingleToggle/.test(utilities),'wiring helper exists');
    assert.ok(/singleDbPrefs\[item\.exerciseId\]=next/.test(utilities),'choice persists per exercise');
  });
  it('the toggle is wired in the live editor and the saved-workout builder',()=>{
    const ROOT=path.resolve(__dirname,'..');
    const editor=fs.readFileSync(path.join(ROOT,'assets/js/workout/workout-editor.js'),'utf8');
    const builder=fs.readFileSync(path.join(ROOT,'assets/js/pages/saved-workouts.js'),'utf8');
    const editorSites=(editor.match(/wireDbSingleToggle\(/g)||[]).length;
    assert.equal(editorSites,2,'live editor wires both the swap path and the full render');
    assert.ok(/wireDbSingleToggle\(host, findItem/.test(builder),'builder wires the toggle');
  });
  it('the even-total suggestion snap is gated off for single-dumbbell',()=>{
    const ROOT=path.resolve(__dirname,'..');
    const progression=fs.readFileSync(path.join(ROOT,'assets/js/workout/progression.js'),'utf8');
    assert.ok(/!dbSingleDumbbell\(exerciseId,_suggDbItem\)/.test(progression),'suggestion snap skips single-dumbbell');
    const editor=fs.readFileSync(path.join(ROOT,'assets/js/workout/workout-editor.js'),'utf8');
    assert.ok(/!dbSingleDumbbell\(item\.exerciseId,item\)/.test(editor),'warmup ladder snap skips single-dumbbell');
  });
  it('the One/Pair row survives the #495 hide-total setting (live render)',()=>{
    /* Same role already loaded at the top of this file (state + utilities +
       exercise-detail); a second loadRole would re-declare the module
       consts. Inject the fixture catalog the way the #495 test does. */
    globalThis.exercises=[{id:'db-press',name:'DB Press',equipment:'dumbbell'}];
    globalThis.getExerciseLogs=()=>[];
    const progressionSummaryForOptions=indirectEval('progressionSummaryForOptions');
    const item={uid:'x1',exerciseId:'db-press',tracking:'reps',
      progression:{mode:'reps',min:6,max:12}};
    let shown=progressionSummaryForOptions(item);
    assert.ok(shown.includes('prog-db-single-row'),'single row renders by default');
    assert.ok(shown.includes('aria-pressed="false">One</button>'),'One starts unpressed (pair)');
    progressionSetup.singleDbPrefs={'db-press':true};
    shown=progressionSummaryForOptions(item);
    assert.ok(shown.includes('aria-pressed="true">One</button>'),'One pressed after the pref is set');
    /* #495: hiding the Total option removes the entry-mode row but must not
       take the single-dumbbell toggle with it — single-DB exercises still
       need it while entry stays per-dumbbell. */
    progressionSetup.hideDbTotal=true;
    const hidden=progressionSummaryForOptions(item);
    assert.ok(!hidden.includes('prog-db-entry-row'),'#495 contract: no entry-mode row while hidden');
    assert.ok(hidden.includes('prog-db-single-row'),'single row stays available while hidden');
    delete globalThis.exercises;
    delete globalThis.getExerciseLogs;
  });
});
