# Globe style settings

Open with **`?dev`** in the URL or press **C**, which brings up the diagnostics
readout alongside it. Edits auto-save to localStorage.

**Local only.** The panel is a development tool, not part of the deployed page:
it exposes every internal knob and writes to localStorage. Both **C** and
**`?dev`** do nothing unless the page is being served from localhost, and the
panel's code (leva included, ~75 kB gzipped) sits in a separate chunk that a
visitor to a deployed link never downloads. Previewing a production build
locally still gets it, which is when you most want to check the two agree.

## Easter egg

Seer — a hot-pink pyramid with one big eye and a curl of tentacles — orbits the
planet, watching. Click it and it opens Seer in a new tab. It catches the pointer
from a comfortable distance rather than only where you can see it: it is a small
thing that never stops moving, and its tentacles are barely a pixel wide.

The eye is always turned towards you. Rather than spinning, the pyramid swivels
to hold the camera, drifting a few degrees either way so it reads as alive; a
full spin would swing the one detail that identifies it out of view half the
time. It also leans back as it passes near your line of sight — the eye face
slopes about 27° off the tangent plane, so from directly overhead you would
otherwise be looking at its edge. The lean eases in only once the face starts
turning away, so at the limb it still stands properly upright. Each face carries
its own baked shade, so the form stays legible without a light on it.

- **pyramid** — turn the whole thing off.
- **colour** · **size** · **orbit altitude** · **orbit speed**

It is unlit, so it stays at full strength over the planet's night side. Its
orbit sits inside the spinning globe group, so it is fixed over the surface and
the planet carries it round — including the fast swing when hovering a region in
ORIGIN parks that region in front of you. Outside the group it would have hung
still while the world turned beneath it, which reads as the pyramid following
the camera.

## Camera

Drag to turn the globe. There is no zoom — it was the only way to push the globe
past the fit below, and a view you can shove off the edge of the screen is not
worth the control.

Hovering a region in the **ORIGIN** panel turns that region to face you and
holds the auto-rotation while you hover. The camera's own angle is read live, so
the region still arrives in front of you after you have dragged the view
somewhere else.

## The globe always fits the viewport

`distance` frames the globe, but it can never bring it in closer than the frame
can hold. `fov` is the *vertical* field of view, so a portrait viewport has a
much narrower horizontal one — a globe sized to fill the height would spill past
both edges, which is what made it overflow on a phone.

The camera is fitted to whichever half-angle is smaller, which covers both
orientations with one number. It is a floor, never a ceiling: a config framed
wider than the fit keeps its framing untouched, and only a viewport too small to
hold the globe pulls the camera back. Rotating a phone re-fits both ways, so
landscape returns to the framing the style asked for rather than staying
stranded small.

Consequence: on a narrow screen `distance` stops having an effect below the fit.
That is the constraint doing its job, not the control breaking.

## Rate gauge

Top left, under the day's total. A zoned bargraph rather than a number on its
own, because "48.6 events a second" only means something next to what this feed
usually does: mint for the lower half of the dial, amber above it, red past the
redline at 80% of full scale. The readout takes its colour from the zone it is
in, so the number and the bar can be read as one instrument.

The pale needle is a peak hold — the highest rate of the last few seconds. It
sits still for a beat after a burst and then walks back down to the live rate
rather than snapping, so a spike stays legible after it has passed.

The dial auto-ranges, which is the one behaviour worth knowing:

- Full scale is the recent high-water rate rounded up to a round gradation, and
  it is printed off the right end of the bar. The left end is unlabelled — a
  bargraph starts at zero without being told.
- It widens the instant traffic needs the room, and narrows only after the rate
  has stayed well clear of the step below for a couple of minutes. A rate parked
  on a boundary would otherwise re-range the bar every tick.
- The bar keeps its length through a re-range: the room for that number is
  reserved whether it reads `60` or `1.6k`.
- It starts at the synthetic generator's ceiling purely so the first frames have
  a sane dial. With the live feed the range becomes whatever that feed actually
  does within a minute or two.

