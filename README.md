# One Turning World

A scroll-driven editorial experience: one day and one year through five cities
(Tokyo, Cairo, Paris, New York, Ushuaia) around a single persistent Three.js Earth.

```bash
npm install
npm run dev      # local development
npm run build    # type-check and production build
```

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
