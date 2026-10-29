
(function(){
  "use strict";

  // Year
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Load decorative video only when visible; respect motion and data preferences.
  var motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  var heroVideos = Array.from(document.querySelectorAll('.scroll-hero video'));
  var motionPaused = motionPreference.matches || !!(navigator.connection && navigator.connection.saveData);
  var heroVisible = true;
  function syncHeroMotion(){
    heroVideos.forEach(function(video){
      var shouldPlay = !motionPaused && heroVisible && !document.hidden;
      if (shouldPlay) {
        var source = video.querySelector('source[data-src]');
        if (source) { source.src = source.dataset.src; source.removeAttribute('data-src'); video.load(); }
        video.muted = true;
        video.playsInline = true;
        video.play().catch(function(){});
      } else video.pause();
    });
  }
  motionPreference.addEventListener('change', function(){ motionPaused = motionPreference.matches; syncHeroMotion(); });
  document.addEventListener('touchend', syncHeroMotion, {passive:true});
  document.addEventListener('click', syncHeroMotion);
  document.addEventListener('visibilitychange', syncHeroMotion);
  if ('IntersectionObserver' in window && document.getElementById('home')) {
    new IntersectionObserver(function(entries){
      heroVisible = entries[0].isIntersecting;
      syncHeroMotion();
    }).observe(document.getElementById('home'));
  } else syncHeroMotion();

  // Native scrolling drives expansion while the sticky stage stays in view.
  (function initScrollHero(){
    var hero = document.getElementById('home');
    var media = document.getElementById('scrollHeroMedia');
    if (!hero || !media) return;   // the home page now has the 3D hero (assets/hero-3d.js)
    var words = hero.querySelectorAll('.scroll-hero-word');
    var hint = document.getElementById('scrollHeroHint');
    var track = hero.querySelector('.hero-scroll-track');
    var stage = hero.querySelector('.hero-sticky');
    var frame = 0;
    function render(){
      frame = 0;
      var distance = track.offsetHeight - stage.offsetHeight;
      var progress = motionPreference.matches ? 1 : Math.min(1, Math.max(0, -track.getBoundingClientRect().top / Math.max(1, distance)));
      var isMobile = window.innerWidth <= 767;
      var startWidth = isMobile ? Math.min(220, window.innerWidth * .60) : Math.min(300, window.innerWidth * .76);
      var endWidth = window.innerWidth * (isMobile ? .78 : .94);
      var startHeight = isMobile ? Math.min(290, stage.offsetHeight * .38) : Math.min(400, stage.offsetHeight * .5);
      var endHeight = stage.offsetHeight * (isMobile ? .56 : .74);
      media.style.width = (startWidth + progress * (endWidth - startWidth)) + 'px';
      media.style.height = (startHeight + progress * (endHeight - startHeight)) + 'px';
      words.forEach(function(word,index){ word.style.transform = 'translateX(' + (index ? 1 : -1) * progress * 150 + 'vw)'; });
      hint.style.opacity = progress > .15 ? '0' : '1';
    }
    function schedule(){ if (!frame) frame = requestAnimationFrame(render); }
    window.addEventListener('scroll', schedule, {passive:true});
    window.addEventListener('resize', schedule, {passive:true});
    motionPreference.addEventListener('change', schedule);
    render();
  })();

  // ---------- Vehicle types ----------
  var VEHICLE_TYPES = ["2-Door Coupe","Small Sedan","Large Sedan","Small SUV/Crossover","Mid-Size SUV","Large SUV","Small Pickup","Mid-Size Pickup","Full-Size Pickup","Large Truck/SUV","Van/Commercial"];

  var qType = document.getElementById('qType');
  VEHICLE_TYPES.forEach(function(v){
    var o = document.createElement('option'); o.textContent = v; qType?.appendChild(o);
  });

  // ---------- Pricing data ----------
  var PAINT_CORRECTION = [
    ["2-Door Coupe","$300","$450-$650","$800-$1,100"],
    ["Small Sedan","$350","$500-$700","$850-$1,200"],
    ["Large Sedan","$400","$550-$750","$950-$1,300"],
    ["Small SUV/Crossover","$400","$600-$800","$1,000-$1,400"],
    ["Mid-Size SUV","$450","$650-$850","$1,100-$1,500"],
    ["Large SUV","$500","$700-$950","$1,200-$1,700"],
    ["Small Pickup","$450","$600-$850","$1,050-$1,450"],
    ["Mid-Size Pickup","$500","$650-$900","$1,100-$1,550"],
    ["Full-Size Pickup","$550","$700-$950","$1,200-$1,700"],
    ["Large Truck/SUV","$600+","$800+","$1,400+"],
    ["Van/Commercial","$650+","$900+","$1,600+"]
  ];
  var paintTbody = document.getElementById('paintCorrectionTable');
  PAINT_CORRECTION.forEach(function(row){
    var tr = document.createElement('tr');
    row.forEach(function(cell){ var td = document.createElement('td'); td.textContent = cell; tr.appendChild(td); });
    paintTbody?.appendChild(tr);
  });

  var CERAMIC = [
    ["2-Door Coupe","$800","$1,200"],
    ["Small Sedan","$850","$1,300"],
    ["Large Sedan","$900","$1,400"],
    ["Small SUV/Crossover","$950","$1,450"],
    ["Mid-Size SUV","$1,050","$1,600"],
    ["Large SUV","$1,200","$1,800"],
    ["Small Pickup","$1,000","$1,500"],
    ["Mid-Size Pickup","$1,100","$1,650"],
    ["Full-Size Pickup","$1,250","$1,850"],
    ["Large Truck/SUV","$1,400+","$2,000+"],
    ["Van/Commercial","$1,500+","$2,800+"]
  ];
  var ceramicTbody = document.getElementById('ceramicTable');
  CERAMIC.forEach(function(row){
    var tr = document.createElement('tr');
    row.forEach(function(cell){ var td = document.createElement('td'); td.textContent = cell; tr.appendChild(td); });
    ceramicTbody?.appendChild(tr);
  });

  var PARTIAL_WRAP = [
    ["Roof",450],["Hood",400],["Trunk/Liftgate",400],["Spoiler",250],["Mirror Caps - Pair",300],
    ["Two Doors",600],["Four Doors",950],["Fenders - Pair",550],["Quarter Panels - Pair",650],
    ["Front Bumper",550],["Rear Bumper",550],["Both Bumpers",950],["A/B/C Pillars",200]
  ];
  var partialTbody = document.getElementById('partialWrapTable');
  PARTIAL_WRAP.forEach(function(row){
    var tr = document.createElement('tr');
    var td1 = document.createElement('td'); td1.textContent = row[0];
    var td2 = document.createElement('td'); td2.textContent = '$' + row[1].toLocaleString();
    tr.appendChild(td1); tr.appendChild(td2); partialTbody?.appendChild(tr);
  });
  var chromeTr = document.createElement('tr');
  chromeTr.innerHTML = '<td>Chrome Delete</td><td>$400-$600</td>';
  partialTbody?.appendChild(chromeTr);

  var FULL_WRAP = [
    ["2-Door Coupe",2200],["Small Sedan",2400],["Large Sedan",2600],["Small SUV/Crossover",2600],
    ["Mid-Size SUV",2800],["Large SUV",3100],["Small Pickup",2800],["Mid-Size Pickup",3000],
    ["Full-Size Pickup",3300],["Large Truck/SUV",3500],["Van",3500]
  ];
  var fullTbody = document.getElementById('fullWrapTable');
  FULL_WRAP.forEach(function(row, i){
    var tr = document.createElement('tr');
    var td1 = document.createElement('td'); td1.textContent = row[0];
    var td2 = document.createElement('td');
    td2.textContent = '$' + row[1].toLocaleString() + (i >= 9 ? '+' : '');
    tr.appendChild(td1); tr.appendChild(td2); fullTbody?.appendChild(tr);
  });

  if (document.getElementById('quoteForm')) {
  // ---------- Quote form service switching ----------
  var servicePills = document.querySelectorAll('.service-pill');
  var condPanels = document.querySelectorAll('.conditional-fields');
  var quoteService = document.getElementById('quoteService');
  var serviceNames = {correction:'Paint Correction', ceramic:'Ceramic Coating', vinyl:'Vinyl Wrap'};
  var summaryLabels = {
    correction: {base:'Enhancement / Stage 1 / Stage 2 (by vehicle)', material:'—', prep:'Decontamination as needed', graphics:'—', protection:'Ceramic, sealant, or wax', labor:'Included in stage price'},
    ceramic: {base:'Entry or Premium tier (by vehicle)', material:'Add-on components selected', prep:'$200 minimum prep charge', graphics:'—', protection:'This is the protection service', labor:'Included in package price'},
    vinyl: {base:'Full or partial wrap (by vehicle/panels)', material:'Film / finish upcharge', prep:'Removal & decontamination as needed', graphics:'Custom graphics if selected', protection:'—', labor:'Door jambs / trim removal if selected'}
  };
  var setService = function(service){
    servicePills.forEach(function(p){ p.setAttribute('aria-pressed', p.dataset.service === service ? 'true' : 'false'); });
    condPanels.forEach(function(p){
      var active = p.dataset.panel === service;
      p.classList.toggle('is-active', active);
      p.querySelectorAll('input,select,textarea').forEach(function(field){ field.disabled = !active; });
    });
    quoteService.value = serviceNames[service];
    var s = summaryLabels[service];
    document.getElementById('sumBase').textContent = s.base;
    document.getElementById('sumMaterial').textContent = s.material;
    document.getElementById('sumPrep').textContent = s.prep;
    document.getElementById('sumGraphics').textContent = s.graphics;
    document.getElementById('sumProtection').textContent = s.protection;
    document.getElementById('sumLabor').textContent = s.labor;
  }
  servicePills.forEach(function(p){
    p.addEventListener('click', function(){ setService(p.dataset.service); });
  });
  setService('correction');
  var wrapCoverage = document.getElementById('vCoverage');
  wrapCoverage.addEventListener('change', function(){ document.getElementById('vPanels').required = wrapCoverage.value === 'Partial wrap'; });

  // Restore only known quote fields; URL text is never inserted as HTML.
  var configuration = new URLSearchParams(window.location.search);
  var requestedService = configuration.get('service');
  if (Object.prototype.hasOwnProperty.call(serviceNames, requestedService)) {
    setService(requestedService);
    var serviceFields = {correction:['cLevel'], ceramic:['crTier','crPackage'], vinyl:['vCoverage','vPanels','vCurrent','vRequested']};
    ['qType','qColor','visualizerEstimate'].concat(serviceFields[requestedService]).forEach(function(id){
      var field = document.getElementById(id);
      var value = configuration.get(id);
      if (value === null) return;
      if (field.tagName === 'SELECT' && !Array.from(field.options).some(function(option){ return option.value === value; })) return;
      field.value = value.slice(0, 1000);
    });
    if (requestedService === 'vinyl') {
      var wrapOptions = configuration.getAll('wrapOptions');
      document.querySelectorAll('input[name="wrapOptions"]').forEach(function(box){
        if (wrapOptions.indexOf(box.value) !== -1) box.checked = true;
      });
    }
    document.getElementById('vPanels').required = wrapCoverage.value === 'Partial wrap';
    var summary = configuration.get('summary');
    if (summary) document.getElementById('sumBase').textContent = [summary.slice(0, 1000), qType.value, document.getElementById('visualizerEstimate').value].filter(Boolean).join(' · ');
    if (requestedService === 'vinyl') document.getElementById('sumMaterial').textContent = document.getElementById('vRequested').value;
  }

  var quoteForm = document.getElementById('quoteForm');
  var formConfirm = document.getElementById('quote-confirmation');
  var quoteFormError = document.getElementById('quoteFormError');
  var quoteSubmitButton = quoteForm.querySelector('button[type="submit"]');
  var qPhotos = document.getElementById('qPhotos');
  var qInspDate = document.getElementById('qInspDate');
  var qPhotoPreview = document.getElementById('qPhotoPreview');
  var qPhotoPreviewImage = document.getElementById('qPhotoPreviewImage');
  var qPhotoPreviewName = document.getElementById('qPhotoPreviewName');
  var qPhotoPreviewUrl = '';
  var quoteFormErrorTimer = 0;
  var quoteFormErrorFadeTimer = 0;

  // Prevent accidental requests for dates that have already passed.
  if (qInspDate) {
    var today = new Date();
    var localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0,10);
    qInspDate.min = localToday;
  }

  quoteForm.addEventListener('invalid', function(){
    quoteFormError.textContent = 'Please fill out all required fields before submitting the quote.';
    window.clearTimeout(quoteFormErrorTimer);
    window.clearTimeout(quoteFormErrorFadeTimer);
    quoteFormError.classList.remove('is-fading');
    quoteFormError.classList.add('is-visible');
    quoteFormErrorTimer = window.setTimeout(function(){
      quoteFormError.classList.remove('is-visible');
      quoteFormError.classList.add('is-fading');
      quoteFormErrorFadeTimer = window.setTimeout(function(){
        quoteFormError.classList.remove('is-fading');
      }, 1000);
    }, 4000);
  }, true);
  quoteForm.addEventListener('input', function(){
    if (!quoteForm.querySelector(':invalid')) quoteFormError.classList.remove('is-visible','is-fading');
  });
  quoteForm.addEventListener('change', function(){
    if (!quoteForm.querySelector(':invalid')) quoteFormError.classList.remove('is-visible','is-fading');
  });

  qPhotos.addEventListener('change', function(){
    var photo = qPhotos.files[0];
    if (qPhotoPreviewUrl) URL.revokeObjectURL(qPhotoPreviewUrl);
    if (!photo) {
      qPhotoPreview.classList.remove('is-visible');
      qPhotoPreviewImage.removeAttribute('src');
      qPhotoPreviewName.textContent = '';
      return;
    }
    qPhotoPreviewUrl = URL.createObjectURL(photo);
    qPhotoPreviewImage.src = qPhotoPreviewUrl;
    qPhotoPreviewName.textContent = photo.name;
    qPhotoPreview.classList.add('is-visible');
  });

  var vArt = document.getElementById('vArt');
  var vArtPreview = document.getElementById('vArtPreview');
  var vArtPreviewImage = document.getElementById('vArtPreviewImage');
  var vArtPreviewName = document.getElementById('vArtPreviewName');
  var vArtPreviewUrl = '';

  vArt.addEventListener('change', function(){
    var artwork = vArt.files[0];
    if (vArtPreviewUrl) URL.revokeObjectURL(vArtPreviewUrl);
    if (!artwork) {
      vArtPreview.classList.remove('is-visible');
      vArtPreviewImage.removeAttribute('src');
      vArtPreviewImage.hidden = false;
      vArtPreviewName.textContent = '';
      return;
    }
    if (artwork.type.indexOf('image/') === 0) {
      vArtPreviewUrl = URL.createObjectURL(artwork);
      vArtPreviewImage.src = vArtPreviewUrl;
      vArtPreviewImage.hidden = false;
    } else {
      vArtPreviewImage.removeAttribute('src');
      vArtPreviewImage.hidden = true;
    }
    vArtPreviewName.textContent = artwork.name;
    vArtPreview.classList.add('is-visible');
  });

  quoteForm.addEventListener('submit', async function(event){
    event.preventDefault();
    if (quoteSubmitButton.disabled) return;
    window.clearTimeout(quoteFormErrorTimer);
    window.clearTimeout(quoteFormErrorFadeTimer);
    quoteFormError.classList.remove('is-visible', 'is-fading');
    formConfirm.classList.remove('is-visible');
    if (!quoteForm.reportValidity()) return;

    // Keep internal field names stable while presenting readable email labels.
    var emailLabels = {
      service: 'Service', name: 'Customer Name', phone: 'Phone #', email: 'Email',
      vehicle: 'Vehicle', vehicleType: 'Vehicle Type', paintColor: 'Paint Color',
      condition: 'Vehicles Condition', correctionLevel: 'Correction Level',
      correctionProtection: 'Correction Protection', paintConditions: 'Paint Conditions',
      previousPaintwork: 'Previous Paintwork', ceramicTier: 'Ceramic Tier',
      ceramicPackage: 'Ceramic Package', ceramicAddOns: 'Ceramic Add-ons',
      ceramicSurfaceConcerns: 'Ceramic Surface Concerns', currentColor: 'Wrap Color',
      requestedColorFinish: 'Requested Color / Finish', preferredFilm: 'Preferred Film',
      wrapCoverage: 'Wrap Coverage', selectedPanels: 'Selected Panels', wrapOptions: 'Wrap Options',
      preferredInspectionDate: 'Inspection Date', notes: 'Additional Info',
      contactConsent: 'Contact Consent', visualizerEstimate: 'Visualizer Estimate'
    };
    var fields = new FormData(quoteForm);
    var payload = new FormData();
    fields.forEach(function(value, name){
      var label = emailLabels[name] || name;
      if (value instanceof File) {
        if (value.size > 0) payload.append(name, value, value.name);
      } else if (payload.has(label)) {
        payload.set(label, payload.get(label) + ', ' + value);
      } else {
        payload.append(label, value);
      }
    });
    // Preserve the customer's address for the email provider's reply handling.
    payload.set('_replyto', fields.get('email'));
    var uploadBytes = 0;
    payload.forEach(function(value){
      if (value instanceof File) uploadBytes += value.size;
    });
    if (uploadBytes > 10 * 1024 * 1024) {
      quoteFormError.textContent = 'Please keep your photo and artwork uploads under 10 MB combined.';
      quoteFormError.classList.add('is-visible');
      return;
    }
    quoteSubmitButton.disabled = true;
    quoteSubmitButton.textContent = 'Sending quote request…';
    quoteForm.setAttribute('aria-busy', 'true');
    var controller = new AbortController();
    var timeout = window.setTimeout(function(){ controller.abort(); }, 60000);
    try {
      var response = await fetch(quoteForm.action, {
        method: 'POST',
        headers: {'Accept': 'application/json'},
        body: payload,
        signal: controller.signal
      });
      var result = await response.json();
      if (!response.ok || !(result.success === true || result.success === 'true')) {
        throw new Error('Submission was not confirmed');
      }
      formConfirm.classList.add('is-visible');
      formConfirm.scrollIntoView({behavior:motionPreference.matches ? 'auto' : 'smooth', block:'center'});
      formConfirm.focus({preventScroll:true});
    } catch (error) {
      quoteFormError.textContent = 'We could not confirm your request. Your details are still here. Please try again or call (340) 775-7405.';
      quoteFormError.classList.add('is-visible');
      quoteFormError.scrollIntoView({behavior:'auto', block:'center'});
    } finally {
      window.clearTimeout(timeout);
      quoteSubmitButton.disabled = false;
      quoteSubmitButton.textContent = formConfirm.classList.contains('is-visible') ? 'Send Another Quote' : 'Submit Quote Request';
      quoteForm.removeAttribute('aria-busy');
    }
  });

  }
  // ---------- Wrap visualizer ----------
  var vizVehicle = document.getElementById('vizVehicle');
  VEHICLE_TYPES.forEach(function(v){ var o = document.createElement('option'); o.textContent = v; vizVehicle?.appendChild(o); });

  var vizArts = document.querySelectorAll('.viz-vehicle-art');
  var vizVehiclePhoto = document.getElementById('vizVehiclePhoto');
  var vizImageTimer = 0;
  var vizVehicleLabel = document.getElementById('vizVehicleLabel');
  function syncPanelCoordinateSpace(){
    var overlay = document.getElementById('vizPanelOverlay');
    if (!overlay || !vizVehiclePhoto || !vizVehiclePhoto.naturalWidth || !vizVehiclePhoto.naturalHeight) return;
    overlay.setAttribute('viewBox','0 0 ' + vizVehiclePhoto.naturalWidth + ' ' + vizVehiclePhoto.naturalHeight);
    overlay.dataset.imageWidth = vizVehiclePhoto.naturalWidth;
    overlay.dataset.imageHeight = vizVehiclePhoto.naturalHeight;
  }
  var VEHICLE_ART = {
    "2-Door Coupe":"images/vehicle-coupe.png",
    "Small Sedan":"images/wrap-visualizer-sedan.png",
    "Large Sedan":"images/vehicle-large-sedan.png",
    "Small SUV/Crossover":"images/vehicle-small-suv.png",
    "Mid-Size SUV":"images/vehicle-mid-suv.png",
    "Large SUV":"images/vehicle-large-suv.png",
    "Small Pickup":"images/vehicle-small-pickup.png",
    "Mid-Size Pickup":"images/vehicle-mid-pickup.png",
    "Full-Size Pickup":"images/vehicle-full-pickup.png",
    "Large Truck/SUV":"images/vehicle-large-truck-suv.png",
    "Van/Commercial":"images/vehicle-van.png"
  };

  // Put the configuration in the destination URL so refresh and new tabs work.
  function quoteLink(link, fields){
    link.href = 'quote.html?' + new URLSearchParams(fields).toString();
  }

  if (vizVehicle) {
  function updateVehicleArt(){
    var vehicle = vizVehicle.value;
    var nextSource = VEHICLE_ART[vehicle];
    if (vizVehiclePhoto && nextSource && !vizVehiclePhoto.src.endsWith(nextSource)) {
      window.clearTimeout(vizImageTimer);
      vizVehiclePhoto.classList.add('is-changing');
      vizVehiclePhoto.onload = function(){
        vizVehiclePhoto.classList.remove('is-changing');
        syncPanelCoordinateSpace();
        if (typeof selectedPanels !== 'undefined' && selectedPanels) updatePanelHighlights();
      };
      vizImageTimer = window.setTimeout(function(){
        vizVehiclePhoto.src = nextSource;
        vizVehiclePhoto.alt = 'Detailed silver ' + vehicle + ' side view for wrap panel preview';
      }, 90);
    }
    vizArts.forEach(function(svg){
      var match = svg.dataset.vehicle === vehicle;
      if (match && !svg.classList.contains('is-active')) {
        svg.classList.add('is-active');
        svg.style.animation = 'none';
        void svg.offsetWidth;
        svg.style.animation = '';
      } else if (!match) {
        svg.classList.remove('is-active');
      }
    });
    vizVehicleLabel.textContent = vizVehicle.value;
    if (typeof selectedPanels !== 'undefined' && selectedPanels) updatePanelHighlights();
  }
  vizVehicle.addEventListener('change', updateVehicleArt);
  updateVehicleArt();
  if (vizVehiclePhoto.complete) syncPanelCoordinateSpace();

  var FULL_WRAP_MAP = {};
  FULL_WRAP.forEach(function(row, i){ FULL_WRAP_MAP[row[0]] = row[1]; });
  // vehicle types not literally in FULL_WRAP list map to nearest bracket
  FULL_WRAP_MAP["Large Truck/SUV"] = 3500;
  FULL_WRAP_MAP["Van/Commercial"] = 3500;

  var PARTIAL_WRAP_MAP = {};
  PARTIAL_WRAP.forEach(function(row){ PARTIAL_WRAP_MAP[row[0]] = row[1]; });

  var vizCoverage = 'full';
  var vizCoverageBar = document.getElementById('vizCoverage');
  var vizPanelsWrap = document.getElementById('vizPanelsWrap');
  var vizPanelsHolder = document.getElementById('vizPanels');
  var vizPanelOverlay = document.getElementById('vizPanelOverlay');
  var vizPanelMarkers = document.getElementById('vizPanelMarkers');
  var selectedPanels = {};

  var PANEL_MARKERS = {
    car:{"Roof":[[520,112]],"Hood":[[180,230]],"Trunk/Liftgate":[[860,230]],"Spoiler":[[940,215]],"Mirror Caps - Pair":[[375,205]],"Two Doors":[[475,290]],"Four Doors":[[455,290],[650,290]],"Fenders - Pair":[[225,300],[800,300]],"Quarter Panels - Pair":[[820,275]],"Front Bumper":[[55,315]],"Rear Bumper":[[955,315]],"Both Bumpers":[[55,315],[955,315]],"A/B/C Pillars":[[405,165],[560,150],[720,170]]},
    coupe:{"Roof":[[535,115]],"Hood":[[190,195]],"Trunk/Liftgate":[[850,235]],"Spoiler":[[940,220]],"Mirror Caps - Pair":[[405,205]],"Two Doors":[[555,285]],"Four Doors":[[475,285],[650,285]],"Fenders - Pair":[[230,305],[800,305]],"Quarter Panels - Pair":[[785,270]],"Front Bumper":[[55,315]],"Rear Bumper":[[955,315]],"Both Bumpers":[[55,315],[955,315]],"A/B/C Pillars":[[425,165],[625,155],[735,180]]},
    suv:{"Roof":[[535,95]],"Hood":[[180,220]],"Trunk/Liftgate":[[925,245]],"Spoiler":[[905,110]],"Mirror Caps - Pair":[[338,193]],"Two Doors":[[480,280]],"Four Doors":[[455,275],[650,275]],"Fenders - Pair":[[210,295],[795,295]],"Quarter Panels - Pair":[[820,255]],"Front Bumper":[[55,315]],"Rear Bumper":[[950,315]],"Both Bumpers":[[55,315],[950,315]],"A/B/C Pillars":[[315,165],[495,158],[685,165]]},
    pickup:{"Roof":[[405,115]],"Hood":[[175,235]],"Trunk/Liftgate":[[930,275]],"Spoiler":[[890,215]],"Mirror Caps - Pair":[[345,210]],"Two Doors":[[440,285]],"Four Doors":[[430,285],[580,285]],"Fenders - Pair":[[210,305],[800,305]],"Quarter Panels - Pair":[[785,250]],"Front Bumper":[[55,325]],"Rear Bumper":[[955,325]],"Both Bumpers":[[55,325],[955,325]],"A/B/C Pillars":[[350,165],[475,155],[610,170]]},
    van:{"Roof":[[600,90]],"Hood":[[130,245]],"Trunk/Liftgate":[[950,250]],"Spoiler":[[900,95]],"Mirror Caps - Pair":[[250,220]],"Two Doors":[[355,290],[610,280]],"Four Doors":[[350,290],[540,280],[720,280]],"Fenders - Pair":[[175,320],[750,320]],"Quarter Panels - Pair":[[805,275]],"Front Bumper":[[45,345]],"Rear Bumper":[[960,345]],"Both Bumpers":[[45,345],[960,345]],"A/B/C Pillars":[[285,165],[390,150],[555,145]]}
  };

  // Hood proportions vary enough between the source photos that a shared
  // car/SUV/pickup coordinate can land on the fender or windshield.
  var HOOD_MARKERS = {
    "2-Door Coupe":[[190,195]],
    "Small Sedan":[[160,195]],
    "Large Sedan":[[170,195]],
    "Small SUV/Crossover":[[150,205]],
    "Mid-Size SUV":[[152,205]],
    "Large SUV":[[168,198]],
    "Small Pickup":[[152,208]],
    "Mid-Size Pickup":[[128,190]],
    "Full-Size Pickup":[[136,186]],
    "Large Truck/SUV":[[140,195]],
    "Van/Commercial":[[130,245]]
  };

  // The extended Large Truck/SUV greenhouse sits farther forward than the
  // shared SUV profile, so each marker targets its actual A, B, and C pillar.
  var PILLAR_MARKERS = {
    "Large Truck/SUV":[[288,164],[482,156],[688,164]]
  };

  var MIRROR_MARKERS = {
    "Large Truck/SUV":[[318,194]]
  };

  function getMarkerProfile(){
    var vehicle = vizVehicle.value;
    if (vehicle === '2-Door Coupe') return PANEL_MARKERS.coupe;
    if (vehicle.indexOf('Pickup') !== -1) return PANEL_MARKERS.pickup;
    if (vehicle === 'Van/Commercial') return PANEL_MARKERS.van;
    if (vehicle.indexOf('SUV') !== -1 || vehicle.indexOf('Crossover') !== -1) return PANEL_MARKERS.suv;
    return PANEL_MARKERS.car;
  }

  function updatePanelHighlights(){
    if (!vizPanelMarkers) return;
    vizPanelMarkers.replaceChildren();
    var profile = getMarkerProfile();
    var imageWidth = parseFloat(vizPanelOverlay.dataset.imageWidth) || 1000;
    var imageHeight = parseFloat(vizPanelOverlay.dataset.imageHeight) || 500;
    Object.keys(selectedPanels).forEach(function(name){
      if (!selectedPanels[name] || !profile[name]) return;
      var points = name === 'Hood' ? HOOD_MARKERS[vizVehicle.value] :
        (name === 'A/B/C Pillars' && PILLAR_MARKERS[vizVehicle.value] ? PILLAR_MARKERS[vizVehicle.value] :
        (name === 'Mirror Caps - Pair' && MIRROR_MARKERS[vizVehicle.value] ? MIRROR_MARKERS[vizVehicle.value] : profile[name]));
      (points || profile[name]).forEach(function(point){
        var marker = document.createElementNS('http://www.w3.org/2000/svg','g');
        marker.setAttribute('class','viz-panel-marker');
        var markerX = point[0] / 1000 * imageWidth;
        var markerY = point[1] / 500 * imageHeight;
        marker.setAttribute('transform','translate(' + markerX + ' ' + markerY + ')');
        var ring = document.createElementNS('http://www.w3.org/2000/svg','circle');
        ring.setAttribute('class','viz-panel-marker-ring'); ring.setAttribute('r',String(imageWidth * .022));
        var core = document.createElementNS('http://www.w3.org/2000/svg','circle');
        core.setAttribute('class','viz-panel-marker-core'); core.setAttribute('r',String(imageWidth * .007));
        marker.appendChild(ring); marker.appendChild(core); vizPanelMarkers.appendChild(marker);
      });
    });
  }

  Object.keys(PARTIAL_WRAP_MAP).forEach(function(name){
    var chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'panel-chip'; chip.textContent = name;
    chip.setAttribute('aria-pressed','false');
    chip.addEventListener('click', function(){
      var pressed = chip.getAttribute('aria-pressed') === 'true';
      chip.setAttribute('aria-pressed', pressed ? 'false' : 'true');
      selectedPanels[name] = !pressed;
      updatePanelHighlights();
      updateEstimate();
    });
    vizPanelsHolder.appendChild(chip);
  });

  vizCoverageBar.querySelectorAll('.tab-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      vizCoverageBar.querySelectorAll('.tab-btn').forEach(function(b){ b.setAttribute('aria-selected','false'); });
      btn.setAttribute('aria-selected','true');
      vizCoverage = btn.dataset.coverage;
      vizPanelsWrap.style.display = vizCoverage === 'partial' ? 'flex' : 'none';
      vizPanelsWrap.style.flexDirection = 'column';
      vizPanelOverlay.classList.toggle('is-visible', vizCoverage === 'partial');
      updatePanelHighlights();
      updateEstimate();
    });
  });

  function updateEstimate(){
    var finishSelect = document.getElementById('vizFinish');
    var finishUpcharge = parseInt(finishSelect.options[finishSelect.selectedIndex].dataset.upcharge, 10) || 0;
    var vehicle = vizVehicle.value;
    var low, high;
    if (vizCoverage === 'full') {
      var base = FULL_WRAP_MAP[vehicle] || 2200;
      low = base; high = base + finishUpcharge + 400;
    } else {
      var sum = 0;
      Object.keys(selectedPanels).forEach(function(name){ if (selectedPanels[name]) sum += PARTIAL_WRAP_MAP[name]; });
      if (sum === 0) sum = 250; // minimum wrap charge
      low = sum; high = sum + finishUpcharge;
    }
    document.getElementById('vizEstimate').textContent = low === high
      ? '$' + low.toLocaleString()
      : '$' + low.toLocaleString() + '–$' + high.toLocaleString();
  }
  vizVehicle.addEventListener('change', updateEstimate);
  var vizFinish = document.getElementById('vizFinish');
  var vizVehicleStage = document.getElementById('vizVehicleStage');
  function updateFinishPreview(){
    var finish = vizFinish.value;
    vizVehicleStage.dataset.finish = finish;
    vizVehiclePhoto.classList.remove('finish-gloss','finish-metallic','finish-satin','finish-matte','finish-color-shift');
    vizVehiclePhoto.classList.add('finish-' + finish);
  }
  vizFinish.addEventListener('change', function(){ updateFinishPreview(); updateEstimate(); });
  updateFinishPreview();
  updateEstimate();

  document.getElementById('vizToQuote').addEventListener('click', function(event){
    var panels = Object.keys(selectedPanels).filter(function(name){ return selectedPanels[name]; });
    var finish = vizFinish.options[vizFinish.selectedIndex].textContent.split(' — ')[0];
    quoteLink(event.currentTarget, {
      service:'vinyl', qType:vizVehicle.value,
      vCoverage:vizCoverage === 'full' ? 'Full wrap' : 'Partial wrap',
      vPanels:vizCoverage === 'full' ? 'All exterior body panels' : panels.join(', '),
      vRequested:finish, visualizerEstimate:document.getElementById('vizEstimate').textContent,
      summary:vizCoverage === 'full' ? 'Full color change' : (panels.join(', ') || 'Partial wrap — panels not selected')
    });
  });

  }
  if (document.getElementById('animatedTestimonials')) {
  // ---------- Testimonials ----------
  // A stack of initials tiles beside the quote: the active tile rises to the front, the rest sit
  // tilted behind it, and the quote's words fade in one by one.
  var TESTIMONIALS = [
    {text:'My SUV came back spotless inside and out, even after weeks of beach sand and daily driving.',name:'Austin',meta:'August 2026',service:'Full-service wash',initials:'AU'},
    {text:'The paint enhancement brought the gloss back without an aggressive sales pitch. The difference was easy to see.',name:'Harvey',meta:'July 2026',service:'Paint enhancement',initials:'HA'},
    {text:'They explained the ceramic-coating preparation clearly and gave me practical advice for maintaining it in the island heat.',name:'Sophia',meta:'June 2026',service:'Ceramic coating',initials:'SO'},
    {text:'The interior detail made our family vehicle feel fresh again, especially the seats, carpets, and small storage areas.',name:'Adara',meta:'May 2026',service:'Interior detail',initials:'AD'},
    {text:'My hood and roof wrap look clean and balanced. The edges and transitions received careful attention.',name:'Treasa',meta:'April 2026',service:'Partial wrap',initials:'TR'},
    {text:'Fast, friendly service and a noticeably cleaner truck. Booking and pickup were both straightforward.',name:'Maya',meta:'March 2026',service:'Exterior wash',initials:'MA'},
    {text:'The chrome delete completely changed the SUV’s appearance while still looking polished and factory-finished.',name:'Rihanna',meta:'December 2025',service:'Chrome delete',initials:'RI'},
    {text:'They took time to inspect the paint first and set realistic expectations before beginning the correction work.',name:'Elijah',meta:'October 2025',service:'Paint correction',initials:'EL'},
    {text:'The full-service wash was thorough, and the team paid extra attention to the wheels and hard-to-reach areas.',name:'James',meta:'September 2025',service:'Full-service wash',initials:'JA'},
    {text:'The finished coating looked exceptionally glossy, and the aftercare instructions were simple and useful.',name:'Mike',meta:'August 2025',service:'Ceramic coating',initials:'MI'},
    {text:'The custom graphics were aligned carefully and gave the work van a much cleaner, more professional appearance.',name:'Hector',meta:'July 2025',service:'Custom graphics',initials:'HE'}
  ];
  var atRoot = document.getElementById('animatedTestimonials');
  var atStack = atRoot.querySelector('.at-stack');
  var atText = atRoot.querySelector('.at-text');
  var atReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var atActive = 0;
  var atPhotos = TESTIMONIALS.map(function(review, i){
    var photo = document.createElement('div'); photo.className = 'at-photo';
    var tile = document.createElement('span'); tile.className = 'at-initials'; tile.textContent = review.initials;
    tile.dataset.tone = String(i % 4);
    photo.appendChild(tile); atStack.appendChild(photo);
    return photo;
  });
  function atTilt(){ return (Math.floor(Math.random() * 21) - 10) + 'deg'; }
  function atShow(index){
    atActive = (index + TESTIMONIALS.length) % TESTIMONIALS.length;
    atPhotos.forEach(function(photo, i){
      var on = i === atActive;
      photo.classList.toggle('is-active', on);
      photo.style.setProperty('--at-rotate', on ? '0deg' : atTilt());
      photo.style.zIndex = on ? 999 : TESTIMONIALS.length + 2 - i;
      // replay the hop to the front
      if (on) { photo.classList.remove('is-rising'); void photo.offsetWidth; photo.classList.add('is-rising'); }
    });
    var review = TESTIMONIALS[atActive];
    var block = document.createElement('div'); block.className = 'at-entry';
    var name = document.createElement('h4'); name.className = 'at-name'; name.textContent = review.name;
    var meta = document.createElement('p'); meta.className = 'at-meta'; meta.textContent = review.service + ' · ' + review.meta;
    var quote = document.createElement('p'); quote.className = 'at-quote';
    review.text.split(' ').forEach(function(word, i){
      var w = document.createElement('span'); w.textContent = word + ' ';
      w.style.setProperty('--at-delay', (0.02 * i) + 's');
      quote.appendChild(w);
    });
    block.appendChild(name); block.appendChild(meta); block.appendChild(quote);
    atText.textContent = ''; atText.appendChild(block);
  }
  atRoot.querySelectorAll('.at-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      atText.setAttribute('aria-live', 'polite');   // announce only quotes the visitor asked for
      atShow(atActive + Number(btn.dataset.step));
    });
  });
  // autoplay every 5s, held while the pointer or keyboard focus is on it
  var atHold = false;
  atRoot.addEventListener('pointerenter', function(){ atHold = true; });
  atRoot.addEventListener('pointerleave', function(){ atHold = false; });
  atRoot.addEventListener('focusin', function(){ atHold = true; });
  atRoot.addEventListener('focusout', function(){ atHold = false; });
  window.setInterval(function(){
    if (atHold || document.hidden || atReduced.matches) return;
    atText.setAttribute('aria-live', 'off');
    atShow(atActive + 1);
  }, 5000);
  atShow(0);

  }
  // ---------- Aftercare tabs ----------
  var aftercareTabs = Array.from(document.querySelectorAll('#aftercareTabs .tab-btn'));
  function activateAftercare(btn){
    aftercareTabs.forEach(function(tab){
      var selected = tab === btn;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      var panel = document.getElementById(tab.getAttribute('aria-controls'));
      panel.classList.toggle('is-active', selected);
      panel.hidden = !selected;
    });
  }
  aftercareTabs.forEach(function(btn,index){
    var panel = document.querySelector('#aftercare .tab-panel[data-panel="' + btn.dataset.tab + '"]');
    btn.id = 'aftercare-tab-' + btn.dataset.tab;
    panel.id = 'aftercare-panel-' + btn.dataset.tab;
    btn.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', btn.id);
    panel.tabIndex = 0;
    btn.addEventListener('click', function(){ activateAftercare(btn); });
    btn.addEventListener('keydown', function(event){
      var next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % aftercareTabs.length;
      else if (event.key === 'ArrowLeft') next = (index + aftercareTabs.length - 1) % aftercareTabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = aftercareTabs.length - 1;
      else return;
      event.preventDefault();
      activateAftercare(aftercareTabs[next]);
      aftercareTabs[next].focus();
    });
  });
  if (aftercareTabs.length) activateAftercare(aftercareTabs[0]);

  // ---------- Material Design ripple ----------
  function addMaterialRipple(control, clientX, clientY){
    if (motionPreference.matches || control.disabled || control.getAttribute('aria-disabled') === 'true') return;
    var box = control.getBoundingClientRect();
    var x = clientX - box.left;
    var y = clientY - box.top;
    var farthestX = Math.max(x, box.width - x);
    var farthestY = Math.max(y, box.height - y);
    var size = Math.hypot(farthestX, farthestY) * 2;
    var ripple = document.createElement('span');
    ripple.className = 'material-ripple-wave';
    ripple.setAttribute('aria-hidden','true');
    ripple.style.width = size + 'px';
    ripple.style.height = size + 'px';
    ripple.style.left = (x - size / 2) + 'px';
    ripple.style.top = (y - size / 2) + 'px';
    control.appendChild(ripple);
    ripple.addEventListener('animationend', function(){ ripple.remove(); }, {once:true});
    window.setTimeout(function(){ ripple.remove(); }, 650);
  }

  document.querySelectorAll('button, a.btn').forEach(function(control){
    control.classList.add('material-ripple-control');
    control.addEventListener('pointerdown', function(event){
      if (event.isPrimary) addMaterialRipple(control, event.clientX, event.clientY);
    });
    control.addEventListener('keydown', function(event){
      if (event.repeat || (event.key !== ' ' && event.key !== 'Enter')) return;
      var box = control.getBoundingClientRect();
      addMaterialRipple(control, box.left + box.width / 2, box.top + box.height / 2);
    });
  });

})();

