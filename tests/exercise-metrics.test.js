'use strict';
/* Role: exercise-metrics — pins #498 (distance/time/load metrics):
   - distance perf-field resolution and metric profiles
   - non-volume exclusion from standard weight×reps volume
   - distance clone/share round-trips
   - distance suggestion shape (hold distance, RPE-gated load, deload hold)
   - backward compatibility: records without metrics/distance behave as before */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const CATALOG=()=>[
  {id:'Barbell_Bench_Press',name:'Barbell Bench Press',primary:['chest'],secondary:['triceps'],equipment:'barbell'},
  {id:'Dumbbell_Bench_Press',name:'Dumbbell Bench Press',primary:['chest'],secondary:['triceps'],equipment:'dumbbell'},
  {id:'Incline_Dumbbell_Press',name:'Incline Dumbbell Press',primary:['chest'],secondary:['shoulders'],equipment:'dumbbell'},
  {id:'Sled_Push',name:'Sled Push',primary:['quadriceps'],secondary:[],equipment:'other'},
  {id:'Farmers_Walk',name:'Farmers Walk',primary:['forearms'],secondary:[],equipment:'dumbbell'},
  {id:'Plank',name:'Plank',primary:['abdominals'],secondary:[],equipment:'body only'},
];
const byId=id=>CATALOG().find(x=>x.id===id);

const role=loadRole('exercise-metrics',{globals:{exercises:CATALOG()}});
const {
  exerciseMetrics, setPerfField,
  isNonVolumeExercise, formatDistance,
  setVolume, cloneSetFields, newExerciseItem, newSet,
  shareEncodeV2, shareDecodeAny,
  progressionForExercise, workoutState, progressionSetup,
}=role;

beforeEach(()=>{
  workoutState.completed=[];
  workoutState.activeProgram=null;
  progressionSetup.units='imperial';
});

describe('#498 distance metrics',()=>{
  it('sled push resolves to the distance perf field; regular lifts stay reps',()=>{
    assert.equal(setPerfField(null,byId('Sled_Push')),'distance');
    assert.equal(setPerfField(null,byId('Barbell_Bench_Press')),'r');
    assert.equal(setPerfField(null,byId('Plank')),'r','catalog plank has no time metrics here');
  });
  it('exerciseMetrics gives distance profiles to the curated non-volume lifts',()=>{
    assert.deepEqual(exerciseMetrics(byId('Sled_Push')),['load','distance']);
    assert.deepEqual(exerciseMetrics(byId('Farmers_Walk')),['load','distance']);
    assert.deepEqual(exerciseMetrics(byId('Barbell_Bench_Press')),['load','reps']);
  });
  it('isNonVolumeExercise flags the curated list only',()=>{
    assert.ok(isNonVolumeExercise(byId('Sled_Push')));
    assert.ok(isNonVolumeExercise(byId('Farmers_Walk')));
    assert.ok(!isNonVolumeExercise(byId('Barbell_Bench_Press')));
  });
  it('formatDistance renders meters',()=>{
    assert.equal(formatDistance(40),'40 m');
    assert.equal(formatDistance(''),'—');
  });
  it('newExerciseItem stamps the distance metric profile for sled work',()=>{
    const item=newExerciseItem({exerciseId:'Sled_Push'});
    assert.deepEqual(item.metrics,['load','distance']);
    assert.equal(setPerfField(item,byId('Sled_Push')),'distance');
  });
});

describe('#498 distance clone round-trips',()=>{
  const dset=()=>({w:90,r:'',seconds:'',distance:40,rpe:8,tags:[],complete:true});
  it('cloneSetFields carries distance in every mode',()=>{
    for(const mode of ['forNewSession','forTemplate','fromTemplate','fromProgram','forEdit','forSaveTemplate']){
      const c=cloneSetFields(dset(),mode);
      if(mode==='forNewSession'||mode==='fromProgram'){
        assert.equal(c.distance,'','distance blanks in '+mode);
      }else{
        assert.equal(String(c.distance),'40','distance carried in '+mode);
      }
    }
  });
  it('newSet carries the distance field',()=>{
    assert.ok('distance' in newSet());
  });
});

