'use strict';
/* #539 (user 2026-09-17): exercise-name consolidation regression pins.

   131 variant exercises carry aliasOf -> canonical id. Variants are invisible
   consolidation: nothing is deleted (all 876 records stay in the DB), lookups
   resolve variant ids to the canonical entry, the library/picker/search never
   list variants, and history/PRs group under the canonical id.

   Pins:
   - DB: 876 records; exactly the mapping's 131 variants carry aliasOf; every
     aliasOf target exists and is itself canonical (no chains).
   - canonicalExerciseId/resolveExercise: variant -> canonical, canonical ->
     itself, unknown id passes through / resolves to undefined.
   - filteredExercises() and rankedExerciseMatches() never return variants.
   - getExerciseLogs(canonicalId) includes sets logged under a variant id;
     getExerciseLogs(variantId) resolves to the same logs.
   - priorSetsForPR(canonicalId) includes sets logged under a variant id.
   - Source pins: the workout picker filter, similar-exercises, and the
     dashboard aggregations exclude/group by canonical. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole}=require('./harness');

const ROOT=path.resolve(__dirname,'..');
const role=loadRole('alias-539');
const {exercises,canonicalExerciseId,resolveExercise,filteredExercises,
  rankedExerciseMatches,getExerciseLogs,priorSetsForPR,state,workoutState}=role;

/* Stamp cross-check: representative variant -> canonical pairs pinned from the
   approved mapping (no external file dependency — the mapping lives outside
   the repo and committed tests must be self-contained). */
const pinnedPairs=[
  ['Barbell_Full_Squat','Barbell_Squat'],
  ['Olympic_Squat','Barbell_Squat'],
  ['Cable_Hammer_Curls_-_Rope_Attachment','Hammer_Curls'],
  ['Bench_Press_-_Powerlifting','Barbell_Bench_Press_-_Medium_Grip'],
  ['Bench_Press_-_With_Bands','Barbell_Bench_Press_-_Medium_Grip'],
  ['Close-Grip_Front_Lat_Pulldown','Wide-Grip_Lat_Pulldown'],
  ['Close-Grip_Dumbbell_Press','Dumbbell_Bench_Press'],
  ['Close-Grip_EZ-Bar_Press','EZ-Bar_Skullcrusher'],
];
/* #539 update (user 2026-09-17): seated variants and Pallof Press With
   Rotation were reverted — they stay as their own entries, no aliasOf. */
const revertedIds=[
  'Seated_Barbell_Military_Press','Seated_Cable_Shoulder_Press',
  'Kettlebell_Seated_Press','Pallof_Press_With_Rotation',
  'Seated_Dumbbell_Press','Seated_Side_Lateral_Raise',
];
const byId=new Map(exercises.map(e=>[e.id,e]));

describe('#539: DB alias stamps',()=>{
  it('nothing is deleted — all 876 records are still in the DB',()=>{
    assert.equal(exercises.length,876);
  });
  it('exactly 132 variants carry aliasOf (pinned representative pairs)',()=>{
    const stamped=exercises.filter(e=>e.aliasOf);
    assert.equal(stamped.length,132);
    for(const [vid,cid] of pinnedPairs){
      const e=byId.get(vid);
      assert.ok(e,'variant still in DB: '+vid);
      assert.equal(e.aliasOf,cid,`${vid} must alias to ${cid}`);
    }
  });
  it('reverted merges carry no aliasOf (seated variants, Pallof With Rotation)',()=>{
    for(const vid of revertedIds){
      const e=byId.get(vid);
      assert.ok(e,'reverted entry still in DB: '+vid);
      assert.ok(!e.aliasOf,vid+' must not be an alias');
    }
  });
  it('every aliasOf target exists and is itself canonical (no chains)',()=>{
    for(const e of exercises){
      if(!e.aliasOf)continue;
      const target=byId.get(e.aliasOf);
      assert.ok(target,'alias target exists: '+e.aliasOf);
      assert.ok(!target.aliasOf,'alias target is canonical: '+e.aliasOf);
    }
  });
  it('canonical entries keep their full records (name, muscles, instructions)',()=>{
    const c=byId.get('Barbell_Squat');
    assert.equal(c.name,'Barbell Squat');
    assert.ok(c.primary.length>0);
    assert.ok(c.instructions.length>0);
  });
});

