/* Continue card (user 2026-09-14): Home and the Workout start screen share ONE
   card (continueWorkoutCardHtml) for the live session — the long-standing
   green card (kicker, title, program line, counts, arrow). The two renderers
   once drifted apart (Home counted set.done, Workout counted set.complete),
   so the X/N sets line disagreed between pages; the shared builder keeps
   them in lockstep. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/* Minimal DOM stub. */
function makeDom(){
  const els = {};
  function el(id){
    if(!els[id]){
      els[id] = {
        id, hidden: true, innerHTML: '', textContent: '',
        dataset: {},
        addEventListener(){},
      };
    }
    return els[id];
  }
  global.document = { querySelector: (s)=> s.startsWith('#') ? el(s.slice(1)) : null };
  global.$ = (s)=> document.querySelector(s);
  return els;
}

/* Extract and eval the shared builder + Home renderer with stubs. */
const src = fs.readFileSync(path.join(__dirname,'..','assets','js','pages','dashboard-stats.js'),'utf8');
const fnSrc = src.slice(src.indexOf('function continueWorkoutCardHtml('));
const fnEnd = fnSrc.indexOf('\n    }', fnSrc.indexOf('card.dataset.wired'));
const fns = fnSrc.slice(0, fnEnd + '\n    }'.length);
global.escapeHtml = (s)=> String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* The shared program-line resolver lives in workout-editor.js; stub it for
   the dashboard-stats.js slice (individual tests override per-case). */
global.draftProgramLine = ()=> '';

test('card hidden when no draft', ()=>{
  const els = makeDom();
  global.workoutState = { draft: null };
  global.state = {};
  eval(fns + '\nrenderWorkoutInProgressCard();');
  assert.equal(els['workoutInProgressCard'].hidden, true);
});

test('card renders the green continue markup with counts (set.complete)', ()=>{
  const els = makeDom();
  global.workoutState = {
    completed: [{id:'w0'}],
    draft: {
      name: 'Workout',
      exercises: [
        { sets: [{complete:true},{complete:false},{complete:false}] },
        { sets: [{complete:false},{complete:false},{complete:false}] },
      ],
    },
  };
  global.state = {};
  global.showWorkouts = ()=>{};
  global.renderWorkoutScreen = ()=>{};
  global.window = { scrollTo(){} };
  eval(fns + '\nrenderWorkoutInProgressCard();');
  assert.equal(els['workoutInProgressCard'].hidden, false);
  const html = els['workoutInProgressCard'].innerHTML;
  assert.match(html, /continue-kicker/);
  assert.match(html, /Workout in progress/);
  assert.match(html, /continue-arrow/);
  assert.match(html, /2 exercises · 1\/6 sets done/);
  assert.doesNotMatch(html, /wip-/);
});

test('#443: card shows for an empty draft', ()=>{
  const els = makeDom();
  global.workoutState = { completed: [{id:'w0'}], draft: { name: 'Workout', exercises: [] } };
  global.state = {};
  eval(fns + '\nrenderWorkoutInProgressCard();');
  assert.equal(els['workoutInProgressCard'].hidden, false);
  assert.match(els['workoutInProgressCard'].innerHTML, /Empty draft — tap to add exercises/);
});

test('Home shows the draft program line (user 2026-09-14)', ()=>{
  /* Regression: Home once gated the program line on a getActiveProgram()
     helper that no longer exists, so the line silently never rendered while
     the Workout tab showed it. Both now resolve the draft's own program. */
  const els = makeDom();
  global.workoutState = {
    completed: [{id:'w0'}],
    draft: {
      name: 'Workout A', programId: 'p1', programWorkoutUid: 'w1',
      exercises: [ { sets: [{complete:true}] } ],
    },
    activeProgram: { id: 'p1', name: 'Base block', workouts: [{ uid: 'w1', name: 'Workout A' }] },
  };
  global.draftProgramLine = (draft)=>{
    if(!draft?.programId)return '';
    const p = draft.programId==='p1' ? global.workoutState.activeProgram : null;
    if(!p)return '';
    const pw = (p.workouts||[]).find(w=>w.uid===draft.programWorkoutUid);
    return `${p.name}${pw?` · ${pw.name}`:''}`;
  };
  global.state = {};
  eval(fns + '\nrenderWorkoutInProgressCard();');
  assert.equal(els['workoutInProgressCard'].hidden, false);
  assert.match(els['workoutInProgressCard'].innerHTML, /continue-program/);
  assert.match(els['workoutInProgressCard'].innerHTML, /Base block · Workout A/);
  assert.match(els['workoutInProgressCard'].innerHTML, /1 exercise · 1\/1 sets done/);
});

