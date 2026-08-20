// Shared GLSL for the beam ribbons and sprites.

export const FADE_INDEX = { linear: 0, easeIn: 1, easeOut: 2, pulse: 3, flash: 4, hold: 5 } as const;
export const EASE_INDEX = { linear: 0, easeOut: 1, easeIn: 2, elastic: 3 } as const;

/** Life -> brightness curve, plus grow-in easing and a hue rotation. */
export const BEAM_COMMON = /* glsl */ `
  // 0 linear, 1 easeIn, 2 easeOut, 3 pulse, 4 flash, 5 hold
  float fadeCurve(float life, float mode) {
    float inv = 1.0 - life;
    if (mode < 0.5) return inv;
    if (mode < 1.5) return inv * inv;
    if (mode < 2.5) return sqrt(max(0.0, inv));
    if (mode < 3.5) return inv * (0.55 + 0.45 * sin(life * 12.566));
    if (mode < 4.5) return exp(-life * 5.0);
    return smoothstep(1.0, 0.78, life);
  }

  // 0 linear, 1 easeOut, 2 easeIn, 3 elastic
  float easeCurve(float t, float mode) {
    t = clamp(t, 0.0, 1.0);
    if (mode < 0.5) return t;
    if (mode < 1.5) return 1.0 - (1.0 - t) * (1.0 - t);
    if (mode < 2.5) return t * t;
    return 1.0 - pow(2.0, -9.0 * t) * cos(t * 22.0);
  }

  vec3 hueRotate(vec3 c, float a) {
    const vec3 k = vec3(0.57735);
    float cs = cos(a);
    return c * cs + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - cs);
  }

  float flickerAt(float seed, float t, float amount, float speed) {
    if (amount <= 0.0) return 1.0;
    float n = sin(t * speed + seed * 6.2831) * 0.5 + 0.5;
    return mix(1.0, n, amount);
  }
`;
