// Home page hero: a dirty car in the wrap visualizer's garage that gets washed.
//  - Scrolling sweeps a glowing seam across it, dirty on the right, clean on the left, and the
//    headline turns from "Splash In." into "Dash Out." where the seam passes.
//  - The handle on the seam can be dragged, and the car can be rubbed clean anywhere like a
//    scratch card (a screen-space mask the paint shader reads).
//  - Service chips switch the before/after (wash, paint correction, ceramic, wrap) and point the
//    button at that service's page.
//  - Small touches: the camera leans toward the pointer, headline letters lift near it, and a
//    tap or click sends out a water ripple.
// If WebGL or the model fails, the hero falls back to a photo with the same text and chips.
import { THREE, LOOKS, buildStudio, loadCar, setSeam, setFinish } from './car-studio.js';

const hero = document.getElementById('home');
const stage = hero && hero.querySelector('.hero3d-stage');
if (stage) init();

function init() {
  const track = hero.querySelector('.hero3d-track');
  const canvas = hero.querySelector('.hero3d-canvas');
  const seamEl = hero.querySelector('.hero3d-seam');
  const handle = hero.querySelector('.hero3d-handle');
  const title = hero.querySelector('.hero3d-title');
  const hint = hero.querySelector('.hero3d-hint');
  const ripples = hero.querySelector('.hero3d-ripples');
  const chips = Array.from(hero.querySelectorAll('.hero3d-chip'));
  const cta = hero.querySelector('.hero3d-cta');
  const header = document.querySelector('.navigation-header');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- headline letters (for the pointer lift) ---------- */
  const letters = [];
  title.querySelectorAll('.hero3d-word').forEach(word => {
    const text = word.textContent;
    word.textContent = '';
    for (const ch of text) {
      const span = document.createElement('span');
      span.className = 'hero3d-letter';
      span.textContent = ch === ' ' ? ' ' : ch;
      word.appendChild(span);
      letters.push(span);
    }
  });

  /* ---------- seam: scroll, or the handle when someone drags it ---------- */
  let scrollFrac = 0;          // where scrolling puts the seam (0 = all dirty, 1 = all clean)
  let manualFrac = null;       // where the handle was dragged to, until the page scrolls on
  let manualScrollY = 0;
  let seam = 0;                // the seam as drawn, easing toward its target
  let dragging = false;

  function readScroll() {
    const nav = header ? header.getBoundingClientRect().height : 0;
    hero.style.setProperty('--hero-nav', nav + 'px');
    if (reduced.matches) { scrollFrac = manualFrac == null ? .5 : scrollFrac; return; }
    const travel = track.offsetHeight - stage.offsetHeight;
    const raw = clamp((stage.getBoundingClientRect().top - track.getBoundingClientRect().top) / Math.max(1, travel), 0, 1);
    scrollFrac = clamp((raw - .06) / .8, 0, 1);   // hold on dirty and on clean at either end
    if (manualFrac != null && Math.abs(scrollY - manualScrollY) > 80) manualFrac = null;
  }
  function seamTarget() { return manualFrac != null ? manualFrac : scrollFrac; }

  function setSeamUI(f) {
    const w = stage.clientWidth;
    stage.style.setProperty('--seam', (f * 100).toFixed(3) + '%');
    stage.classList.toggle('is-washing', f > .002 && f < .998);
    handle.setAttribute('aria-valuenow', String(Math.round(f * 100)));
    handle.setAttribute('aria-valuetext', Math.round(f * 100) + '% clean');
    // the headline swaps word where the seam crosses it
    const r = title.getBoundingClientRect(), s = stage.getBoundingClientRect();
    title.style.setProperty('--cut', clamp(s.left + f * w - r.left, 0, r.width) + 'px');
    if (f > .04) hint.classList.add('is-hidden');
  }

  function fracFromEvent(e) {
    const r = stage.getBoundingClientRect();
    return clamp((e.clientX - r.left) / r.width, 0, 1);
  }
  handle.addEventListener('pointerdown', e => {
    dragging = true;
    handle.setPointerCapture(e.pointerId);
    manualFrac = fracFromEvent(e);
    e.stopPropagation();
  });
  handle.addEventListener('pointermove', e => {
    if (!dragging) return;
    manualFrac = fracFromEvent(e);
    manualScrollY = scrollY;
    kick();
  });
  const endDrag = () => { dragging = false; manualScrollY = scrollY; };
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
  handle.addEventListener('keydown', e => {
    const step = e.shiftKey ? .2 : .05;
    let f = seamTarget();
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') f += step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') f -= step;
    else if (e.key === 'Home') f = 0;
    else if (e.key === 'End') f = 1;
    else return;
    e.preventDefault();
    manualFrac = clamp(f, 0, 1);
    manualScrollY = scrollY;
    kick();
  });

  /* ---------- rub clean: paint into a screen-space mask ---------- */
  const maskCanvas = document.createElement('canvas');
  const mctx = maskCanvas.getContext('2d');
  let maskTex = null, maskDirty = false, wiping = false, lastWipe = null;
  function sizeMask() {
    const w = stage.clientWidth || 1, h = stage.clientHeight || 1;
    const mw = 320, mh = Math.max(1, Math.round(320 * h / w));
    if (maskCanvas.width === mw && maskCanvas.height === mh) return;
    maskCanvas.width = mw; maskCanvas.height = mh;
    clearMask();
    if (maskTex) { maskTex.dispose(); maskTex = null; }   // a texture can't change size; make a new one
  }
  function clearMask() {
    mctx.fillStyle = '#000';
    mctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    maskDirty = true;
  }
  // a sponge: a cluster of soft dabs around the point, so the cleaned edge looks hand-wiped
  function dab(x, y) {
    const mw = maskCanvas.width, mh = maskCanvas.height;
    const px = x * mw, py = y * mh, r = mw * .045;
    mctx.fillStyle = '#fff';
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * r * .7;
      mctx.beginPath();
      mctx.arc(px + Math.cos(a) * d, py + Math.sin(a) * d, r * (.45 + Math.random() * .45), 0, Math.PI * 2);
      mctx.fill();
    }
    maskDirty = true;
  }
  function wipeTo(e) {
    const r = stage.getBoundingClientRect();
    const p = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    if (lastWipe) {
      // fill in between fast moves so the stroke stays continuous
      const dx = p.x - lastWipe.x, dy = (p.y - lastWipe.y) * r.height / r.width;
      const n = Math.ceil(Math.hypot(dx, dy) / .015);
      for (let i = 1; i <= n; i++) dab(lastWipe.x + (p.x - lastWipe.x) * i / n, lastWipe.y + (p.y - lastWipe.y) * i / n);
    } else dab(p.x, p.y);
    lastWipe = p;
    hint.classList.add('is-hidden');
    kick();
  }
  const isControl = el => el.closest('.hero3d-handle, .hero3d-dock, a, button');
  stage.addEventListener('pointerdown', e => {
    if (isControl(e.target)) return;
    ripple(e);
    if (!ready) return;
    wiping = true;
    lastWipe = null;
    if (e.pointerType === 'mouse') stage.setPointerCapture(e.pointerId);
    wipeTo(e);
  });
  stage.addEventListener('pointermove', e => {
    pointer.tx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / innerHeight) * 2 - 1;
    liftLetters(e.clientX, e.clientY);
    if (wiping) wipeTo(e);
    kick();
  });
  const endWipe = () => { wiping = false; lastWipe = null; };
  stage.addEventListener('pointerup', endWipe);
  stage.addEventListener('pointercancel', endWipe);
  stage.addEventListener('pointerleave', () => { pointer.tx = pointer.ty = 0; liftLetters(-1e4, -1e4); kick(); });

  /* ---------- small touches: letter lift, water ripples ---------- */
  function liftLetters(x, y) {
    if (reduced.matches || !finePointer.matches) return;
    letters.forEach(span => {
      const r = span.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
      const k = Math.max(0, 1 - d / 140);
      span.style.transform = k ? `translateY(${(-14 * k).toFixed(1)}px) scale(${(1 + .12 * k).toFixed(3)})` : '';
    });
  }
  function ripple(e) {
    if (reduced.matches) return;
    const r = stage.getBoundingClientRect();
    const drop = document.createElement('span');
    drop.className = 'hero3d-ripple';
    drop.style.left = (e.clientX - r.left) + 'px';
    drop.style.top = (e.clientY - r.top) + 'px';
    ripples.appendChild(drop);
    drop.addEventListener('animationend', () => drop.remove());
  }

  /* ---------- service chips ---------- */
  let current = 'wash';
  function pickChip(chip) {
    chips.forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
    const name = chip.dataset.name;
    cta.href = chip.dataset.href;
    cta.querySelectorAll('.hero3d-cta-text').forEach(t => { t.textContent = 'Explore ' + name; });
    hero.dataset.service = chip.dataset.look;
    if (chip.dataset.look !== current) {
      current = chip.dataset.look;
      if (mats) {
        const f = LOOKS[current];
        setFinish(mats.before, f.before);
        setFinish(mats.after, f.after);
      }
      clearMask();
      kick();
    }
  }
  chips.forEach(chip => chip.addEventListener('click', () => pickChip(chip)));

  /* ---------- 3D ---------- */
  let renderer = null, scene, shadow, camera, car = null, mats = null, length = 4.6, ready = false;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let raf = 0, visible = true, lastKey = '', lastTime = 0;

  function kick() { if (!raf && visible) { lastTime = performance.now(); raf = requestAnimationFrame(frame); } }

  function frame(now) {
    raf = 0;
    // ease by elapsed time, so slow devices keep up with the scroll instead of lagging behind it
    const dt = Math.min(.1, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    readScroll();
    // ease the seam and the pointer lean
    const target = seamTarget();
    const k = reduced.matches || dragging ? 1 : 1 - Math.exp(-dt * 12);
    seam += (target - seam) * k;
    if (Math.abs(target - seam) < .0005) seam = target;
    const lean = reduced.matches || !finePointer.matches ? 0 : 1;
    const kp = 1 - Math.exp(-dt * 5);
    pointer.x += (pointer.tx * lean - pointer.x) * kp;
    pointer.y += (pointer.ty * lean - pointer.y) * kp;
    setSeamUI(seam);

    let moving = seam !== target || Math.abs(pointer.tx * lean - pointer.x) > .002 || Math.abs(pointer.ty * lean - pointer.y) > .002;
    if (ready && visible) {
      const w = stage.clientWidth, h = stage.clientHeight;
      const key = [w, h, seam.toFixed(4), pointer.x.toFixed(3), pointer.y.toFixed(3), current].join(':');
      if (key !== lastKey || maskDirty) {
        lastKey = key;
        const dpr = Math.min(devicePixelRatio, 1.6);
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          renderer.setPixelRatio(dpr);
          renderer.setSize(w, h, false);
          sizeMask();
        }
        if (!maskTex) {
          maskTex = new THREE.CanvasTexture(maskCanvas);
          [mats.before, mats.after].forEach(m => { m.userData.uniforms.uMask.value = maskTex; m.userData.uniforms.uUseMask.value = 1; });
        }
        if (maskDirty) { maskTex.needsUpdate = true; maskDirty = false; }
        // a front three-quarter view that swings toward the side as the car is washed,
        // leaning a little toward the pointer
        const aspect = w / h;
        camera.aspect = aspect;
        const theta = THREE.MathUtils.degToRad(30 + seam * 22 - pointer.x * 7);
        const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        // portrait screens: a little closer and looking down more, so the car fills the width
        // and the ceiling strips stay out of the headline
        const portrait = aspect < 1;
        const dist = Math.max(length * (portrait ? .44 : .5) / (halfH * aspect), length * .42 / halfH);
        const elev = length * ((portrait ? .62 : .22) + pointer.y * .05);
        camera.position.set(-Math.cos(theta) * dist, elev, Math.sin(theta) * dist);
        camera.lookAt(0, length * (portrait ? -.02 : .12), 0);
        camera.updateProjectionMatrix();
        setSeam(mats, seam * 2 - 1);
        renderer.render(scene, camera);
      }
    }
    if (moving || dragging || wiping) raf = requestAnimationFrame(frame);
  }

  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', () => { lastKey = ''; kick(); });
  reduced.addEventListener('change', () => { hero.classList.toggle('is-reduced', reduced.matches); lastKey = ''; kick(); });
  hero.classList.toggle('is-reduced', reduced.matches);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { lastKey = ''; kick(); } }).observe(stage);

  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    ({ scene, shadow } = buildStudio(renderer, () => { lastKey = ''; kick(); }));
    camera = new THREE.PerspectiveCamera(30, 16 / 9, .1, 100);
  } catch (e) {
    hero.classList.add('is-fallback');
  }
  if (renderer) {
    loadCar(hero.dataset.model, {
      wheels: (hero.dataset.wheels || '0,0,0,0').split(',').map(Number),
      belt: Number(hero.dataset.belt || .65),
      finishes: LOOKS[current],
    }).then(loaded => {
      ({ car, mats, length } = loaded);
      scene.add(car);
      shadow.scale.set(loaded.footprint[0] * 1.25, 1, loaded.footprint[1] * 1.6);
      sizeMask();
      renderer.compile(scene, camera);
      ready = true;
      hero.classList.add('is-3d');
      lastKey = '';
      kick();
    }).catch(() => hero.classList.add('is-fallback'));
  }
  kick();
}