So the zones are relative to this stream's own recent peak, not to any absolute
notion of "busy" — red means *as loud as it has lately been*, which is the only
threshold the client can honestly know.

## Event stream

Right-hand column. One row arrives per data tick, newest at the top, and the
whole column slides down to make room for it — the motion is what makes a wall
of fixed-width text readable as a stream rather than as churn.

It is a **sample, not a queue**. At 40 events a second the panel used to redraw
two thirds of its rows every tick, so nothing could be followed; now each tick
admits the newest event and drops whatever else arrived alongside it. Dropping
rather than queueing is deliberate — a queue drained at a readable pace would
fall minutes behind within a minute, and the timestamps would be fiction. The
header carries the ratio (`1:14` = one row shown per fourteen received), so what
is missing is stated rather than implied.

The newest row arrives in mint and cools to normal ink as later rows push it
down, and the bottom of the column fades out with age. Neither is decoration:
between them they say where to look and how old a row is without spending a
column on either. Both stand down under `prefers-reduced-motion`.

Rows carry only what the feed actually has — time, SDK family, region bucket,
and coordinates. There is no event type on the live payload, and the region is
the same coarse longitude bucket the **ORIGIN** panel counts, not a country.

## Alerts bulletin

Top right. Derived live from the same rolling stats the panels read — throughput
against its own trailing baseline, error share per SDK family, and regional
concentration — so a line only appears when something actually moved in the
stream. Each entry links out to sentry.io.

Nothing in it identifies a customer, project, user or issue: the bulletin only
ever names an SDK family, a region and a rate.

Two behaviours worth knowing:

- Alerts are on a cooldown per kind, so one storm produces one line rather than
  a screenful of the same thing.
- A stalled stream is treated as the tab being backgrounded, not as an outage.
  The generator runs off requestAnimationFrame, which browsers suspend on a
  hidden tab, so it would otherwise report a 100% drop on leaving and a spike on
  returning.

The right-hand column is hidden below 1100px wide, so the bulletin goes with it.

## Controls appear only when they apply

The panel hides anything that wouldn't do anything in the current setup, so if a
control is missing it's because its dependency is off:

- `roughness` / `metalness` need `material` = `standard` or `physical`
- `clearcoat` needs `material` = `physical`
- `emissive`, `flat shading`, `shadows on` need any **lit** material (not `basic`)
- `land colour`, `coastline softness` need `surface mode` = `solid` or `relief`
- `relief height` / `softness` / `bevel` need `surface mode` = `relief`
- every **Dots** control needs `surface mode` = `dots`
- `line length` needs beam `style` = `line`; `sprite size`/`growth` need any other style
- `fixed colour` needs beam `colour mode` = `fixed`
- every effect's parameters appear only once that effect is enabled

## Rotation

Rotation lives on the **globe**, not the camera. The planet turns on its own
axis while the camera holds still — so a fixed light behaves like a real sun and
continents pass through day and night. Controls are in the **Globe** folder:

- **auto-rotate** — turn the rotation on/off.
- **rotate speed** — radians per second (0.16 ≈ 39s per rotation).

The camera no longer orbits at all; **Camera** only frames the shot.

### Blank screens that are expected, not bugs

- `exposure` → 0 (global brightness multiplier)
- Bloom `threshold` low + `intensity` high (everything blooms to white)
- A lit material with all lights off
- `globe opacity` or `dots opacity` → 0
- `posterize bits` → 1
- `pixelate`/`ascii` at extreme cell sizes

---

## ⬇ Config

- **Copy config JSON** — whole style to clipboard; hand it over to bake in as the default.
- **Log config** — same, to the console.
- **Run self-test** — sweeps every setting, renders, prints a table of
  `OK` / `no visible change` / `BLANK`.
- **Reset to defaults** — clears the saved config and reloads.

## ★ Presets

