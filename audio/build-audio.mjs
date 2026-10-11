// Generates the music loop and every sound effect, timed to docs/beat-sheet.md, then masters to -14 LUFS.
//   node audio/build-audio.mjs   ->  out/audio.wav (and out/audio-raw.wav before loudness normalisation)
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { Mix, SR, adsr, sine, tri, saw, noiseGen, Biquad, reverb, toWav } from './synth.mjs';

const DUR = 64, BPM = 120, BAR = 240 / BPM;     // 2.0 s per bar
const bar = b => (b - 1) * BAR;                  // bar 1 starts at 0 s
const note = n => 440 * 2 ** ((n - 69) / 12);    // MIDI -> Hz
const D = { D3: 50, Fs3: 54, A3: 57, D4: 62, Fs4: 66, A4: 69, B3: 59, G3: 55, Cs4: 61, E4: 64, B4: 71, D5: 74, Fs5: 78, A5: 81, G4: 67, E5: 76, Cs5: 73 };
mkdirSync('out', { recursive: true });

// ---------- music ----------
const music = new Mix(DUR);
// chord progression per bar (D major, with a B-minor lean in the middle act)
const CHORDS = [];
for (let b = 1; b <= 32; b++) {
  let c;
  if (b <= 12) c = [['D3', 'A3', 'D4', 'Fs4'], ['D3', 'A3', 'D4', 'Fs4'], ['G3', 'D4', 'G4', 'B4'], ['A3', 'E4', 'A4', 'Cs5']][(b - 1) % 4];
  else if (b <= 20) c = [['B3', 'D4', 'Fs4', 'B4'], ['G3', 'D4', 'G4', 'B4'], ['D3', 'A3', 'D4', 'Fs4'], ['A3', 'E4', 'A4', 'Cs5']][(b - 13) % 4];
  else if (b <= 24) c = [['G3', 'D4', 'G4', 'B4'], ['D3', 'A3', 'D4', 'Fs4'], ['A3', 'E4', 'A4', 'Cs5'], ['D3', 'A3', 'D4', 'Fs4']][(b - 21) % 4];
  else c = [['D3', 'A3', 'D4', 'Fs4'], ['G3', 'D4', 'G4', 'B4'], ['A3', 'E4', 'A4', 'Cs5'], ['D3', 'A3', 'D4', 'Fs4']][(b - 25) % 4];
  CHORDS.push(c);
}
const musicLevel = t => Math.min(1, t / 2.5) * (t > 62 ? Math.max(0, (64 - t) / 2) : 1);

