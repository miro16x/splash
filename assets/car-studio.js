// Shared 3D pieces for the before/after cars (home hero, paint correction, ceramic coatings):
// the car paint shader, the finishes, the wrap visualizer's garage in light and dark, and loading
// a car model. Each car is drawn twice, once per finish, and each copy keeps only its side of the
// seam: the "after" finish left of it, the "before" right of it (or wherever a mask says it was
// rubbed clean). The floor reflection splits the same way.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

export { THREE };

const DRACO_PATH = 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/';
const PAINT = 0x0d2a52;   // deep navy, like the sample photos

// Finishes for each side of the seam. paint is the color (navy unless set); rough/coat/coatRough
// drive the paint; haze lifts it toward a dull gray-blue; spots draws faint water-spot rings;
// beads adds beaded water; dirt covers the car in road dust and mud, heaviest low down.
const BASE = { paint: PAINT, rough: .1, coat: 1, coatRough: .03, haze: 0, spots: 0, beads: 0, dirt: 0 };
const look = o => ({ ...BASE, ...o });
export const LOOKS = {
  correction: {
    before: look({ rough: .42, coat: .25, coatRough: .38, haze: .22, spots: 1 }),
    after:  look({}),
  },
  ceramic: {
    before: look({ rough: .7, coat: 0, coatRough: .6, haze: .1, dirt: 1 }),
    after:  look({ rough: .05, coatRough: .01 }),
  },
  // the home hero's service chips
  wash: {
    before: look({ rough: .7, coat: 0, coatRough: .6, haze: .1, dirt: 1 }),
    after:  look({ rough: .12, coat: .9, coatRough: .04 }),
  },
  heroCorrection: {
    before: look({ paint: 0x0b0d10, rough: .45, coat: .2, coatRough: .4, haze: .26, spots: 1 }),
    after:  look({ paint: 0x0b0d10, rough: .08, coatRough: .02 }),
  },
  heroCeramic: {
    before: look({ paint: 0x5c0a10, rough: .5, coat: .15, coatRough: .4, haze: .18, spots: 1, dirt: .45 }),
    after:  look({ paint: 0x5c0a10, rough: .04, coatRough: .005 }),
  },
  wrap: {
    before: look({}),
    after:  look({ paint: 0x0d7f88, rough: .38, coat: .35, coatRough: .3 }),   // satin ocean teal
  },
};

const PAINT_GLSL = /* glsl */`
uniform float uSeam; uniform float uSide;   // seam in screen x (-1..1); +1 keeps the clean side, -1 the dirty side
uniform sampler2D uMask; uniform float uUseMask;   // screen-space mask of spots rubbed clean (red > .5)
varying vec4 vClip;
uniform vec3 uPaint; uniform float uRough; uniform float uCoat; uniform float uCoatRough;
uniform float uHaze; uniform float uSpots; uniform float uBeads; uniform float uDirt;
uniform vec4 uBox;      // x min, x length, y min, y height (object space; the nose is at x min)
uniform vec2 uLat;      // z centre, z half-width
uniform vec4 uWheels;   // rear axle, front axle, axle height, rim radius (0-1 of the car, as on the wrap visualizer)
uniform float uBelt;    // window line, 0-1 of the height
varying vec3 vObjPos; varying vec3 vWorldPos; varying vec3 vWorldN;
float rvHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rvNoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(rvHash(i), rvHash(i + vec2(1., 0.)), f.x), mix(rvHash(i + vec2(0., 1.)), rvHash(i + 1.), f.x), f.y);
}
float rvFbm(vec2 p){ return .5 * rvNoise(p) + .3 * rvNoise(p * 2.7 + 5.2) + .2 * rvNoise(p * 7.1 + 1.7); }
// Drops on a world-space grid, projected along the surface's main axis. Returns the drop's
// local offset (xy, -1..1 inside a drop) and 1 inside / 0 outside in z.
vec3 rvDrop(vec3 wp, vec3 wn, float cell, float fill, out vec3 tu, out vec3 tv){
  vec3 an = abs(wn);
  vec2 p;
  if (an.y >= an.x && an.y >= an.z) { p = wp.xz; tu = vec3(1., 0., 0.); tv = vec3(0., 0., 1.); }
  else if (an.x >= an.z) { p = wp.zy; tu = vec3(0., 0., 1.); tv = vec3(0., 1., 0.); }
  else { p = wp.xy; tu = vec3(1., 0., 0.); tv = vec3(0., 1., 0.); }
  vec2 g = floor(p / cell);
  vec3 best = vec3(0.);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = g + vec2(i, j);
    float h = rvHash(c);
    if (h > fill) continue;
    vec2 centre = (c + .2 + .6 * vec2(rvHash(c + 7.1), rvHash(c + 3.3))) * cell;
    float r = cell * (.12 + .3 * rvHash(c + 11.7));
    vec2 d = (p - centre) / r;
    if (dot(d, d) < 1.) best = vec3(d, 1.);
  }
  return best;
}
`;