- **Dot matrix (default)** — plain starting point, no effects.
- **Clay cartoon** — chunky toy globe: raised continents, distant key light, self-shadowing.
- **Night lights** — teal dotted land, warm gold events, purple haze, stars.
- **Deep violet** — indigo globe, white dot land, cyan beams, blue rim.
- **Ember mono** — warm monochrome amber halos.
- **Aurora** — teal→pink gradient land, expanding rings.
- **Neon night** — high-bloom cyan cyberpunk.
- **Blueprint** — wireframe technical drawing.
- **Pixel toy** — pixelated + posterised retro.

> A preset overwrites every control. Copy your config first if you want to keep it.

## Background

- **color** — the empty space behind everything.

## Globe

- **visible** — draw the sphere at all.
- **surface mode**
  - `dots` — continents as a Fibonacci dot matrix.
  - `solid` — continents painted flat onto the sphere.
  - `relief` — continents raised off the sphere (the clay look).
- **material** — how the surface reacts to light.
  - `basic` — unlit; ignores all lights/shadows. Fastest.
  - `standard` / `physical` — realistic PBR. `physical` adds clearcoat.
  - `phong` — older shiny model. `lambert` — matte. `toon` — banded cel shading.
- **ocean / base** — sphere colour (the sea in solid/relief).
- **land (solid/relief)** — continent colour.
- **relief height** — how far land is pushed out. Relief mode only.
- **coastline softness** — extra blur on the *colour* map only. Coastlines are
  already antialiased, so 0 is crisp *and* smooth; raise this only if you want a
  deliberately hazy shoreline.
- **relief softness** — blur on the *height* map only. Higher = wider, gentler slopes.
- **relief bevel** — reshapes the slope from a straight ramp into an S-curve.
  0 = sharp plateau edge, 1 = fully domed, like pressed clay.
- **emissive** / **emissive int** — self-lit glow, independent of lights.
- **roughness** — 0 = sharp mirror highlight, 1 = matte. Lit materials only.
- **metalness** — 0 = plastic/clay, 1 = metal. Lit materials only.
- **clearcoat** / **clearcoat rough** — glossy varnish layer. `physical` only;
  this is what gives clay its sheen.
- **opacity** — sphere transparency.
- **wireframe** — draw triangle edges only.
- **flat shading** — faceted low-poly instead of smooth.
- **radius** — sphere size relative to the dot shell. <1 sits under the dots,
  >1 swallows them.
- **segments** — mesh resolution. Low = visibly faceted. Relief forces ≥128
  because displacement needs vertices to push around.
- **shadows on** — let the sphere cast and receive shadows.

## Dots  *(dots mode only)*

- **count (density)** — total sample points over the whole sphere; ~⅓ land on
  continents. The master density control.
- **size** — dot size.
- **shell spacing** — pushes the dot shell in/out from the sphere.
- **shape** — `circle` / `square` / `ring` / `diamond`.
- **color mode** — `flat`, or a gradient by `latitude`/`longitude`.
- **color** / **color B** — the two ends of that gradient (B unused when flat).
- **opacity** — dot transparency.
- **altitude** — height above the surface.
- **size attenuation** — on: dots shrink with distance (3D). Off: constant
  pixel size (flat, graphic look).
- **additive blend** — dots add light where they overlap; good for glow.
- **jitter** — 0 = perfect lattice, higher = organic scatter.

## Atmosphere

- **enabled** — rim glow around the limb of the globe.
- **color** — glow colour.
- **intensity** — brightness.
- **falloff power** — higher = tighter band hugging the edge.
- **scale** — size of the glow shell.

## Lighting  *(lit materials only)*

- **ambient on / color / int** — flat light from all directions. No shading or
  direction; high values wash out the terminator.
- **hemisphere on / sky color / ground color / int** — sky colour from above,
  ground colour from below. Great soft fill for toy-like looks.
- **directional on / color / int** — a sun; parallel rays from infinitely far.
  - **dir X / Y / Z** — the light's direction, so it also sets **which way
    shadows fall**.
  - **dir casts shadow** — this light generates the shadow map.
