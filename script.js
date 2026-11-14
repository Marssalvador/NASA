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
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('selected', item === button));
      const isBack = button.dataset.view === 'back';
      bodyFront.hidden = isBack;
      bodyBack.hidden = !isBack;
      document.querySelector('.body-svg')?.setAttribute('aria-label', `Modelo corporal interactivo, vista ${isBack ? 'posterior' : 'frontal'}`);
    });
  });

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
