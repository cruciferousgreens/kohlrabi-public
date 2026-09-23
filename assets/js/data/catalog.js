/* ===== module: catalog.js ===== */
    /** Normalizes the bundled exercise database (records live in
        exercise-data.js, #99 B19) into the app's lightweight exercise model. */
        /* Module map (v1.006) — Key: `exercises` — the normalized catalog every picker and detail view reads. Depends on: window.FREE_EXERCISE_DB from data/exercises-db.js (exercise-data.js's coreExercises is only the fallback when the DB script fails to load). */

    /* #280 (user 2026-09-13): cardio exercises default to time tracking — a
       conditioning movement should open on the Seconds segment, not Reps.
       Pure so tests can pin it. */
    function defaultExerciseTracking(x){
      return x.force === 'static' || x.category === 'cardio' ? 'time' : 'reps';
    }
    /* #99 C18: let, NOT const — mergeCustomExercises() and wipeLocalUserData()
       reassign the whole array (customs added / data wiped), not just its
       contents. Changing this to const breaks the app. */
    let exercises = Array.isArray(window.FREE_EXERCISE_DB) ? window.FREE_EXERCISE_DB.map(x => ({
      id: x.id,
      name: x.name,
      force: x.force,
      level: x.level,
      mechanic: x.mechanic,
      equipment: x.equipment,
      primary: x.primaryMuscles || [],
      secondary: x.secondaryMuscles || [],
      category: x.category,
      tracking: defaultExerciseTracking(x),
      instructions: x.instructions || [],
      images: x.images || [],
      /* #539: variant entries carry aliasOf -> canonical id. Variants are
         invisible consolidation — lookups resolve to the canonical. */
      aliasOf: x.aliasOf || null
    })).filter(x => x.id && x.name) : coreExercises;

    /* #539 (user 2026-09-17): exercise-name consolidation. Nothing is
       deleted — variant entries keep their full records and gain aliasOf.
       canonicalExerciseId() follows the alias to the canonical id (old saved
       workouts, history, and shared links referencing variant ids keep
       working); resolveExercise() returns the canonical entry itself.
       Custom exercises never carry aliasOf and are untouched. */
    /* #546 (2026-09-19): cached id→entry map. The catalog array is built
       once at load, so a lazily-built Map (rebuilt if the array identity
       ever changes) turns every lookup from O(n) into O(1). The #539
       resolveExercise() called canonicalExerciseId() INSIDE the .find()
       predicate — an O(n) scan per catalog entry, i.e. O(n²), ~767k ops per
       call on the 876-entry catalog — which made Logs and editor renders
       take the better part of a second. Same keying as the established
       exerciseById() cache in dashboard-stats.js. */
    let _exerciseMapFor=null,_exerciseMapCache=null;
    /* Lazily-built id→entry map; rebuilt when the catalog array identity changes. */
    function _exerciseMap(){
      if(_exerciseMapFor!==exercises){
        _exerciseMapFor=exercises;
        _exerciseMapCache=new Map();
        if(Array.isArray(exercises))for(const x of exercises)if(x&&x.id!=null&&!_exerciseMapCache.has(x.id))_exerciseMapCache.set(x.id,x);
      }
      return _exerciseMapCache;
    }
    /* #563: the map caches by array identity, so an in-place mutation
       (share.js unshifts imported custom exercises) left it stale —
       resolveExercise missed the new entries until reload. Call this after
       any in-place catalog edit. */
    function invalidateExerciseMap(){_exerciseMapFor=null;_exerciseMapCache=null;}
    /* Follows aliasOf to the canonical exercise id. */
    function canonicalExerciseId(id){
      if(!id||typeof exercises==='undefined'||!Array.isArray(exercises))return id;
      let cur=_exerciseMap().get(id);
      const seen=new Set();
      while(cur&&cur.aliasOf&&!seen.has(cur.id)){
        seen.add(cur.id);
        cur=_exerciseMap().get(cur.aliasOf);
      }
      return cur?cur.id:id;
    }
    /* Returns the canonical catalog entry for an id (undefined when missing). */
    function resolveExercise(id){
      if(typeof exercises==='undefined'||!Array.isArray(exercises))return undefined;
      return _exerciseMap().get(canonicalExerciseId(id));
    }