- **point on / color / int** — a bulb at a position.
  - **point X / Y / Z** — its position.
  - **point distance** — range before it stops lighting (0 = infinite).
  - **point decay** — falloff steepness (2 = physically correct).

## Shadows

- **enabled** — master switch. Also needs a light with *casts shadow* and a mesh
  with *shadows on*.
- **type** — `basic` (hard, cheap) → `pcf` → `pcfsoft` (soft) → `vsm` (softest).
- **bias** — nudges depth to remove shadow acne (self-striping stripes).
- **normal bias** — offsets along the surface normal. The right tool for curved
  self-shadowing: removes acne without detaching the shadow.
- **radius** — blur width of the shadow edge.
- **map size** — shadow resolution (512 → 4096). Higher = crisper, costlier.

> Dots are GPU points and can't cast shadows — shadows are for solid/relief.

## Beams  *(the events)*

- **visible** — draw events at all.
- **style**
  - `line` — flat ribbon shooting out from the surface. The quad is expanded in
    *view* space, so it always turns its width toward the camera and never shows
    an end. Not a solid, and it takes no lighting cue from its orientation.
  - `bar` — the same beam as a solid rectangular cuboid, with a depth as well as
    a width and a baked face ramp. A real 3D object, which means a bar pointing
    at the camera shows you its end rather than its height.
  - `dot` — bright soft point.
  - `ring` — ring that expands as it fades.
  - `burst` — radial spikes from a core.
  - `halo` — wide diffuse glow.

  `line` and `bar` share every length, growth and fade control; only **bar
  depth**, **face shading** and **thin out when end-on** are specific to `bar`.
  Switching between them keeps the animation identical.
- **colour mode** — `sdk` colours by SDK family (matching the leaderboard);
  `fixed` paints every event one colour, for monochrome looks.
- **fixed colour** — the colour used in `fixed` mode.
- **sprite size** — size of dot/ring/burst/halo. Sprite styles only.
- **sprite growth** — how much the sprite expands over its life.
- **line length** — base beam length. `line` style only.
- **+ by intensity** — extra length scaled by the event's intensity.
- **opacity** — overall transparency.
- **brightness** — colour multiplier; above 1 pushes into bloom nicely.
- **additive blend** — overlapping events add up into hot spots.
- **hover dim** — how far *other* SDKs fade when you hover one in the
  leaderboard. 0 = they vanish completely.

### Line-beam shaping *(line style)*

`line` beams are camera-facing ribbons, not GL lines — WebGL ignores line width,
so this is what makes real thickness possible.

- **line width** — ribbon thickness in world units.
- **taper to tip** — 0 = parallel sides, 1 = narrows to a point.
- **edge softness** — feathers the long edges; 0 is hard-sided.
- **trail length** — how much of the beam stays lit back from the tip.
- **direction** — `out` grows from the surface, `in` descends toward it.

### Animation

- **fade curve** — `linear` · `easeIn` · `easeOut` · `pulse` · `flash` · `hold`.
- **width** — the ribbon's on-screen width in `line`, or one side of the
  cuboid's cross-section in `bar`.
- **bar depth (x width)** — the other side, as a multiple of width. 1 = square
  bar; low values give a thin slab, high values a wide plank.
- **face shading** — strength of the baked top/side ramp that makes the bar read
  as a solid rather than a silhouette. Applied to coverage as well as colour, so
  it stays visible even with brightness pushed past the clipping point.
- **thin out when end-on** — a bar pointing at the camera has no screen length to
  show, so all you see is its square end, which pixelation then snaps into a
  floating block. This shrinks the cross-section as a bar turns end-on so those
  fade from notice, the way the old billboarded ribbon's hairline did. 0 is
  geometrically honest and shows the squares; 1 makes head-on bars vanish
  entirely. Bars toward the limb, where height is actually readable, are
  unaffected either way.
- **grow duration (s)** — seconds to rise from nothing to the full **length**.
  Beams always grow all the way; there is no partial-growth amount.
- **grow easing** — the curve of that rise.
- **hold at full length (s)** — seconds standing at full height before it starts
  retracting, up to 60.
