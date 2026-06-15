"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Outlines } from "@react-three/drei";

/* ──────────────────────────────────────────────────────────────────────────
   Tends bot — a rounded TRIANGULAR PRISM (not a pyramid).
   Triangular face points at the camera (silhouette = the 2D logo), extruded
   backward for real thickness. Reactive: the head turns toward the cursor and
   the pupils glance (lirikan) + a glossy glint, while it keeps floating idle.
   Eyes blink every BLINK_INTERVAL seconds. Several material "skins" to pick.
   ────────────────────────────────────────────────────────────────────────── */

export type BotVariant = "matte" | "gradient" | "toon" | "glossy";
/** How the body deforms while reacting:
 *  - "lean": straight shear toward the cursor (a tilting parallelogram)
 *  - "bend": curved bow + bulge toward the cursor (hunched jelly) */
export type MorphMode = "lean" | "bend";

const SCLERA_COLOR = "#F3F5F7";
const PUPIL_COLOR = "#15171A";

const BLINK_INTERVAL = 5; // seconds between blinks
const BLINK_DURATION = 0.16; // seconds a single blink takes

// Reused vectors for the per-frame vertex morph (no per-vertex allocation).
const _mv = new THREE.Vector3();
const _ev = new THREE.Vector3();
const _ev2 = new THREE.Vector3();

/** Build a THREE.Shape for a rounded polygon by rolling each sharp corner
 *  into a quadratic curve of the given radius. */
function roundedPolyShape(points: THREE.Vector2[], radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];

    const toPrev = new THREE.Vector2().subVectors(prev, curr).normalize();
    const toNext = new THREE.Vector2().subVectors(next, curr).normalize();

    const start = new THREE.Vector2().addVectors(
      curr,
      toPrev.clone().multiplyScalar(radius),
    );
    const end = new THREE.Vector2().addVectors(
      curr,
      toNext.clone().multiplyScalar(radius),
    );

    if (i === 0) shape.moveTo(start.x, start.y);
    else shape.lineTo(start.x, start.y);
    shape.quadraticCurveTo(curr.x, curr.y, end.x, end.y);
  }
  shape.closePath();
  return shape;
}

function usePrismGeometry() {
  return useMemo(() => {
    // Equilateral-ish triangle, apex up — matches the 2D proportions.
    const tri = [
      new THREE.Vector2(0, 1.0), // apex
      new THREE.Vector2(1.05, -0.75), // bottom-right
      new THREE.Vector2(-1.05, -0.75), // bottom-left
    ];
    const shape = roundedPolyShape(tri, 0.32);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.7,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.12,
      bevelSegments: 6,
      curveSegments: 28,
      steps: 1,
    });
    geo.center();
    geo.computeVertexNormals();
    return geo;
  }, []);
}

/** Small grayscale ramp used by MeshToonMaterial to quantize lighting into
 *  flat cartoon bands. */
function makeToonGradient(steps: number): THREE.DataTexture {
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) data[i] = Math.round((i / (steps - 1)) * 255);
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

/** The body material for the chosen variant. */
function useBodyMaterial(variant: BotVariant): THREE.Material {
  return useMemo(() => {
    if (variant === "toon") {
      return new THREE.MeshToonMaterial({
        color: "#2C5EAD",
        gradientMap: makeToonGradient(4),
      });
    }

    if (variant === "glossy") {
      return new THREE.MeshPhysicalMaterial({
        color: "#2C5EAD",
        roughness: 0.22,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.35,
      });
    }

    if (variant === "gradient") {
      const mat = new THREE.MeshStandardMaterial({
        color: "#2f63b3",
        roughness: 0.5,
        metalness: 0,
      });
      // Inject a vertical gradient into the diffuse color: lighter sky-blue at
      // the apex fading to a deep blue at the base — a soft, cartoon look.
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTop = { value: new THREE.Color("#67B0EE") };
        shader.uniforms.uBot = { value: new THREE.Color("#173E86") };
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying float vGY;",
          )
          .replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nvGY = position.y;",
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            "#include <common>\nuniform vec3 uTop;\nuniform vec3 uBot;\nvarying float vGY;",
          )
          .replace(
            "vec4 diffuseColor = vec4( diffuse, opacity );",
            "float gT = smoothstep(-0.9, 0.95, vGY);\nvec4 diffuseColor = vec4( mix(uBot, uTop, gT), opacity );",
          );
      };
      mat.customProgramCacheKey = () => "tends-gradient-body";
      return mat;
    }

    // matte (default soft skin)
    return new THREE.MeshStandardMaterial({
      color: "#2C5EAD",
      roughness: 0.55,
      metalness: 0,
    });
  }, [variant]);
}

