'use strict';
/* User 2026-09-14: fresh accounts (no workout data) see a "Ready?" hero at
   the top of Home (#506, v1.8: the onboarding flow v2 lands here) — #504
   (v1.8): the headline states the state with the value explanation under
   it; a Start-workout card in the program-next card styling, a Sign-in
   button while signed out, and a bold
   See-how-it-works link that opens in a new tab. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {renderDashEmptyHero,workoutState}=loadRole('stats-math');

const GUIDE_URL='https://cruciferousgreens.com/getting-started';
let els, actions, dashClasses;
function fakeEl(){
  return {innerHTML:'',hidden:false,listeners:{},
    addEventListener(t,fn){this.listeners[t]=fn;},
    setAttribute(){},scrollIntoView(){},
    classList:{add:(c)=>dashClasses.add(c),remove:(c)=>dashClasses.delete(c),contains:(c)=>dashClasses.has(c)}};
}
beforeEach(()=>{
  dashClasses=new Set();
  els={'#dashEmptyHero':fakeEl(),'#startFirstWorkout':fakeEl(),'#emptySignIn':fakeEl(),'#dashboardView':fakeEl(),'#startHeroProgramSetup':fakeEl(),'#startHeroNext':fakeEl()};
  actions=[];
  globalThis.document.querySelector=(sel)=>els[sel]||null;
  globalThis.document.querySelectorAll=()=>[];
  globalThis.document.getElementById=(id)=>els['#'+id]||null;
  globalThis.showWorkouts=()=>actions.push('showWorkouts');
  globalThis.startBlankWorkout=()=>actions.push('startBlankWorkout');
  globalThis.showSettings=()=>actions.push('showSettings');
  globalThis.showProgram=()=>actions.push('showProgram');
  delete globalThis.Sync;
  globalThis.requestAnimationFrame=(fn)=>{fn();return 0;};
  workoutState.completed=[];
  workoutState.activeProgram=null;
});
function heroHtml(){return els['#dashEmptyHero'].innerHTML;}

describe('"No workouts yet" hero (no workout data)',()=>{
  it('uses the Workout tab no-data card register: training-hero, headline, value sub, primary Start blank workout button',()=>{
    renderDashEmptyHero();
    assert.equal(els['#dashEmptyHero'].hidden,false,'hero hidden');
    const html=heroHtml();
    assert.ok(html.includes('training-hero'),'hero is not the training-hero card');
    assert.ok(html.includes('<h2>No workouts yet</h2>'),'missing headline');
    assert.ok(!html.includes('Ready?'),'Ready? must be gone');
    assert.ok(html.includes('Your training week, program, and progress will live here.'),'missing value sub');
    assert.ok(html.includes('id="startFirstWorkout"'),'missing start button');
    assert.ok(html.includes('primary-button'),'start is not the primary button');
    assert.ok(html.includes('>Start blank workout</button>'),'wrong start label');
  });
  it('shows the bold See-how-it-works link opening in a new tab',()=>{
    renderDashEmptyHero();
    const html=heroHtml();
    assert.ok(html.includes(GUIDE_URL),'missing guide URL');
    assert.ok(html.includes('target="_blank"'),'link does not open in a new tab');
    assert.ok(html.includes('rel="noopener"'),'missing rel=noopener');
    assert.ok(html.includes('<strong>'),'See how it works is not bold');
    assert.ok(html.includes('>See how it works</a>'),'missing See how it works text');
  });
  it('never shows a Sign in button (public fork: no accounts)',()=>{
    renderDashEmptyHero();
    assert.ok(!heroHtml().includes('emptySignIn'),'Sign in button rendered');
    assert.ok(!heroHtml().includes('>Sign in</button>'),'sign-in label rendered');
  });
  it('clicking the start card opens a blank workout',()=>{
    renderDashEmptyHero();
    els['#startFirstWorkout'].listeners.click();
    assert.deepEqual(actions,['showWorkouts','startBlankWorkout']);
  });

  it('hides the hero once the user has workout data',()=>{
    workoutState.completed=[{id:'w1'}];
    renderDashEmptyHero();
    assert.equal(els['#dashEmptyHero'].hidden,true,'hero visible with data');
    assert.equal(heroHtml(),'','hero not emptied');
    assert.ok(!dashClasses.has('dash-is-empty'),'dash-is-empty not removed');
  });
  it('marks the dashboard empty-only while the hero shows',()=>{
    renderDashEmptyHero();
    assert.ok(dashClasses.has('dash-is-empty'),'calendar/grid not hidden behind the hero');
  });
  it('#449: no program yet — the Program option is a "Create a program" option card',()=>{
    renderDashEmptyHero();
    const html=heroHtml();
    assert.ok(html.includes('id="startHeroProgramSetup"'),'missing program option card');
    assert.ok(html.includes('start-option'),'program card is not the start-option card');
    assert.ok(html.includes('<strong>Create a program</strong>'),'program card wrong title');
    assert.ok(html.includes('Structure your training into a plan.'),'program card wrong subtitle');
  });
  it('#449: the program card sits after the start-workout button, before See how it works',()=>{
    renderDashEmptyHero();
    const html=heroHtml();
    const iStart=html.indexOf('startFirstWorkout'), iProg=html.indexOf('startHeroProgramSetup');
    const iGuide=html.indexOf('See how it works');
    assert.ok(iStart>=0&&iProg>=0&&iGuide>=0,'missing cards');
    assert.ok(iStart<iProg&&iProg<iGuide,'program card order wrong');
    assert.ok(!html.includes('emptySignIn'),'Sign in button rendered (public fork: no accounts)');
  });
  it('#449: clicking the program card opens the program builder',()=>{
    renderDashEmptyHero();
    els['#startHeroProgramSetup'].listeners.click();
    assert.deepEqual(actions,['showProgram']);
  });
  it('#449: no program card when an active program already exists',()=>{
    /* dashboardNextWorkout lives in programs.js, outside this role — the
       program's next-workout resolution isn't under test here. */
    globalThis.suggestedProgramWorkout=()=>null;
    workoutState.activeProgram={id:'p1',name:'Base',length:4,workouts:[]};
    renderDashEmptyHero();
    delete globalThis.suggestedProgramWorkout;
    assert.ok(!heroHtml().includes('startHeroProgramSetup'),'program card shown with an active program');
  });
});