// a black 1x1 mask: nothing rubbed clean
const NO_MASK = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
NO_MASK.needsUpdate = true;

export function paintMaterial(src, finish, fit, side) {
  const mat = new THREE.MeshPhysicalMaterial({
    map: src.map || null, normalMap: src.normalMap || null, roughnessMap: src.roughnessMap || null, metalnessMap: src.metalnessMap || null,
    roughness: 1, metalness: 1, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.2,
  });
  if (src.normalScale) mat.normalScale.copy(src.normalScale);
  const uniforms = {
    uPaint: { value: new THREE.Color() }, uRough: { value: 0 }, uCoat: { value: 0 }, uCoatRough: { value: 0 },
    uHaze: { value: 0 }, uSpots: { value: 0 }, uBeads: { value: 0 }, uDirt: { value: 0 },
    uBox: { value: fit.box }, uLat: { value: fit.lat }, uWheels: { value: fit.wheels }, uBelt: { value: fit.belt },
    uSeam: { value: 0 }, uSide: { value: side }, uMask: { value: NO_MASK }, uUseMask: { value: 0 },
  };
  mat.userData.uniforms = uniforms;
  setFinish(mat, finish);
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying vec3 vObjPos; varying vec3 vWorldPos; varying vec3 vWorldN; varying vec4 vClip;\n' + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vObjPos = transformed;
      vWorldPos = (modelMatrix * vec4(transformed, 1.)).xyz;
      vWorldN = normalize(mat3(modelMatrix) * objectNormal);
      vClip = gl_Position;`);
    shader.fragmentShader = PAINT_GLSL + shader.fragmentShader
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        // keep only this finish's part of the screen: clean = left of the seam or rubbed clean
        // (screen position works in the reflection pass too)
        vec2 rvNdc = vClip.xy / vClip.w;
        float rvClean = step(rvNdc.x, uSeam);
        if (uUseMask > .5) rvClean = max(rvClean, step(.5, texture2D(uMask, rvNdc * .5 + .5).r));
        if (uSide > 0. ? rvClean < .5 : rvClean > .5) discard;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        // paint = bright, untinted texture (the Meshy cars are white); glass = dark above the window line
        vec3 rvTex = diffuseColor.rgb;
        float rvLum = dot(rvTex, vec3(.2126, .7152, .0722));
        float rvSat = max(rvTex.r, max(rvTex.g, rvTex.b)) - min(rvTex.r, min(rvTex.g, rvTex.b));
        float rvPaint = smoothstep(.62, .72, rvLum) * (1. - smoothstep(.05, .12, rvSat));
        float rvU = (uBox.x + uBox.y - vObjPos.x) / uBox.y;
        float rvH = (vObjPos.y - uBox.z) / uBox.y;
        float rvW = abs(vObjPos.z - uLat.x) / uLat.y;
        float rvV = (vObjPos.y - uBox.z) / uBox.w;
        float rvAxle = uWheels.z * uBox.w / uBox.y;
        float rvRim = min(length(vec2(rvU - uWheels.x, rvH - rvAxle)), length(vec2(rvU - uWheels.y, rvH - rvAxle)));
        float rvWheel = (rvW > .6 && rvRim < uWheels.w) ? 1. : 0.;
        rvPaint *= 1. - rvWheel;
        float rvGlass = step(uBelt - .05, rvV) * (1. - smoothstep(.4, .48, rvLum)) * (1. - rvPaint) * (1. - smoothstep(.06, .12, rvSat));
        vec3 rvColor = mix(uPaint, vec3(.34, .38, .44), uHaze) * clamp(rvLum / .85, 0., 1.1);
        diffuseColor.rgb = mix(rvTex, rvColor, rvPaint);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.03, .04, .05), rvGlass);
        // panel gaps: the texture draws them mid-gray, which reads as chalky lines on dark paint,
        // so they become a darker shade of the paint instead (as on the wrap visualizer)
        float rvSeam = (1. - rvPaint) * (1. - rvGlass) * (1. - rvWheel) * smoothstep(.22, .37, rvLum) * (1. - smoothstep(.05, .12, rvSat));
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(uPaint, vec3(.34, .38, .44), uHaze) * mix(1., clamp(rvLum / .85, 0., 1.), .5), rvSeam);
        vec3 rvN = normalize(vWorldN);
        // before correction: faint chalky rings where water dried on the flat panels
        if (uSpots > 0.) {
          vec3 tu, tv; vec3 sp = rvDrop(vWorldPos, rvN, .09, .5, tu, tv);
          float ring = sp.z * smoothstep(.55, .85, length(sp.xy)) * smoothstep(.35, .7, rvN.y);
          diffuseColor.rgb += ring * rvPaint * .07;
        }
        // dirty car: a film of road dust over everything, heavier toward the bottom, with mud
        // splatter on the lower panels and wheels and a dusty haze on the glass
        float rvDirt = 0.;
        if (uDirt > 0.) {
          vec2 dp = vec2(vWorldPos.x + vWorldPos.z * .7, vWorldPos.y * 1.6);
          float low = 1. - smoothstep(.12, .62, rvV);
          float film = mix(.45, .95, rvFbm(dp * 3.)) * (.55 + .45 * low);
          float splat = smoothstep(.56, .72, rvFbm(dp * 11. + 3.1)) * smoothstep(.15, .7, low);
          rvDirt = clamp(film * .85 + splat, 0., 1.) * uDirt;
          vec3 dust = mix(vec3(.55, .47, .37), vec3(.3, .22, .14), max(low, splat));
          diffuseColor.rgb = mix(diffuseColor.rgb, dust, rvDirt * mix(.85, .55, rvGlass));
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(mix(normal, nonPerturbedNormal, max(rvPaint, rvGlass)));`)
      .replace('#include <clearcoat_normal_fragment_maps>', `#include <clearcoat_normal_fragment_maps>
        // ceramic: beaded water, each drop a small lens on the clear coat
        if (uBeads > 0.) {
          vec3 tu, tv; vec3 bd = rvDrop(vWorldPos, rvN, .06, .6, tu, tv);
          if (bd.z > 0. && rvPaint > .5) {
            float r2 = dot(bd.xy, bd.xy);
            vec3 bn = normalize(rvN * sqrt(max(0., 1. - r2)) + (tu * bd.x + tv * bd.y) * .9);
            clearcoatNormal = normalize((viewMatrix * vec4(bn, 0.)).xyz);
            diffuseColor.rgb *= 1. - .35 * smoothstep(.6, 1., sqrt(r2));
          }
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, uRough, rvPaint);
        roughnessFactor = mix(roughnessFactor, .05, rvGlass);
        roughnessFactor = mix(roughnessFactor, .9, rvDirt);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, .02, max(rvPaint, rvGlass));`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        #ifdef USE_CLEARCOAT
          material.clearcoat = (mix(0., uCoat, rvPaint) + rvGlass * .6) * (1. - rvDirt);
          material.clearcoatRoughness = mix(material.clearcoatRoughness, uCoatRough, rvPaint);
        #endif`);
  };
  return mat;
}

