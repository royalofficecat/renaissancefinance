// Story data shared by the 3D scene, the on-screen overlay and the sound track.
// Every number in `cap` and `real` is REAL HISTORY and is sourced in ../SOURCES.md.
// `whatif` lines are imagined outcomes and stay qualitative on purpose.

export const FPS = 30;
export const BEAT_LEN = 4.5;
export const END_LEN = 4;
export const TOTAL = 13 * BEAT_LEN + END_LEN; // 62.5 s
export const TITLE = 'What if the 2008 market crash never happened?';

export const BEATS = [
  { cap: 'The real 2007–09 recession lasted 18 months.', src: 'Federal Reserve History', real: 'Unemployment 5.0% (Dec 2007)', whatif: 'The crash path bends' },
  { cap: 'In 2006, subprime loans were 23.5% of new mortgages.', src: 'Financial Crisis Inquiry Commission', real: 'Subprime share 23.5% (2006)', whatif: 'Risky loans shrink' },
  { cap: 'The Fed’s rule to check borrowers could repay came in July 2008.', src: 'Federal Register', real: 'Rule adopted Jul 14, 2008', whatif: 'The rule arrives years earlier' },
  { cap: 'The Fed raised rates 17 times, to 5.25% by June 2006.', src: 'Federal Reserve', real: 'Fed rate 5.25% (Jun 2006)', whatif: 'Prices cool slowly' },
  { cap: 'Lehman Brothers failed Sept 15, 2008, with $639B in assets.', src: 'Britannica', real: 'Largest US bankruptcy filing then', whatif: 'The panic doesn’t spread' },
  { cap: '25 US banks failed in 2008 — and 140 in 2009.', src: 'FDIC', real: 'Bank failures: 3 (2007) → 140 (2009)', whatif: 'Far fewer failures' },
  { cap: 'The US lost 8.7 million jobs from Jan 2008 to Feb 2010.', src: 'BLS', real: 'Unemployment peak 10% (Oct 2009)', whatif: 'More jobs might survive' },
  { cap: 'Median family net worth fell 38.8% from 2007 to 2010.', src: 'Federal Reserve SCF', real: 'Median $126,400 → $77,300', whatif: 'More savings might hold' },
  { cap: 'Housing starts fell from 2.27M to 478K a year, 2006–2009.', src: 'Census Bureau', real: 'Housing starts down ~79%', whatif: 'Building slows, keeps going' },
  { cap: 'Retail lost about 1 million jobs in the recession.', src: 'BLS', real: 'Retail jobs −6.7%', whatif: 'Shops: a smaller dip' },
  { cap: 'Median new-home price: $239,500 (Jul 2007) → $420,300 (2024).', src: 'Census Bureau', real: '$239.5K → $420.3K', whatif: 'Homes might still be pricey', twist: true },
  { cap: 'After the crash, the Fed held rates near 0% for 7 years.', src: 'Federal Reserve', real: 'Record-low mortgage rate 2.65% (Jan 2021)', whatif: 'Rates might not dip so low', twist: true },
  { cap: 'April 2020: US payrolls fell 20.5 million in one month.', src: 'BLS', real: 'Unemployment 14.7% (Apr 2020)', whatif: 'Risk never fully disappears', twist: true,
    takeaway: 'Dodging one crash protects paychecks — not prices, and not forever.' },
];

export const END = {
  question: 'No dot-com crash or no 2020 crash next?',
  cta: 'Comment your pick 👇',
  sources: 'Sources: Federal Reserve · BLS · Census · FDIC · FCIC · Freddie Mac',
};

// Sound-effect cues (seconds) keyed to visual jokes, used by the audio builder in step C.
export const SFX = [
  { t: 1.6, kind: 'whoosh' }, { t: 2.4, kind: 'boing' },
  ...[0, 1, 2, 3, 4, 5].map(i => ({ t: 4.5 + 1.0 + i * 0.5, kind: 'sproing' })),
  { t: 9.0 + 0.4, kind: 'flip' }, { t: 9.0 + 0.9, kind: 'flip' }, { t: 9.0 + 1.4, kind: 'flip' },
  ...[0, 1, 2, 3].map(i => ({ t: 9.0 + 2.0 + i * 0.5, kind: 'pop' })),
  { t: 13.5 + 0.6, kind: 'squeak' }, { t: 13.5 + 3.4, kind: 'boing' },
  { t: 18.0 + 0.5, kind: 'wobble' }, { t: 18.0 + 3.0, kind: 'ding' },
  ...[0, 1, 2, 3, 4, 5].map(i => ({ t: 22.5 + 0.5 + i * 0.5, kind: 'plink' })),
  ...[0, 1, 2, 3, 4, 5].map(i => ({ t: 27.0 + 0.8 + i * 0.5, kind: 'pop' })),
  ...[0, 1, 2, 3].map(i => ({ t: 31.5 + 0.5 + i * 0.75, kind: 'boing' })),
  ...[0, 1, 2].map(i => ({ t: 36.0 + 0.6 + i * 1.2, kind: 'ratchet' })), { t: 36.0 + 2.2, kind: 'beep' },
  { t: 40.5 + 0.5, kind: 'bell' }, ...[0, 1, 2].map(i => ({ t: 40.5 + 1.5 + i * 0.8, kind: 'pop' })),
  { t: 45.0 + 0.1, kind: 'scratch' }, { t: 45.0 + 1.3, kind: 'bigboing' },
  ...[0, 1, 2, 3].map(i => ({ t: 49.5 + 0.4 + i * 0.35, kind: 'clack' })), { t: 49.5 + 2.4, kind: 'pop' },
  { t: 58.5 + 0.2, kind: 'pop' },
];

// Moments where the music softens out of respect (hardship facts).
export const SOFT_BEATS = [5, 6, 7, 9, 12];
