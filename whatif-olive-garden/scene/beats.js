// Story data shared by the 3D scene, the on-screen overlay and the sound track.
// Every number in `cap` and `real` is a REAL fact sourced in ../SOURCES.md.
// `whatif` lines are imagined and stay qualitative. Rows marked `napkin` are plain arithmetic on real numbers.

export const FPS = 30;
export const BEAT_LEN = 4.5;
export const END_LEN = 4;
export const TOTAL = 13 * BEAT_LEN + END_LEN; // 62.5 s
export const TITLE = 'What if the world could only eat Olive Garden?';

export const BEATS = [
  { cap: 'The first Olive Garden opened in Orlando on Dec 13, 1982.', src: 'Darden Restaurants', real: '935 US Olive Gardens (FY2025)', whatif: 'Every restaurant becomes one' },
  { cap: 'US restaurant sales topped $1 trillion for the first time in 2024.', src: 'National Restaurant Association', real: '$1T+ in restaurant sales (2024)', whatif: 'All of it goes to one menu' },
  { cap: 'Olive Garden’s parent, Darden, made about $12.1 billion in FY2025.', src: 'Darden FY2025 results', real: '2,159 Darden restaurants', whatif: 'The parent company balloons' },
  { cap: 'Darden says it has about 190,000 team members.', src: 'Darden Restaurants', real: '~190,000 team members', whatif: 'Every chef joins up' },
  { cap: 'One Olive Garden breadstick is about 140 calories.', src: 'Olive Garden nutrition info', real: '140 calories per breadstick', whatif: 'Breadsticks become a food group' },
  { cap: 'Nutrition labels use 2,000 calories a day as a reference.', src: 'FDA', real: '14 breadsticks × 140 = 1,960 cal', napkin: true, whatif: 'Pants everywhere feel tighter' },
  { cap: 'In 2015, 2,000 Pasta Passes sold out in 1 second.', src: 'TODAY / Fox News', real: '$100 for 7 weeks of pasta (2015)', whatif: 'Everyone gets a lifetime pass' },
  { cap: 'The Never Ending Pasta Bowl came back in 2025 at $13.99.', src: 'Olive Garden, Aug 2025', real: '$13.99 (2025 promo)', whatif: 'The pasta literally never ends' },
  { cap: 'Walmart topped the 2025 Fortune 500 with $681 billion in revenue.', src: 'Fortune 500, 2025', real: '$1T restaurant sales ÷ $12.1B = ~83× today’s Darden', napkin: true, whatif: 'Bigger than Walmart. From breadsticks.' },
  { cap: 'The Moon is about 238,855 miles from Earth.', src: 'NASA', real: '8.2B breadsticks end to end = to the Moon and back, daily', napkin: true, whatif: 'Deliveries go interplanetary' },
  { cap: 'In 2019, 50 Lifetime Pasta Passes sold for $500 each.', src: 'Fox News / The Daily Meal', real: '$500 ÷ $13.99 = paid off after 36 bowls', napkin: true, whatif: 'The only retirement plan you need' },
  { cap: 'There are 0 Olive Gardens in Italy.', src: 'The Daily Meal', real: 'Italy: 0 locations', whatif: 'Italy: the last place with other food', twist: true },
  { cap: 'Unlimited breadsticks began at that first Orlando restaurant in 1982.', src: 'Fortune, 2025', real: 'Free refills since 1982', whatif: 'Variety is the real never-ending deal', twist: true,
    takeaway: 'Unlimited breadsticks: fun. Unlimited sameness: not so much.' },
];

export const END = {
  question: 'Which chain should take over the world next?',
  cta: 'Comment your pick 👇',
  sources: 'Sources: Darden · NRA · FDA · UN · NASA · Fortune · TODAY',
};

// Sound-effect cues (seconds) keyed to the visual jokes.
export const SFX = [
  ...[0, 1, 2, 3, 4, 5].map(i => ({ t: 0.6 + i * 0.32, kind: 'pop' })),
  ...[0, 1, 2, 3, 4, 5].map(i => ({ t: 4.5 + 0.6 + i * 0.4, kind: 'meep' })), ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ t: 4.5 + 1.6 + i * 0.3, kind: 'plink' })),
  ...[0, 1, 2, 3, 4].map(i => ({ t: 9.0 + 0.5 + i * 0.55, kind: 'squish' })), { t: 9.0 + 0.4, kind: 'whistle' },
  ...[0, 1, 2, 3, 4, 5].map(i => ({ t: 13.5 + 0.7 + i * 0.4, kind: 'pop' })),
  ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ t: 18.0 + 0.5 + i * 0.45, kind: 'thunk' })), { t: 18.0 + 3.4, kind: 'ding' },
  ...[0, 1, 2, 3].map(i => ({ t: 22.5 + 0.5 + i * 0.5, kind: 'boing' })), { t: 22.5 + 2.6, kind: 'chaching' },
  { t: 27.0 + 0.3, kind: 'sparkle' }, { t: 27.0 + 2.2, kind: 'yay' },
  { t: 31.5 + 0.6, kind: 'slurp' }, { t: 31.5 + 2.2, kind: 'boing' }, { t: 31.5 + 3.2, kind: 'boing' },
  { t: 36.0 + 0.3, kind: 'whistle' }, { t: 36.0 + 2.8, kind: 'ding' },
  { t: 40.5 + 0.2, kind: 'whoosh' }, { t: 40.5 + 1.6, kind: 'tada' },
  { t: 45.0 + 0.4, kind: 'sparkle' }, ...[0, 1, 2, 3].map(i => ({ t: 45.0 + 1.2 + i * 0.5, kind: 'pop' })), { t: 45.0 + 3.2, kind: 'yay' },
  { t: 49.5 + 0.6, kind: 'gull' }, { t: 49.5 + 2.4, kind: 'horn' },
  ...[0, 1, 2, 3, 4, 5].map(i => ({ t: 54.0 + 0.5 + i * 0.3, kind: 'pop' })), { t: 54.0 + 2.6, kind: 'yay' },
  { t: 58.5 + 0.2, kind: 'pop' },
];

// Beats where the band plays softer: the twist beats, so the turn lands.
export const SOFT_BEATS = [11];
