'use strict';
/* #391 (2026-09-16) / #541 (2026-09-17): muscle-data audit regression pins.

   Every catalog correction from the audits is pinned against the real
   data/exercises-db.js so a future DB refresh or hand-edit cannot silently
   reintroduce the error. Plus two global invariants the audit established:
   every record has at least one primary muscle, and no muscle is ever
   listed as both primary and secondary for the same exercise.

   v1.85 (#541) re-audited all 876 exercises: hip-hinge lifts (deadlift
   family) are now P[glutes, hamstrings], not lower back; prime movers are
   primary everywhere else; stabilizers demoted to secondary. Pins below
   reflect the corrected values. */

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const vm=require('vm');
const path=require('path');

function loadDb(){
  const src=fs.readFileSync(
    path.join(__dirname,'..','data','exercises-db.js'),'utf8');
  const ctx={window:{}};
  vm.createContext(ctx);
  vm.runInContext(src,ctx,{filename:'exercises-db.js'});
  /* JSON round-trip: values created inside vm.runInContext carry the VM
     realm's Array/Object prototypes, which makes assert.deepStrictEqual
     fail on reference inequality. Plain JSON clones fix the realm. */
  return JSON.parse(JSON.stringify(ctx.window.FREE_EXERCISE_DB));
}
const db=loadDb();
const byName=n=>{
  const e=db.find(x=>x.name===n);
  assert.ok(e,'record exists: '+n);
  return e;
};
const muscles=(e,key)=>(e[key]||[]);

test('catalog still loads 876 records',()=>{
  assert.equal(db.length,876);
});

/* A. Wrong primaries. */
test('Split Squats: prime movers are primary, matching sibling variants',()=>{
  /* #541: Barbell Side Split Squat, Smith Single-Leg Split Squat,
     Split Squat with Dumbbells, Suspended Split Squat are all
     P:quadriceps+glutes with hamstrings/adductors/calves secondary. */
  const e=byName('Split Squats');
  assert.deepEqual(muscles(e,'primaryMuscles'),['quadriceps','glutes']);
  assert.deepEqual(muscles(e,'secondaryMuscles'),['hamstrings','adductors','calves']);
});

test('Lower Back Curl: prone spinal extension, not an ab exercise',()=>{
  /* Its own instructions: "Using your lower back muscles, extend your
     spine lifting your chest off of the ground." */
  const e=byName('Lower Back Curl');
  assert.deepEqual(muscles(e,'primaryMuscles'),['lower back']);
});

/* B. A muscle cannot be both primary and secondary — stays primary. */
const DEDUPED={
  'All Fours Quad Stretch':[],
  'Barbell Step Ups':['hamstrings','adductors','calves'],
  'Bent-Arm Barbell Pullover':['chest','shoulders','triceps'],
  'Clean and Press':['hamstrings','lower back','traps','triceps'],
  'Hurdle Hops':['hamstrings','calves'],
  'Kneeling Hip Flexor':[],
  'Snatch Deadlift':['quadriceps','lower back','traps','forearms'],
  'Split Snatch':['traps','shoulders','lower back','forearms'],
  'Upper Back Stretch':[],
};
for(const [name,want] of Object.entries(DEDUPED)){
  test(name+': duplicated muscle removed from secondary',()=>{
    const e=byName(name);
    assert.deepEqual(muscles(e,'secondaryMuscles'),want);
    const both=muscles(e,'primaryMuscles')
      .filter(m=>muscles(e,'secondaryMuscles').includes(m));
    assert.deepEqual(both,[],'no primary/secondary overlap');
  });
}

/* C. Missing secondaries. */
test('Zercher Squats: the Zercher hold loads the back isometrically',()=>{
  /* #541: quads+glutes are the prime movers; hamstrings and the isometric
     back/biceps hold are secondary. */
  const e=byName('Zercher Squats');
  assert.deepEqual(muscles(e,'primaryMuscles'),['quadriceps','glutes']);
  assert.deepEqual(muscles(e,'secondaryMuscles'),
    ['hamstrings','calves','middle back','lower back','biceps']);
});

test('One-Arm Kettlebell Clean and Jerk: the dip-drive is leg-driven',()=>{
  /* #541: same corrected assignment as the barbell Clean and Press. */
  const e=byName('One-Arm Kettlebell Clean and Jerk');
  assert.deepEqual(muscles(e,'primaryMuscles'),['quadriceps','glutes','shoulders']);
  assert.deepEqual(muscles(e,'secondaryMuscles'),
    ['hamstrings','lower back','traps','triceps']);
});

test('Pelvic Tilt Into Bridge: a bridge is hip extension',()=>{
  /* #541: glutes are primary; hamstrings and lower back assist. */
  const e=byName('Pelvic Tilt Into Bridge');
  assert.deepEqual(muscles(e,'primaryMuscles'),['glutes']);
  assert.deepEqual(muscles(e,'secondaryMuscles'),['hamstrings','lower back']);
});

/* Global invariants across all 876 records. */
test('every record has at least one primary muscle',()=>{
  const bad=db.filter(e=>!(e.primaryMuscles||[]).length);
  assert.deepEqual(bad.map(e=>e.name),[]);
});

test('no record lists a muscle as both primary and secondary',()=>{
  const bad=db.filter(e=>
    (e.primaryMuscles||[]).some(m=>(e.secondaryMuscles||[]).includes(m)));
  assert.deepEqual(bad.map(e=>e.name),[]);
});
