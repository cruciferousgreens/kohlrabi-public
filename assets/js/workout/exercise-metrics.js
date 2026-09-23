/* =====================================================================
   module: exercise-metrics.js
   Depends on: (none — pure helpers; stampNonVolumeFlags reads the global
   `exercises` catalog when present)
   Loaded after: exercise-library.js, before: workout-builder.js, exercise-detail.js,
                 workout-editor.js, workout-history.js, progression.js, dashboard-stats.js
   ---------------------------------------------------------------------
   Distance/time/load metric exercises (#498).

   Some movements are logged as load + distance (sled pushes, carries) or
   load + time rather than the standard load × reps. Those sets never
   contribute to weight×reps volume, and the workout UI renders a distance
   (or time) performance column in place of reps.

   Nothing here rewrites exercise IDs or existing logged records. Metric
   profiles are DERIVED from the tracking field and a small curated
   overlay, so every old workout keeps behaving exactly as before.

   Public surface:
     exerciseMetrics(ex)              ['load','reps'] | ['load','time'] | ['load','distance']
     exercisePerfField(ex)            'r' | 'seconds' | 'distance'
     setPerfField(item, ex)           performance field for a workout item
     isNonVolumeExercise(ex)          sled/carry-style movements excluded from weight×reps
     formatDistance(m)                "40 m"
     detectDistancePRs(currentSets, priorSets)
   ===================================================================== */
(function(){
  'use strict';

  /* ---------- curated overlays ----------------------------------------
     NON_VOLUME_METRICS: movement DB ids logged as load + distance (or time)
     rather than load × reps. Curated by id — the word "sled" alone would
     also catch Sled Row / Sled Overhead Triceps Extension, which are normal
     reps exercises. */
  const NON_VOLUME_METRICS={
    'Sled_Push':['load','distance'],
    'Prowler_Sprint':['load','distance'],
    'Farmers_Walk':['load','distance'],
    'Yoke_Walk':['load','distance'],
    'Rickshaw_Carry':['load','distance'],
    'Bear_Crawl_Sled_Drags':['load','distance'],
    'Sled_Drag_-_Harness':['load','distance'],
    'Sled_Overhead_Backward_Walk':['load','distance'],
  };

  /* ---------- metrics (#498) ------------------------------------------- */
  function exerciseMetrics(ex){
    if(!ex)return ['load','reps'];
    if(Array.isArray(ex.metrics)&&ex.metrics.length)return ex.metrics.slice();
    if(ex.tracking==='distance'||NON_VOLUME_METRICS[ex.id])return ['load','distance'];
    const t=ex.tracking||'reps';
    return (t==='time'||t==='seconds')?['load','time']:['load','reps'];
  }
  /* The set field this exercise performs on: 'distance', 'seconds', or 'r' (reps). */
  function exercisePerfField(ex){
    const metrics=exerciseMetrics(ex);
    if(metrics.includes('distance'))return 'distance';
    if(metrics.includes('time'))return 'seconds';
    return 'r';
  }
  /* Performance field for a workout exercise ITEM: the item's metrics can
     override the catalog default (live "track" toggle). */
  function setPerfField(item, ex){
    const metrics=item&&item.metrics?item.metrics:exerciseMetrics(ex);
    if(metrics.includes('distance'))return 'distance';
    if(metrics.includes('time'))return 'seconds';
    const t=(item&&item.tracking)||(ex&&ex.tracking)||'reps';
    return (t==='time'||t==='seconds')?'seconds':'r';
  }
  /* True when the exercise is distance/time-based and excluded from volume math. */
  function isNonVolumeExercise(ex){
    if(!ex)return false;
    if(ex.nonVolume)return true;
    return !!NON_VOLUME_METRICS[ex.id];
  }
  /* Formats a distance value as "N m", or an em dash for missing/invalid. */
  function formatDistance(m){
    if(m==null||m==='')return '—';
    const n=Number(m);
    if(!Number.isFinite(n))return '—';
    return `${n} m`;
  }
  /* Distance PRs mirror detectTimedPRs: improvement on longest distance.
     First-session rule like the weighted/timed paths — the first logged
     distance establishes the baseline, it isn't a PR. */
  function detectDistancePRs(currentSets, priorSets){
    const priorDistances=(priorSets||[]).map(s=>Number(s.distance)).filter(n=>n>0);
    const currentBest=Math.max(0,...(currentSets||[]).map(s=>Number(s.distance)).filter(n=>n>0));
    if(!currentBest||!priorDistances.length)return false;
    return currentBest>Math.max(...priorDistances);
  }

  /* ---------- boot: stamp catalog records ------------------------------ */
  function stampNonVolumeFlags(){
    if(typeof exercises==='undefined'||!Array.isArray(exercises))return;
    Object.keys(NON_VOLUME_METRICS).forEach(id=>{
      const ex=resolveExercise(id);
      if(ex)ex.nonVolume=true;
    });
  }
  stampNonVolumeFlags();

  /* ---------- exports --------------------------------------------------- */
  const api={
    exerciseMetrics, exercisePerfField, setPerfField,
    isNonVolumeExercise, formatDistance, detectDistancePRs,
    NON_VOLUME_METRICS,
  };
  Object.keys(api).forEach(k=>{globalThis[k]=api[k];});
})();
