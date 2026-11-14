import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, useProgress } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  Box3,
  Color,
  Group,
  Mesh,
  AdditiveBlending,
  MeshStandardMaterial,
  NormalBlending,
  PerspectiveCamera,
  PMREMGenerator,
  Vector3,
  Vector4,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { acceleratedRaycast, computeBoundsTree } from 'three-mesh-bvh';
import { bodySites, cameraEase, cameraTargets, CAMERA_DURATION_MS } from './anatomyConfig';
import type { BodyMarker } from './lib';
import type { Status } from './types';

export interface LayersState {
  skin: boolean;
  muscles: boolean;
  skeleton: boolean;
  organs: boolean;
}
interface Props {
  selected: string;
  focused: boolean;
  states: Record<string, Status>;
  onSelect: (id: string) => void;
  layers: LayersState;
  back: boolean;
  reset: number;
  markers?: BodyMarker[];
  onReady?: () => void;
  /** false: focusing only moves the camera; every layer stays as in overview (no detail swap). */
  isolate?: boolean;
  /** false: alert sites keep their soft glow but no callout labels are drawn. */
  labels?: boolean;
}
interface MeshInfo {
  mesh: Mesh;
  region: string;
  tissue: string;
  zone: string;
  material: MeshStandardMaterial;
}
const MODEL_URL = '/models/overview.glb';
const detailUrl = (region: string) => `/models/detail-${region}.glb`;
/** Warm the parsed-geometry cache when the user shows intent (hover/focus on a system). */
export function prefetchDetail(region: string) {
  useGLTF.preload(detailUrl(region), false, true);
}
function projectionOffset(
  camera: PerspectiveCamera,
  width: number,
  height: number,
  focused: boolean,
) {
  if (focused || window.innerWidth <= 900) return 0;
  return (
    -(window.innerWidth <= 1200 ? 132 : 160) *
    ((2 * Math.tan((camera.fov * Math.PI) / 360) * 35 * Math.min(width / height, 1)) / height)
  );
}

class ViewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="anatomy-load-error" role="alert">
        No se pudo abrir el visor 3D. Comprueba WebGL y los archivos locales del atlas.
        <button onClick={() => window.location.reload()}>Volver a cargar</button>
      </div>
    ) : (
      this.props.children
    );
  }
}

function Loader() {
  const { progress } = useProgress();
  return (
    <div className="anatomy-loader" role="status">
      <span className="anatomy-loader-ring" />
      <strong>Preparando el atlas anatómico</strong>
      <span>Geometría local · {Math.round(progress)} %</span>
    </div>
  );
}

/* ---------- Materials ---------------------------------------------------------------
 * One physically based material per piece, extended with two cheap terms:
 *  - a view-dependent rim (Fresnel) that makes skin read as a translucent human silhouette
 *    and gives muscles and organs volume without textures or post-processing;
 *  - a localized warm glow at body sites whose data evaluation needs review.
 * Both are colour only. They do not depict tissue damage.
 */
interface Look {
  color: string;
  roughness: number;
  /** Alpha multiplier at normal incidence; 1 = uniformly opaque. */
  core: number;
  /** Optional core above the neck, so the face reads as a face rather than a skull. */
  headCore?: number;
  power: number;
  rim: string;
  rimStrength: number;
  /** Light-emitting glass: added to the dark backdrop instead of covering it. */
  additive?: boolean;
}
const ORGAN: Omit<Look, 'color'> = {
  roughness: 0.4,
  core: 0.7,
  power: 2,
  rim: '#cfe8ff',
  rimStrength: 0.3,
};
/**
 * Hologram palette for the dark theme: skin, muscle, tendon and bone are additive glass
 * (mostly rim light), organs stay solid enough to read, and the selected system glows warm.
 */