// pad: detuned triangles with a slow attack, through a gentle low-pass
for (let b = 1; b <= 32; b++) {
  const t0 = bar(b), gain = b <= 8 ? 0.11 : b <= 20 ? 0.15 : 0.16;
  for (const n of CHORDS[b - 1]) {
    const f = note(D[n]); const env = adsr(0.9, 0.3, 0.8, 0.6, BAR + 0.4); const lp = new Biquad('lp', b <= 8 ? 900 : 1400, 0.7);
    music.add(t0, BAR + 0.4, i => lp.process((tri(f, i) + tri(f * 1.004, i) + 0.5 * sine(f * 2, i)) / 2.5) * env(i) * musicLevel(t0 + i / SR), gain, (D[n] - 62) / 20);
  }
}
// plucks: soft arpeggio on 8ths during the opening and the finale
for (let b = 1; b <= 32; b++) {
  if (b > 8 && b < 25) continue;
  const chord = CHORDS[b - 1];
  for (let k = 0; k < 8; k++) {
    if (b <= 8 && k % 2 === 1 && b % 2 === 0) continue;
    const n = chord[[0, 2, 3, 2, 1, 2, 3, 2][k]]; const f = note(D[n]) * (b >= 25 ? 2 : 1);
    const t0 = bar(b) + k * BAR / 8, env = adsr(0.004, 0.25, 0.0, 0.1, 0.45);
    music.add(t0, 0.45, i => (sine(f, i) + 0.35 * sine(f * 2, i) + 0.12 * sine(f * 3, i)) * env(i) * musicLevel(t0), b <= 8 ? 0.13 : 0.1, 0.25);
  }
}
// piano-like lead from bar 22: sine + harmonics with a bright attack, melody over the chords
const MEL = { 22: ['Fs4', 'A4'], 23: ['B4', 'A4'], 24: ['D5', 'Cs5'], 25: ['D5'], 26: ['B4', 'D5'], 27: ['Cs5', 'E5'], 28: ['Fs5'], 29: ['D5', 'Fs5'], 30: ['E5', 'D5'], 31: ['D5'] };
for (const [b, notes] of Object.entries(MEL)) {
  notes.forEach((n, k) => {
    const f = note(D[n]), t0 = bar(Number(b)) + k * BAR / notes.length, len = BAR / notes.length + 0.6;
    const env = adsr(0.006, 0.5, 0.35, 0.5, len);
    music.add(t0, len, i => (sine(f, i) + 0.5 * sine(f * 2, i) + 0.25 * sine(f * 3, i) * Math.exp(-i / SR * 6) + 0.12 * sine(f * 4, i) * Math.exp(-i / SR * 9)) * env(i) * musicLevel(t0), 0.17, -0.15);
  });
}
// sub bass on roots from bar 7
for (let b = 7; b <= 30; b++) {
  const f = note(D[CHORDS[b - 1][0]]) / 2, t0 = bar(b), env = adsr(0.02, 0.2, 0.7, 0.3, BAR);
  music.add(t0, BAR, i => sine(f, i) * env(i) * musicLevel(t0), b <= 10 ? 0.12 : b <= 20 ? 0.2 : 0.14, 0);
}
// drums: kick (sine drop), hat (noise tick), soft snare; pulse enters bar 7, full from bar 11, heartbeat bars 21-24, out after 30
const nz = noiseGen(99);
function kick(t, g) { const env = adsr(0.001, 0.18, 0, 0.05, 0.25); music.add(t, 0.25, i => sine(55 + 90 * Math.exp(-i / SR * 28), i) * env(i), g, 0); }
function hat(t, g) { const hp = new Biquad('hp', 7000, 0.8); const env = adsr(0.001, 0.04, 0, 0.02, 0.07); music.add(t, 0.07, i => hp.process(nz()) * env(i), g, 0.3); }
function snare(t, g) { const bp = new Biquad('bp', 1800, 0.9); const env = adsr(0.001, 0.12, 0, 0.05, 0.18); music.add(t, 0.18, i => (bp.process(nz()) * 0.8 + sine(190, i) * Math.exp(-i / SR * 30) * 0.5) * env(i), g, -0.1); }
for (let b = 7; b <= 30; b++) {
  const t0 = bar(b), full = b >= 11 && b <= 20, heart = b >= 21;
  for (let q = 0; q < 4; q++) {
    const t = t0 + q * BAR / 4;
    if (q === 0 || (full && q === 2) || (!heart && b >= 9 && q === 2)) kick(t, heart ? 0.22 : full ? 0.32 : 0.24);
    if (full && (q === 1 || q === 3)) snare(t, 0.16);
    if (!heart && b >= 9) for (let e = 0; e < 2; e++) hat(t + e * BAR / 8, e ? 0.045 : 0.07);
  }
}
// risers into the lake reveal (bars 13-16) and the payoff (bars 23-24)
function riser(t, dur, g) { const bp = new Biquad('bp', 300, 2); const env = adsr(dur * 0.8, 0.1, 0.6, dur * 0.1, dur); music.add(t, dur, i => { if (i % 200 === 0) bp.set(300 + 2500 * (i / SR / dur) ** 2, 2); return bp.process(nz()) * env(i); }, g, 0); }
riser(bar(14), BAR * 2.5, 0.16); riser(bar(23), BAR * 2, 0.12);
// payoff hit at bar 25 and the button note on the end card
{ const env = adsr(0.005, 1.2, 0, 0.6, 2.0); music.add(bar(25), 2.0, i => (sine(36.7, i) + 0.5 * sine(73.4, i) + 0.2 * saw(110, i) * Math.exp(-i / SR * 4)) * env(i), 0.38, 0); }
{ const env = adsr(0.01, 1.4, 0.3, 1.8, 3.6); for (const n of ['D4', 'Fs4', 'A4', 'D5']) { const f = note(D[n]); music.add(60.0, 3.6, i => (sine(f, i) + 0.4 * sine(f * 2, i)) * env(i), 0.14, (D[n] - 66) / 16); } }
const musicWet = reverb(music, { decay: 0.78, wet: 0.22 });
music.addStereo(0, musicWet, 1);

