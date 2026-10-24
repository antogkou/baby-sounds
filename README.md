# Baby Sounds

A small offline web app for a 3-month-old: play-time voices and sounds, plus sleep sounds.
All audio is generated in the browser (Web Audio and in-browser WAV rendering). There are no audio files.

**Open it:** https://antogkou.github.io/baby-sounds/

## Modes

- **Play time:** slow-moving black, white and red shapes. Tap a shape to make it bounce and make a sound. You also get a sing-song "parentese" voice in English or Greek (ΕΛ), Peekaboo, a song, a rattle, chimes, coos and bubbles.
- **Games (2 yrs):** Balloons (pop them and hear the colours), Animals (sounds and names), Colours ("Find red!"), Paint (finger painting), Count 1-5, and Hide & seek behind bushes. There is no reading, no failing and no timers. To go back, press and hold the arrow for 1 second.
- **Sleep:** white, pink and brown noise, a heartbeat (womb), shushing, ocean waves, and music-box versions of Brahms' Lullaby and Twinkle Twinkle. It has a sleep timer (15/30/45/60/off) with a 90-second fade-out, a dark screen and a dimmer. It also keeps the screen on.

## Install on iPhone

1. Open the link above in Safari.
2. Tap **Share**, then **Add to Home Screen**.

## Safe listening

Keep the phone at least 2 m (about 7 ft) from the baby. Keep the volume low, around 50 dB. Never put the phone in the crib.

## Development

It is a static site with no build step. To serve it locally, run `python3 -m http.server`.
The smoke tests are `node tests/smoke.mjs http://localhost:8000/ webkit` and `node tests/games.mjs http://localhost:8000/`. They need `playwright`.
Every push to `main` deploys to GitHub Pages.
