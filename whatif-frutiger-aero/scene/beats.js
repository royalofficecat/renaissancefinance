// Story data shared by the 3D scene, the overlay and the soundtrack. Every number is sourced in ../SOURCES.md.
export const FPS = 30;
export const BEAT_LEN = 4.5;
export const END_LEN = 4;
export const TOTAL = 13 * BEAT_LEN + END_LEN; // 62.5 s
export const TITLE = 'What if the world went full Frutiger Aero?';

export const BEATS = [
  { cap: 'Frutiger Aero was the tech look of about 2004–2013.', src: 'University of Waterloo Computer Museum', real: 'Named in 2017 by the Consumer Aesthetics Research Institute', whatif: 'The promised future arrives' },
  { cap: 'Windows Vista and its glassy “Aero” look launched Jan 30, 2007.', src: 'Microsoft release history', real: 'Jan 30, 2007', whatif: 'Every window in town goes glossy' },
  { cap: 'The world added about 700 GW of renewables in 2024, a 22nd straight record year.', src: 'IEA, Global Energy Review 2025', real: 'Solar = 7% of world electricity (2024)', whatif: 'Rooftops grow solar leaves' },
  { cap: 'Solar power cost 56% less than fossil power in 2023, after costing 4× more in 2010.', src: 'IRENA', real: 'Battery costs down 89% since 2010', whatif: 'The power bill becomes a tiny bubble' },
  { cap: 'US community solar hit 8.6 GW by the end of 2024, a record year.', src: 'Wood Mackenzie / CCSA', real: '1.7 GW added in 2024', whatif: 'The neighborhood shares one glowing roof' },
  { cap: 'There are about 175,000 Little Free Libraries in 121 countries.', src: 'Little Free Library, 2024', real: '121 countries, all 50 states', whatif: 'Every corner gets a glass share-box' },
  { cap: 'About 3,200 Repair Cafés now fix things for free worldwide.', src: 'Repair Café International', real: '~3,200 Repair Cafés', whatif: '“Broken” becomes a 10-minute errand' },
  { cap: 'US organic sales hit a record $69.7 billion in 2023.', src: 'Organic Trade Association', real: 'Organic produce: $20.5B', whatif: 'The farmers’ market takes over the plaza' },
  { cap: 'US community gardens number roughly 18,000–20,000.', src: 'American Community Gardening Association', real: '18,000+ gardens', whatif: 'Every rooftop is a garden' },
  { cap: 'In 2025, renewables overtook coal in world electricity for the first time in 100 years.', src: 'Ember', real: '700 GW ≈ 700 big power plants in one year', napkin: true, whatif: 'The smokestack retires as a slide' },
  { cap: 'The world made 62 million tonnes of e-waste in 2022. Only 22.3% was recycled.', src: 'UN Global E-waste Monitor 2024', real: 'E-waste up 82% since 2010', whatif: 'The glossy future needs a recycling plan', twist: true },
  { cap: 'The look faded in the early 2010s as optimism about tech faded.', src: 'University of Waterloo Computer Museum', real: '#frutigeraero: 28M+ TikTok views (early 2023)', whatif: 'Optimism comes back as a daily habit', twist: true },
  { cap: 'The name “Frutiger Aero” was coined only in 2017, years after the era ended.', src: 'Consumer Aesthetics Research Institute', real: 'Coined 2017', whatif: 'The glossy future is kept, not promised', twist: true,
    takeaway: 'The future isn’t a wallpaper. It’s a chore chart.' },
];

export const END = {
  question: 'Which 2000s future should come true next?',
  cta: 'Comment your pick 👇',
  sources: 'Sources: IEA · IRENA · Ember · UNITAR · OTA · Little Free Library · Repair Café Intl · U. Waterloo',
};

// Sound-effect cues (seconds).
export const SFX = [
  { t: 0.3, kind: 'chime' }, ...[0, 1, 2, 3, 4, 5, 6].map(i => ({ t: 1.0 + i * 0.22, kind: 'bloop' })),
  ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ t: 4.5 + 0.6 + i * 0.35, kind: 'ping' })),
  ...[0, 1, 2, 3, 4, 5].map(i => ({ t: 9.0 + 0.6 + i * 0.4, kind: 'sprout' })), { t: 9.0 + 2.8, kind: 'whir' },
  { t: 13.5 + 0.8, kind: 'zip' }, { t: 13.5 + 2.4, kind: 'bloop' }, { t: 13.5 + 3.4, kind: 'pop' },
  ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ t: 18.0 + 0.6 + i * 0.4, kind: 'clink', note: i })),
  ...[0, 1, 2, 3, 4].map(i => ({ t: 22.5 + 0.5 + i * 0.5, kind: 'pop' })), { t: 22.5 + 3.0, kind: 'flutter' },
  ...[0, 1, 2].map(i => ({ t: 27.0 + 0.6 + i * 1.1, kind: 'ratchet' })), { t: 27.0 + 3.6, kind: 'tada' },
  ...[0, 1, 2, 3, 4].map(i => ({ t: 31.5 + 0.8 + i * 0.5, kind: 'boing' })), { t: 31.5 + 3.4, kind: 'splash' },
  { t: 36.0 + 0.4, kind: 'whoosh' }, ...[0, 1, 2].map(i => ({ t: 36.0 + 1.6 + i * 0.8, kind: 'sprinkle' })),
  { t: 40.5 + 0.1, kind: 'zoom' }, { t: 40.5 + 1.8, kind: 'wheee' }, { t: 40.5 + 3.6, kind: 'splash' },
  { t: 45.0 + 0.1, kind: 'scratch' }, ...[0, 1, 2, 3, 4, 5].map(i => ({ t: 45.0 + 1.4 + i * 0.45, kind: 'tick' })),
  { t: 49.5 + 0.3, kind: 'flicker' }, ...[0, 1, 2, 3].map(i => ({ t: 49.5 + 1.4 + i * 0.6, kind: 'squeak' })), { t: 49.5 + 3.8, kind: 'chime' },
  { t: 54.0 + 0.5, kind: 'swell' }, ...[0, 1, 2, 3, 4, 5].map(i => ({ t: 54.0 + 1.2 + i * 0.3, kind: 'bloop' })),
  { t: 58.5 + 0.2, kind: 'chime' }, { t: 58.5 + 0.8, kind: 'pop' },
];
export const SOFT_BEATS = [10, 11];