- **shrink duration (s)** — seconds to retract from full length back to nothing.
  Beams always shrink all the way.
- **shrink easing** — the curve of the retraction.

There is no lifetime setting: a beam's life *is* grow + hold + shrink, so those
three are the whole timeline and none of them can be squeezed out by a separate
duration they have to fit inside. **life jitter** scales all three together, so
the phases keep their proportions and the numbers above stay nominal seconds.
  (`linear`/`easeOut`/`easeIn`/`elastic`).

- **flicker** + **speed** — per-beam brightness noise.
- **sprite spin** — rotation for the sprite styles.
- **lift off surface** — raises the base off the globe.

### Per-event variation

Each event gets its own random seed, so these vary beam to beam rather than
moving in lockstep.

- **hue variation** — colour drift around the base colour.
- **length variation** — random length spread.
- **lifetime variation** — random lifetime spread; stops bursts fading together.

## Bloom

- **enabled** — glow bleeding out of bright areas.
- **intensity** — strength of the glow.
- **threshold** — how bright a pixel must be to bloom. **Low + high intensity =
  white-out.**
- **smoothing** — softness of that threshold cutoff.
- **radius** — how far the glow spreads.
- **mipmap blur** — wider, softer glow. Can cause blocky artifacts on some GPUs;
  off uses a smoother kernel blur.

## Style effects

- **pixelate** / **pixel size** — chunky pixels.
- **ASCII** / **ascii cell** — renders the scene as ASCII characters.
- **halftone dots** / **halftone scale** / **halftone angle** — print-style dot screen.
- **posterize (cartoon)** / **color bits** — reduces the number of colours.
  Low bits = flat cartoon banding; 1 bit is nearly black/white.
- **grayscale** — strips colour.
- **sepia** / **sepia amount** — warm brown wash.
- **scanlines** / **scanline density** — CRT lines.

## Color grade

- **hue/sat on** — enable hue & saturation shifting.
  - **hue** — rotates all colours around the wheel.
  - **saturation** — −1 grey → +1 vivid.
- **bright/contrast on** — enable brightness & contrast.
  - **brightness** — lifts/lowers everything.
  - **contrast** — pushes lights and darks apart.
- **exposure** — overall light level. **0 = black screen.**

## Lens / grain

- **vignette** / **darkness** / **offset** — darkened corners; offset moves where
  the darkening starts.
- **chromatic aberration** / **ca offset** — RGB fringing toward the edges.
  Applies to the map only: beams, clouds, stars and empty space stay sharp
  however far you push the offset. The map still samples colour from wherever
  the shift lands, so a beam can throw a faint fringe onto the ground beside
  it — the beam itself is never smeared. Costs 5 extra draw calls per frame,
  and only while the effect is on.
- **film grain** / **grain amount** — animated noise.
- **tilt shift** / **tilt blur** / **tilt focus** — blurs top and bottom for a
  miniature-model effect; focus sets the sharp band's height.
- **glitch** / **glitch strength** — periodic digital tearing.

## Stars

- **enabled** — drifting starfield behind everything.
- **count** — how many stars.
- **field radius** — how far out the field sits (keep well beyond the globe).
- **field depth** — how thick the shell of stars is.
- **star size** — point size in pixels.
- **saturation** — 0 = white, higher tints each star a random hue.
- **fade at edges** — softens star brightness.
- **drift speed** — slow parallax rotation.

## Clouds

Procedural weather over the surface, in two completely different styles. Colour
and opacity are material properties so they apply instantly; everything else
regenerates the clouds.

- **style** — `soft` is a smooth noise shell. `blocky` builds every cloud out of
  cubes, Crossy Road style. The controls below switch with it.
- **colour** / **opacity** — shared by both styles.
- **altitude** — clearance above the globe surface. In blocky mode this is
  measured off the *lowest block*, so clouds never sink into the planet however
  big you make them.
- **drift vs ground** — clouds sit inside the spinning globe, so this is motion
  *relative to the surface*. Negative drifts the other way.
