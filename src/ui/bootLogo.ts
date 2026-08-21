// The Sentry mark: three nested arches, each with its legs and foot. Supplied as
// a 76x38 bitmap and downsampled here to 38 columns by 38 pixel rows, then
// emitted with half blocks (▀/▄/█) so one character carries two pixel rows.
//
// Character cells are ~0.6em wide by 1em tall, so a half-row pixel is 0.6 x 0.5
// em. The source is 76*0.6 = 45.6 by 38 em, a ratio of 1.2 — which the target
// preserves exactly when columns equal pixel rows. Get that wrong and the
// arches lean.
export const LOGO: string[] = [
  "                ▄▄██▄▄                ",
  "               ████████               ",
  "              ██████████              ",
  "             █████  █████             ",
  "           ▄█████    █████▄           ",
  "           █████      ▀████           ",
  "          ▀███████▄    █████▄         ",
  "         ▄   ▀██████    ▀████▄        ",
  "       ▄████▄  ▀▀█████   ▀████▄       ",
  "      ▄███████▄  ▀█████▄  ▀████▄      ",
  "     ▄████▀██████  ▀████▄   ████▄     ",
  "    ▄█████  ▀█████  ▀████▄  ▀████▄    ",
  "    ▀██████▄  █████▄ ▀████▄  ▀█████   ",
  "      ▀▀████▄  █████  ▀████   ▀█████  ",
  " ▄███▄  ▀█████  ████   ████     ████▄ ",
  "█████▀   ▀█████  ████  █████    ▀█████",
  "████       ████  ████  █████      ████",
  "███████████████  ███████████  ████████",
  "▀██████████████  ███████████  ███████▀",
];

// The wordmark, on the same grid but at the cell size the rest of the screen
// uses: 76 characters wide, which is exactly the mark's 38 columns at twice the
// cell. Every element of the boot screen is that width, so the lockup, the
// header band and the POST log all share one left and right edge.
//
// Mixed case, so it reads as the product's own name rather than as a shout:
// eighteen pixel rows carry a cap line at the top, an x-height starting a third
// of the way down, and two rows of descender for the y. Letters are drawn with
// two-pixel strokes and tracked 4 columns apart; the widths (6 6 6 5 5 6 8 6)
// plus that tracking come to 76 exactly. The y's tail hooks left at the bottom
// rather than dropping straight — a bare vertical stops dead and reads as a
// descender that got clipped rather than as a tail.
export const WORDMARK: string[] = [
  "                                ██                         ██████     ██████",
  "                                ██                        ██    ██    ██    ",
  "██████    ██████    ██████    █████    █████    ██  ██    ██    ██    ██    ",
  "██        ██  ██    ██  ██      ██     ██       ██  ██    ██    ██    ██████",
  "██████    ██████    ██  ██      ██     ██       ██  ██    ██    ██        ██",
  "    ██    ██        ██  ██      ██     ██       ██  ██    ██    ██        ██",
  "██████    ██████    ██  ██      ███    ██       ██████     ██████     ██████",
  "                                                    ██                      ",
  "                                                  ████                      ",
];
