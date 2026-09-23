/* #447 (user 2026-09-14): the "+" buttons on the Past sessions tab of the
   "add saved workout to program" dialog did nothing. Root cause: the click
   handler passed `w.exercises||[]` to `templateExercisesFromCompleted`, which
   expects the WHOLE workout (it reads `workout.exercises.map(...)`) — so
   `workout.exercises` was undefined, `.map` threw, and the add silently died.
   The fix passes `w`. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const programsSrc = fs.readFileSync(path.join(__dirname,'..','assets','js','pages','programs.js'),'utf8');

test('#447 call site passes the whole workout, not w.exercises', ()=>{
  assert.ok(
    programsSrc.includes('templateExercisesFromCompleted(w)'),
    'past-sessions handler must call templateExercisesFromCompleted(w)');
  assert.ok(
    !programsSrc.includes('templateExercisesFromCompleted(w.exercises'),
    'past-sessions handler must NOT pass w.exercises (the #447 bug)');
});

/* Functional contract of the helper: it takes a workout, not an array. */
const savedSrc = fs.readFileSync(path.join(__dirname,'..','assets','js','pages','saved-workouts.js'),'utf8');
const fnStart = savedSrc.indexOf('function templateExercisesFromCompleted(');
const fnEnd = savedSrc.indexOf('\n    }', fnStart);
const fnSrc = savedSrc.slice(fnStart, fnEnd + '\n    }'.length);
/* Stub the per-item clone — the contract under test is the argument shape,
   not the clone itself. */
global.cloneExerciseItem = (item)=> ({...item, cloned: true});
eval(fnSrc);

test('#447 helper converts a whole workout', ()=>{
  const workout = {name:'Workout', exercises:[{name:'Bench', sets:[{complete:true}]},{name:'Row', sets:[]}]};
  const out = templateExercisesFromCompleted(workout);
  assert.equal(out.length, 2);
  assert.equal(out[0].name, 'Bench');
  assert.equal(out[0].cloned, true);
});

test('#447 helper rejects a bare exercises array (the old buggy call)', ()=>{
  const workout = {name:'Workout', exercises:[{name:'Bench', sets:[]}]};
  assert.throws(
    ()=> templateExercisesFromCompleted(workout.exercises||[]),
    'passing w.exercises must throw — the handler must pass the workout');
});