const LOOKS: Record<string, Look> = {
  skin: {
    color: '#1b2a3a',
    roughness: 0.3,
    core: 0.05,
    headCore: 0.3,
    power: 2.2,
    rim: '#9fdcff',
    rimStrength: 1.1,
    additive: true,
  },
  muscle: {
    color: '#22303f',
    roughness: 0.4,
    core: 0.35,
    power: 1.6,
    rim: '#6fb8ff',
    rimStrength: 0.55,
    additive: true,
  },
  tendon: {
    color: '#2a3a4a',
    roughness: 0.35,
    core: 0.4,
    power: 1.5,
    rim: '#9fd0ff',
    rimStrength: 0.4,
    additive: true,
  },
  skeleton: {
    color: '#4b5b6e',
    roughness: 0.5,
    core: 0.7,
    power: 2,
    rim: '#d8eeff',
    rimStrength: 0.45,
    additive: true,
  },
  lung: { ...ORGAN, color: '#3d5266', core: 0.22, power: 1.4, rimStrength: 0.5 },
  airway: { ...ORGAN, color: '#4d6174' },
  digestive: { ...ORGAN, color: '#3f5063', core: 0.45 },
  liver: { ...ORGAN, color: '#45505f', core: 0.5 },
  viscera: { ...ORGAN, color: '#415264', core: 0.45 },
  kidney: { ...ORGAN, color: '#4a4f5e' },
  brain: { ...ORGAN, color: '#55677a' },
  eye: { ...ORGAN, color: '#7d8fa3' },
  cardiac: { ...ORGAN, color: '#d2452f', core: 0.97, rim: '#ffb59f', rimStrength: 0.5 },
  cardiac_artery: { ...ORGAN, color: '#de4c34', core: 0.97, rim: '#ffb59f', rimStrength: 0.5 },
  cardiac_vein: { ...ORGAN, color: '#b24a45', core: 0.97, rim: '#ffb59f', rimStrength: 0.5 },
};
const SELECTED_GLOW = new Color('#ff4a2e');
const BLACK = new Color('#000000');
const ALERT_COLOR = new Color('#de3b2c');
const REGION_INDEX = ['heart', 'lungs', 'kidneys', 'brain', 'skeleton', 'muscles', 'metabolic', 'skin'];
const MAX_SPOTS = 4;

interface SpotUniforms {
  aegisSpots: { value: Vector4[] };
  aegisSpotRegion: { value: number[] };
  aegisSpotCount: { value: number };
  aegisSpotColor: { value: Color };
}
function createSpots(): SpotUniforms {
  return {
    aegisSpots: { value: Array.from({ length: MAX_SPOTS }, () => new Vector4()) },
    aegisSpotRegion: { value: Array(MAX_SPOTS).fill(-1) },
    aegisSpotCount: { value: 0 },
    aegisSpotColor: { value: ALERT_COLOR },
  };
}

const FRAGMENT_HEAD = `varying vec3 vAegisWorld;
uniform float aegisCore, aegisHeadCore, aegisPower, aegisRimStrength;
uniform vec3 aegisRim, aegisSpotColor;
uniform vec4 aegisSpots[${MAX_SPOTS}];
uniform int aegisSpotRegion[${MAX_SPOTS}];
uniform int aegisSpotCount, aegisRegion;`;
const FRAGMENT_BODY = `
float aegisF = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), aegisPower);
float aegisOwn = 0.0, aegisNear = 0.0;
for (int i = 0; i < ${MAX_SPOTS}; i++) {
  if (i >= aegisSpotCount) break;
  float d = distance(vAegisWorld, aegisSpots[i].xyz);
  float h = 1.0 - smoothstep(aegisSpots[i].w * 0.2, aegisSpots[i].w, d);
  if (aegisSpotRegion[i] == aegisRegion) aegisOwn = max(aegisOwn, h); else aegisNear = max(aegisNear, h);
}
outgoingLight += aegisRim * aegisF * aegisRimStrength;
outgoingLight = mix(outgoingLight, aegisSpotColor * (0.8 + 0.45 * aegisF), aegisOwn * 0.72 + aegisNear * 0.16);
float aegisCoreHere = mix(aegisCore, aegisHeadCore, smoothstep(1.5, 1.56, vAegisWorld.y));
diffuseColor.a *= mix(aegisCoreHere, 1.0, aegisF);
diffuseColor.a = max(diffuseColor.a, opacity * aegisOwn * 0.92);
#include <opaque_fragment>`;