// Pointer tilt for the service cards; touch and reduced-motion users keep a static grid.
(function(){
  var canTilt = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  document.querySelectorAll('.animated-service-card').forEach(function(card){
    function reset(){
      card.style.removeProperty('--card-rotate-x');
      card.style.removeProperty('--card-rotate-y');
    }
    card.addEventListener('pointermove', function(event){
      if (!canTilt.matches || event.pointerType === 'touch') return;
      var bounds = card.getBoundingClientRect();
      var x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
      var y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
      card.style.setProperty('--card-rotate-x', (-y * 7) + 'deg');
      card.style.setProperty('--card-rotate-y', (x * 7) + 'deg');
    });
    card.addEventListener('pointerleave', reset);
    card.addEventListener('pointercancel', reset);
    canTilt.addEventListener('change', reset);
  });
})();

// Scroll-driven before/after reveal: the photo stays pinned while the page scrolls, and scroll
// progress moves the seam that uncovers the after image. With reduced motion the stage stays in
// the flow and a range input across the photo moves the seam instead.
(function(){
  var reveals = document.querySelectorAll('.wash-reveal');
  if (!reveals.length) return;
  var header = document.querySelector('.navigation-header');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var frame = 0;
  function render(){
    frame = 0;
    var nav = header ? header.getBoundingClientRect().height : 0;
    reveals.forEach(function(reveal){
      reveal.style.setProperty('--wash-nav', nav + 'px');
      if (!reveal.classList.contains('is-scroll')) return;
      var track = reveal.querySelector('.wash-reveal-track');
      var stage = reveal.querySelector('.wash-reveal-stage');
      var travel = track.offsetHeight - stage.offsetHeight;
      var stuck = stage.getBoundingClientRect().top - track.getBoundingClientRect().top;
      // hold a moment on "before" and on "after" at either end of the track
      var raw = stuck / Math.max(1, travel);
      reveal.style.setProperty('--wash-p', Math.max(0, Math.min(1, (raw - .08) / .8)).toFixed(4));
    });
  }
  function schedule(){ if (!frame) frame = requestAnimationFrame(render); }
  function sync(){
    reveals.forEach(function(reveal){
      reveal.classList.toggle('is-scroll', !reducedMotion.matches);
      if (reducedMotion.matches) reveal.style.setProperty('--wash-p', reveal.querySelector('.wash-reveal-range').value / 100);
    });
    schedule();
  }
  reveals.forEach(function(reveal){
    var range = reveal.querySelector('.wash-reveal-range');
    range.addEventListener('input', function(){ reveal.style.setProperty('--wash-p', range.value / 100); });
  });
  window.addEventListener('scroll', schedule, {passive:true});
  window.addEventListener('resize', schedule);
  reducedMotion.addEventListener('change', sync);
  sync();
})();

