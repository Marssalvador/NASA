document.addEventListener('DOMContentLoaded', () => {
  const toast = document.getElementById('toast');
  let toastTimer;
  const announce = (message) => {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  };

  document.getElementById('dismiss-demo')?.addEventListener('click', () => {
    document.querySelector('.demo-banner')?.remove();
  });

  document.getElementById('checkin')?.addEventListener('click', () => {
    announce('Registro de medición: conecta un sensor o introduce datos verificados para continuar.');
  });

  document.getElementById('view-plan')?.addEventListener('click', () => {
    announce('Plan de demostración. La carga y la técnica deben seguir el protocolo de misión.');
  });

  const bodyFront = document.getElementById('body-front');
  const bodyBack = document.getElementById('body-back');
  const weightSlider = document.getElementById('weight-slider');
  const weightValue = document.getElementById('weight-value');
  const sexButtons = document.querySelectorAll('.sex-option');

  let aiProfile = {
    shoulder_width: 41.92,
    torso_width: 32.28,
    torso_height: 59.92,
    waist_width: 27.4,
    hip_width: 30.28,
    head_radius: 11,
    arm_length: 43.28,
    leg_length: 48.6,
    muscle_intensity: 1.08,
    symmetry_bias: 0.04
  };

  const loadAiProfile = async () => {
    try {
      const response = await fetch('output/body_render_profile.json');
      if (!response.ok) throw new Error('No body profile found');
      const payload = await response.json();
      aiProfile = { ...aiProfile, ...payload.render_profile };
    } catch (error) {
      aiProfile = aiProfile;
    }
  };

  const buildBodySvg = (sex = 'male', weight = 75) => {
    const isFemale = sex === 'female';
    const scale = Math.max(0, (weight - 45) / 75);
    const torsoWidth = 58 + scale * 14 + (isFemale ? 5 : 0);
    const torsoHeight = 120 + scale * 30;
    const chestWidth = 44 + scale * 9;
    const pelvisWidth = 34 + scale * 10 + (isFemale ? 6 : 0);
    const headRadius = 12 + (isFemale ? 1 : 2);
    const armLength = 88 + scale * 18;
    const legLength = 98 + scale * 22;
    const glowAlpha = 0.18 + scale * 0.12;

    return `
      <svg viewBox="0 0 240 420" role="img" aria-label="Modelo anatómico 3D según peso y sexo">
        <defs>
          <linearGradient id="cyanFill" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="#dffbff" stop-opacity="0.85"/>
            <stop offset="55%" stop-color="#7fd8ff" stop-opacity="0.78"/>
            <stop offset="100%" stop-color="#5ccaf0" stop-opacity="0.25"/>
          </linearGradient>
          <linearGradient id="orangeGlow" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="#ffb163" stop-opacity="0.95"/>
            <stop offset="100%" stop-color="#ff8a5a" stop-opacity="0.7"/>
          </linearGradient>
          <filter id="medicalGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <g filter="url(#medicalGlow)">
          <path d="M 96 36 Q 120 18 144 36 L 152 64 Q 130 72 120 72 Q 110 72 88 64 Z" fill="rgba(131, 231, 255, 0.08)" stroke="#8fe3ff" stroke-width="1.6"/>
          <circle cx="120" cy="49" r="${headRadius}" fill="rgba(131, 231, 255, 0.08)" stroke="#a8eeff" stroke-width="1.8"/>

          <path d="M 76 78 L 96 72 L 107 98 L 104 150 L 96 195 L 88 242 L 98 312 L 90 360 L 102 390 L 118 390 L 122 342 L 128 308 L 136 242 L 132 188 L 136 150 L 133 98 L 144 72 L 164 78 L 178 110 L 170 182 L 172 248 L 160 306 L 162 360 L 150 390 L 138 390 L 128 360 L 119 311 L 116 250 L 116 202 L 120 145 L 116 94 L 92 92 Z" fill="rgba(125, 216, 255, ${glowAlpha})" stroke="#8fe3ff" stroke-width="1.5"/>

          <path d="M 96 78 L 110 90 L 120 94 L 130 90 L 144 78" fill="none" stroke="#bfefff" stroke-width="1.2" opacity="0.8"/>
          <path d="M 92 110 L 98 168 L 102 222 L 98 280" fill="none" stroke="#bfefff" stroke-width="1.1" opacity="0.8"/>
          <path d="M 148 110 L 142 168 L 138 222 L 142 280" fill="none" stroke="#bfefff" stroke-width="1.1" opacity="0.8"/>

          <g stroke="#bfefff" stroke-width="1.2" fill="none" opacity="0.9">
            <path d="M 82 118 L 118 118"/>
            <path d="M 80 136 L 118 136"/>
            <path d="M 78 154 L 118 154"/>
            <path d="M 78 172 L 118 172"/>
            <path d="M 78 190 L 118 190"/>
            <path d="M 122 118 L 158 118"/>
            <path d="M 122 136 L 160 136"/>
            <path d="M 122 154 L 160 154"/>
            <path d="M 122 172 L 160 172"/>
            <path d="M 122 190 L 160 190"/>
          </g>

          <path d="M 90 220 L 110 238 L 120 236 L 130 220 L 134 254 L 126 286 L 120 320 L 114 286 L 106 254 Z" fill="rgba(125, 216, 255, 0.10)" stroke="#8fe3ff" stroke-width="1.4"/>

          <path d="M 88 292 L 66 308 L 56 340 L 72 382 L 94 390 L 100 358 L 102 312 Z" fill="rgba(125, 216, 255, 0.10)" stroke="#8fe3ff" stroke-width="1.4"/>
          <path d="M 152 292 L 174 308 L 184 340 L 168 382 L 146 390 L 140 358 L 138 312 Z" fill="rgba(125, 216, 255, 0.10)" stroke="#8fe3ff" stroke-width="1.4"/>

          <path d="M 104 390 L 104 416 L 92 418 L 88 390" fill="none" stroke="#8fe3ff" stroke-width="1.4"/>
          <path d="M 136 390 L 136 416 L 148 418 L 152 390" fill="none" stroke="#8fe3ff" stroke-width="1.4"/>

          <g stroke="#8fe3ff" stroke-width="1.2" fill="none">
            <path d="M 104 150 L 92 210"/>
            <path d="M 136 150 L 148 210"/>
            <path d="M 110 214 L 90 258"/>
            <path d="M 130 214 L 150 258"/>
          </g>

          <g stroke="#ffb067" stroke-width="3" fill="none" opacity="0.9">
            <path d="M 108 96 L 118 150 L 114 220"/>
            <path d="M 132 96 L 122 150 L 126 220"/>
            <path d="M 100 246 L 118 292 L 111 334"/>
            <path d="M 140 246 L 122 292 L 129 334"/>
          </g>

          <g fill="#ffb067" opacity="0.88">
            <circle cx="112" cy="104" r="3.2"/>
            <circle cx="128" cy="104" r="3.2"/>
            <circle cx="104" cy="160" r="3.2"/>
            <circle cx="136" cy="160" r="3.2"/>
            <circle cx="110" cy="264" r="3.2"/>
            <circle cx="130" cy="264" r="3.2"/>
          </g>

          <g stroke="#8fe3ff" stroke-width="1.4" fill="none" opacity="0.8">
            <path d="M 120 60 L 120 80"/>
            <path d="M 120 80 L 120 220"/>
            <path d="M 120 220 L 120 390"/>
            <path d="M 102 92 L 82 120"/>
            <path d="M 138 92 L 158 120"/>
            <path d="M 102 130 L 80 168"/>
            <path d="M 138 130 L 160 168"/>
          </g>
        </g>
      </svg>
    `;
  };

  const renderBodyModel = async () => {
    const sex = document.querySelector('.sex-option.selected')?.dataset.sex || 'male';
    const weight = Number(weightSlider?.value || 75);
    const valueText = `${weight} kg`;
    if (weightValue) weightValue.textContent = valueText;

    if (!Object.keys(aiProfile).length) {
      await loadAiProfile();
    }

    const frontMarkup = buildBodySvg(sex, weight, aiProfile);
    const backMarkup = buildBodySvg(sex, weight, aiProfile);
    bodyFront.querySelector('.body-svg-root').innerHTML = frontMarkup;
    bodyBack.querySelector('.body-svg-root').innerHTML = backMarkup;
  };

  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('selected', item === button));
      const isBack = button.dataset.view === 'back';
      bodyFront.hidden = isBack;
      bodyBack.hidden = !isBack;
      document.querySelector('.body-render')?.setAttribute('aria-label', `Modelo corporal interactivo, vista ${isBack ? 'posterior' : 'frontal'}`);
    });
  });

  sexButtons.forEach((button) => {
    button.addEventListener('click', () => {
      sexButtons.forEach((item) => item.classList.toggle('selected', item === button));
      renderBodyModel();
    });
  });

  weightSlider?.addEventListener('input', renderBodyModel);
  renderBodyModel();

  const regionDetails = {
    thighs: { title: 'Cuádriceps', value: '−3.1%', status: 'cambio vs. línea base', copy: 'Espesor por ecografía: 18.4 mm · última lectura hace 2 días.' },
    calves: { title: 'Pantorrillas', value: '+0.8%', status: 'cambio vs. línea base', copy: 'Fuerza funcional estable · ecografía pendiente de próxima sesión.' },
    arms: { title: 'Brazos', value: '—', status: 'sin medición reciente', copy: 'Añade una medición de fuerza o ecografía para ver su evolución.' }
  };
  const popover = document.getElementById('region-popover');
  const openRegion = (region) => {
    const details = regionDetails[region];
    if (!details || !popover) return;
    document.getElementById('region-title').textContent = details.title;
    document.getElementById('region-value').textContent = details.value;
    document.getElementById('region-status').textContent = details.status;
    document.getElementById('region-copy').textContent = details.copy;
    popover.classList.add('open');
  };
  document.querySelectorAll('.muscle[data-region]').forEach((region) => {
    region.addEventListener('click', () => openRegion(region.dataset.region));
    region.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openRegion(region.dataset.region);
      }
    });
  });
  document.querySelector('.popover-close')?.addEventListener('click', () => popover?.classList.remove('open'));
  document.getElementById('region-plan')?.addEventListener('click', () => announce('Ejercicio de ejemplo: consulta el plan y confirma la carga con el equipo médico.'));

  const cycleToggle = document.getElementById('cycle-toggle');
  cycleToggle?.addEventListener('click', () => {
    const enabled = cycleToggle.getAttribute('aria-checked') !== 'true';
    cycleToggle.setAttribute('aria-checked', String(enabled));
    document.getElementById('cycle-detail').hidden = !enabled;
  });
});