test('Home renderer resolves the program line like the Workout tab (no getActiveProgram)', ()=>{
  /* Source-level guard: the Home renderer must call the shared
     draftProgramLine, never the removed getActiveProgram helper. */
  const start = src.indexOf('function renderWorkoutInProgressCard()');
  assert.ok(start !== -1, 'renderWorkoutInProgressCard exists');
  const body = src.slice(start, src.indexOf('\n    }', src.indexOf('card.dataset.wired')))
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(body, /draftProgramLine\(draft\)/);
  assert.doesNotMatch(body, /getActiveProgram/);
});

test('draftProgramLine: program · workout, program-only, and empty cases', ()=>{
  const editor = fs.readFileSync(path.join(__dirname,'..','assets','js','workout','workout-editor.js'),'utf8');
  const start = editor.indexOf('function draftProgramLine(');
  assert.ok(start !== -1, 'draftProgramLine exists');
  const end = editor.indexOf('\n    }', start) + '\n    }'.length;
  global.workoutState = {
    activeProgram: { id: 'p1', name: 'Base block', workouts: [{ uid: 'w1', name: 'Workout A' }] },
    archivedPrograms: [{ id: 'p9', name: 'Old block', workouts: [] }],
  };
  global.findProgramById = (id)=>{
    if(!id)return null;
    if(global.workoutState.activeProgram?.id===id)return global.workoutState.activeProgram;
    return (global.workoutState.archivedPrograms||[]).find(p=>p.id===id) || null;
  };
  eval(editor.slice(start, end));
  assert.equal(draftProgramLine({ programId: 'p1', programWorkoutUid: 'w1' }), 'Base block · Workout A');
  assert.equal(draftProgramLine({ programId: 'p9', programWorkoutUid: 'wx' }), 'Old block');
  assert.equal(draftProgramLine({ programId: 'nope' }), '');
  assert.equal(draftProgramLine({}), '');
  assert.equal(draftProgramLine(null), '');
});

test('builder renders the program line when provided', ()=>{
  eval(fns);
  const html = continueWorkoutCardHtml({ name: 'Workout', exercises: [] }, 'Base block · Workout A');
  assert.match(html, /continue-program/);
  assert.match(html, /Base block · Workout A/);
  const noProgram = continueWorkoutCardHtml({ name: 'Workout', exercises: [] }, '');
  assert.doesNotMatch(noProgram, /continue-program/);
});

test('Workout start screen uses the shared builder (no drift)', ()=>{
  /* Source-level guard: renderContinueWorkout must render
     continueWorkoutCardHtml, not its own count markup. */
  const editor = fs.readFileSync(path.join(__dirname,'..','assets','js','workout','workout-editor.js'),'utf8');
  const start = editor.indexOf('function renderContinueWorkout()');
  assert.ok(start !== -1, 'renderContinueWorkout exists');
  const body = editor.slice(start, editor.indexOf('\n    }', start));
  assert.match(body, /continueWorkoutCardHtml\(draft,programLine\)/);
  assert.doesNotMatch(body, /sets done/);
});

test('Workout start screen wraps the card in the green class', ()=>{
  const editor = fs.readFileSync(path.join(__dirname,'..','assets','js','workout','workout-editor.js'),'utf8');
  const start = editor.indexOf('function renderContinueWorkout()');
  const body = editor.slice(start, editor.indexOf('\n    }', start));
  assert.match(body, /class="continue-workout-card"/);
  assert.doesNotMatch(body, /workout-in-progress-card/);
});

test('Home button uses the green card class', ()=>{
  const html = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(html, /<button class="continue-workout-card" id="workoutInProgressCard"/);
  assert.doesNotMatch(html, /workout-in-progress-card/);
});
