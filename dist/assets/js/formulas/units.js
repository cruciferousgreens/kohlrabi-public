/* ===== module: formulas/units.js ===== */
    /** Weight-unit conversions: the app's canonical store.
        Plain-English rule: weights are ALWAYS stored in pounds. The metric
        setting changes display and input only — never storage, never the
        progression math. 1 lb = 0.45359237 kg exactly (international avoirdupois
        pound, 1959 agreement).
        Depends on: progressionSetup.units (state.js) — read at CALL time, so
        load order vs state.js does not matter.
        Worked example: displayWeight(100) → '100' (imperial) or '45.4' (metric);
        storageWeight('45.4') → '100' (metric input converted back to lb). */

    /* Units (2026-09-10): weights are stored canonically in pounds; the metric
       setting only changes display and input. 1 lb = 0.45359237 kg. */
    const LB_TO_KG=0.45359237;

    /* True when the user's unit setting is metric (kg display/input). */
    function isMetric(){return progressionSetup.units==='metric';}

    /* Display unit label for the current setting ('kg' or 'lb'). */
    function weightUnit(){return isMetric()?'kg':'lb';}

    /* Converts a canonical-lb weight to the display string (kg when metric, rounded to 0.1). */
    function displayWeight(lb){
      if(lb==null||String(lb).trim()==='')return '';
      const n=Number(lb); if(!isFinite(n))return '';
      return isMetric()?String(Math.round(n*LB_TO_KG*10)/10):String(n);
    }

    /* Converts a display-unit input back to the canonical-lb string for storage. */
    function storageWeight(val){
      if(val==null||String(val).trim()==='')return '';
      const n=Number(val); if(!isFinite(n))return '';
      return isMetric()?String(Math.round(n/LB_TO_KG*10)/10):String(val);
    }
