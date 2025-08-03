import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import styles from './CrashRocketScene.module.css';

interface CrashRocketSceneProps {
  multiplier: number;
  phase: 'waiting' | 'betting' | 'playing' | 'crashed';
  className?: string;
}

// Color interpolation helper functions
const interpolateColor = (color1: string, color2: string, factor: number): string => {
  // Convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * factor);
  const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * factor);
  const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * factor);

  return `rgb(${r}, ${g}, ${b})`;
};

const interpolateGradient = (colors1: string[], colors2: string[], factor: number): string => {
  const interpolatedColors = colors1.map((color1, index) => {
    const color2 = colors2[index] || colors2[colors2.length - 1];
    return interpolateColor(color1, color2, factor);
  });
  
  // Add more color stops for smoother gradients
  const stops = [
    '0%',
    '25%', 
    '50%',
    '75%',
    '100%'
  ];
  
  const gradientColors = interpolatedColors.map((color, index) => {
    const stop = stops[index] || '100%';
    return `${color} ${stop}`;
  });
  
  return `linear-gradient(135deg, ${gradientColors.join(', ')})`;
};

export default function CrashRocketScene({ multiplier, phase, className = '' }: CrashRocketSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const WIDTH = mountRef.current.clientWidth;
    const HEIGHT = mountRef.current.clientHeight;

    // Scene with fog (MineCash theme)
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x2C2C2C, 10, 1500); // Dark gray fog (MineCash theme)
    sceneRef.current = scene;

    // Camera (exact same as their example)
    const camera = new THREE.PerspectiveCamera(60, WIDTH / HEIGHT, 1, 10000);
    camera.position.x = 0;
    camera.position.z = 500;
    camera.position.y = -10;
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(WIDTH, HEIGHT);
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // Lights (like the example)
    const ambientLight = new THREE.HemisphereLight(0x404040, 0x404040, 1);
    const directionalLight = new THREE.DirectionalLight(0xdfebff, 1);
    directionalLight.position.set(-300, 0, 600);
    const pointLight = new THREE.PointLight(0xa11148, 2, 1000, 2);
    pointLight.position.set(200, -100, 50);
    scene.add(ambientLight, directionalLight, pointLight);

    // No 3D rocket needed - using CSS rocket instead
    console.log('✅ Scene initialized - CSS rocket will be rendered!');

    // Simple animation loop (like the example)
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      
      // CSS rocket handles its own positioning - no 3D manipulation needed
      
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      
      const newWidth = mountRef.current.clientWidth;
      const newHeight = mountRef.current.clientHeight;
      
      cameraRef.current.aspect = newWidth / newHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (mountRef.current && rendererRef.current?.domElement) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      window.removeEventListener('resize', handleResize);
      rendererRef.current?.dispose();
    };
  }, []);

  // Update when phase/multiplier changes
  useEffect(() => {
    // The animation loop handles this automatically
  }, [phase, multiplier]);

  // Smooth background color calculation
  const getBackgroundColor = () => {
    if (phase === 'crashed') {
      return 'linear-gradient(135deg, #0a0a0a 0%, #2a0a0a 25%, #4a0a0a 50%, #6a0a0a 75%, #8b0000 100%)';
    } else if (phase === 'waiting' || phase === 'betting') {
      // More subtle gradient for waiting/betting phases
      return 'linear-gradient(135deg, #0F0F0F 0%, #1A1A1A 25%, #2C2C2C 50%, #3A3A3A 75%, #4A4A4A 100%)';
    } else if (phase === 'playing') {
      // Define color stages with very subtle gradients that stay dark
      const colorStages = [
        { 
          multiplier: 1.0, 
          colors: ['#0F0F0F', '#1A1A1A', '#2C2C2C', '#3A3A3A', '#4A4A4A'] 
        },
        { 
          multiplier: 1.5, 
          colors: ['#0F0F0F', '#1A1A1A', '#2C2C2C', '#3A3A3A', '#4A4A4A'] 
        },
        { 
          multiplier: 2.0, 
          colors: ['#0F0F0F', '#1A1A1A', '#2C2C2C', '#3A3A3A', '#4A4A4A'] 
        },
        { 
          multiplier: 2.5, 
          colors: ['#0F0F0F', '#1A1A1A', '#2C2C2C', '#3A3A3A', '#4A4A4A'] 
        },
        { 
          multiplier: 3.0, 
          colors: ['#0F0F0F', '#1A1A1A', '#2C2C2C', '#3A3A3A', '#4A4A4A'] 
        },
        { 
          multiplier: 4.0, 
          colors: ['#0F0F0F', '#1A1A1A', '#2C2C2C', '#3A3A3A', '#4A4A4A'] 
        },
        { 
          multiplier: 5.0, 
          colors: ['#0F0F0F', '#1A1A1A', '#2C2C2C', '#3A3A3A', '#4A4A4A'] 
        }
      ];

      // Find the appropriate color stage
      let stageIndex = 0;
      for (let i = 0; i < colorStages.length - 1; i++) {
        if (multiplier >= colorStages[i].multiplier && multiplier < colorStages[i + 1].multiplier) {
          stageIndex = i;
          break;
        }
      }
      if (multiplier >= colorStages[colorStages.length - 1].multiplier) {
        stageIndex = colorStages.length - 1;
      }

      const currentStage = colorStages[stageIndex];
      const nextStage = colorStages[Math.min(stageIndex + 1, colorStages.length - 1)];
      
      // Calculate interpolation factor
      const factor = nextStage.multiplier === currentStage.multiplier ? 0 : 
        (multiplier - currentStage.multiplier) / (nextStage.multiplier - currentStage.multiplier);
      
      return interpolateGradient(currentStage.colors, nextStage.colors, factor);
    }
    
    // Default subtle gradient
    return 'linear-gradient(135deg, #0F0F0F 0%, #1A1A1A 25%, #2C2C2C 50%, #3A3A3A 75%, #4A4A4A 100%)';
  };

  // Smooth flame color calculation
  const getFlameColor = () => {
    if (phase !== 'playing') {
      return 'linear-gradient(45deg, #E63946 0%, #FF8C00 25%, #FFD700 50%, #FFD700 75%, #FFD700 100%)';
    }

    // Define flame color stages for smooth interpolation with more color stops
    const flameStages = [
      { 
        multiplier: 1.0, 
        colors: ['#E63946', '#FF8C00', '#FFD700', '#FFD700', '#FFD700'] 
      },
      { 
        multiplier: 1.5, 
        colors: ['#ffdd00', '#ffed00', '#ffff00', '#ffff00', '#ffffff'] 
      },
      { 
        multiplier: 2.0, 
        colors: ['#ffcc00', '#ffdc00', '#ffff00', '#ffff00', '#ffffff'] 
      },
      { 
        multiplier: 2.5, 
        colors: ['#ff9900', '#ffb900', '#ffdd00', '#ffff00', '#ffff00'] 
      },
      { 
        multiplier: 3.0, 
        colors: ['#ff6600', '#ff8600', '#ffcc00', '#ffff00', '#ffff00'] 
      },
      { 
        multiplier: 4.0, 
        colors: ['#ff3300', '#ff5300', '#ff9900', '#ffff00', '#ffff00'] 
      },
      { 
        multiplier: 5.0, 
        colors: ['#ff0000', '#ff2000', '#ff6600', '#ffff00', '#ffff00'] 
      }
    ];

    // Find the appropriate flame stage
    let stageIndex = 0;
    for (let i = 0; i < flameStages.length - 1; i++) {
      if (multiplier >= flameStages[i].multiplier && multiplier < flameStages[i + 1].multiplier) {
        stageIndex = i;
        break;
      }
    }
    if (multiplier >= flameStages[flameStages.length - 1].multiplier) {
      stageIndex = flameStages.length - 1;
    }

    const currentStage = flameStages[stageIndex];
    const nextStage = flameStages[Math.min(stageIndex + 1, flameStages.length - 1)];
    
    // Calculate interpolation factor
    const factor = nextStage.multiplier === currentStage.multiplier ? 0 : 
      (multiplier - currentStage.multiplier) / (nextStage.multiplier - currentStage.multiplier);
    
    return interpolateGradient(currentStage.colors, nextStage.colors, factor);
  };

  return (
    <div 
      className={`w-full h-full ${className}`}
      style={{ 
        position: 'relative',
        background: getBackgroundColor(),
        overflow: 'hidden',
        perspective: '10rem',
        transition: 'background 0.1s ease-out' // Smooth background transitions
      }}
    >
      {/* 3D Canvas */}
      <div 
        ref={mountRef} 
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          overflow: 'hidden'
        }}
      />
      
      {/* Moving rain effects (like their example) */}
      <div className={`${styles.rain} ${styles.rain1}`}></div>
      <div className={`${styles.rain} ${styles.rain2}`}><div className={`${styles.drop} ${styles.drop2}`}></div></div>
      <div className={`${styles.rain} ${styles.rain3}`}></div>
      <div className={`${styles.rain} ${styles.rain4}`}></div>
      <div className={`${styles.rain} ${styles.rain5}`}><div className={`${styles.drop} ${styles.drop5}`}></div></div>
      <div className={`${styles.rain} ${styles.rain6}`}></div>
      <div className={`${styles.rain} ${styles.rain7}`}></div>
      <div className={`${styles.rain} ${styles.rain8}`}><div className={`${styles.drop} ${styles.drop8}`}></div></div>
      <div className={`${styles.rain} ${styles.rain9}`}></div>
      <div className={`${styles.rain} ${styles.rain10}`}></div>
      <div className={`${styles.drop} ${styles.drop11}`}></div>
      <div className={`${styles.drop} ${styles.drop12}`}></div>
      
      {/* Simple CSS Rocket - flies faster with higher multipliers */}
      <div 
        className={phase === 'crashed' ? styles.rocketWrapperHidden : styles.rocketWrapper}
        style={{
          left: (() => {
            if (phase === 'betting' || phase === 'waiting') {
              return '25%'; // Start at left
            } else if (phase === 'playing') {
              // Faster movement with higher multipliers - exponential speed increase
              const speedMultiplier = Math.min(multiplier * 0.8, 3); // Speed increases with multiplier
              const rawProgress = Math.min((multiplier - 1) / (1.75 * speedMultiplier), 1);
              const easedProgress = 1 - Math.pow(1 - rawProgress, 2); // Quadratic easing for faster acceleration
              return `${25 + (easedProgress * 25)}%`; // 25% to 50%
            }
            return '50%'; // Crashed - stay at center
          })(),
          top: (() => {
            if (phase === 'betting' || phase === 'waiting') {
              return '40%'; // Directly above flame (closer)
            } else if (phase === 'playing') {
              // Vertical movement accelerates with multiplier
              const speedMultiplier = Math.min(multiplier * 0.8, 3);
              const rawProgress = Math.min((multiplier - 1) / (1.75 * speedMultiplier), 1);
              const verticalProgress = Math.sin(rawProgress * Math.PI * 0.5);
              return `${40 - (verticalProgress * 20)}%`; // More vertical movement (40% to 20%)
            }
            return '20%'; // Crashed - stay higher up
          })(),
          transition: 'none' // Remove transition to prevent stuttering
        }}
      >
        <div 
          className={styles.rocketBody}
          style={{
            transform: (() => {
              const floatOffset = Math.sin(Date.now() * 0.003) * 2; // Smooth floating
              if (phase === 'playing') {
                const rawProgress = Math.min((multiplier - 1) / 1.75, 1); // 4x faster
                const horizontalProgress = rawProgress; // Use linear progress for smoother animation
                // Stop rotating once mostly reached center (horizontalProgress > 0.85)
                const rotation = horizontalProgress > 0.85 ? 0 : Math.min(multiplier * 5, 45);
                return `translateY(${floatOffset}px) rotate(${Math.round(rotation * 10) / 10}deg)`; // Combine float and rotation
              }
              return `translateY(${floatOffset}px) rotate(0deg)`;
            })()
          }}
        >
          <div className={styles.rocketNose}></div>
          <div className={styles.rocketMain}></div>
          <div className={styles.rocketFins}></div>
        </div>
      </div>

      {/* Flame effect - accelerates with rocket speed */}
      <div 
        className={styles.fireWrapper}
        style={{
          left: (() => {
            if (phase === 'betting' || phase === 'waiting') {
              return '25%'; // Start at left
            } else if (phase === 'playing') {
              // Match rocket speed - exponential acceleration
              const speedMultiplier = Math.min(multiplier * 0.8, 3);
              const rawProgress = Math.min((multiplier - 1) / (1.75 * speedMultiplier), 1);
              const easedProgress = 1 - Math.pow(1 - rawProgress, 2); // Quadratic easing
              return `${25 + (easedProgress * 25)}%`; // 25% to 50%
            }
            return '50%'; // Crashed - stay at center
          })(),
          top: (() => {
            if (phase === 'betting' || phase === 'waiting') {
              return '55%'; // Position below rocket (rocket is at 40%)
            } else if (phase === 'playing') {
              // Match rocket vertical movement
              const speedMultiplier = Math.min(multiplier * 0.8, 3);
              const rawProgress = Math.min((multiplier - 1) / (1.75 * speedMultiplier), 1);
              const verticalProgress = Math.sin(rawProgress * Math.PI * 0.5);
              return `${55 - (verticalProgress * 20)}%`; // 55% to 35% (always below rocket)
            }
            return '35%'; // Crashed - stay below rocket at 20%
          })(),
          transition: 'none' // Remove transition to prevent stuttering
        }}
      >
        <div 
          className={styles.fire}
          style={{
            width: '100%',
            height: `${phase === 'playing' ? Math.min(40 + multiplier * 8, 120) : 40}px`, // Bigger flame with higher multiplier
            background: getFlameColor(),
            borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
            opacity: phase === 'crashed' ? 0 : (phase === 'playing' ? Math.min(0.7 + multiplier * 0.15, 1) : (phase === 'betting' ? 0.6 : 0.4)), // More intense with higher multiplier
            filter: phase === 'playing' ? `brightness(${1 + multiplier * 0.2}) blur(${Math.min(multiplier * 0.5, 2)}px)` : 'none', // More dramatic effects
            display: phase === 'crashed' ? 'none' : 'block', // Completely hide when crashed
            transform: phase === 'playing' ? `scale(${1 + multiplier * 0.1})` : 'scale(1)', // Bigger scale with higher multiplier
            boxShadow: phase === 'playing' ? `0 0 ${Math.min(multiplier * 10, 50)}px ${multiplier >= 3 ? '#ffff00' : '#ff6600'}` : 'none' // Glow effect
          }}
        />
      </div>
    </div>
  );
}