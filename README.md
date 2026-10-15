# One Turning World

A scroll-driven editorial experience: one day and one year through five cities
(Tokyo, Cairo, Paris, New York, Ushuaia) around a single persistent Three.js Earth.

```bash
npm install
npm run dev      # local development
npm run build    # type-check and production build
```

## Origin

The idea and the brief come from the OpenAI master dev workshop
([katia-openai/master-dev-workshop](https://github.com/katia-openai/master-dev-workshop)),
the "Year in a Day" prompt series:

1. `prompts/year-in-a-day-01-experience.txt` — the scroll-driven globe experience.
2. `prompts/year-in-a-day-02-sprites.txt` — landmark sprites orbiting the Earth.
3. `prompts/year-in-a-day-03-polish-goal.txt` — the goal of reaching exhibition quality.

The workshop's reference demo is
[year-in-a-day-demo.openai.chatgpt.site](https://year-in-a-day-demo.openai.chatgpt.site).
This implementation was built independently from those prompts; the code is not
taken from the demo. Landmark sprites were generated with Figma AI image
generation and keyed to transparency with `scripts/key-sprites.py`.

## Structure

- `src/scene/Experience.ts` — renderer, camera, damping, city ownership, three-layer compositing (rear → Earth → foreground).
- `src/scene/Globe.ts` — Earth shader, clouds, atmosphere, city markers.
- `src/scene/orbit.ts` — globe-centred orbits: limb clearance, layer hysteresis, speed-limited orbital angle.
- `src/scene/cities/*` — procedural choreography per city.
- `src/data/landmarks.ts` — landmark sprite configuration (window, side, focus, depth, scale).
- `src/components/SolarStepper.tsx` — solar-course navigation.

## Landmark sprites

Sources live in `assets-src/sprites` (chroma-key renders). Regenerate the
transparent WebP files in `public/sprites` with:

```bash
python3 scripts/key-sprites.py   # needs Pillow, NumPy and cwebp
```
