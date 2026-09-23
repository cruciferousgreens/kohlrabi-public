'use strict';
/* #508 acceptance: on the real 876-exercise catalog, searching "squat",
   "bench", "deadlift", "curl", "press" shows the barbell/dumbbell/bodyweight
   versions at the top of their relevance tier. The within-tier float never
   outranks a better tier — but the user's 2026-09-16 canonical-lift rule sits
   above tiers entirely: the plain barbell/dumbbell variant of the searched
   lift ("Barbell Bench Press" for "bench press") ranks first, ahead of
   chains/bands/powerlifting variants. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {rankedExerciseMatches,exerciseSearchScore,state}=loadRole('catalog-db-logic');

const tierOf=(ex,q)=>{const s=exerciseSearchScore(ex,q);return s>=100?0:s>=85?1:s>=75?2:3;};
const STANDARD=new Set(['barbell','dumbbell','body only']);
const isStandard=ex=>STANDARD.has(ex.equipment);
const indexOf=(q,name)=>rankedExerciseMatches(q,200).findIndex(x=>x.name===name);

describe('#508 acceptance — standard equipment tops each relevance tier',()=>{
  for(const q of ['squat','bench','deadlift','curl','press']){
    it(`"${q}": within every relevance tier, standard-equipment versions sort first`,()=>{
      const rows=rankedExerciseMatches(q,80);
      const byTier=new Map();
      rows.forEach(ex=>{
        const t=tierOf(ex,q);
        if(!byTier.has(t))byTier.set(t,[]);
        byTier.get(t).push(ex);
      });
      for(const [t,group] of byTier){
        const seq=group.map(ex=>isStandard(ex)?0:1);
        assert.deepEqual([...seq].sort(),seq,`"${q}" tier ${t} must list standard equipment first`);
      }
    });
  }
  it('"squat": barbell Box Squat outranks machine Hack Squat (same tier)',()=>{
    assert.ok(indexOf('squat','Box Squat')<indexOf('squat','Hack Squat'));
  });
  it('"bench": merged #539 variants are invisible — Barbell Bench Press tops, powerlifting/bands variants gone',()=>{
    assert.equal(indexOf('bench','Barbell Bench Press'),0);
    assert.equal(indexOf('bench','Bench Press - Powerlifting'),-1);
    assert.equal(indexOf('bench','Bench Press - With Bands'),-1);
  });
  it('"deadlift": barbell Sumo Deadlift outranks other-equipment Car Deadlift (same tier)',()=>{
    assert.ok(indexOf('deadlift','Sumo Deadlift')<indexOf('deadlift','Car Deadlift'));
  });
  it('"curl": dumbbell Hammer Curls outranks e-z-bar EZ-Bar Curl (same tier)',()=>{
    assert.ok(indexOf('curl','Hammer Curls')<indexOf('curl','EZ-Bar Curl'));
  });
  it('"press": barbell Push Press outranks machine Leg Press (same tier)',()=>{
    assert.ok(indexOf('press','Push Press')<indexOf('press','Leg Press'));
  });
  it('kettlebell stays non-standard (TBD): barbell Push Press outranks kettlebells Bent Press',()=>{
    assert.ok(indexOf('press','Push Press')<indexOf('press','Bent Press'));
  });
  it('plain barbell/dumbbell variants cross tiers (user 2026-09-17): "bench" opens Barbell/Dumbbell Bench Press, above tier-1 Bench Sprint',()=>{
    const rows=rankedExerciseMatches('bench',40);
    assert.equal(rows[0].name,'Barbell Bench Press');
    assert.equal(rows[1].name,'Dumbbell Bench Press');
    const sprint=rows.find(x=>x.name==='Bench Sprint');
    assert.ok(sprint,'Bench Sprint still matches');
    assert.ok(rows.indexOf(sprint)>1,'the plain variants sit above the tier-1 non-barbell match');
  });
  it('plain barbell/dumbbell variants cross tiers (user 2026-09-17): "row" opens with barbell/dumbbell rows, above Rowing, Stationary',()=>{
    const rows=rankedExerciseMatches('row',25);
    const stationary=rows.find(x=>x.name==='Rowing, Stationary');
    assert.ok(stationary,'Rowing, Stationary still matches');
    assert.ok(rows.indexOf(stationary)>0,'a barbell/dumbbell row variant ranks first');
    assert.ok(['barbell','dumbbell'].includes(rows[0].equipment),'the top row result is barbell or dumbbell');
  });
  it('canonical lift (user 2026-09-16): "bench press" opens with the plain barbell/dumbbell variants',()=>{
    const names=rankedExerciseMatches('bench press',10).map(x=>x.name);
    assert.deepEqual(names.slice(0,2),['Barbell Bench Press','Dumbbell Bench Press']);
  });
  it('canonical lift: "squat" opens Barbell Squat, Dumbbell Squat',()=>{
    const names=rankedExerciseMatches('squat',10).map(x=>x.name);
    assert.deepEqual(names.slice(0,2),['Barbell Squat','Dumbbell Squat']);
  });
  it('canonical lift: "curl" opens with Barbell Curl',()=>{
    assert.equal(rankedExerciseMatches('curl',10)[0].name,'Barbell Curl');
  });
  it('canonical lift: "deadlift" opens with Barbell Deadlift',()=>{
    assert.equal(rankedExerciseMatches('deadlift',10)[0].name,'Barbell Deadlift');
  });
  it('canonical lift: "lat pulldown" opens with Lat Pulldown (post-rename exact match)',()=>{
    assert.equal(rankedExerciseMatches('lat pulldown',10)[0].name,'Lat Pulldown');
  });
  it('canonical lift: favorites still win inside the canonical group (#155 pattern)',()=>{
    state.favorites.add('Dumbbell_Bench_Press');
    try{
      const names=rankedExerciseMatches('bench press',10).map(x=>x.name);
      assert.deepEqual(names.slice(0,2),['Dumbbell Bench Press','Barbell Bench Press']);
    }finally{state.favorites.delete('Dumbbell_Bench_Press');}
  });
});
