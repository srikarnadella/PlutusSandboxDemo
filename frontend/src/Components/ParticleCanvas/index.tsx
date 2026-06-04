import React, { useRef, useEffect } from "react";

interface ParticleCanvasProps {
  density?: number;
  speed?: number;
  style?: React.CSSProperties;
}

const ParticleCanvas: React.FC<ParticleCanvasProps> = ({
  density = 9000,
  speed = 0.22,
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;
    const mouse = { x: null as number | null, y: null as number | null, radius: 160 };

    class Particle {
      x: number; y: number; vx: number; vy: number; size: number;
      constructor(x: number, y: number, vx: number, vy: number, size: number) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.size = size;
      }
      draw() {
        ctx!.beginPath();
        ctx!.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(52,211,153,0.70)";
        ctx!.fill();
      }
      update() {
        if (this.x > canvas!.width || this.x < 0) this.vx = -this.vx;
        if (this.y > canvas!.height || this.y < 0) this.vy = -this.vy;
        if (mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 0.01) return;
          if (dist < mouse.radius + this.size) {
            const force = (mouse.radius - dist) / mouse.radius;
            this.x -= (dx / dist) * force * 3.5;
            this.y -= (dy / dist) * force * 3.5;
          }
        }
        this.x += this.vx;
        this.y += this.vy;
        this.draw();
      }
    }

    let particles: Particle[] = [];

    const init = () => {
      particles = [];
      const count = Math.floor((canvas!.width * canvas!.height) / density);
      for (let i = 0; i < count; i++) {
        const size = Math.random() * 1.6 + 0.5;
        const half = speed / 2;
        particles.push(new Particle(
          Math.random() * (canvas!.width - size * 4) + size * 2,
          Math.random() * (canvas!.height - size * 4) + size * 2,
          Math.random() * speed - half,
          Math.random() * speed - half,
          size,
        ));
      }
    };

    const connect = () => {
      const threshold = (canvas!.width / 7) * (canvas!.height / 7);
      for (let a = 0; a < particles.length; a++) {
        for (let b = a + 1; b < particles.length; b++) {
          const dx = particles[a].x - particles[b].x;
          const dy = particles[a].y - particles[b].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < threshold) {
            const opacity = (1 - d2 / threshold) * 0.42;
            let lineColor: string;
            if (mouse.x !== null && mouse.y !== null) {
              const mdx = particles[a].x - mouse.x;
              const mdy = particles[a].y - mouse.y;
              lineColor = Math.sqrt(mdx * mdx + mdy * mdy) < mouse.radius
                ? `rgba(255,255,255,${opacity * 0.65})`
                : `rgba(16,185,129,${opacity})`;
            } else {
              lineColor = `rgba(16,185,129,${opacity})`;
            }
            ctx!.strokeStyle = lineColor;
            ctx!.lineWidth = 0.75;
            ctx!.beginPath();
            ctx!.moveTo(particles[a].x, particles[a].y);
            ctx!.lineTo(particles[b].x, particles[b].y);
            ctx!.stroke();
          }
        }
      }
    };

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      ctx!.fillStyle = "rgba(7,11,20,1)";
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
      particles.forEach(p => p.update());
      connect();
    };

    const resize = () => {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
      init();
    };

    const onMouseMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onMouseOut = () => { mouse.x = null; mouse.y = null; };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseout", onMouseOut);
    resize();
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseout", onMouseOut);
      cancelAnimationFrame(rafId);
    };
  }, [density, speed]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        ...style,
      }}
    />
  );
};

ParticleCanvas.displayName = "ParticleCanvas";
export default ParticleCanvas;
