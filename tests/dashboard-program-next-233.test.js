'use strict';
/* Role: #233 — Home Active Program card quick-jump. User 2026-09-14: the
   quick jump moved OUT of the Active program card to the top of Home
   (#dashboardContinueProgram, below the week strip), rendered by
   renderDashboardContinueProgram. Shown only when no live draft exists. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

function makeEl(){
  const listeners={};
  return {
    innerHTML:'',
    hidden:false,
    addEventListener:(t,fn)=>{listeners[t]=fn;},
    listeners,
  };
}

describe('#233 active-program quick jump (top slot)',()=>{
  let els, started;
  /* loadRole once per process: re-loading re-declares const globals. */
  const role=loadRole('stats-math');
  beforeEach(()=>{
    els={'#dashboardProgram':makeEl(),'#dashboardContinueProgram':makeEl(),'#openDashboardProgram':makeEl(),'#startDashboardNext':makeEl()};
    started=null;
    globalThis.document.querySelector=(sel)=>els[sel]||null;
    globalThis.suggestedProgramWorkout=()=>({uid:'w1',name:'Push Day',template:{exercises:[{},{},{}]}});
    globalThis.programWorkoutRangeLabel=()=>'Mixed ranges';
    globalThis.startProgramWorkout=()=>{started=true;};
    globalThis.showProgram=()=>{};
    globalThis.programWeek=()=>2;
    role.workoutState.draft=null;
    role.workoutState.completed=[];
    role.workoutState.activeProgram={id:'p1',name:'Base',length:8,workouts:[{uid:'w1'}]};
  });

  it('shows the program-next card in the top slot when no live draft',()=>{
    role.renderDashboardContinueProgram();
    const slot=els['#dashboardContinueProgram'];
    assert.equal(slot.hidden,false,'slot hidden');
    const html=slot.innerHTML;
    assert.ok(html.includes('id="startDashboardNext"'),'missing start button');
    assert.ok(html.includes('program-next-main'),'not the program-next card');
    assert.ok(html.includes('Continue program'),'missing kicker');
    assert.ok(html.includes('<strong>Push Day</strong>'),'button names the next workout');
    assert.ok(html.includes('3 exercises'),'meta shows the exercise count');
    assert.ok(html.includes('program-next-arrow'),'missing chevron');
  });

  it('active program card no longer nests the quick jump',()=>{
    role.renderDashboardProgram();
    const html=els['#dashboardProgram'].innerHTML;
    assert.ok(!html.includes('startDashboardNext'),'quick jump still nested');
    assert.ok(html.includes('id="openDashboardProgram"'),'missing Open program');
    assert.ok(html.includes('Base'),'missing program name');
  });

  it('hides the quick jump while a live draft exists',()=>{
    role.workoutState.draft={name:'',exercises:[]};
    role.renderDashboardContinueProgram();
    assert.equal(els['#dashboardContinueProgram'].hidden,true,'slot shown during live draft');
  });

  it('omits the quick jump when no next workout is suggested',()=>{
    globalThis.suggestedProgramWorkout=()=>null;
    role.renderDashboardContinueProgram();
    assert.equal(els['#dashboardContinueProgram'].hidden,true,'slot shown with no suggestion');
  });

  it('clicking the quick jump starts the suggested workout',()=>{
    role.renderDashboardContinueProgram();
    els['#startDashboardNext'].listeners.click();
    assert.ok(started,'startProgramWorkout not called');
  });
});
