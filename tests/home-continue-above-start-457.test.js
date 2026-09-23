'use strict';
/* #457 (user 2026-09-14): with an active program and a suggested next workout,
   Home's empty-state hero shows the Continue-program card directly under the
   "No workouts yet" heading (#506), ABOVE the Start-workout card — the program workout is the
   primary action. Full order: No workouts yet → Continue program → Start workout →
   Sign in → See how it works. The standalone top slot (#dashboardContinueProgram)
   stays hidden while the hero embeds the card — no duplicate. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

/* loadRole once per process: re-loading re-declares const globals. */
const role=loadRole('stats-math');
const {workoutState}=role;

function makeEl(){
  const listeners={};
  return {innerHTML:'',hidden:false,listeners,
    addEventListener(t,fn){listeners[t]=fn;},
    setAttribute(){},scrollIntoView(){},
    classList:{add(){},remove(){},contains:()=>false}};
}

let els,started;
beforeEach(()=>{
  els={
    '#dashEmptyHero':makeEl(),'#dashboardView':makeEl(),
    '#dashboardContinueProgram':makeEl(),'#startDashboardNext':makeEl(),
    '#startHeroNext':makeEl(),'#startFirstWorkout':makeEl(),'#emptySignIn':makeEl(),
  };
  started=null;
  globalThis.document.querySelector=(sel)=>els[sel]||null;
  globalThis.document.querySelectorAll=()=>[];
  globalThis.document.getElementById=(id)=>els['#'+id]||null;
  globalThis.showWorkouts=()=>{};globalThis.startBlankWorkout=()=>{};
  globalThis.showSettings=()=>{};
  delete globalThis.Sync;
  globalThis.requestAnimationFrame=(fn)=>{fn();return 0;};
  globalThis.suggestedProgramWorkout=()=>({uid:'w1',name:'Push Day',template:{exercises:[{},{},{}]}});
  globalThis.programWeek=()=>2;
  globalThis.programWorkoutRangeLabel=()=>'Mixed ranges';
  globalThis.startProgramWorkout=(p,next)=>{started={p,next};};
  globalThis.draftProgramLine=()=>'';
  workoutState.completed=[];
  workoutState.draft=null;
  workoutState.activeProgram={id:'p1',name:'Base',length:8,workouts:[{uid:'w1'}]};
});

const htmlOf=()=>els['#dashEmptyHero'].innerHTML;

describe('#457 Continue program above Start workout in the hero',()=>{
  it('pins the empty-state order: No workouts yet → Continue program → Start workout → See how it works',()=>{
    const html=role.dashEmptyHeroHtml({
      starterCardHtml:'STARTER',
      continueCardHtml:'CONTINUE',
    });
    const i=(s)=>html.indexOf(s);
    for(const s of ['No workouts yet','CONTINUE','STARTER','See how it works'])
      assert.ok(i(s)!==-1,`missing ${s}`);
    assert.ok(i('No workouts yet')<i('CONTINUE'),'Continue program is not under No workouts yet');
    assert.ok(i('CONTINUE')<i('STARTER'),'Continue program is not above Start workout');
    assert.ok(i('STARTER')<i('See how it works'),'Start workout is not above See how it works');
    assert.ok(!html.includes('emptySignIn'),'Sign in button rendered (public fork: no accounts)');
  });
  it('never shows a Sign in button, order otherwise unchanged',()=>{
    const html=role.dashEmptyHeroHtml({starterCardHtml:'STARTER',continueCardHtml:'CONTINUE'});
    assert.ok(!html.includes('emptySignIn'),'Sign in shown');
    assert.ok(html.indexOf('STARTER')<html.indexOf('See how it works'),'order wrong');
  });
  it('embeds the Continue card directly under No workouts yet when an active program has a next workout',()=>{
    role.renderDashEmptyHero();
    const html=htmlOf();
    assert.ok(html.includes('id="startHeroNext"'),'hero is missing the continue card');
    assert.ok(html.indexOf('No workouts yet')<html.indexOf('id="startHeroNext"'),'continue card not under No workouts yet');
    assert.ok(html.indexOf('id="startHeroNext"')<html.indexOf('id="startFirstWorkout"'),'continue card not above Start workout');
    assert.ok(html.includes('program-next-main'),'continue card is not the program-next card');
    assert.ok(html.includes('Continue program'),'missing kicker');
    assert.ok(html.includes('<strong>Push Day</strong>'),'card does not name the next workout');
    assert.ok(html.includes('3 exercises'),'missing exercise-count meta');
    assert.ok(html.includes('program-next-arrow'),'missing chevron');
  });
  it('the hero continue card is the same builder as the top slot (only the button id differs)',()=>{
    const p={id:'p1',name:'Base',length:8,workouts:[{uid:'w1'}]};
    const next={uid:'w1',name:'Push Day',template:{exercises:[{},{},{},{}]}};
    const a=role.continueProgramCardHtml(p,next,'startHeroNext');
    const b=role.continueProgramCardHtml(p,next,'startDashboardNext');
    assert.ok(a.includes('id="startHeroNext"'),'hero button id missing');
    assert.ok(b.includes('id="startDashboardNext"'),'slot button id missing');
    assert.equal(
      a.replace('startHeroNext','BTN'),
      b.replace('startDashboardNext','BTN'),
      'hero and slot cards differ',
    );
  });
  it('clicking the hero continue card starts the suggested program workout',()=>{
    role.renderDashEmptyHero();
    els['#startHeroNext'].listeners.click();
    assert.ok(started,'startProgramWorkout not called');
    assert.equal(started.p.id,'p1','wrong program');
    assert.equal(started.next.uid,'w1','wrong workout');
  });
  it('no active program: no continue card, hero order unchanged',()=>{
    workoutState.activeProgram=null;
    role.renderDashEmptyHero();
    const html=htmlOf();
    assert.ok(!html.includes('Continue program'),'continue card shown with no active program');
    const i=(s)=>html.indexOf(s);
    assert.ok(i('No workouts yet')<i('startFirstWorkout'),'order wrong');
    assert.ok(i('startFirstWorkout')<i('See how it works'),'order wrong');
  });
  it('a live draft keeps priority: no continue card in the hero',()=>{
    workoutState.draft={name:'Live',exercises:[]};
    role.renderDashEmptyHero();
    const html=htmlOf();
    assert.ok(!html.includes('id="startHeroNext"'),'continue card shown during a live draft');
    assert.ok(html.includes('id="heroWorkoutInProgress"'),'WIP card missing during live draft');
  });
  it('no duplicate: the top slot stays hidden while the hero embeds the card',()=>{
    role.renderDashEmptyHero();
    role.renderDashboardContinueProgram();
    const slot=els['#dashboardContinueProgram'];
    assert.equal(slot.hidden,true,'slot visible alongside the hero card');
    assert.equal(slot.innerHTML,'','slot rendered a duplicate card');
  });
  it('with workout data the hero is gone and the top slot shows the card instead',()=>{
    workoutState.completed=[{id:'w1'}];
    role.renderDashEmptyHero();
    assert.equal(htmlOf(),'','hero not emptied with workout data');
    delete els['#startHeroNext']; /* the emptied hero no longer owns the id */
    role.renderDashboardContinueProgram();
    const slot=els['#dashboardContinueProgram'];
    assert.equal(slot.hidden,false,'slot hidden with data + active program');
    assert.ok(slot.innerHTML.includes('id="startDashboardNext"'),'slot missing the card');
  });
});
