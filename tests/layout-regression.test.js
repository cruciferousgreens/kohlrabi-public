'use strict';
/* v1.015 layout regression pins (user 2026-09-12):
   #197 saved-workout exercise rows full-width — <button> with display:grid
   and width:auto shrink-wraps to its content in WebKit; .picker-item needs
   an explicit width:100%.
   #202 the exercise-detail Notes card is gone (may return as a future
   feature; per-exercise notes inside workouts are untouched).
   #203 Similar exercises sits below How to on the exercise detail page.
   Dependency-free: reads the stylesheet and markup from disk. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(ROOT,'assets/styles.css'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');

describe('#197 saved-workout rows are full-width',()=>{
  it('.picker-item carries width:100%',()=>{
    const m=css.match(/\.picker-item\s*\{([^}]*)\}/);
    assert.ok(m,'.picker-item rule found in styles.css');
    assert.match(m[1],/(^|;)\s*width\s*:\s*100%\s*;/,'.picker-item has width:100%');
  });
});

describe('#202 exercise-detail Notes card removed',()=>{
  it('no #noteCard element remains in index.html',()=>{
    assert.ok(!html.includes('id="noteCard"'),'index.html has no #noteCard');
    assert.ok(!html.includes('notesHeading'),'index.html has no notesHeading');
  });
});

describe('#203 Similar exercises below How to',()=>{
  it('the similar block renders after the how-to block',()=>{
    const how=html.indexOf('id="howHeading"');
    const similar=html.indexOf('id="similarGrid"');
    assert.ok(how!==-1,'how-to section present');
    assert.ok(similar!==-1,'similar section present');
    assert.ok(similar>how,'Similar exercises comes after How to');
  });
});

describe('#209 saved-workout editor delete × is danger red',()=>{
  it('.rule-remove uses var(--danger) for color and border',()=>{
    const m=css.match(/\.rule-remove\s*\{([^}]*)\}/);
    assert.ok(m,'.rule-remove rule found in styles.css');
    assert.match(m[1],/(^|;)\s*color\s*:\s*var\(--danger\)\s*;/,'.rule-remove has color:var(--danger)');
    assert.match(m[1],/border[^:;]*:\s*[^;]*var\(--danger\)/,'.rule-remove border uses var(--danger)');
  });
  it('#209 follow-up: .builder-x (set-row delete ×) uses var(--danger) for color and border',()=>{
    const m=css.match(/^\s*\.builder-x\s*\{([^}]*)\}/m);
    assert.ok(m,'.builder-x rule found in styles.css');
    assert.match(m[1],/(^|;)\s*color\s*:\s*var\(--danger\)\s*;/,'.builder-x has color:var(--danger)');
    assert.match(m[1],/border[^:;]*:\s*[^;]*var\(--danger\)/,'.builder-x border uses var(--danger)');
  });
});

describe('user 2026-09-13: workout set-input placeholders stay at the old 10px shrink (mobile)',()=>{
  it('.log-input::placeholder is 10px on small screens',()=>{
    const rules=[...css.matchAll(/\.log-input::placeholder\s*\{([^}]*)\}/g)];
    assert.ok(rules.length>0,'.log-input::placeholder rule(s) present');
    const sized=rules.filter(r=>/font-size\s*:\s*10px/.test(r[1]));
    assert.ok(sized.length>0,'a 10px placeholder rule exists (the mobile shrink)');
  });
});

describe('user 2026-09-13: home muscle-map hugs the SVG after hydration',()=>{
  const dashStats=fs.readFileSync(path.join(ROOT,'assets/js/pages/dashboard-stats.js'),'utf8');
  it('hydrateBodyMaps sets data-hydrated on the host after injecting the SVG',()=>{
    assert.ok(dashStats.includes("setAttribute('data-hydrated'"),'dashboard-stats.js sets data-hydrated');
  });
  it('.anatomy-map[data-hydrated] releases the pre-hydration reserves',()=>{
    const m=css.match(/\.anatomy-map\[data-hydrated\]\s*\{([^}]*)\}/);
    assert.ok(m,'.anatomy-map[data-hydrated] rule found in styles.css');
    assert.match(m[1],/min-height\s*:\s*0/,'min-height reserve released');
    assert.match(m[1],/aspect-ratio\s*:\s*auto/,'aspect-ratio reserve released (the 760/614 box kept dead space under the 160px-capped compact SVG)');
  });
});

describe('user 2026-09-14: compact home map reserve matches its hydrated box (no open-time jump)',()=>{
  it('.compact-heatmap .anatomy-map reserves exactly the 160px-capped SVG box',()=>{
    const m=css.match(/\.compact-heatmap\s+\.anatomy-map\s*\{([^}]*)\}/);
    assert.ok(m,'.compact-heatmap .anatomy-map rule found in styles.css');
    /* min-height:0 kills the base 280px reserve; aspect-ratio + max-height:160px
       is the same box the injected SVG renders (width:100%, height:auto,
       max-height:160px, intrinsic 760/614) — so hydration can't move the page. */
    assert.match(m[1],/min-height\s*:\s*0/,'no min-height reserve above the hydrated box');
    assert.match(m[1],/aspect-ratio\s*:\s*760\s*\/\s*614/,'aspect-ratio 760/614 reserved');
    assert.match(m[1],/max-height\s*:\s*160px/,'reserve capped at the same 160px as the SVG');
  });
  it('the compact SVG cap and the host cap agree',()=>{
    const svg=css.match(/\.compact-heatmap\s+\.anatomy-map\s+svg\s*\{([^}]*)\}/);
    assert.ok(svg,'.compact-heatmap .anatomy-map svg rule found in styles.css');
    assert.match(svg[1],/max-height\s*:\s*160px/,'SVG capped at 160px — must match the host reserve');
  });
});
