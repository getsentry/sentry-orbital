import { useEffect, useState } from "react";

type ShootingStar = {
  id: string;
  startX: number;
  startY: number;
  angle: number;
  duration: number;
};

const SPAWN_INTERVAL_MIN = 8000;
const SPAWN_INTERVAL_MAX = 15000;
const DURATION_MIN = 1200;
const DURATION_MAX = 2200;
const MAX_STARS = 2;

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createStar(): ShootingStar {
  // Stars start from top or left edges, travel diagonally down-right
  const fromTop = Math.random() > 0.4;
  const startX = fromTop ? randomRange(5, 65) : randomRange(-5, 15);
  const startY = fromTop ? randomRange(-5, 5) : randomRange(5, 45);
  
  return {
    id: crypto.randomUUID(),
    startX,
    startY,
    angle: randomRange(25, 50), // Diagonal down-right direction
    duration: randomRange(DURATION_MIN, DURATION_MAX),
  };
}

export function ShootingStars() {
  const [stars, setStars] = useState<ShootingStar[]>([]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    const spawnStar = () => {
      setStars((current) => {
        if (current.length >= MAX_STARS) {
          return current;
        }
        return [...current, createStar()];
      });
      
      // Schedule next spawn
      timeout = setTimeout(spawnStar, randomRange(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX));
    };

    // Initial spawn after a short delay
    timeout = setTimeout(spawnStar, randomRange(3000, 6000));

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  const removeStar = (id: string) => {
    setStars((current) => current.filter((star) => star.id !== id));
  };

  return (
    <div className="shooting-stars-container">
      {stars.map((star) => (
        <div
          key={star.id}
          className="shooting-star"
          style={{
            left: `${star.startX}%`,
            top: `${star.startY}%`,
            "--angle": `${star.angle}deg`,
            "--duration": `${star.duration}ms`,
          } as React.CSSProperties}
          onAnimationEnd={() => removeStar(star.id)}
        />
      ))}
    </div>
  );
}
