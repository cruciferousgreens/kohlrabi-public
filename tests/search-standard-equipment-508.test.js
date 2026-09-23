'use strict';
/* #508: standard equipment gets ranking priority INSIDE the relevance tier
   (same pattern as the #155 favorites float — it never outranks a better
   tier). Small fixture catalog so the tier/favorite interactions are exact. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const fixture=[
  {id:'sq-machine',name:'Squat Machine',force:'push',equipment:'machine',
   primary:['quadriceps'],secondary:[],category:'strength',tracking:'reps'},
  {id:'bb-squat',name:'Barbell Back Squat',force:'push',equipment:'barbell',
   primary:['quadriceps'],secondary:[],category:'strength',tracking:'reps'},
  {id:'cable-squat',name:'Cable Squat Press',force:'push',equipment:'cable',
   primary:['quadriceps'],secondary:[],category:'strength',tracking:'reps'},
  {id:'bw-squat',name:'Bodyweight Squat Hold',force:'static',equipment:'body only',
   primary:['quadriceps'],secondary:[],category:'strength',tracking:'reps'},
];
const {rankedExerciseMatches,exerciseSearchScore,state}=loadRole('utilities',{globals:{exercises:fixture}});
const ids=q=>rankedExerciseMatches(q).map(x=>x.id);
const tierOf=(ex,q)=>{const s=exerciseSearchScore(ex,q);return s>=100?0:s>=85?1:s>=75?2:3;};

beforeEach(()=>{state.favorites.clear();});

describe('#508 standard-equipment float (fixture catalog)',()=>{
  it('plain barbell variant tops the search, crossing tiers (user 2026-09-17)',()=>{
    assert.deepEqual(ids('squat'),['bb-squat','sq-machine','bw-squat','cable-squat']);
  });
  it('tier discipline still applies where the plain-variant rule does not fire: prefix machine stays above body-only/cable substring matches',()=>{
    const order=ids('squat');
    assert.equal(order[0],'bb-squat','plain barbell variant of the searched lift ranks first');
    assert.ok(order.indexOf('sq-machine')<order.indexOf('bw-squat'),'body-only still does not cross into a better tier');
    assert.ok(order.indexOf('sq-machine')<order.indexOf('cable-squat'));
    assert.ok(tierOf(fixture[1],'squat')>tierOf(fixture[0],'squat'));
  });
  it('a favorite outside the plain-variant group cannot enter it; favorites still win within their tier',()=>{
    state.favorites.add('cable-squat');
    assert.deepEqual(ids('squat'),['bb-squat','sq-machine','cable-squat','bw-squat']);
  });
  it('body-only counts as standard (bodyweight)',()=>{
    const order=ids('squat');
    assert.ok(order.indexOf('bw-squat')<order.indexOf('cable-squat'));
  });
});
