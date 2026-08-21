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