// Polaroid line carousel (gallery): prints pegged to a sagging string. Dragging the line or the
// arrows slides them along it; each print swings with the line's speed and settles back, and
// sways a little at rest. The print nearest the middle is the active one.
(function(){
  var root = document.getElementById('polaroidGallery');
  if (!root) return;
  var cards = Array.prototype.slice.call(root.querySelectorAll('.pl-card'));
  var n = cards.length;
  var path = root.querySelector('.pl-string path');
  var cap = root.querySelector('.pl-cap');
  var count = root.querySelector('.pl-count b');
  var live = root.querySelector('.pl-sr');
  var CARD_WIDTH = 300, SAG = 46, AUTOPLAY = 4500;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var size = { w:1200, h:800, cw:CARD_WIDTH };
  var spacing = CARD_WIDTH * 1.08;
  var sim = { off:0, vel:0, target:0, a:[], w:[] };
  var drag = null, lastTouch = 0, active = -1, raf = 0, visible = true, prev = performance.now();

  function clamp(v, a, b){ return Math.min(b, Math.max(a, v)); }
  function pad2(i){ return i < 10 ? '0' + i : String(i); }
  // height of the string sagging by sag between (0, y0) and (w, y0), at x
  function stringY(x, w, y0, sag){ var t = clamp(x / w, 0, 1); return y0 + 4 * sag * t * (1 - t); }
  // one step of a critically damped spring toward target
  function springStep(x, v, target, dt){ var k = 70, c = 2 * Math.sqrt(k); var nv = v + (k * (target - x) - c * v) * dt; return [x + nv * dt, nv]; }
  // one step of a print's swing: it lags behind the line's motion, gravity pulls it back, damping settles it
  function swingStep(a, w, lineVel, dt, gain){ var nw = w + (-38 * a - 4.2 * w + lineVel * 0.0034 * gain) * dt; return [clamp(a + nw * dt, -0.6, 0.6), nw]; }
  function nearestAt(off){ return clamp(Math.round(off / spacing), 0, Math.max(0, n - 1)); }
  function goTo(i){ sim.target = clamp(i, 0, n - 1) * spacing; }

  function setActive(i){
    active = i;
    cards.forEach(function(card, k){
      card.dataset.on = k === i ? '1' : '0';
      if (k === i) card.removeAttribute('aria-hidden'); else card.setAttribute('aria-hidden', 'true');
    });
    var title = cards[i].dataset.title || '';
    var caption = cards[i].dataset.caption || '';
    // fresh spans so the caption slides in again
    cap.textContent = '';
    var t = document.createElement('span'); t.className = 'pl-title'; t.textContent = title; cap.appendChild(t);
    if (caption) { var c = document.createElement('span'); c.className = 'pl-sub'; c.textContent = caption; cap.appendChild(c); }
    count.textContent = pad2(i + 1);
    live.textContent = 'Photo ' + (i + 1) + ' of ' + n + (title ? ': ' + title : '');
  }

  function measure(){
    var r = root.getBoundingClientRect();
    var cw = Math.round(Math.max(150, Math.min(CARD_WIDTH, r.width * 0.42, r.height * 0.42)));
    size = { w:r.width, h:r.height, cw:cw };
    root.style.setProperty('--pl-cw', cw + 'px');
    spacing = cw * 1.08;
    // keep the line on the active print when the spacing changes
    sim.target = sim.off = Math.max(0, active) * spacing;
    schedule();
  }

  function frame(now){
    raf = 0;
    if (!visible) return;
    var dt = Math.min(0.033, (now - prev) / 1000);
    prev = now;
    var w = size.w, cw = size.cw;
    var y0 = Math.max(40, size.h * 0.2);
    var lineVel;
    if (drag && drag.moved) {
      lineVel = drag.v * 1000;
    } else {
      var before = sim.off;
      var s = springStep(sim.off, sim.vel, sim.target, dt);
      sim.off = s[0]; sim.vel = s[1];
      lineVel = -(sim.off - before) / Math.max(dt, 1e-3);
    }
    var gain = reduce.matches ? 0 : 1;
    var near = nearestAt(sim.off);
    for (var i = 0; i < n; i++) {
      var el = cards[i];
      var x = w / 2 + i * spacing - sim.off;
      if (x < -cw * 1.5 || x > w + cw * 1.5) { el.style.visibility = 'hidden'; continue; }
      el.style.visibility = 'visible';
      var sw = swingStep(sim.a[i] || 0, sim.w[i] || 0, lineVel, dt, gain);
      var a = sw[0];
      if (gain) a += Math.sin(now / 1300 + i * 1.7) * 0.0009;
      sim.a[i] = a; sim.w[i] = sw[1];
      var y = stringY(x, w, y0, SAG) - 6;
      el.style.transform = 'translate(' + (x - cw / 2).toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + a.toFixed(4) + 'rad)';
      el.style.zIndex = String(i === near ? n + 1 : n - Math.abs(i - near));
    }
    path.setAttribute('d', 'M0 ' + y0 + ' Q' + w / 2 + ' ' + (y0 + 2 * SAG) + ' ' + w + ' ' + y0);
    if (near !== active) setActive(near);
    raf = requestAnimationFrame(frame);
  }
  function schedule(){ if (visible && !raf) { prev = performance.now(); raf = requestAnimationFrame(frame); } }

  function step(dir){ lastTouch = performance.now(); goTo(clamp(active + dir, 0, n - 1)); }

  root.addEventListener('pointerdown', function(e){
    if (e.target.closest('.pl-bar')) return;
    lastTouch = performance.now();
    drag = { x:e.clientX, off:sim.off, lx:e.clientX, lt:e.timeStamp, v:0, moved:false };
  });
  root.addEventListener('pointermove', function(e){
    if (!drag) return;
    var dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 5) {
      drag.moved = true;
      root.dataset.drag = '1';
      root.setPointerCapture(e.pointerId);
    }
    if (!drag.moved) return;
    var dt = Math.max(1, e.timeStamp - drag.lt);
    drag.v = 0.7 * ((e.clientX - drag.lx) / dt) + 0.3 * drag.v;
    drag.lx = e.clientX; drag.lt = e.timeStamp;
    // past either end the line gives with some resistance
    var max = (n - 1) * spacing;
    var off = drag.off - dx;
    if (off < 0) off *= 0.35;
    if (off > max) off = max + (off - max) * 0.35;
    sim.off = off;
  });
  function release(e){
    var d = drag;
    drag = null;
    lastTouch = performance.now();
    if (!d) return;
    if (d.moved) {
      root.dataset.drag = '0';
      sim.vel = -d.v * 1000;
      goTo(nearestAt(sim.off - d.v * 180));
      return;
    }
    var card = e.target.closest('.pl-card');
    if (card) goTo(Number(card.dataset.i));
  }
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);
  root.querySelectorAll('.pl-btn').forEach(function(btn){
    btn.addEventListener('click', function(){ step(Number(btn.dataset.step)); });
  });
  root.addEventListener('keydown', function(e){
    if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else return;
    e.preventDefault();
  });

  // autoplay, back to the first print after the last; it waits while someone is interacting
  if (n > 1) window.setInterval(function(){
    if (document.hidden || drag || !visible || performance.now() - lastTouch < AUTOPLAY) return;
    goTo(active >= n - 1 ? 0 : active + 1);
  }, AUTOPLAY);

  new IntersectionObserver(function(entries){ visible = entries[0].isIntersecting; schedule(); }).observe(root);
  new ResizeObserver(measure).observe(root);
  root.classList.add('is-ready');
  setActive(0);
  measure();
})();
