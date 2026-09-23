/* ===== module: formulas/volume.js ===== */
    /** Training-volume math.
        Plain-English rule: one set's volume is weight × reps (both stored in
        canonical units: lb and reps). Distance-tracked sets (sled, carries)
        and non-volume exercises (stretches, mobility) contribute 0 — see the
        #498 notes on setVolume. Muscle-volume attribution counts a set fully
        toward each primary muscle and SECONDARY_MUSCLE_WEIGHT toward each
        secondary muscle.
        Depends on: isMetric/LB_TO_KG (units.js), isNonVolumeExercise
        (workout/exercise-metrics.js, guarded) — all read at CALL time.
        Worked example: setVolume({w:135, r:8}) → 1080 (lb·reps);
        setVolume({w:135, r:8, distance:40}) → 0 (sled work isn't tonnage). */

    /** Logged weight is already the total external load, including for dumbbells. Never multiply by implement count. */
    /* #chaos (2026-09-15): non-finite inputs (e.g. weight '1e309' -> Infinity)
       must degrade to 0, exactly like NaN/blank already did. */
    /* #498 (v1.8): distance/time/load metric movements (sled pushes, carries)
       never contribute standard weight×reps volume. Pass the exercise when
       known; without it the legacy weight×reps behavior is preserved. */
    /* #498: distance-tracked sets (sled, carries) never contribute to
       weight×reps volume. The set-level distance check guarantees this for
       every call site — including bare legacy setVolume(set) calls over
       flat-mapped sets — while the exercise flag covers sets whose distance
       field is blank. */
    function setVolume(set, ex) {
      if(Number(set?.distance)>0)return 0;
      if(ex&&typeof isNonVolumeExercise==='function'&&isNonVolumeExercise(ex))return 0;
      const w=Number(set.w), r=Number(set.r);
      return (isFinite(w)?w:0) * (isFinite(r)?r:0);
    }

    /* Muscle volume attribution: a set counts fully toward each primary
       muscle and at SECONDARY_MUSCLE_WEIGHT toward each secondary muscle. */
    const SECONDARY_MUSCLE_WEIGHT=0.45;

    /* → assets/js/formulas/units.js: LB_TO_KG — moved here in the v1.878 restructure (no behavior change). */
    /* → assets/js/formulas/units.js: isMetric — moved here in the v1.878 restructure (no behavior change). */
    /* → assets/js/formulas/units.js: weightUnit — moved here in the v1.878 restructure (no behavior change). */
    /* → assets/js/formulas/units.js: displayWeight — moved here in the v1.878 restructure (no behavior change). */
    /* → assets/js/formulas/units.js: storageWeight — moved here in the v1.878 restructure (no behavior change). */
    function displayVolume(lbReps){
      /* #chaos (2026-09-15): non-finite inputs ('1e309' -> Infinity) must
         degrade to 0 rather than rendering "Infinity". NaN/blank already
         yielded 0; Infinity was the hole (Infinity || 0 === Infinity). */
      const n=Number(lbReps), finite=isFinite(n)?n:0;
      return isMetric()?finite*LB_TO_KG:finite;
    }