/** One googly eye: white ellipsoid sclera, a dark pupil (driven by the parent
 *  for the glance), and a small bright glint for cuteness. */
function Eye({
  position,
  tiltZ,
  eyeRef,
  pupilRef,
}: {
  position: [number, number, number];
  tiltZ: number;
  eyeRef: React.RefObject<THREE.Group | null>;
  pupilRef: React.RefObject<THREE.Mesh | null>;
}) {
  return (
    <group position={position} rotation={[0, 0, tiltZ]} ref={eyeRef}>
      {/* Sclera — taller than wide, like the 2D eyes */}
      <mesh scale={[0.28, 0.38, 0.17]}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshStandardMaterial color={SCLERA_COLOR} roughness={0.3} metalness={0} />
      </mesh>
      {/* Pupil — big & round for cuteness; position animated by the parent */}
      <mesh ref={pupilRef} position={[0, -0.04, 0.12]} scale={[0.13, 0.16, 0.09]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color={PUPIL_COLOR} roughness={0.4} metalness={0} />
      </mesh>
      {/* Glint — small bright catch-light, sells the "cute" look */}
      <mesh position={[-0.07, 0.08, 0.2]} scale={0.038}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={"#ffffff"} />
      </mesh>
    </group>
  );
}

function Bot({
  variant,
  morphMode,
  revealed,
}: {
  variant: BotVariant;
  morphMode: MorphMode;
  revealed: boolean;
}) {
  const geo = usePrismGeometry();
  const bodyMat = useBodyMaterial(variant);

  const { gl } = useThree();

  const groupRef = useRef<THREE.Group>(null);
  const eyeLRef = useRef<THREE.Group>(null);
  const eyeRRef = useRef<THREE.Group>(null);
  const pupilLRef = useRef<THREE.Mesh>(null);
  const pupilRRef = useRef<THREE.Mesh>(null);

  // Cursor target, normalized relative to the bot's OWN canvas center (not the
  // window). The bot sits near the left edge of the screen, so a window-centered
  // origin made it turn LEFT when the cursor was right in front of its face.
  // Canvas-relative means it faces forward when the cursor is on its face and
  // turns fully right when the cursor is over the accordion to its right.
  const pointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const clamp = (v: number) => Math.max(-2, Math.min(2, v));
    const onMove = (e: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      pointer.current.x = clamp((e.clientX - cx) / (rect.width / 2));
      pointer.current.y = clamp(-((e.clientY - cy) / (rect.height / 2)));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [gl]);

  // Spring state for the squishy lean — a real spring (with velocity) so it
  // overshoots a little and settles → jelly. At rest it's 0 (clean triangle).
  const leanX = useRef(0);
  const leanXVel = useRef(0);

  // Spring state for the bouncy "pop-in" scale (underdamped → overshoots 1).
  const appear = useRef(0);
  const appearVel = useRef(0);

  // Pristine vertex positions + the body's vertical extent, so we can morph the
  // geometry analytically each frame and restore it cleanly.
  const basePos = useMemo(
    () => (geo.attributes.position.array as Float32Array).slice(),
    [geo],
  );
  const yExtent = useMemo(() => {
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    return { min: bb.min.y, span: bb.max.y - bb.min.y || 1 };
  }, [geo]);

  const PUPIL_BASE_Y = -0.04; // base pupil rest position (local to each eye)
  const FRONT_Z = 0.46; // front face z after centering (half-depth + bevel)

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.033); // clamp so a stutter can't blow up the spring
    const t = clock.getElapsedTime();
    const px = pointer.current.x;
    const py = pointer.current.y;

    // ── Pop-in/out spring (scale). Computed first so we can skip the costly
    //    geometry morph while the bot is essentially invisible (e.g. warming
    //    up during the reveal, before the fall). ──────────────────────────
    const aTarget = revealed ? 1 : 0;
    const Ka = 150; // stiffness
    const Ca = 17; // damping → gentle pop, small overshoot
    appearVel.current +=
      (Ka * (aTarget - appear.current) - Ca * appearVel.current) * dt;
    appear.current += appearVel.current * dt;
    const a = Math.max(0, appear.current);

    const g = groupRef.current;
    if (a < 0.02) {
      if (g) g.scale.setScalar(a);
      return;
    }

    // ── Springy lean toward the cursor ──────────────────────────────────
    // "lean" is gentler (you asked to reduce the tilt); "bend" pushes harder
    // because a quadratic bow reads as less extreme per unit.
    const reach = morphMode === "lean" ? 0.2 : 0.42;
    const K = 120; // stiffness
    const C = 16; // damping
    const target = px * reach;
    const acc = K * (target - leanX.current) - C * leanXVel.current;
    leanXVel.current += acc * dt;
    leanX.current += leanXVel.current * dt;

    // Whip (spring speed) → squash for lean, belly-bulge for bend.
    const whip = THREE.MathUtils.clamp(Math.abs(leanXVel.current) * 0.05, 0, 0.2);
    const breathe = Math.sin(t * 1.5) * 0.012;
    const sx = 1 + (morphMode === "lean" ? whip : whip * 0.4);
    const sy = 1 - whip * 0.5 + breathe;
    const sz = 1 - whip * 0.25;
    const bulge = morphMode === "bend" ? whip * 1.1 : 0;
    const lean = leanX.current;
    const yMin = yExtent.min;
    const span = yExtent.span;

    // Analytic deform shared by the body verts AND the eye anchors so the eyes
    // stay glued to the morphing surface.
    const deform = (bx: number, by: number, bz: number, out: THREE.Vector3) => {
      if (morphMode === "lean") {
        // straight shear: apex slides sideways, edges stay straight
        out.set(bx * sx + lean * by, by * sy, bz * sz);
      } else {
        const h = (by - yMin) / span; // 0 base .. 1 apex
        const bow = lean * h * h; // quadratic → curved bow, base stays planted
        const inflate = 1 + bulge * Math.sin(h * Math.PI); // fattest mid-height
        out.set(bx * sx * inflate + bow, by * sy, bz * sz * inflate);
      }
      return out;
    };

    // Morph the body geometry in place.
    const arr = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      deform(basePos[i], basePos[i + 1], basePos[i + 2], _mv);
      arr[i] = _mv.x;
      arr[i + 1] = _mv.y;
      arr[i + 2] = _mv.z;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();

    // Place each eye on the morphed surface and tilt it to ride the local slope.
    const placeEye = (
      ref: React.RefObject<THREE.Group | null>,
      ax: number,
      baseTilt: number,
    ) => {
      const e = ref.current;
      if (!e) return;
      deform(ax, 0.06, FRONT_Z, _ev);
      deform(ax, 0.11, FRONT_Z, _ev2); // sample slightly higher for the slope
      e.position.set(_ev.x, _ev.y, _ev.z);
      const slope = (_ev2.x - _ev.x) / 0.05; // dx/dy
      e.rotation.z = baseTilt - slope * 0.45;
    };
    placeEye(eyeLRef, -0.33, 0.13);
    placeEye(eyeRRef, 0.33, -0.13);

    // Head turn toward the cursor + floating idle (always on).
    if (g) {
      g.position.y = Math.sin(t * 1.25) * 0.075;
      g.position.x = Math.sin(t * 0.45) * 0.02;
      const targetRotY = px * 0.26 + Math.sin(t * 0.5) * 0.04;
      const targetRotX = -py * 0.18 + 0.03;
      const targetRotZ = Math.sin(t * 0.7) * 0.02;
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, targetRotY, 6, dt);
      g.rotation.x = THREE.MathUtils.damp(g.rotation.x, targetRotX, 6, dt);
      g.rotation.z = THREE.MathUtils.damp(g.rotation.z, targetRotZ, 6, dt);

      // Gentle pop squash from the spring velocity — small so it isn't
      // "gepeng" (the cursor morph keeps its own separate squash/stretch).
      const sq = THREE.MathUtils.clamp(appearVel.current * 0.045, -0.1, 0.1);
      g.scale.set(a * (1 - sq), a * (1 + sq), a * (1 - sq));
    }

    // Pupils glance toward the cursor — faster than the head/body.
    const pupX = px * 0.07;
    const pupY = py * 0.06;
    for (const ref of [pupilLRef, pupilRRef]) {
      const p = ref.current;
      if (!p) continue;
      p.position.x = THREE.MathUtils.damp(p.position.x, pupX, 16, dt);
      p.position.y = THREE.MathUtils.damp(p.position.y, PUPIL_BASE_Y + pupY, 16, dt);
    }

    // Blink: squash eye height to ~8% and back, once per BLINK_INTERVAL.
    const cycle = t % BLINK_INTERVAL;
    let blink = 1;
    if (cycle < BLINK_DURATION) {
      blink = 1 - 0.92 * Math.sin((cycle / BLINK_DURATION) * Math.PI); // 0→1→0
    }
    if (eyeLRef.current) eyeLRef.current.scale.y = blink;
    if (eyeRRef.current) eyeRRef.current.scale.y = blink;
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={geo} material={bodyMat} castShadow>
        {variant === "toon" && <Outlines thickness={0.035} color={"#0E2A52"} />}
      </mesh>

      <Eye
        position={[-0.33, 0.06, FRONT_Z]}
        tiltZ={0.13}
        eyeRef={eyeLRef}
        pupilRef={pupilLRef}
      />
      <Eye
        position={[0.33, 0.06, FRONT_Z]}
        tiltZ={-0.13}
        eyeRef={eyeRRef}
        pupilRef={pupilRRef}
      />
    </group>
  );
}

