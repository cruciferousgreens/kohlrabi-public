'use strict';
/* #170 (user 2026-09-14): bodyweight stats. Unweighted bodyweight work
   generates no volume — in Volume mode it ranks and displays by sets.
   Bodyweight with added load counts real volume and ranks/displays by it,
   like any weighted exercise. Canonical volume stays weight × reps. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const catalog=[
  {id:'bench-press',name:'Barbell Bench Press',equipment:'barbell',primary:['chest'],secondary:[]},
  {id:'push-up',name:'Push-Up',equipment:'body only',primary:['chest'],secondary:[]},
  {id:'incline-push-up',name:'Incline Push-Up',equipment:'body only',primary:['chest'],secondary:[]},
  {id:'weighted-dip',name:'Weighted Dip',equipment:'body only',primary:['chest'],secondary:['triceps']},
];
const {
  renderTopExercises, exercisesForMuscle, state, workoutState,
}=loadRole('stats-math',{globals:{exercises:catalog}});

let n=0;
function set(w,r){return {uid:'s'+(++n),w:String(w),r:String(r),rpe:'',tags:[],done:true};}
function item(exerciseId,sets){return {uid:'e-'+exerciseId,exerciseId,sets};}
function workout(items){return {id:'w1',date:'2026-09-10',exercises:items};}

let els;
function fakeEl(){
  return {innerHTML:'',listeners:{},
    addEventListener(t,fn){this.listeners[t]=fn;},
    setAttribute(){},};
}
beforeEach(()=>{
  els={'#topExercises':fakeEl()};
  globalThis.document.querySelector=(sel)=>els[sel]||null;
  globalThis.document.querySelectorAll=()=>[];
  state.topExercisesMode='volume';
  workoutState.completed=[];
});

describe('#170 bodyweight in Top exercises (volume mode)',()=>{
  it('unweighted bodyweight ranks and displays by sets',()=>{
    workoutState.completed=[workout([
      item('bench-press',[set(135,8),set(135,8),set(135,8)]),
      item('push-up',[set('',12),set('',12),set('',10)]),
    ])];
    renderTopExercises(workoutState.completed);
    const html=els['#topExercises'].innerHTML;
    assert.ok(html.includes('Push-Up'),'push-up missing from top exercises');
    assert.ok(html.includes('3 sets'),'unweighted push-up not shown by sets');
  });
  it('bodyweight with added weight ranks and displays by real volume',()=>{
    workoutState.completed=[workout([
      item('bench-press',[set(135,8),set(135,8)]),
      item('weighted-dip',[set(45,8),set(45,8),set(45,8)]),
      item('push-up',[set('',12),set('',12),set('',12),set('',12),set('',12)]),
    ])];
    renderTopExercises(workoutState.completed);
    const html=els['#topExercises'].innerHTML;
    const dipIdx=html.indexOf('Weighted Dip'), pushIdx=html.indexOf('Push-Up');
    assert.ok(dipIdx>-1&&pushIdx>-1,'both exercises should appear');
    assert.ok(dipIdx<pushIdx,'weighted dip (1.1k volume) should outrank 5 unweighted sets');
    assert.ok(html.includes('1.1k'),'weighted dip not displayed by volume');
    assert.ok(html.includes('5 sets'),'unweighted push-up not displayed by sets');
  });
  it('sets mode still shows everything by sets',()=>{
    state.topExercisesMode='sets';
    workoutState.completed=[workout([item('bench-press',[set(135,8)])])];
    renderTopExercises(workoutState.completed);
    assert.ok(els['#topExercises'].innerHTML.includes('1 set'),'sets mode broken');
  });
});

describe('#170 bodyweight in muscle drill-down (volume mode)',()=>{
  const workouts=()=>[workout([
    item('weighted-dip',[set(45,8),set(45,8)]),
    item('push-up',[set('',12),set('',12),set('',12),set('',12)]),
    item('incline-push-up',[set('',10),set('',10)]),
  ])];
  it('weighted bodyweight sorts by volume; unweighted pair sorts by sets and stays visible',()=>{
    const drivers=exercisesForMuscle('chest',workouts(),false);
    const ids=drivers.map(([id])=>id);
    assert.deepEqual(ids,['weighted-dip','push-up','incline-push-up'],
      'dip should lead by real volume (720); unweighted pair follows by sets (4, 2)');
    assert.equal(drivers[1][1].volume,0,'unweighted driver volume stays 0');
    assert.equal(drivers[1][1].sets,4);
  });
  it('weighted bodyweight driver sorts by volume',()=>{
    const drivers=exercisesForMuscle('triceps',workouts(),false);
    assert.equal(drivers.length,1,'only the dip drives triceps');
    assert.equal(drivers[0][0],'weighted-dip');
    assert.equal(drivers[0][1].volume,720*0.45,'secondary muscle gets 45% of set volume');
  });
});
