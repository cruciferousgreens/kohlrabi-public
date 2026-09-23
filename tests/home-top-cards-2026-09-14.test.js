/* User 2026-09-14, two Home changes:
   1. "Ready?" hero: when a live draft exists, the hero's
      starter card IS the Workout-in-progress card (same green card) — the
      Log-your-first-workout starter is removed. The standalone #workoutInProgressCard
      hides on the empty screen so the card doesn't show twice.
   2. The Continue-program quick jump moves out of the Active program card to
      the top of Home (#dashboardContinueProgram, below the week strip). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname,'..','assets','js','pages','dashboard-stats.js'),'utf8');

function makeDom(){
  const els = {};
  function el(id){
    if(!els[id]){
      els[id] = {
        id, hidden: true, innerHTML: '',
        dataset: {},
        classList: { add(){}, remove(){} },
        addEventListener(){},
      };
    }
    return els[id];
  }
  global.document = { querySelector: (s)=> s.startsWith('#') ? el(s.slice(1)) : null };
  global.$ = (s)=> document.querySelector(s);
  return els;
}

global.escapeHtml = (s)=> String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
global.draftProgramLine = ()=> '';
global.showWorkouts = ()=>{};
global.startBlankWorkout = ()=>{};
global.renderWorkoutScreen = ()=>{};
global.window = { scrollTo(){} };

function evalFn(name){
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start !== -1, `${name} exists`);
  const end = src.indexOf('\n    }', start) + '\n    }'.length;
  /* Wrap as a function expression so eval returns it; park on global so the
     eval'd renderers (and their bare cross-references) resolve. */
  global[name] = eval(`(${src.slice(start, end)})`);
}

/* continueWorkoutCardHtml is needed by the hero test. */
evalFn('continueWorkoutCardHtml');
/* #457: renderDashEmptyHero / renderDashboardContinueProgram now share these
   helpers — eval them too so the isolated renderers resolve. */
evalFn('dashEmptyHeroHtml');
evalFn('dashboardNextWorkout');
evalFn('continueProgramCardHtml');

function renderHero(){ renderDashEmptyHero(); }
function renderWip(){ renderWorkoutInProgressCard(); }
function renderContinue(){ renderDashboardContinueProgram(); }
function renderProgram(){ renderDashboardProgram(); }

test('hero: live draft replaces the Log-your-first-workout starter with the workout card', ()=>{
  const els = makeDom();
  global.workoutState = {
    completed: [],
    draft: { name: 'Workout', exercises: [] },
  };
  global.state = {};
  evalFn('renderDashEmptyHero');
  renderHero();
  const html = els['dashEmptyHero'].innerHTML;
  assert.equal(els['dashEmptyHero'].hidden, false);
  assert.match(html, /heroWorkoutInProgress/);
  assert.match(html, /continue-workout-card/);
  assert.match(html, /Empty draft — tap to add exercises/);
  assert.doesNotMatch(html, /startFirstWorkout/);
  assert.doesNotMatch(html, /Log your first workout/);
});

test('hero: no draft keeps the Start-blank-workout starter', ()=>{
  const els = makeDom();
  global.workoutState = { completed: [], draft: null };
  global.state = {};
  evalFn('renderDashEmptyHero');
  renderHero();
  const html = els['dashEmptyHero'].innerHTML;
  assert.match(html, /startFirstWorkout/);
  assert.match(html, /Start blank workout/);
  assert.doesNotMatch(html, /heroWorkoutInProgress/);
});

test('hero hidden once workouts are completed', ()=>{
  const els = makeDom();
  global.workoutState = { completed: [{id:'w1'}], draft: null };
  global.state = {};
  evalFn('renderDashEmptyHero');
  renderHero();
  assert.equal(els['dashEmptyHero'].hidden, true);
});

test('standalone workout card hides on the empty-data screen (hero owns it)', ()=>{
  const els = makeDom();
  global.workoutState = {
    completed: [],
    draft: { name: 'Workout', exercises: [{ sets: [] }] },
  };
  global.state = {};
  evalFn('renderWorkoutInProgressCard');
  renderWip();
  assert.equal(els['workoutInProgressCard'].hidden, true);
});

