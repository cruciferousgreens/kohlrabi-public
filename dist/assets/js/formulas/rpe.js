/* ===== module: formulas/rpe.js ===== */
    /** RPE / RIR conversions and rep-jump math.
        Plain-English rules: stored set.rpe is canonical RPE (1–10); RIR
        (reps in reserve) is purely a display/entry lens, RIR = 10 − RPE, both
        rounded to the nearest 0.5 (#483: the RPE field accepts 0.5 steps).
        A blank RPE means "no RPE logged" — never RPE 0 (#370: Number('')===0
        would slip through the progression gate and poison the RIR math).
        rpeRepJump: the rep jump IS the lifter's reps-in-reserve, rounded to
        the nearest whole rep (half up), never below the #387 floor of 2 —
        "add 2.5 reps" is nonsense on a card.
        Literature: RPE→RIR follows Zourdos et al. (2016), the RIR-based RPE
        scale for resistance training (RIR = 10 − RPE by definition).
        Worked example: rpeToRir(7.5) → '2.5'; rpeRepJump(7.5) → 3 (2.5 rounds
        half-up); blankRpeToNull('') → null. */

    /* RPE → RIR (10 − RPE), rounded to the nearest 0.5; '' when not finite. */
    function rpeToRir(rpe){ const n=Number(rpe); if(!Number.isFinite(n)) return ''; return String(Math.round((10-n)*2)/2); }

    /* RIR → RPE (10 − RIR), rounded to the nearest 0.5; '' when not finite. */
    function rirToRpe(rir){ const n=Number(rir); if(!Number.isFinite(n)) return ''; return String(Math.round((10-n)*2)/2); }


    /* #370: a blank/whitespace RPE ('') must mean "no RPE logged", never RPE 0.
       Number('')===0, so the old `==null?null:Number(set.rpe)` conversion let a
       blank RPE slip through the `latest.rpe<=threshold` gate (0<=8) and
       inflated estimate1RM (rir = 10-0 = 10). Every other layer already treats
       '' as missing — topSetForSession has to agree.
       Chaos sweep finding 4: a non-numeric RPE ('abc') is also "no RPE" —
       Number('abc') is NaN and 10-NaN poisons the RIR math downstream. */
    function blankRpeToNull(rpe){
      if(rpe==null||String(rpe).trim()==='')return null;
      const n=Number(rpe);
      return Number.isFinite(n)?n:null;
    }

    /* #483 (user 2026-09-15): the RPE field accepts 0.5 steps, so 10-rpe can
       be fractional (RPE 7.5 → a 2.5-rep jump). Reps and seconds are discrete —
       "add 2.5 reps" / "10.5 reps" is nonsense on a card and in reason text.
       The jump is the lifter's reps-in-reserve, rounded to the nearest whole
       rep (half up), and never below the #387 floor of 2. One helper so the
       top set, the all-sets cascade (repJumpUsed), and the all-sets
       independent path all agree. */
    function rpeRepJump(rpe){
      return Math.max(2,Math.round(10-Number(rpe)));
    }

    /* #490: compact RPE formatting for reason text (8.199999 → "8.2"). */
    function fmtRpe(r){return String(Math.round(Number(r)*10)/10);}