// switch a car material to another finish (the shader stays compiled; only uniforms change)
export function setFinish(mat, f) {
  const u = mat.userData.uniforms;
  u.uPaint.value.setHex(f.paint);
  u.uRough.value = f.rough; u.uCoat.value = f.coat; u.uCoatRough.value = f.coatRough;
  u.uHaze.value = f.haze; u.uSpots.value = f.spots; u.uBeads.value = f.beads; u.uDirt.value = f.dirt;
}

// a studio with light strips, baked into reflections (as on the wrap visualizer): dark, or bright for light mode
function envScene(light = false) {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 30), new THREE.MeshBasicMaterial({ color: light ? new THREE.Color().setScalar(.62) : 0x07080a, side: THREE.BackSide }));
  room.position.y = 5;
  s.add(room);
  const glow = (w, h, d, x, y, z, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(i) }));
    m.position.set(x, y, z);
    s.add(m);
  };
  for (let i = -3; i <= 3; i++) glow(.35, .05, 18, i * 2.4, 9.9, 0, 9);
  glow(8, .05, 6, 0, 9.95, 0, 2.2);
  for (let i = -3; i <= 3; i++) {
    glow(.05, 5, .3, 14.9, 4.5, i * 4, 4); glow(.05, 5, .3, -14.9, 4.5, i * 4, 4);
    glow(.3, 5, .05, i * 4, 4.5, 14.9, 4); glow(.3, 5, .05, i * 4, 4.5, -14.9, 4);
  }
  if (light) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(.3) }));
    floor.rotation.x = -Math.PI / 2;
    s.add(floor);
  }
  return s;
}

