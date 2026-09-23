'use strict';
/* #390 (user 2026-09-13): the exercise-detail favorite star reads as part of
   the header — a bigger mark, vertically aligned with the title text, while
   the button keeps its 44px touch target. Dependency-free: reads the
   stylesheet and markup from disk. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(ROOT,'assets/styles.css'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');

describe('#390 favorite star is bigger and in line with the title',()=>{
  it('the detail-header star svg is bigger than the old 20px mark',()=>{
    const m=css.match(/\.detail-header\s+\.fav-toggle\s+svg\s*\{([^}]*)\}/);
    assert.ok(m,'.detail-header .fav-toggle svg rule found in styles.css');
    const w=m[1].match(/width\s*:\s*(\d+)px/);
    assert.ok(w&&Number(w[1])>=28,'star svg is >=28px wide (was 20px)');
    const h=m[1].match(/height\s*:\s*(\d+)px/);
    assert.ok(h&&Number(h[1])>=28,'star svg is >=28px tall (was 20px)');
  });
  it('the button keeps its 44px touch target',()=>{
    const m=css.match(/\.fav-toggle\s*\{([^}]*)\}/);
    assert.ok(m,'.fav-toggle rule found in styles.css');
    assert.match(m[1],/(^|;)\s*width\s*:\s*44px\s*;/,'44px wide touch target');
    assert.match(m[1],/(^|;)\s*height\s*:\s*44px\s*;/,'44px tall touch target');
  });
  it('the star is aligned with the title, not floating at the grid top',()=>{
    const m=css.match(/\.detail-header\s+\.fav-toggle\s*\{([^}]*)\}/);
    assert.ok(m,'.detail-header .fav-toggle alignment rule found in styles.css');
    assert.match(m[1],/align-self\s*:\s*start/,'top-aligned with the title cell');
    assert.match(m[1],/margin-top\s*:\s*-/,'nudged up so the star centers on the title text');
  });
  it('the detail header still carries the star button',()=>{
    assert.ok(html.includes('id="detailFavToggle"'),'index.html has #detailFavToggle');
    assert.ok(html.includes('class="detail-header"'),'index.html has .detail-header');
  });
});
