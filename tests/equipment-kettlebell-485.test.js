'use strict';
/* Role: catalog-db-logic — pins #485 (user 2026-09-15): kettlebell as an
   equipment option.

   The issue assumed the catalog only carried five equipment values (barbell,
   body only, cable, dumbbell, machine). That five-value list is the OFFLINE
   FALLBACK (coreExercises in exercise-data.js, used only when the database
   script fails to load). The bundled database (data/exercises-db.js, loaded
   by index.html before catalog.js) tags 56 exercises 'kettlebells', and all
   three equipment surfaces derive their options from the live catalog:
     - library filter:      exercise-library.js populateFilters()
     - picker filter:       workout-builder.js populatePickerFilters()
     - custom-exercise form: custom-exercises.js customOptions()
   These tests pin that vocabulary so a future database or fallback change
   cannot silently drop the kettlebell option.

   Kettlebell is a weighted implement, so it stays weight-REQUIRED — it does
   not join the #452/#474 weight-optional list (body only, bands, exercise
   ball, foam roll(er), other, and unrecorded equipment). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole}=require('./harness');

const REPO_ROOT=path.join(__dirname,'..');
const role=loadRole('catalog-db-logic');
const exercises=role.exercises;
const exerciseWeightOptional=role.exerciseWeightOptional;
const db=role.window.FREE_EXERCISE_DB;

/* The exact derivation expressions used by the three surfaces, evaluated
   here against the loaded catalog (kept in sync with the sources by the
   structural tests below). */
const pickerVocabulary=()=>[...new Set(exercises.map(x=>x.equipment).filter(Boolean))].sort();
const customPillVocabulary=()=>[...new Set(exercises.map(x=>x.equipment).filter(Boolean))].sort();

describe('kettlebell equipment vocabulary (#485)',()=>{
  it('the bundled database tags kettlebell exercises',()=>{
    const kb=db.filter(x=>x.equipment==='kettlebells');
    assert.ok(kb.length>0,'expected kettlebell rows in data/exercises-db.js');
    assert.ok(kb.every(x=>x.id&&x.name),'every kettlebell row has id and name');
  });
  it('the normalized catalog carries the kettlebell rows',()=>{
    const kb=exercises.filter(x=>x.equipment==='kettlebells');
    assert.ok(kb.length>0,'expected kettlebell rows in the normalized catalog');
    assert.ok(kb.some(x=>/kettlebell/i.test(x.name)),'at least one is a named kettlebell movement');
  });
  it('the picker equipment filter vocabulary includes kettlebell',()=>{
    assert.ok(pickerVocabulary().includes('kettlebells'),
      'populatePickerFilters derives from the catalog and must list kettlebells');
  });
  it('the custom-exercise equipment pills include kettlebell',()=>{
    assert.ok(customPillVocabulary().includes('kettlebells'),
      'customOptions derives from the catalog and must offer a kettlebell pill');
  });
  it('kettlebell stays weight-required (weighted implement)',()=>{
    assert.equal(exerciseWeightOptional({equipment:'kettlebells'}),false,
      'kettlebell is weighted — weight must be required, unlike the #452/#474 optional list');
    assert.equal(exerciseWeightOptional({equipment:'body only'}),true,'bodyweight stays optional');
    assert.equal(exerciseWeightOptional({equipment:'dumbbell'}),false,'dumbbell stays required');
  });
});

describe('equipment vocabulary stays data-driven (#485)',()=>{
  const lib=fs.readFileSync(path.join(REPO_ROOT,'assets','js','pages','exercise-library.js'),'utf8');
  const builder=fs.readFileSync(path.join(REPO_ROOT,'assets','js','workout','workout-builder.js'),'utf8');
  const customs=fs.readFileSync(path.join(REPO_ROOT,'assets','js','data','custom-exercises.js'),'utf8');
  it('library filter derives equipment from the catalog, not a hardcoded list',()=>{
    assert.ok(lib.includes('new Set(exercises')&&lib.includes('x.equipment'),
      'populateFilters must keep deriving equipment from the live catalog');
  });
  it('picker filter derives equipment from the catalog, not a hardcoded list',()=>{
    assert.ok(builder.includes('new Set(exercises.map(x=>x.equipment)'),
      'populatePickerFilters must keep deriving equipment from the live catalog');
  });
  it('custom-exercise pills derive equipment from the catalog, not a hardcoded list',()=>{
    assert.ok(customs.includes('new Set(exercises.map(x => x.equipment)'),
      'customOptions must keep deriving equipment from the live catalog');
  });
});
