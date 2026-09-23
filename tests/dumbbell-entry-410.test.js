'use strict';
/* #410 (user 2026-09-13): dumbbell weight entry mode — 'per' (per dumbbell,
   the default) or 'total'. The canonical stored weight is ALWAYS the total
   combined weight; only presentation and input change. Regression pins:
   - DEFAULT_PROGRESSION_SETUP.dbEntry='per' with a dbEntryPrefs map;
     normalizeProgression repairs both on old blobs.
   - dbEntryMode: item profile override → dbEntryPrefs[exerciseId] →
     Settings default.
   - dbDisplayWeight halves the canonical total in per mode (dumbbells
     only); total mode and non-dumbbell exercises pass through untouched.
   - dbStorageWeight doubles the entered per-dumbbell value; total mode
     and non-dumbbell exercises pass through untouched.
   - setVolume stays canonical: a per-dumbbell entry of 50 × 5 reps
     volumes as 2 × 50 × 5 = 500.
   - Settings → Units has the #settingsDbEntryPills Per dumbbell/Total
     control, synced and persisted by app-bootstrap.
   - defaultExerciseProgression carries dbEntry (null default). */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole}=require('./harness');

const role=loadRole('exercise-math');
const indirectEval=eval;
const dbEntryMode=indirectEval('dbEntryMode');
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
  progressionSetup.units='imperial';
});

describe('#410 dumbbell entry mode',()=>{
  it('defaults to per-dumbbell with an empty per-exercise map',()=>{
    assert.equal(DEFAULT_PROGRESSION_SETUP.dbEntry,'per');
    assert.deepEqual(DEFAULT_PROGRESSION_SETUP.dbEntryPrefs,{});
  });
  it('normalizeProgression repairs the mode and the prefs map',()=>{
    const p={dbEntry:'bogus',dbEntryPrefs:[1,2]};
    normalizeProgression(p);
    assert.equal(p.dbEntry,'per');
    assert.deepEqual(p.dbEntryPrefs,{});
  });
  it('effective mode: item override beats prefs beats Settings',()=>{
    progressionSetup.dbEntry='total';
    progressionSetup.dbEntryPrefs={db1:'per'};
    assert.equal(dbEntryMode('db1',null),'per');
    assert.equal(dbEntryMode('db2',null),'total');
    assert.equal(dbEntryMode('db1',{progression:{dbEntry:'total'}}),'total');
    progressionSetup.dbEntry='per';
    assert.equal(dbEntryMode('db9',null),'per');
  });
  it('dbDisplayWeight halves the canonical total in per mode (dumbbells only)',()=>{
    assert.equal(dbDisplayWeight(100,'db1',null,true),'50');
    assert.equal(dbDisplayWeight('45','db1',null,true),'22.5');
    progressionSetup.dbEntry='total';
    assert.equal(dbDisplayWeight(100,'db1',null,true),'100');
    progressionSetup.dbEntry='per';
    assert.equal(dbDisplayWeight(100,'db1',null,false),'100');
  });
  it('dbDisplayWeight passes junk through instead of inventing a number',()=>{
    assert.equal(dbDisplayWeight('', 'db1',null,true),'');
    assert.equal(dbDisplayWeight(null,'db1',null,true),'');
  });
  it('dbStorageWeight doubles the per-dumbbell entry back to canonical',()=>{
    assert.equal(dbStorageWeight('50','db1',null,true),'100');
    assert.equal(dbStorageWeight('22.5','db1',null,true),'45');
    progressionSetup.dbEntry='total';
    assert.equal(dbStorageWeight('50','db1',null,true),'50');
    progressionSetup.dbEntry='per';
    assert.equal(dbStorageWeight('50','db1',null,false),'50');
    assert.equal(dbStorageWeight('','db1',null,true),'');
  });
  it('volume stays canonical: per-dumbbell entry volumes as 2 × entered × reps',()=>{
    const canonical=dbStorageWeight('50','db1',null,true);
    assert.equal(canonical,'100');
    assert.equal(setVolume({w:canonical,r:5}),500);
  });
  it('defaultExerciseProgression carries dbEntry, null unless overridden',()=>{
    assert.equal(defaultExerciseProgression().dbEntry,null);
    assert.equal(defaultExerciseProgression({dbEntry:'total'}).dbEntry,'total');
    assert.equal(defaultExerciseProgression({dbEntry:'bogus'}).dbEntry,null);
  });
  it('Settings → Units has the per-dumbbell/total pills, defaulting to per',()=>{
    const ROOT=path.resolve(__dirname,'..');
    const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
    const bootstrap=fs.readFileSync(path.join(ROOT,'assets/js/core/app-bootstrap.js'),'utf8');
    assert.ok(/id="settingsDbEntryPills"/.test(html),'pills exist under Units');
    assert.ok(/data-db-entry="per"[^>]*aria-pressed="true"/.test(html),'Per dumbbell is the default');
    assert.ok(/data-db-entry="total"/.test(html),'Total option exists');
    assert.ok(/function syncDbEntryPills/.test(bootstrap),'settings render syncs the pills');
    assert.ok(/settingsDbEntryPills/.test(bootstrap)&&/progressionSetup\.dbEntry=mode/.test(bootstrap),'clicking a pill persists the mode');
  });
});
