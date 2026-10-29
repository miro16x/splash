// 3D version of the scroll-driven before/after reveal (paint correction, ceramic coatings).
// The whole car sits in the wrap visualizer's garage (assets/car-studio.js), split at the glowing
// seam: the "after" finish left of it, the "before" right of it. assets/site.js still turns
// scroll into --wash-p (0-1) on .wash-reveal; this module reads it, moves the split there and eases
// the camera around the car. If WebGL or the model fails, the photos underneath stay in place.
import { THREE, LOOKS, buildStudio, loadCar, setSeam } from './car-studio.js';

function setup(reveal) {
  const stage = reveal.querySelector('.wash-reveal-stage');
  const canvas = reveal.querySelector('.wash-reveal-canvas');
  const finishes = LOOKS[reveal.dataset.look] || LOOKS.correction;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { return; }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const { scene, shadow } = buildStudio(renderer, () => { lastKey = ''; start(); });
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, .1, 100);
  let car = null, mats = null, length = 4.6;
  let lastKey = '', visible = true, raf = 0;

  function frame() {
    raf = 0;
    if (!visible || !car) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    const p = parseFloat(getComputedStyle(reveal).getPropertyValue('--wash-p')) || 0;
    const key = w + 'x' + h + ':' + p.toFixed(4);
    if (key !== lastKey) {
      lastKey = key;
      const dpr = Math.min(devicePixelRatio, 1.75);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h, false);
      }
      // ease from a front three-quarter view toward the side as the seam crosses
      const aspect = w / h;
      camera.aspect = aspect;
      const theta = THREE.MathUtils.degToRad(32 + p * 26);
      // far enough that the whole car fits across the frame, with a margin
      const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const dist = Math.max(length * .54 / (halfH * aspect), length * .4 / halfH);
      camera.position.set(-Math.cos(theta) * dist, length * .26, Math.sin(theta) * dist);
      camera.lookAt(0, length * .1, 0);
      camera.updateProjectionMatrix();
      // the seam sits where the CSS draws it: left = p * 104% - 2.5%, as screen x from -1 to 1
      setSeam(mats, Math.max(0, Math.min(1, p * 1.04 - .025)) * 2 - 1);
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf && visible && car) raf = requestAnimationFrame(frame); }

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(stage);

  loadCar(reveal.dataset.model, {
    wheels: (reveal.dataset.wheels || '0,0,0,0').split(',').map(Number),
    belt: Number(reveal.dataset.belt || .65),
    finishes,
  }).then(loaded => {
    ({ car, mats, length } = loaded);
    scene.add(car);
    shadow.scale.set(loaded.footprint[0] * 1.25, 1, loaded.footprint[1] * 1.6);
    // compile both finishes before showing the canvas, so the first scroll doesn't stutter
    renderer.compile(scene, camera);
    reveal.classList.add('is-3d');
    start();
  }).catch(() => { /* keep the photos */ });

  new ResizeObserver(() => { lastKey = ''; start(); }).observe(stage);
}

// load each car only when its section comes near the screen
const reveals = document.querySelectorAll('.wash-reveal[data-model]');
const near = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    near.unobserve(e.target);
    setup(e.target);
  });
}, { rootMargin: '600px 0px' });
reveals.forEach(r => near.observe(r));