describe('#498 distance share round-trips',()=>{
  it('v2 links carry distance and metrics, and decode them back',async()=>{
    const item=newExerciseItem({exerciseId:'Sled_Push',
      sets:[{uid:'s1',w:90,r:'',seconds:'',distance:40,rpe:8,targetRpe:'',tags:[],complete:true}]});
    const payload={v:2,kind:'template',name:'Sled Day',
      template:{name:'Sled Day',exercises:[item]},customExercises:[]};
    const back=await shareDecodeAny(await shareEncodeV2(payload));
    const ex0=back.template.exercises[0];
    assert.equal(ex0.exerciseId,'Sled_Push');
    assert.deepEqual(ex0.metrics,['load','distance']);
    assert.equal(String(ex0.sets[0].distance),'40');
    assert.equal(Number(ex0.sets[0].w),90);
  });
});

describe('#498 non-volume exclusion from standard volume',()=>{
  it('a distance set contributes zero volume — with or without the exercise',()=>{
    const set={w:90,r:'',distance:40};
    assert.equal(setVolume(set),0,'bare legacy call');
    assert.equal(setVolume(set,byId('Sled_Push')),0,'with exercise context');
  });
  it('a non-volume exercise contributes zero even when distance is blank',()=>{
    assert.equal(setVolume({w:90,r:''},byId('Sled_Push')),0);
  });
  it('regular weight×reps volume is untouched',()=>{
    assert.equal(setVolume({w:135,r:5},byId('Barbell_Bench_Press')),675);
    assert.equal(setVolume({w:135,r:5}),675);
  });
});

describe('#498 distance suggestions',()=>{
  const PROF=()=>({mode:'reps',min:6,max:12,scheme:'rpe'});
  const CFG=()=>({threshold:8,incrementType:'lb',incrementValue:5,timeStep:5});
  const sledLog=(w,distance,rpe)=>({id:'w1',date:'2026-09-10',name:'Sled day',
    exercises:[{exerciseId:'Sled_Push',tracking:'reps',
      sets:[
        {w:String(w),r:'',seconds:'',distance:String(distance),rpe,tags:[]},
        {w:String(w),r:'',seconds:'',distance:String(distance-10),rpe,tags:[]},
      ]}]});
  it('holds the longest distance and gates load on the RPE trigger',()=>{
    workoutState.completed=[sledLog(90,40,7)];
    const s=progressionForExercise('Sled_Push',PROF(),CFG());
    assert.ok(s.isDistance);
    assert.equal(s.nextDistance,40,'distance held at the longest set');
    assert.equal(s.nextWeight,95,'RPE 7 ≤ 8 → +5 lb');
    assert.equal(s.kind,'load');
  });
  it('holds everything when the top set beats the trigger',()=>{
    workoutState.completed=[sledLog(90,40,9)];
    const s=progressionForExercise('Sled_Push',PROF(),CFG());
    assert.equal(s,null,'#79: no change → no card');
  });
  it('scheduled deloads hold distance work steady (no card)',()=>{
    workoutState.completed=[sledLog(90,40,7)];
    const s=progressionForExercise('Sled_Push',PROF(),
      {...CFG(),currentWeek:4,pctWave:true,weeklyDeloads:[false,false,false,true],deloadPct:60});
    assert.equal(s,null,'deload holds → #79 suppresses the card');
  });
  it('linear scheme adds the increment with no RPE gate',()=>{
    workoutState.completed=[sledLog(90,40,10)];
    const s=progressionForExercise('Sled_Push',{...PROF(),scheme:'linear'},CFG());
    assert.equal(s.nextWeight,95);
    assert.equal(s.nextDistance,40);
  });
});

describe('backward compatibility',()=>{
  it('records without metrics/distance behave exactly as before',()=>{
    const set={w:135,r:5};
    assert.equal(setVolume(set,byId('Barbell_Bench_Press')),675);
    assert.equal(setPerfField({tracking:'reps',metrics:null},byId('Barbell_Bench_Press')),'r');
    assert.ok(!('angle' in newExerciseItem({exerciseId:'Barbell_Bench_Press'})),'no angle field on items');
  });
  it('legacy share links without metrics/distance still decode',async()=>{
    const payload={v:2,kind:'template',name:'Legacy',
      template:{name:'Legacy',exercises:[{
        uid:'x1',exerciseId:'Barbell_Bench_Press',tracking:'reps',
        sets:[{uid:'s1',w:135,r:5,seconds:'',rpe:8,targetRpe:'',tags:[],complete:true}],
      }]},customExercises:[]};
    const back=await shareDecodeAny(await shareEncodeV2(payload));
    const ex0=back.template.exercises[0];
    assert.equal(ex0.sets[0].r,5);
    assert.ok(!('angle' in ex0),'no angle field rides the link');
  });
});