test('standalone workout card still shows once data exists', ()=>{
  const els = makeDom();
  global.workoutState = {
    completed: [{id:'w1'}],
    draft: { name: 'Workout', exercises: [{ sets: [{complete:false}] }] },
  };
  global.state = {};
  evalFn('renderWorkoutInProgressCard');
  renderWip();
  assert.equal(els['workoutInProgressCard'].hidden, false);
  assert.match(els['workoutInProgressCard'].innerHTML, /continue-kicker/);
  assert.match(els['workoutInProgressCard'].innerHTML, /1 exercise · 0\/1 sets done/);
});

test('continue program card renders at the top slot (not nested)', ()=>{
  const els = makeDom();
  global.workoutState = {
    completed: [{id:'w1'}],
    draft: null,
    activeProgram: { id: 'p1', name: 'Base block', length: 8, workouts: [{uid:'w1',name:'Workout A'}] },
  };
  global.state = {};
  global.suggestedProgramWorkout = ()=>({ uid: 'w1', name: 'Workout A', template: { exercises: [{},{}] } });
  global.programWeek = ()=>1;
  global.programWorkoutRangeLabel = ()=>'Mixed ranges';
  global.startProgramWorkout = ()=>{};
  evalFn('renderDashboardContinueProgram');
  renderContinue();
  const slot = els['dashboardContinueProgram'];
  assert.equal(slot.hidden, false);
  assert.match(slot.innerHTML, /startDashboardNext/);
  assert.match(slot.innerHTML, /Continue program/);
  assert.match(slot.innerHTML, /Workout A/);
  assert.match(slot.innerHTML, /Week 1 · 2 exercises · Mixed ranges/);
});

test('continue program slot hides with a live draft or no program', ()=>{
  const els = makeDom();
  global.state = {};
  global.suggestedProgramWorkout = ()=>({ uid: 'w1', name: 'Workout A', template: { exercises: [] } });
  global.programWeek = ()=>1;
  global.workoutState = { completed: [], draft: { name: 'W', exercises: [] }, activeProgram: { id: 'p1' } };
  evalFn('renderDashboardContinueProgram');
  renderContinue();
  assert.equal(els['dashboardContinueProgram'].hidden, true);
  global.workoutState = { completed: [], draft: null, activeProgram: null };
  renderContinue();
  assert.equal(els['dashboardContinueProgram'].hidden, true);
});

test('active program card no longer nests the continue button', ()=>{
  const els = makeDom();
  global.workoutState = {
    completed: [{id:'w1'}],
    draft: null,
    activeProgram: { id: 'p1', name: 'Base block', length: 8, workouts: [{uid:'w1',name:'Workout A'}] },
  };
  global.state = {};
  global.showProgram = ()=>{};
  global.suggestedProgramWorkout = ()=>({ uid: 'w1', name: 'Workout A' });
  global.programWeek = ()=>1;
  evalFn('renderDashboardProgram');
  renderProgram();
  const html = els['dashboardProgram'].innerHTML;
  assert.match(html, /Base block/);
  assert.match(html, /Open program/);
  assert.doesNotMatch(html, /startDashboardNext/);
  assert.doesNotMatch(html, /Continue program/);
});

test('dashboard renders the continue-program slot', ()=>{
  const start = src.indexOf('function renderDashboard()');
  assert.ok(start !== -1, 'renderDashboard exists');
  const body = src.slice(start, src.indexOf('\n    }', start));
  assert.match(body, /renderDashboardContinueProgram\(\)/);
});

test('index.html has the continue-program slot after the workout card', ()=>{
  const html = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const wip = html.indexOf('id="workoutInProgressCard"');
  const slot = html.indexOf('id="dashboardContinueProgram"');
  assert.ok(wip !== -1 && slot !== -1 && slot > wip, 'slot exists after the workout card');
});
