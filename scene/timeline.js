// The single source of truth for timing: beats, captions, stats and the day counter.
// Times are in seconds. 30 fps, 64 s = 1920 frames. One music bar = 2.0 s.
export const FPS = 30;
export const DURATION = 64;
export const TOTAL_FRAMES = DURATION * FPS;

// Stat panels count up over 0.9 s starting 0.4 s into the beat.
// `count` is the number that counts up; `text` turns the live number into the panel text.
export const BEATS = [
  { id: 1, start: 0, end: 4, set: 'globe', day: [1, 2],
    title: 'What if California got **30 days** of extreme rain?',
    caption: { at: 0.5, lines: ['At first, everyone celebrates', 'Then the water keeps rising'] },
    stat: { count: [0, 30], text: v => `<b>${v.toFixed(0)}</b>`, label: 'days of storms in this illustrative scenario' } },
  { id: 2, start: 4, end: 8, set: 'globe', day: [3, 6],
    caption: { lines: ['Atmospheric rivers deliver roughly', '**30–50%** of the state’s precipitation'] },
    stat: { count: [0, 50], text: v => `<b>${Math.round(v * 0.6)}–${Math.round(v)}%</b>`, label: 'of annual precipitation, NOAA' } },
  { id: 3, start: 8, end: 12, set: 'reservoir', day: [8, 11],
    caption: { lines: ['In early 2023, **9** atmospheric rivers', 'arrived in about three weeks'] },
    stat: { count: [0, 9], text: v => `<b>${v.toFixed(0)}</b>`, label: 'storms in 3 weeks, winter 2022–23' } },
  { id: 4, start: 12, end: 16, set: 'soil', day: [12, 14],
    caption: { lines: ['Soil is about **50%** pore space', 'Once full, rain runs off'] },
    stat: { count: [0, 50], text: v => `<b>${v.toFixed(0)}%</b>`, label: 'of soil volume is pore space, USDA NRCS' } },
  { id: 5, start: 16, end: 20, set: 'soil', day: [15, 17],
    caption: { lines: ['On soaked slopes, debris flows can', 'move faster than **35 mph**'] },
    stat: { count: [0, 35], text: v => `<b>${v.toFixed(0)} mph</b>`, label: 'debris-flow speeds can exceed, USGS' } },
  { id: 6, start: 20, end: 26, set: 'map', day: [18, 21], legend: true,
    caption: { lines: ['Sierra runoff drains into one valley', 'about **400 miles** long'] },
    stat: { count: [0, 400], text: v => `<b>${v.toFixed(0)} mi</b>`, label: 'length of the Central Valley, USGS' } },
  { id: 7, start: 26, end: 32, set: 'map', day: [22, 23], legend: true,
    caption: { lines: ['In USGS’s ARkStorm scenario, floods', 'could stretch **300 miles**'] },
    stat: { count: [0, 300], text: v => `<b>${v.toFixed(0)} mi</b>`, label: 'of valley flooding in the scenario, USGS' } },
  { id: 8, start: 32, end: 36, set: 'map', day: [24, 25], legend: true,
    caption: { lines: ['This valley grows about **25%** of', 'the nation’s food, moved by truck'] },
    stat: { count: [0, 25], text: v => `<b>${v.toFixed(0)}%</b>`, label: 'of US food from the Central Valley, USGS' } },
  { id: 9, start: 36, end: 40, set: 'city', day: [26, 29],
    caption: { lines: ['One January 2023 storm cut power to', 'over **350,000** Sacramento customers'] },
    stat: { count: [0, 350000], text: v => `<b>${(Math.round(v / 1000) * 1000).toLocaleString('en-US')}</b>`, label: 'customers lost power, 8 Jan 2023, SMUD' } },
  { id: 10, start: 40, end: 44, set: 'map', day: 'After day 30', legend: true,
    caption: { lines: ['Tulare Lake refilled in 2023', 'Draining it could take about **a year**'] },
    stat: { count: [0, 12], text: v => `<b>~${v.toFixed(0)} months</b>`, label: 'expected for Tulare Lake to recede' } },
  { id: 11, start: 44, end: 48, set: 'recharge', day: 'After day 30',
    caption: { lines: ['In 2023, about **390,000** acre-feet of', 'floodwater was steered into the ground'] },
    stat: { count: [0, 390000], text: v => `<b>${(Math.round(v / 1000) * 1000).toLocaleString('en-US')}</b>`, label: 'acre-feet recharged under 2023 orders, DWR' } },
  { id: 12, start: 48, end: 54, set: 'map', day: 'Winter 1861–62',
    title: 'California has seen something like this before',
    caption: { lines: ['In 1861–62, about **45 days** of storms', 'flooded the valley, moving the capital'] },
    stat: { count: [0, 45], text: v => `<b>${v.toFixed(0)} days</b>`, label: 'of storms, winter 1861–62, USGS' } },
  { id: 13, start: 54, end: 60, set: 'map', day: [30, 30],
    title: 'California has seen something like this before',
    captions: [ { at: 0, until: 2.5, lines: ['Thirty days of rain', 'could change California'] },
                { at: 2.5, until: 6, lines: ['How we make room for water', 'changes what happens next'] } ],
    stat: { count: [0, 30], text: v => `<b>${v.toFixed(0)}</b>`, label: 'days of rain in this scenario' } },
  { id: 14, start: 60, end: 64, set: 'globe', endcard: true },
];

export function beatAt(t) {
  for (const b of BEATS) if (t >= b.start && t < b.end) return b;
  return BEATS[BEATS.length - 1];
}

/** 0..1 "recovery" amount: drives the land colour toward green and the light warming. */
export function recovery(t) {
  if (t < 40) return 0;
  if (t < 44) return (t - 40) / 4 * 0.35;
  if (t < 48) return 0.35 + (t - 44) / 4 * 0.45;
  return Math.min(1, 0.8 + (t - 48) / 6 * 0.2);
}
/** 0..1 rain intensity by time (no rain after day 30). */
export function rain(t) {
  if (t < 4) return 0.25 + t / 4 * 0.15;
  if (t < 20) return 0.4 + (t - 4) / 16 * 0.35;
  if (t < 40) return 0.75 + Math.min(0.25, (t - 20) / 16 * 0.25);
  if (t < 42) return 1 - (t - 40) / 2;
  return 0;
}
