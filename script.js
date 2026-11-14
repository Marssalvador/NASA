const partData = {
  piernas: {
    name: 'Piernas',
    deficit: '-9.4%',
    risk: 'Sarcopenia moderada',
    summary:
      'La masa muscular de las piernas muestra una tendencia de desuso acumulado. El sistema recomienda ejercicios de resistencia y un plan nutricional orientado a síntesis proteica.',
    exercises: [
      'Sentadillas con banda de resistencia',
      'Step-ups de 3 series x 12 repeticiones',
      'Entrenamiento de explosividad en isquios'
    ],
    supplements: ['Leucina', 'Whey aislado', 'Vitamina D3', 'Magnesio'],
    diet: [
      '1.8–2.2 g/kg de proteína',
      'Carbohidratos 4–5 g/kg',
      'Electrolitos cada 6 h',
      'Reposición de sueño 8.5 h'
    ]
  },
  brazos: {
    name: 'Brazos',
    deficit: '-5.1%',
    risk: 'Pérdida de fuerza funcional',
    summary:
      'La fuerza de brazos presenta una caída progresiva, con mayor fatiga durante las maniobras de carga y mantenimiento en microgravedad.',
    exercises: [
      'Curl con banda',
      'Press de triceps isotónico',
      'Pull-down asistido con brazos'
    ],
    supplements: ['Creatina', 'BCAA', 'Vitamina B6', 'Zinc'],
    diet: [
      'Proteína distribuida en 4 tomas',
      'Omega-3 2 g/día',
      'Sodio ajustado por sudoración',
      'Hidratación controlada'
    ]
  },
  core: {
    name: 'Core',
    deficit: '-6.8%',
    risk: 'Estabilidad reducida',
    summary:
      'La estabilidad central está comprometida, reduciendo el control postural y la eficiencia para realizar maniobras de precisión.',
    exercises: [
      'Plancha de resistencia',
      'Levantamiento de piernas en suspensión',
      'Torque con resistencia de banda'
    ],
    supplements: ['Magnesio', 'Kre-alkalyn', 'Vitamina C', 'Probioticos'],
    diet: [
      'Fibra 25–30 g/día',
      'Proteína 1.7 g/kg',
      'Potasio + 300 mg',
      'Descanso activo diario'
    ]
  },
  espalda: {
    name: 'Espalda',
    deficit: '-4.7%',
    risk: 'Fatiga lumbar',
    summary:
      'La espalda muestra signos de fatiga acumulada y pérdida de estabilidad, especialmente durante tareas repetitivas de carga o manipulación.',
    exercises: [
      'Peso muerto asistido',
      'Rangos de movilidad dorsal',
      'Extensión isométrica de espalda'
    ],
    supplements: ['Calcio', 'Vitamina D', 'Collagen peptides', 'Magnesio'],
    diet: [
      'Hidratación en 2–3 bloques',
      'Proteína distribuida',
      'Aminoácidos esenciales',
      'Dormir 8 h mínimo'
    ]
  }
};

function renderPart(partKey) {
  const entry = partData[partKey];
  const partName = document.getElementById('part-name');
  const partDeficit = document.getElementById('part-deficit');
  const partSummary = document.getElementById('part-summary');
  const partRisk = document.getElementById('part-risk');
  const partExercises = document.getElementById('part-exercises');
  const partSupplements = document.getElementById('part-supplements');
  const partDiet = document.getElementById('part-diet');

  if (!entry) return;

  partName.textContent = entry.name;
  partDeficit.textContent = entry.deficit;
  partSummary.textContent = entry.summary;
  partRisk.textContent = entry.risk;

  partExercises.innerHTML = entry.exercises.map((item) => `<li>${item}</li>`).join('');
  partSupplements.innerHTML = entry.supplements.map((item) => `<li>${item}</li>`).join('');
  partDiet.innerHTML = entry.diet.map((item) => `<li>${item}</li>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  const bodyParts = document.querySelectorAll('.body-part');

  bodyParts.forEach((part) => {
    part.addEventListener('click', () => {
      bodyParts.forEach((item) => item.classList.remove('is-active'));
      part.classList.add('is-active');
      renderPart(part.dataset.part);
    });
  });

  renderPart('piernas');
});
