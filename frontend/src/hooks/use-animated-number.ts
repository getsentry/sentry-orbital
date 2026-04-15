import { useEffect, useRef, useState } from "react";

type AnimatedNumberOptions = {
  stiffness?: number;
  damping?: number;
  precision?: number;
};

const DEFAULT_STIFFNESS = 0.08;
const DEFAULT_DAMPING = 0.85;
const DEFAULT_PRECISION = 0.5;

/**
 * A hook that smoothly animates a number using spring physics.
 * Creates an "odometer" effect where the displayed value eases toward the target.
 */
export function useAnimatedNumber(
  target: number,
  options: AnimatedNumberOptions = {},
): number {
  const {
    stiffness = DEFAULT_STIFFNESS,
    damping = DEFAULT_DAMPING,
    precision = DEFAULT_PRECISION,
  } = options;

  const [displayed, setDisplayed] = useState(target);
  const currentRef = useRef(target);
  const velocityRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    // If we're already at the target (or very close), skip animation
    if (Math.abs(currentRef.current - target) < precision && velocityRef.current === 0) {
      currentRef.current = target;
      setDisplayed(target);
      return;
    }

    const animate = () => {
      const current = currentRef.current;
      const distance = target - current;

      // Spring physics: force = stiffness * distance
      // Velocity is damped and force is applied
      velocityRef.current = velocityRef.current * damping + distance * stiffness;
      currentRef.current = current + velocityRef.current;

      // Check if we've settled (close enough and slow enough)
      const settled =
        Math.abs(distance) < precision && Math.abs(velocityRef.current) < precision * 0.1;

      if (settled) {
        currentRef.current = target;
        velocityRef.current = 0;
        setDisplayed(target);
        frameRef.current = null;
        return;
      }

      // Round for display to avoid excessive decimal places
      setDisplayed(Math.round(currentRef.current));
      frameRef.current = requestAnimationFrame(animate);
    };

    // Start animation loop if not already running
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [target, stiffness, damping, precision]);

  return displayed;
}