function materialFor(tissue: string, region: string, spots: SpotUniforms) {
  const look = LOOKS[tissue] ?? { ...ORGAN, color: '#d2b3a2' };
  const material = new MeshStandardMaterial({
    color: look.color,
    roughness: look.roughness,
    metalness: 0,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: look.additive ? AdditiveBlending : NormalBlending,
    envMapIntensity: LOOKS[tissue]?.additive ? 0.35 : 0.6,
  });
  const uniforms = {
    aegisCore: { value: look.core },
    aegisHeadCore: { value: look.headCore ?? look.core },
    aegisPower: { value: look.power },
    aegisRim: { value: new Color(look.rim) },
    aegisRimStrength: { value: look.rimStrength },
    aegisRegion: { value: REGION_INDEX.indexOf(region) },
    ...spots,
  };
  material.userData.look = look;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAegisWorld;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvAegisWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_HEAD}`)
      .replace('#include <opaque_fragment>', FRAGMENT_BODY);
  };
  // Every tissue shares one compiled program; only uniform values differ.
  material.customProgramCacheKey = () => 'aegis-tissue-v3';
  return material;
}

function prepareScene(source: Group, interactive = true) {
  const scene = source.clone(true);
  const parts: MeshInfo[] = [];
  const spots = createSpots();
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const { region, tissue, zone } = object.userData as {
      region: string;
      tissue: string;
      zone: string;
    };
    if (!region) return;
    const material = materialFor(tissue, region, spots);
    object.material = material;
    if (interactive && region !== 'skin' && !object.geometry.boundsTree)
      computeBoundsTree.call(object.geometry, { maxLeafTris: 32 });
    if (interactive)
      object.raycast = (raycaster, hits) => {
        if (!object.visible || region === 'skin' || material.opacity < 0.25) return;
        acceleratedRaycast.call(object, raycaster, hits);
      };
    object.castShadow = false;
    object.receiveShadow = false;
    // Painter's order for the translucent stack: bone → organs → muscle → skin.
    object.renderOrder =
      region === 'skin'
        ? 6
        : region === 'muscles'
          ? 5
          : region === 'skeleton'
            ? 0
            : tissue === 'lung'
              ? 3
              : 4;
    parts.push({ mesh: object, region, tissue, zone, material });
  });
  return { scene, parts, spots };
}

type ViewMode = 'overview' | 'zoom' | 'isolate';
/**
 * Target opacity per piece. Overview reads as a visible porcelain person; zoom keeps that
 * context and only clears the way to the selected system; isolate fades everything else.
 */
function opacityFor(part: MeshInfo, selected: string, mode: ViewMode) {
  const { region, tissue } = part;
  const active = region === selected;
  if (mode === 'isolate') {
    if (region === 'skin') return 0.3;
    if (tissue === 'tendon') return active ? 0.85 : 0.06;
    if (region === 'muscles') return active ? 0.94 : 0.08;
    if (region === 'skeleton') return active ? 0.98 : 0.2;
    if (tissue === 'lung') return active ? 0.86 : 0.12;
    return active ? 0.98 : 0.16;
  }
  const zoom = mode === 'zoom';
  if (region === 'skin') return zoom ? 0.75 : 0.9;
  if (tissue === 'tendon') return active ? 0.85 : 0.35;
  if (region === 'muscles') return active ? 0.92 : zoom ? 0.35 : 0.45;
  if (region === 'skeleton') return active ? 0.96 : 0.55;
  if (tissue === 'lung') return active ? 0.88 : 0.4;
  return active ? 0.98 : 0.5;
}

const layerOf = (part: MeshInfo): keyof LayersState =>
  part.region === 'skin' || part.region === 'muscles' || part.region === 'skeleton'
    ? part.region
    : 'organs';

function Anatomy({
  selected,
  focused,
  isolate = true,
  onSelect,
  layers,
  onReady,
  markers,
  url = MODEL_URL,
  hiddenRegion = null,
  visible = true,
}: {
  selected: string;
  focused: boolean;
  isolate?: boolean;
  onSelect: (id: string) => void;
  layers: LayersState;
  onReady: () => void;
  markers: BodyMarker[];
  url?: string;
  hiddenRegion?: string | null;
  visible?: boolean;
}) {
  const { scene: original } = useGLTF(url, false, true);
  const { scene, parts, spots } = useMemo(() => prepareScene(original), [original]);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    onReady();
    return () => parts.forEach((p) => p.material.dispose());
  }, [onReady, parts]);
  useEffect(() => {
    const alerts = markers
      .filter((m) => m.tone === 'alert' && bodySites[m.site])
      .slice(0, MAX_SPOTS);
    alerts.forEach((m, i) => {
      const site = bodySites[m.site];
      spots.aegisSpots.value[i].set(...site.point, site.radius);
      spots.aegisSpotRegion.value[i] = REGION_INDEX.indexOf(m.region);
    });
    spots.aegisSpotCount.value = alerts.length;
    invalidate();
  }, [markers, spots, invalidate]);
  useEffect(() => {
    for (const part of parts) {
      part.mesh.visible = visible && layers[layerOf(part)] && part.region !== hiddenRegion;
      const target = opacityFor(part, selected, !focused ? 'overview' : isolate ? 'isolate' : 'zoom');
      part.material.userData.targetOpacity = target;
      if (!part.material.userData.initialized) {
        part.material.opacity = target;
        part.material.userData.initialized = true;
      }
      const look = part.material.userData.look as Look;
      const glowing = part.region === selected && part.region !== 'skin';
      part.material.blending = look.additive && !glowing ? AdditiveBlending : NormalBlending;
      part.material.emissive.copy(glowing ? SELECTED_GLOW : BLACK);
      part.material.emissiveIntensity = glowing ? 0.55 : 0;
      part.material.depthWrite = target >= 0.95 && look.core > 0.9;
    }
    invalidate();
  }, [parts, selected, focused, isolate, layers, invalidate, hiddenRegion, visible]);
  useFrame((_, delta) => {
    const alpha = 1 - Math.exp(-delta * 9);
    let moving = false;
    for (const p of parts) {
      const target = Number(p.material.userData.targetOpacity ?? 1);
      const gap = target - p.material.opacity;
      if (Math.abs(gap) > 0.001) {
        p.material.opacity += gap * alpha;
        moving = true;
      } else p.material.opacity = target;
    }
    if (moving) invalidate();
  });
  return (
    <primitive
      object={scene}
      onClick={(e: { stopPropagation: () => void; object: Mesh; delta?: number }) => {
        if ((e.delta ?? 0) > 3) return;
        const r = e.object.userData.region;
        const m = e.object.material as MeshStandardMaterial;
        if (m.opacity < 0.3 && r !== selected) return;
        if (r && r !== 'skin') {
          e.stopPropagation();
          onSelect(r);
        }
      }}
    />
  );
}

function CameraDirector({
  selected,
  focused,
  back,
  reset,
}: {
  selected: string;
  focused: boolean;
  back: boolean;
  reset: number;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, invalidate, size } = useThree();
  const animation = useRef<{
    start: number;
    from: Vector3;
    to: Vector3;
    fromTarget: Vector3;
    toTarget: Vector3;
    duration: number;
    fromFilm: number;
    toFilm: number;
  } | null>(null);
  useEffect(() => {
    if (!controls.current) return;
    const pose = cameraTargets[focused ? selected : 'overview'] ?? cameraTargets.overview;
    const destination = new Vector3(...pose.position),
      target = new Vector3(...pose.target);
    destination.y = target.y;
    if (back && !focused) destination.z = -Math.abs(destination.z);
    animation.current = {
      start: performance.now(),
      from: camera.position.clone(),
      to: destination,
      fromTarget: controls.current.target.clone(),
      toTarget: target,
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 0
        : CAMERA_DURATION_MS,
      fromFilm: camera instanceof PerspectiveCamera ? camera.filmOffset : 0,
      toFilm:
        camera instanceof PerspectiveCamera
          ? projectionOffset(camera, size.width, size.height, focused)
          : 0,
    };
    controls.current.enabled = false;
    invalidate();
  }, [camera, selected, focused, back, reset, invalidate, size.width, size.height]);
  useFrame(() => {
    const a = animation.current,
      c = controls.current;
    if (!a || !c) return;
    const t = a.duration === 0 ? 1 : Math.min((performance.now() - a.start) / a.duration, 1),
      e = cameraEase(t);
    camera.position.lerpVectors(a.from, a.to, e);
    c.target.lerpVectors(a.fromTarget, a.toTarget, e);
    if (camera instanceof PerspectiveCamera) {
      camera.filmOffset = a.fromFilm + (a.toFilm - a.fromFilm) * e;
      camera.updateProjectionMatrix();
    }
    c.update();
    invalidate();
    if (t === 1) {
      animation.current = null;
      c.enabled = true;
    }
  });
  return (
    <OrbitControls
      ref={controls}
      target={[0, 0.86, 0]}
      enablePan={false}
      enableZoom={false}
      enableDamping
      dampingFactor={0.1}
      minDistance={0.35}
      maxDistance={4.5}
      minPolarAngle={Math.PI / 2}
      maxPolarAngle={Math.PI / 2}
      makeDefault
    />
  );
}

/** Local studio environment (procedural room → PMREM). No HDR file, no network. */
function StudioEnvironment() {
  const { gl, scene, invalidate } = useThree();
  useEffect(() => {
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const texture = generator.fromScene(room, 0.04).texture;
    scene.environment = texture;
    scene.environmentIntensity = 0.3;
    invalidate();
    return () => {
      scene.environment = null;
      texture.dispose();
      room.dispose();
      generator.dispose();
    };
  }, [gl, scene, invalidate]);
  return null;
}

function Studio() {
  return (
    <>
      <StudioEnvironment />
      <hemisphereLight args={['#dfeaff', '#1a2233', 0.35]} />
      <directionalLight position={[2.2, 3.4, 3.6]} intensity={1.2} color="#f4f8ff" />
      <directionalLight position={[-3, 1.8, 1.2]} intensity={0.45} color="#eef1ff" />
      <directionalLight position={[0.4, 2.6, -3.2]} intensity={1.6} color="#9fd0ff" />
    </>
  );
}

/* ---------- Anatomical callouts ------------------------------------------------------
 * Labels sit in a column just outside the silhouette, joined to the body site by a
 * leader line, like an anatomy plate. Positions are written straight to the DOM on
 * rendered frames only, so markers cost nothing while the scene is idle.
 */
const LABEL_GAP = 50;
const COLUMN = 0.42;
function MarkerProjector({
  markers,
  layer,
}: {
  markers: BodyMarker[];
  layer: RefObject<HTMLDivElement | null>;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const scratch = useMemo(
    () => ({ p: new Vector3(), c: new Vector3(), r: new Vector3(), s: new Vector3() }),
    [],
  );
  useEffect(() => invalidate(), [markers, invalidate]);
  useFrame(({ camera, size }) => {
    const root = layer.current;
    if (!root) return;
    const { p, c, r, s } = scratch;
    r.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
    const toScreen = (v: Vector3) => {
      v.project(camera);
      return [((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height, v.z] as const;
    };
    const placed = markers
      .map((m) => {
        const site = bodySites[m.site];
        if (!site) return null;
        const [x, y, depth] = toScreen(p.set(...site.point));
        const [cx] = toScreen(c.set(0, site.point[1], 0));
        const right = x >= cx;
        const [colX] = toScreen(
          s.set(0, site.point[1], 0).addScaledVector(r, right ? COLUMN : -COLUMN),
        );
        // Keep the whole label on screen; narrow viewports use the compact label width.
        const room = size.width < 600 ? 136 : 200;
        const lx = right
          ? Math.min(Math.max(colX, x + 40), size.width - room)
          : Math.max(Math.min(colX, x - 40), room);
        return { id: m.id, x, y, lx, ly: y, right, visible: depth < 1 };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
    for (const side of [true, false]) {
      let last = -Infinity;
      for (const item of placed.filter((v) => v.right === side).sort((a, b) => a.y - b.y)) {
        item.ly = Math.max(item.y, last + LABEL_GAP);
        last = item.ly;
      }
    }
    for (const item of placed) {
      const node = root.querySelector<HTMLElement>(`[data-marker="${item.id}"]`);
      if (!node) continue;
      const elbow = item.lx + (item.right ? -22 : 22);
      node.style.setProperty('--x', `${item.x}px`);
      node.style.setProperty('--y', `${item.y}px`);
      node.style.setProperty('--lx', `${item.lx}px`);
      node.style.setProperty('--ly', `${item.ly}px`);
      node.dataset.side = item.right ? 'right' : 'left';
      node.dataset.placed = item.visible ? 'true' : 'false';
      node
        .querySelector('path')
        ?.setAttribute('d', `M${item.x} ${item.y} L${elbow} ${item.ly} L${item.lx} ${item.ly}`);
    }
  });
  return null;
}

function MarkerLayer({
  markers,
  layer,
  onSelect,
}: {
  markers: BodyMarker[];
  layer: RefObject<HTMLDivElement | null>;
  onSelect: (region: string) => void;
}) {
  return (
    <div className="anatomy-markers" ref={layer}>
      {markers.map((m) => (
        <div
          key={m.id}
          className={`anatomy-marker ${m.tone}`}
          data-marker={m.id}
          data-placed="false"
        >
          <svg aria-hidden="true">
            <path />
          </svg>
          <span className="anatomy-marker-dot" aria-hidden="true" />
          <button
            className="anatomy-marker-label"
            onClick={() => onSelect(m.region)}
          >
            <strong>{m.title}</strong>
            <small>{m.detail}</small>
          </button>
        </div>
      ))}
    </div>
  );
}

export default function AnatomyViewer(props: Props) {
  const [ready, setReady] = useState(false);
  const onReadyRef = useRef(props.onReady);
  onReadyRef.current = props.onReady;
  const readyRef = useRef(() => {
    setReady(true);
    requestAnimationFrame(() => requestAnimationFrame(() => onReadyRef.current?.()));
  });
  const [detailRegion, setDetailRegion] = useState<string | null>(null);
  const [failedDetail, setFailedDetail] = useState<string | null>(null),
    [retry, setRetry] = useState(0),
    [contextLost, setContextLost] = useState(false);
  const layer = useRef<HTMLDivElement>(null);
  const markers = useMemo(() => props.markers ?? [], [props.markers]);
  return (
    <div
      className="anatomy-canvas"
      data-ready={ready}
      data-camera-mode={props.focused ? props.selected : 'overview'}
      data-detail-region={
        props.focused && detailRegion === props.selected ? detailRegion : 'overview'
      }
      aria-label="Modelo anatómico 3D interactivo; arrastra para rotar"
    >
      {!props.focused && <div className="anatomy-ground-shadow" aria-hidden="true" />}
      {props.focused && failedDetail === props.selected && (
        <div className="anatomy-detail-note" role="status">
          Detalle no disponible; se mantiene la vista ligera.{' '}
          <button
            onClick={() => {
              useGLTF.clear(detailUrl(props.selected));
              setFailedDetail(null);
              setRetry((r) => r + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      )}
      {contextLost && (
        <div className="anatomy-detail-note" role="status">
          Restaurando el contexto gráfico…
        </div>
      )}
      <ViewBoundary>
        <Suspense fallback={<Loader />}>
          <Canvas
            frameloop="demand"
            camera={{ position: [0.015, 0.86, 3.05], fov: 33.5, near: 0.01, far: 20 }}
            dpr={[1, 1.25]}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            onCreated={({ gl, raycaster, camera, size }) => {
              gl.setClearColor('#f8f5f1', 0);
              gl.toneMappingExposure = 1.02;
              raycaster.firstHitOnly = true;
              if (camera instanceof PerspectiveCamera) {
                camera.filmOffset = projectionOffset(
                  camera,
                  size.width,
                  size.height,
                  props.focused,
                );
                camera.updateProjectionMatrix();
              }
            }}
          >
            <Studio />
            <Anatomy
              {...props}
              markers={markers}
              onReady={readyRef.current}
              hiddenRegion={
                props.focused && props.isolate !== false && detailRegion === props.selected
                  ? detailRegion
                  : null
              }
            />
            {props.focused && props.isolate !== false && (
              <DetailBoundary
                key={`${props.selected}-${retry}`}
                onFailure={() => setFailedDetail(props.selected)}
              >
                <Suspense fallback={null}>
                  <RegionDetail
                    {...props}
                    markers={markers}
                    active={detailRegion === props.selected}
                    onLoaded={setDetailRegion}
                  />
                </Suspense>
              </DetailBoundary>
            )}
            <CameraDirector {...props} />
            {ready && props.labels !== false && <MarkerProjector markers={markers} layer={layer} />}
            <RenderProbe id="main" />
            <ContextRecovery onLost={setContextLost} />
          </Canvas>
        </Suspense>
      </ViewBoundary>
      {ready && props.labels !== false && (
        <MarkerLayer markers={markers} layer={layer} onSelect={props.onSelect} />
      )}
    </div>
  );
}

class DetailBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
function ContextRecovery({ onLost }: { onLost: (value: boolean) => void }) {
  const { gl, invalidate } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      onLost(true);
    };
    const restored = () => {
      onLost(false);
      invalidate();
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
    };
  }, [gl, invalidate, onLost]);
  return null;
}
function RegionDetail(
  props: Props & { markers: BodyMarker[]; active: boolean; onLoaded: (id: string) => void },
) {
  const callback = useRef(() => props.onLoaded(props.selected));
  return (
    <Anatomy
      {...props}
      url={detailUrl(props.selected)}
      visible={props.active}
      onReady={callback.current}
    />
  );
}
declare global {
  interface Window {
    __AEGIS_PERF__?: Record<
      string,
      {
        triangles: number;
        calls: number;
        camera: number[];
        target: number[];
        frame: number;
        pixelRatio: number;
      }
    >;
  }
}
function RenderProbe({ id }: { id: string }) {
  const enabled = useMemo(() => new URLSearchParams(location.search).has('benchmark'), []);
  useFrame(({ gl, camera, controls }) => {
    if (!enabled) return;
    const target = (controls as OrbitControlsImpl | undefined)?.target ?? new Vector3();
    window.__AEGIS_PERF__ ??= {};
    window.__AEGIS_PERF__[id] = {
      triangles: gl.info.render.triangles,
      calls: gl.info.render.calls,
      camera: camera.position.toArray(),
      target: target.toArray(),
      frame: gl.info.render.frame,
      pixelRatio: gl.getPixelRatio(),
    };
  });
  return null;
}

function PreviewObject({ selected, status }: { selected: string; status: Status }) {
  const { scene: original } = useGLTF(detailUrl(selected), false, true);
  const { scene, parts } = useMemo(() => prepareScene(original, false), [original]);
  const { camera, invalidate } = useThree();
  useEffect(() => {
    scene.position.set(0, 0, 0);
    scene.updateMatrixWorld(true);
    const bounds = new Box3();
    const alert = status === 'review' || status === 'emergency';
    for (const p of parts) {
      p.mesh.visible =
        p.region === selected && (selected !== 'heart' || p.tissue.startsWith('cardiac'));
      if (!p.mesh.visible) continue;
      bounds.expandByObject(p.mesh);
      p.material.opacity = 1;
      p.material.depthWrite = true;
      p.material.transparent = false;
      p.mesh.renderOrder = 0;
      // The isolated organ is drawn solid; a review state warms it, it never paints damage.
      if (alert) {
        p.material.color.lerp(ALERT_COLOR, 0.45);
        p.material.emissive.set('#5a120c');
        p.material.emissiveIntensity = 0.35;
      }
    }
    const center = bounds.getCenter(new Vector3()),
      size = bounds.getSize(new Vector3());
    scene.position.copy(center).multiplyScalar(-1);
    const distance = Math.max(size.x, size.y, size.z) * 2.1;
    camera.position.set(distance * 0.2, distance * 0.1, distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    invalidate();
    return () => parts.forEach((p) => p.material.dispose());
  }, [camera, parts, scene, selected, status, invalidate]);
  return <primitive object={scene} />;
}

export function OrganPreview({ selected, status }: { selected: string; status: Status }) {
  return (
    <ViewBoundary>
      <Suspense fallback={<div className="organ-preview-loading">Preparando órgano…</div>}>
        <Canvas
          frameloop="demand"
          camera={{ position: [0, 0, 0.5], near: 0.001, far: 10, fov: 35 }}
          dpr={1}
          gl={{ antialias: true, alpha: true }}
        >
          <Studio />
          <PreviewObject selected={selected} status={status} />
          <RenderProbe id="preview" />
        </Canvas>
      </Suspense>
    </ViewBoundary>
  );
}