describe('#539: id resolution',()=>{
  it('canonicalExerciseId maps variant -> canonical',()=>{
    assert.equal(canonicalExerciseId('Barbell_Full_Squat'),'Barbell_Squat');
    assert.equal(canonicalExerciseId('Cable_Hammer_Curls_-_Rope_Attachment'),'Hammer_Curls');
  });
  it('canonicalExerciseId leaves canonical ids alone',()=>{
    assert.equal(canonicalExerciseId('Barbell_Squat'),'Barbell_Squat');
  });
  it('canonicalExerciseId passes unknown ids through untouched',()=>{
    assert.equal(canonicalExerciseId('custom-xyz-123'),'custom-xyz-123');
    assert.equal(canonicalExerciseId(null),null);
  });
  it('resolveExercise returns the canonical entry for a variant id',()=>{
    const ex=resolveExercise('Barbell_Full_Squat');
    assert.ok(ex);
    assert.equal(ex.id,'Barbell_Squat');
    assert.equal(ex.name,'Barbell Squat');
    assert.ok(!ex.aliasOf);
  });
  it('resolveExercise returns undefined for unknown ids (customs untouched)',()=>{
    assert.equal(resolveExercise('custom-xyz-123'),undefined);
  });
});

describe('#539: variants never list',()=>{
  it('filteredExercises() excludes all 132 variants',()=>{
    state.query='';state.muscles.clear();
    state.onlyFavorites=false;state.onlyCustom=false;state.equipment='';
    const rows=filteredExercises();
    assert.equal(rows.length,876-132);
    assert.ok(rows.every(x=>!x.aliasOf),'no variant in the library');
  });
  it('search never returns variants',()=>{
    for(const q of ['squat','bench','curl','row','press']){
      const hits=rankedExerciseMatches(q,200);
      assert.ok(hits.length>0,`"${q}" still matches`);
      assert.ok(hits.every(x=>!x.aliasOf),`"${q}" returns no variants`);
    }
  });
});

describe('#539: history and PRs merge under the canonical',()=>{
  const VARIANT='Barbell_Full_Squat', CANON='Barbell_Squat';
  workoutState.completed=[
    {id:'w1',name:'Leg day',date:'2026-09-10',completedAt:'2026-09-10T10:00:00Z',
     exercises:[{exerciseId:VARIANT,tracking:'reps',
       sets:[{w:135,r:8},{w:135,r:8}]}]},
    {id:'w2',name:'Leg day 2',date:'2026-09-12',completedAt:'2026-09-12T10:00:00Z',
     exercises:[{exerciseId:CANON,tracking:'reps',
       sets:[{w:145,r:8}]}]},
  ];
  it('getExerciseLogs(canonical) includes sets logged under the variant id',()=>{
    const logs=getExerciseLogs(CANON);
    assert.equal(logs.length,2);
    const allSets=logs.flatMap(l=>l.sets);
    assert.equal(allSets.length,3);
  });
  it('getExerciseLogs(variantId) resolves to the canonical logs',()=>{
    assert.deepEqual(
      getExerciseLogs(VARIANT).map(l=>l.workoutId).sort(),
      getExerciseLogs(CANON).map(l=>l.workoutId).sort());
  });
  it('priorSetsForPR(canonical) sees variant-id sets as prior work',()=>{
    const later={id:'w3',date:'2026-09-14',completedAt:'2026-09-14T10:00:00Z',exercises:[]};
    const sets=priorSetsForPR(later,CANON);
    assert.equal(sets.length,3);
    assert.ok(sets.some(s=>Number(s.w)===135),'variant-id 135 lb set counts');
  });
});

describe('#539: source pins',()=>{
  const builderSrc=fs.readFileSync(
    path.join(ROOT,'assets/js/workout/workout-builder.js'),'utf8');
  const detailSrc=fs.readFileSync(
    path.join(ROOT,'assets/js/pages/exercise-detail.js'),'utf8');
  const dashSrc=fs.readFileSync(
    path.join(ROOT,'assets/js/pages/dashboard-stats.js'),'utf8');
  it('the workout picker filter excludes variants',()=>{
    const i=builderSrc.indexOf('function pickerFilterMatch');
    assert.ok(i>=0,'pickerFilterMatch exists');
    assert.ok(builderSrc.slice(i,i+400).includes('aliasOf'),
      'pickerFilterMatch excludes alias entries');
  });
  it('similar-exercises excludes variants',()=>{
    const i=detailSrc.indexOf('function similarTo');
    assert.ok(i>=0,'similarTo exists');
    assert.ok(detailSrc.slice(i,i+400).includes('aliasOf'),
      'similarTo excludes alias entries');
  });
  it('opening a detail by variant id lands on the canonical',()=>{
    const i=detailSrc.indexOf('function openExercise');
    assert.ok(detailSrc.slice(i,i+300).includes('id = ex.id'),
      'openExercise re-points state.selected at the canonical id');
  });
  it('dashboard stats group under the canonical id',()=>{
    assert.ok(dashSrc.includes('canonicalExerciseId'),
      'dashboard-stats.js canonicalizes exercise ids');
  });
});