- **seed** — a completely different sky at the same density.
- **react to lights** — lit shading instead of unlit (needs a light on).
- **additive blend** — glowing clouds rather than opaque ones.

### Soft style

Noise generated from each texel's direction on the sphere, so it wraps
seamlessly and doesn't smear at the poles.

- **coverage** — 0 clear sky, 1 overcast. Linear: 0.45 really is ~45% cloud.
- **edge softness** — hard-edged blobs through to soft haze.
- **scale (weather size)** — low = a few large systems, high = wispy detail.
- **detail (octaves)** — how much fine structure sits inside each mass.

### Blocky style

Each cloud is a voxel blob: a few squashed ellipsoid lobes fused together, eroded
at the rim, then emitted as boxes. Faces touching another block are dropped, so
the whole sky is one draw call with no hidden geometry inside it. Face brightness
is baked into the mesh, so the chunky top/side/bottom look survives even with
every light switched off.

- **cloud count** — separate formations spread evenly over the globe.
- **block size** — the edge of a single cube, in globe radii. The cheapest way to
  make clouds bigger: it costs no extra geometry, where cloud size adds blocks.
- **cloud size (blocks)** — how many blocks across each formation is. Goes wide
  enough for a single cloud to span most of a hemisphere; clouds wrap the globe
  rather than sitting on a flat tangent slab, so a big one hugs the surface
  instead of hovering off it as a plate.
- **puffiness (lobes)** — masses fused into each cloud. 1 = a single dome,
  higher = lumpy multi-humped silhouettes.
- **flatness** — vertical vs horizontal radius. Low = wide flat slabs, high =
  tall towering heaps.
- **ragged edges** — erosion at the rim. 0 = a clean stepped ellipsoid, 1 = a
  chewed-up crumbly outline.
- **size variance** — how much clouds differ in size from each other. 0 = every
  cloud the same, 1 = tiny puffs alongside masses ~10x their width. The draw is
  weighted toward small, so big clouds stay rare enough to read as landmarks,
  and the *average* size doesn't move as you turn it up — only the spread does.
  Block size stays uniform, so a big cloud is one built from more bricks, not
  from bigger ones.
- **speed variance** — how much clouds differ in drift rate from each other. 0
  makes the sky move as one rigid shell; 1 spreads it from near-stationary to
  about twice **drift vs ground**. Symmetric, so the average pace doesn't change
  as you turn it up. Each cloud still travels along its own latitude, so clouds
  near the poles cover less ground than equatorial ones at the same rate.
- **gap between blocks** — shrinks each cube so the bricks visibly separate.
  At 0 the blocks fuse into one solid stepped mass (and interior faces are
  culled); above 0 every cube is drawn in full, which costs ~2x the geometry.
- **face shading** — strength of the baked top/side/bottom brightness ramp.
  0 = flat silhouette, 1 = strongly faceted.
- **block variation** — random brightness jitter per cube, for a less uniform mass.
- **cast shadow** — clouds throw shadows onto the globe. Needs shadows enabled
  and a shadow-casting light.

If you push cloud count and size together the builder stops at a geometry budget
and warns in the console rather than locking the tab.

## Halo shell

A grainy particle shell floating around the globe.

- **enabled** / **colour**
- **particle count** — density of the shell.
- **radius** — how far out it sits (1.0 = globe surface).
- **thickness** — depth the particles scatter through; 0 = a thin sheet.
- **particle size** — individual particle size.
- **opacity** — transparency.
- **additive blend** — glows where particles overlap.

## Camera

- **fov (base)** — the lens angle before flattening. High values give
  wide-angle distortion; low values compress perspective.
- **flatten (telephoto)** — 0..1. A wide lens makes whatever faces you bulge
  outward (fish-eye); this narrows the lens and pulls the camera back by the
  matching amount, so the globe **stays the same size on screen** but the land
  reads flatter and more evenly sized. 1 is near-orthographic.
- **distance** — how far the camera sits (applies live).
- **tilt** — camera height, i.e. how much you look down on the globe.