function Scene({
  variant,
  morphMode,
  revealed,
}: {
  variant: BotVariant;
  morphMode: MorphMode;
  revealed: boolean;
}) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <hemisphereLight
        color={"#eaf2fb"}
        groundColor={"#6f93c4"}
        intensity={0.55}
      />
      <directionalLight position={[4, 7, 6]} intensity={1.5} color={"#ffffff"} />
      <directionalLight position={[-4, 1, 3]} intensity={0.35} color={"#bcd6f0"} />
      <pointLight position={[2, 3, 5]} intensity={0.5} />

      <Bot variant={variant} morphMode={morphMode} revealed={revealed} />

      <ContactShadows
        position={[0, -1.0, 0]}
        opacity={0.32}
        scale={4}
        blur={2.6}
        far={2}
        color={"#16243a"}
      />
    </>
  );
}

export default function BotPrism({
  variant = "gradient",
  morphMode = "lean",
  revealed = true,
  className,
  style,
}: {
  variant?: BotVariant;
  morphMode?: MorphMode;
  /** When it flips true, the bot pops in with a bouncy spring. */
  revealed?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  // Render the Canvas only after mount to sidestep any SSR/hydration issues.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className={className} style={style} />;
  }

  return (
    <Canvas
      className={className}
      style={style}
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0.15, 5.1], fov: 34 }}
    >
      <Scene variant={variant} morphMode={morphMode} revealed={revealed} />
    </Canvas>
  );
}
