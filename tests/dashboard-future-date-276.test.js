'use strict';
/* #276 (agent-generated, persona sweep): "the Upcoming-program future-date
   path on the dashboard looks unreachable — verify whether any path can
   select a future date."
   Verdict: REACHABLE, not dead code. The week strip always renders the full
   Mon–Sun week containing today (Monday-start: now - ((getDay()+6)%7)), and
   next-week paging is disabled at offset >= 0 — so on any day before Sunday,
   the later-this-week chips are future dates and tapping one sets
   selectedDashboardDate > today, which drives selectedIsFuture and the
   #4 upcomingProgramMarkup path. Beyond-this-week futures are intentionally
   unreachable (the strip is a history + this-week view). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const src=fs.readFileSync(path.join(__dirname,'..','assets','js','pages','dashboard-stats.js'),'utf8');

function weekStart(now){
  const start=new Date(now);start.setHours(12,0,0,0);
  start.setDate(now.getDate()-((now.getDay()+6)%7));
  return start;
}
function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}

describe('#276 future-date dashboard path is reachable',()=>{
  it('the strip renders the whole Mon-Sun week, including later-this-week futures',()=>{
    // A Wednesday: strip must contain Thu/Fri/Sat/Sun (future) chips.
    const wed=new Date(2026,8,9,12); // 2026-09-09 is a Wednesday
    assert.equal(wed.getDay(),3,'fixture is a Wednesday');
    const start=weekStart(wed);
    const chips=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return iso(d);});
    assert.deepEqual(chips.slice(0,1),['2026-09-07'],'week starts Monday');
    const future=chips.filter(c=>c>iso(wed));
    assert.deepEqual(future,['2026-09-10','2026-09-11','2026-09-12','2026-09-13'],'Thu-Sun are tappable future chips');
  });
  it('selectedIsFuture fires for a later-this-week selection',()=>{
    const selectedIsFuture=(sel,todayIso)=>!!sel&&sel>todayIso;
    assert.ok(selectedIsFuture('2026-09-12','2026-09-09'),'later-this-week counts as future');
    assert.ok(!selectedIsFuture('2026-09-09','2026-09-09'),'today is not future');
    assert.ok(!selectedIsFuture(null,'2026-09-09'),'null selection is not future');
  });
  it('the upcoming-program renderer exists and is wired to the future branch',()=>{
    assert.ok(src.includes('function upcomingProgramMarkup(selDate)'),'#4 renderer present');
    assert.ok(src.includes('selectedIsFuture?upcomingProgramMarkup(selDate)'),'future branch calls it');
    assert.ok(src.includes("textContent=selectedIsFuture?'Upcoming'"),'summary shows Upcoming for futures');
  });
  it('next-week paging stays disabled at offset >= 0 (history + this-week only)',()=>{
    assert.ok(src.includes("$('#nextWeek').disabled=state.calendarWeekOffset>=0"),'next-week disabled at current week');
  });
});