// ---------- sound effects ----------
const sfx = new Mix(DUR);
const rainCurve = t => t < 4 ? 0.25 + t / 4 * 0.15 : t < 20 ? 0.4 + (t - 4) / 16 * 0.35 : t < 40 ? 0.75 + Math.min(0.25, (t - 20) / 16 * 0.25) : t < 42 ? 1 - (t - 40) / 2 : 0;
{ // rain bed: band-limited noise shaped by the rain curve, with a few soft drips
  const rn = noiseGen(7), lp = new Biquad('lp', 3800, 0.6), hp = new Biquad('hp', 700, 0.7);
  sfx.add(0, DUR, i => { const t = i / SR; const w = rainCurve(t); return hp.process(lp.process(rn())) * w * (0.85 + 0.15 * Math.sin(t * 0.7)); }, 0.17, 0);
}
function whoosh(t, dur = 0.9, g = 0.5, pan = 0) { const wn = noiseGen(Math.round(t * 1000)); const bp = new Biquad('bp', 400, 1.2); const env = adsr(dur * 0.45, 0.05, 0.8, dur * 0.5, dur); sfx.add(t, dur, i => { if (i % 128 === 0) bp.set(400 + 2600 * Math.sin(Math.PI * i / SR / dur), 1.2); return bp.process(wn()) * env(i); }, g, pan); }
function tick(t, g = 0.35) { const env = adsr(0.001, 0.03, 0, 0.02, 0.05); sfx.add(t, 0.05, i => sine(2400, i) * env(i) + 0.3 * sine(3600, i) * env(i), g, 0.2); }
function swell(t, dur, g) { const wn = noiseGen(31); const lp = new Biquad('lp', 500, 0.8); const env = adsr(dur * 0.6, 0.2, 0.7, dur * 0.3, dur); sfx.add(t, dur, i => { if (i % 256 === 0) lp.set(300 + 900 * (i / SR / dur), 0.8); return lp.process(wn()) * env(i); }, g, 0); }
function boom(t, g) { const env = adsr(0.005, 0.9, 0, 0.5, 1.6); sfx.add(t, 1.6, i => sine(42 + 30 * Math.exp(-i / SR * 10), i) * env(i), g, 0); }
function buzzDrop(t) { const env = adsr(0.05, 0.4, 0.5, 0.3, 1.4); sfx.add(t, 1.4, i => { const k = i / SR; const f = k < 0.9 ? 120 : 120 * Math.exp(-(k - 0.9) * 6); return (saw(f, i) * 0.4 + saw(f * 2.01, i) * 0.2) * env(i) * (k < 0.9 ? 0.8 + 0.2 * Math.sin(k * 60) : 1); }, 0.22, 0.1); }
function button(t) { const env = adsr(0.004, 0.8, 0.0, 0.4, 1.3); for (const f of [587.3, 880, 1174.7]) sfx.add(t, 1.3, i => sine(f, i) * env(i), 0.14, 0); }

// beats: ticks during every count-up (0.4 s into the beat, over 0.9 s)
const BEAT_STARTS = [0, 4, 8, 12, 16, 20, 26, 32, 36, 40, 44, 48, 54];
for (const b of BEAT_STARTS) for (let k = 0; k < 3; k++) tick(b + 0.4 + k * 0.3, 0.3 - k * 0.05);
whoosh(0.2, 1.4, 0.3);                       // plume forms
whoosh(4.9, 1.6, 0.5, -0.2);                 // fly-to California
swell(8.4, 3.2, 0.3);                        // reservoir rises
whoosh(12.0, 0.7, 0.3);                      // cut to the soil cube
swell(16.4, 3.0, 0.32);                      // runoff rushes downhill
whoosh(20.0, 1.0, 0.5);                      // map transition
swell(26.5, 4.5, 0.42);                      // the lake connects
whoosh(32.6, 1.3, 0.45, 0.2);                // fly south along the route
tick(35.2, 0.4);                             // the route halts
buzzDrop(36.6);                              // power drops
whoosh(40.0, 0.9, 0.3);                      // rain stops, reset
whoosh(44.6, 0.8, 0.4, 0.1);                 // gate opens
boom(48.0, 0.6);                             // payoff
whoosh(54.0, 1.2, 0.3);                      // pull back
button(60.0);                                // end card

// ---------- mix ----------
// music about 9 dB under the effect hits (whooshes, ticks, swells); the rain bed sits lower still as ambience
const master = new Mix(DUR);
master.addStereo(0, sfx, 1.0);
master.addStereo(0, music, Math.pow(10, -9 / 20) * 2.2);
for (let i = 0; i < master.n; i++) { const t = i / SR; const g = Math.min(1, t / 1.0) * Math.min(1, (DUR - t) / 1.5); master.L[i] *= g; master.R[i] *= g; }
const pk = master.peak(); master.scale(0.9 / pk);
writeFileSync('out/audio-raw.wav', toWav(master));
console.log('raw audio written, peak normalised; now loudness-normalising to -14 LUFS / -1 dBTP');
// two-pass loudnorm with ffmpeg
const p1 = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', 'out/audio-raw.wav', '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
const pass1 = p1.stderr;
const stats = JSON.parse((pass1 + '').slice((pass1 + '').lastIndexOf('{')));
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', 'out/audio-raw.wav', '-af', `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true:print_format=summary`, '-ar', '48000', 'out/audio.wav'], { stdio: 'inherit' });
const check = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', 'out/audio.wav', '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
console.log(check.slice(check.lastIndexOf('Summary')).trim());
