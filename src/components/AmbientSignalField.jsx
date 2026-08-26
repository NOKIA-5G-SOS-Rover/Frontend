import React, { useEffect, useRef } from 'react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const seededRandom = (seed) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

const createParticles = (count, bottomWeighted = false) => Array.from({ length: count }, (_, index) => {
  const ySeed = seededRandom(index * 1.91 + 29);
  const lowerBandSeed = seededRandom(index * 4.13 + 173);
  const y = bottomWeighted && lowerBandSeed < 0.42
    ? 0.5 + ySeed * 0.5
    : ySeed;

  return {
  x: seededRandom(index * 1.17 + 11),
  y,
  depth: 0.3 + seededRandom(index * 2.43 + 47) * 1.05,
  size: 0.55 + seededRandom(index * 2.89 + 83) * 1.95,
  speed: 0.16 + seededRandom(index * 3.31 + 101) * 0.78,
  phase: seededRandom(index * 3.77 + 131) * Math.PI * 2,
  tone: index % 11 === 0 ? 'bright' : index % 19 === 0 ? 'soft' : 'critical',
  lowerBand: bottomWeighted && lowerBandSeed < 0.42,
  };
});

export default function AmbientSignalField({ bottomWeighted = false, coquette = false }) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper || process.env.NODE_ENV === 'test') return undefined;

    const context = canvas.getContext?.('2d');
    if (!context) return undefined;

    const matchMediaSafe = (query) => (
      typeof window.matchMedia === 'function'
        ? window.matchMedia(query)
        : { matches: false, addEventListener: () => {}, removeEventListener: () => {} }
    );

    const compact = matchMediaSafe('(max-width: 760px)');
    const reducedMotion = matchMediaSafe('(prefers-reduced-motion: reduce)');
    const particles = createParticles(
      compact.matches ? (bottomWeighted ? 460 : 360) : (bottomWeighted ? 980 : 760),
      bottomWeighted
    );

    let width = 1;
    let height = 1;
    let pixelRatio = 1;
    let frameId = null;
    let inViewport = true;
    let documentVisible = document.visibilityState !== 'hidden';
    let currentScroll = window.scrollY || 0;
    let targetScroll = currentScroll;
    let scrollEnergy = 0;
    let lastScroll = currentScroll;
    let pointerX = 0.5;
    let pointerY = 0.5;

    const resize = () => {
      const bounds = wrapper.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const handleScroll = () => {
      targetScroll = window.scrollY || 0;
      const delta = Math.abs(targetScroll - lastScroll);
      scrollEnergy = clamp(scrollEnergy + delta * 0.024, 0, 1.35);
      lastScroll = targetScroll;
    };

    const handlePointerMove = (event) => {
      pointerX = clamp(event.clientX / Math.max(window.innerWidth, 1), 0, 1);
      pointerY = clamp(event.clientY / Math.max(window.innerHeight, 1), 0, 1);
    };

    const draw = (time) => {
      context.clearRect(0, 0, width, height);
      currentScroll += (targetScroll - currentScroll) * 0.09;
      scrollEnergy *= 0.935;

      const seconds = reducedMotion.matches ? 0 : time * 0.001;
      const scrollPhase = currentScroll * 0.0018;
      const activeMotion = reducedMotion.matches ? 0 : 0.42 + scrollEnergy * 2.05;
      const rendered = [];

      particles.forEach((particle) => {
        const driftX = Math.sin(seconds * particle.speed + particle.phase) * 20 * particle.depth * activeMotion;
        const driftY = Math.cos(seconds * particle.speed * 0.72 + particle.phase) * 13 * particle.depth * activeMotion;
        const parallaxX = (pointerX - 0.5) * 28 * particle.depth;
        const parallaxY = (pointerY - 0.5) * 18 * particle.depth;
        const scrollX = Math.sin(scrollPhase + particle.phase) * 48 * particle.depth * (0.42 + scrollEnergy);
        const scrollY = currentScroll * particle.depth * -0.17;

        const x = ((particle.x * width + driftX + parallaxX + scrollX) % (width + 100) + width + 100) % (width + 100) - 50;
        const y = ((particle.y * height + driftY + parallaxY + scrollY) % (height + 100) + height + 100) % (height + 100) - 50;
        const pulse = 0.72 + Math.sin(seconds * 1.4 + particle.phase) * 0.28;
        const lowerBandBoost = particle.lowerBand ? 1.18 : 1;
        const alpha = (0.28 + particle.depth * 0.44) * pulse * lowerBandBoost * (coquette ? 0.76 : 1);

        rendered.push({ ...particle, x, y, alpha });
      });

      context.globalCompositeOperation = coquette ? 'source-over' : 'lighter';

      for (let index = 0; index < rendered.length; index += 1) {
        const particle = rendered[index];
        if (index % 5 !== 0) continue;

        let nearest = null;
        let nearestDistance = 102;
        for (let candidateIndex = index + 1; candidateIndex < rendered.length; candidateIndex += 1) {
          const candidate = rendered[candidateIndex];
          const distance = Math.hypot(candidate.x - particle.x, candidate.y - particle.y);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = candidate;
          }
        }

        if (nearest) {
          const lineAlpha = (1 - nearestDistance / 102) * 0.12 * (0.7 + scrollEnergy);
          const lineRgb = coquette ? '205, 87, 137' : '255, 91, 231';
          context.strokeStyle = `rgba(${lineRgb}, ${lineAlpha * (coquette ? 1.45 : 1)})`;
          context.lineWidth = 0.55;
          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(nearest.x, nearest.y);
          context.stroke();
        }
      }

      rendered.forEach((particle) => {
        const radius = particle.size * (0.72 + particle.depth * 0.44);
        let rgb = coquette ? '218, 83, 142' : '255, 0, 218';
        if (particle.tone === 'bright') rgb = coquette ? '235, 128, 174' : '255, 91, 231';
        if (particle.tone === 'soft') rgb = coquette ? '246, 181, 209' : '255, 157, 240';

        context.fillStyle = `rgba(${rgb}, ${particle.alpha})`;
        context.beginPath();
        context.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
        context.fill();

        if (particle.size > 1.35) {
          context.fillStyle = `rgba(${rgb}, ${particle.alpha * 0.11})`;
          context.beginPath();
          context.arc(particle.x, particle.y, radius * 4.4, 0, Math.PI * 2);
          context.fill();
        }
      });

      context.globalCompositeOperation = 'source-over';
      if (inViewport && documentVisible) {
        frameId = window.requestAnimationFrame(draw);
      } else {
        frameId = null;
      }
    };

    const resumeIfNeeded = () => {
      if (inViewport && documentVisible && frameId === null) {
        frameId = window.requestAnimationFrame(draw);
      }
    };

    const pauseIfNeeded = () => {
      if ((!inViewport || !documentVisible) && frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
    };

    const handleVisibility = () => {
      documentVisible = document.visibilityState !== 'hidden';
      pauseIfNeeded();
      resumeIfNeeded();
    };

    const resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(resize)
      : null;

    const intersectionObserver = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(([entry]) => {
        inViewport = entry.isIntersecting;
        pauseIfNeeded();
        resumeIfNeeded();
      }, { threshold: 0.01 })
      : null;

    resize();
    resizeObserver?.observe(wrapper);
    intersectionObserver?.observe(wrapper);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);
    frameId = window.requestAnimationFrame(draw);

    return () => {
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, [bottomWeighted, coquette]);

  return (
    <div className="ambient-signal-field" ref={wrapperRef} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