// the garage in each site theme, matching the wrap visualizer's light and dark modes
const GARAGE = {
  dark:  { bg: '#07090c', wall: 0x0c0e12, coat: 0x050608, coatOpacity: .84, mirror: 0x8a8f96, hemi: [0xbfd8ff, 0x0a0a0a, .35] },
  light: { bg: '#e9ecef', wall: 0xf2f4f6, coat: 0xd9dde1, coatOpacity: .74, mirror: 0xb4b9bf, hemi: [0xffffff, 0x9aa1a8, 1.1] },
};
const isLight = () => document.documentElement.dataset.theme === 'light';

function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,.9)'); grd.addColorStop(.55, 'rgba(0,0,0,.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The wrap visualizer's garage: mirror floor under a coat, walls, ceiling and wall light strips,
// following the site's light/dark theme. onTheme runs after every theme change (to redraw).
export function buildStudio(renderer, onTheme) {
  const scene = new THREE.Scene();
  const BG = new THREE.Color('#07090c');
  scene.background = BG;
  scene.fog = new THREE.Fog(BG, 16, 32);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = { dark: pmrem.fromScene(envScene(), .03).texture, light: pmrem.fromScene(envScene(true), .03).texture };

  const reflectRes = innerWidth < 760 ? 512 : 1024;
  const mirror = new Reflector(new THREE.PlaneGeometry(60, 60), { textureWidth: reflectRes, textureHeight: reflectRes, color: 0x8a8f96, clipBias: .003 });
  mirror.rotation.x = -Math.PI / 2;
  scene.add(mirror);
  const floorCoat = new THREE.Mesh(new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x050608, roughness: .55, metalness: 0, envMapIntensity: .35, transparent: true, opacity: .84 }));
  floorCoat.rotation.x = -Math.PI / 2;
  floorCoat.position.y = .002;
  scene.add(floorCoat);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: .9, side: THREE.BackSide });
  const room = new THREE.Mesh(new THREE.BoxGeometry(28, 5, 28), [wallMat, wallMat, wallMat, new THREE.MeshBasicMaterial({ visible: false }), wallMat, wallMat]);
  room.position.y = 2.5;
  scene.add(room);
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: false });
  const stripGeo = new THREE.BoxGeometry(.12, .04, 9);
  for (let i = -3; i <= 3; i++) {
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(i * 1.9, 4.9, 0);
    scene.add(strip);
  }
  const wallStripMat = new THREE.MeshBasicMaterial({ color: 0xd8ecff, toneMapped: false });
  const vGeo = new THREE.BoxGeometry(.08, 3.4, .02);
  for (let i = -5; i <= 5; i++) {
    const a = new THREE.Mesh(vGeo, wallStripMat); a.position.set(i * 2.3, 2.4, -13.95); scene.add(a);
    const b = new THREE.Mesh(vGeo, wallStripMat); b.position.set(i * 2.3, 2.4, 13.95); scene.add(b);
    const c = new THREE.Mesh(vGeo, wallStripMat); c.rotation.y = Math.PI / 2; c.position.set(13.95, 2.4, i * 2.3); scene.add(c);
    const d = new THREE.Mesh(vGeo, wallStripMat); d.rotation.y = Math.PI / 2; d.position.set(-13.95, 2.4, i * 2.3); scene.add(d);
  }
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x0a0a0a, .35);
  scene.add(hemi);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .005; shadow.renderOrder = 2;
  scene.add(shadow);

  // follow the site's light/dark theme, now and whenever the theme button changes it
  function applyTheme() {
    const g = isLight() ? GARAGE.light : GARAGE.dark;
    BG.set(g.bg);
    scene.fog.color.set(g.bg);
    scene.environment = isLight() ? env.light : env.dark;
    wallMat.color.setHex(g.wall);
    floorCoat.material.color.setHex(g.coat);
    floorCoat.material.opacity = g.coatOpacity;
    mirror.material.uniforms.color.value.setHex(g.mirror);
    hemi.color.setHex(g.hemi[0]); hemi.groundColor.setHex(g.hemi[1]); hemi.intensity = g.hemi[2];
  }
  applyTheme();
  new MutationObserver(() => { applyTheme(); onTheme && onTheme(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return { scene, shadow };
}

const draco = new DRACOLoader().setDecoderPath(DRACO_PATH);
const loader = new GLTFLoader().setDRACOLoader(draco);

// Load a one-piece Meshy car, stand it on the floor about `length` m long (nose toward -x) and
// make the two finish copies. wheels/belt are the model's wrap visualizer settings.
export function loadCar(url, { wheels = [0, 0, 0, 0], belt = .65, finishes, length = 4.6 }) {
  return new Promise((resolve, reject) => {
    loader.load(url, gltf => {
      let mesh = null;
      gltf.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
      if (!mesh) { reject(new Error('no mesh')); return; }
      mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox;
      const size = bb.getSize(new THREE.Vector3());
      const fit = {
        box: new THREE.Vector4(bb.min.x, size.x, bb.min.y, size.y),
        lat: new THREE.Vector2((bb.min.z + bb.max.z) / 2, size.z / 2),
        wheels: new THREE.Vector4().fromArray(wheels),
        belt,
      };
      const mats = { before: paintMaterial(mesh.material, finishes.before, fit, -1), after: paintMaterial(mesh.material, finishes.after, fit, 1) };
      const s = length / size.x;
      const car = new THREE.Group();
      car.add(new THREE.Mesh(mesh.geometry, mats.before), new THREE.Mesh(mesh.geometry, mats.after));
      car.scale.setScalar(s);
      car.position.set(-(bb.min.x + size.x / 2) * s, -bb.min.y * s, -(bb.min.z + size.z / 2) * s);
      resolve({ car, mats, length, footprint: [size.x * s, size.z * s] });
    }, undefined, reject);
  });
}

// set where the seam is (screen x, -1..1) on both finishes
export function setSeam(mats, x) {
  mats.before.userData.uniforms.uSeam.value = x;
  mats.after.userData.uniforms.uSeam.value = x;
}
