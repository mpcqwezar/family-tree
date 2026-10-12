import './styles.css';
import { renderHeader } from './header.js';
import { createChart } from 'family-chart';
import { getPersonDisplayName } from './person-name.js';

const app = document.querySelector('#app');
const ANCESTRY_DEPTH = 3;
const PROGENY_DEPTH = 3;
const DEFAULT_FOCUS_ID = 'I500008';

function normalizeId(value) {
  return String(value || '').replace(/^@|@$/g, '');
}

function buildPhotoUrl(person, fileName, fallback) {
  if (!fileName) return fallback;
  const base = import.meta.env.BASE_URL || './';
  return new URL(`${base}photos/${person.id}/${fileName}`, window.location.href).toString();
}

function getYearsLabel(person) {
  if (!person) return '—';
  const birth = (person.birthDate || '').match(/\d{4}/)?.[0] || '';
  const death = (person.deathDate || '').match(/\d{4}/)?.[0] || '';

  if (person.living) {
    return birth ? `род. ${birth}` : 'род. —';
  }

  if (birth && death) return `${birth}–${death}`;
  if (birth) return `род. ${birth}`;
  if (death) return `ум. ${death}`;
  return '—';
}

function createPlaceholder(sex = 'M') {
  const color = sex === 'F' ? '#d8bfd8' : '#bfd9ee';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#f5f0ea"/>
      <circle cx="100" cy="70" r="38" fill="${color}"/>
      <path d="M48 176c10-30 30-46 52-46s42 16 52 46H48z" fill="${color}"/>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getPersonPhoto(person) {
  const fileName = person?.extra?.photo || '';
  return fileName ? buildPhotoUrl(person, fileName, createPlaceholder(person?.sex || 'M')) : createPlaceholder(person?.sex || 'M');
}

function transformPeopleToChartData(people, families) {
  const personMap = new Map();
  for (const person of people) {
    const id = normalizeId(person.id);
    personMap.set(id, {
      id,
      data: {
        id,
        gender: person.sex === 'F' ? 'F' : 'M',
        name: getPersonDisplayName(person, people, families),
        given: person.given || '',
        surname: person.surname || '',
        birthDate: person.birthDate || '',
        deathDate: person.deathDate || '',
        birthPlace: person.birthPlace || '',
        deathPlace: person.deathPlace || '',
        occupation: person.occupation || person.extra?.occupation || '',
        living: !!person.living,
        comment: person.extra?.comment || '',
        link: person.extra?.link || '',
        wikipedia: person.extra?.wikipedia || '',
        photo: getPersonPhoto(person),
        details: person.extra?.details || '',
        list: !!person.extra?.list,
        clan: person.extra?.clan || 'Без рода',
        bio: person.notes?.[0] || ''
      },
      rels: {
        parents: [],
        spouses: [],
        children: []
      }
    });
  }

  for (const family of families) {
    const husband = normalizeId(family.husband);
    const wife = normalizeId(family.wife);
    const spouseIds = [husband, wife].filter(Boolean);

    if (spouseIds.length === 2) {
      for (const spouseId of spouseIds) {
        const person = personMap.get(spouseId);
        if (!person) continue;
        const otherSpouses = spouseIds.filter((id) => id !== spouseId);
        for (const otherId of otherSpouses) {
          if (!person.rels.spouses.includes(otherId)) person.rels.spouses.push(otherId);
        }
      }
    }

    const childIds = (family.children || []).map(normalizeId).filter(Boolean);
    const parentIds = spouseIds.filter(Boolean);

    for (const childId of childIds) {
      const child = personMap.get(childId);
      if (!child) continue;
      for (const parentId of parentIds) {
        if (!child.rels.parents.includes(parentId)) child.rels.parents.push(parentId);
      }
    }

    for (const childId of childIds) {
      const child = personMap.get(childId);
      if (!child) continue;
      for (const parentId of parentIds) {
        const parent = personMap.get(parentId);
        if (!parent) continue;
        if (!parent.rels.children.includes(childId)) parent.rels.children.push(childId);
      }
    }
  }

  return [...personMap.values()];
}

function readFocusFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('focus');
  return raw || DEFAULT_FOCUS_ID;
}

function formatPanel(person) {
  const photo = person?.data?.photo || createPlaceholder(person?.data?.gender || 'M');
  const name = person?.data?.name || 'Неизвестно';
  const years = getYearsLabel({
    birthDate: person?.data?.birthDate,
    deathDate: person?.data?.deathDate,
    living: !!person?.data?.living
  });

  return `
    <div class="tree-panel-header">
      <img src="${photo}" alt="${name}" class="panel-photo" />
      <div>
        <h3>${name}</h3>
        <p>${years}</p>
      </div>
    </div>
    <div class="tree-panel-grid">
      <div><strong>Родился:</strong> ${person?.data?.birthDate || '—'}${person?.data?.birthPlace ? `, ${person.data.birthPlace}` : ''}</div>
      <div><strong>Умер:</strong> ${person?.data?.deathDate || '—'}${person?.data?.deathPlace ? `, ${person.data.deathPlace}` : ''}</div>
      <div><strong>Профессия:</strong> ${person?.data?.occupation || '—'}</div>
      <div><strong>Пол:</strong> ${person?.data?.gender === 'F' ? 'Женский' : 'Мужской'}</div>
      <div><strong>Комментарий:</strong> ${person?.data?.comment || '—'}</div>
      ${person?.data?.details ? `<div class="panel-markdown">${person.data.details}</div>` : ''}
    </div>
    <div class="panel-actions">
      ${person?.data?.list ? `<a href="./people.html#${person.id}" class="panel-link">Открыть в списке</a>` : ''}
      ${person?.data?.link ? `<a href="${person.data.link}" target="_blank" rel="noreferrer" class="panel-link">Внешняя ссылка</a>` : ''}
      ${person?.data?.wikipedia ? `<a href="${person.data.wikipedia}" target="_blank" rel="noreferrer" class="panel-link">Wikipedia</a>` : ''}
    </div>
  `;
}

function decorateTreeCard(d) {
  const record = d.data?.data ?? d.data ?? {};
  const person = record;
  const displayName = person.name || `${person.given || ''} ${person.surname || ''}`.trim() || 'Неизвестно';
  const years = getYearsLabel({
    birthDate: person.birthDate,
    deathDate: person.deathDate,
    living: !!person.living
  });
  const cardColor = person.gender === 'F' ? '#f3d9e2' : '#d7edf8';
  const photo = person.photo || createPlaceholder(person.gender || 'M');

  return `
    <div class="tree-card-person" style="border-color:${cardColor}; background:${person.gender === 'F' ? '#f8eaf0' : '#eaf5fb'};">
      <div class="tree-card-photo-wrap"><img src="${photo}" alt="${displayName}" /></div>
      <div class="tree-card-body">
        <div class="tree-card-name">${displayName}</div>
        <div class="tree-card-years">${years}</div>
      </div>
      <button type="button" class="tree-card-center-btn" data-person-id="${person.id || ''}" aria-label="Сделать ${displayName} центром" title="Сделать центром">
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8"></circle>
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 1v4M12 19v4M1 12h4M19 12h4"></path>
        </svg>
      </button>
    </div>
  `;
}

function applyTreeLinkContrast() {
  const svg = document.querySelector('#tree-container svg');
  if (!svg) return;

  const darkStroke = '#3e4d5d';
  const elements = svg.querySelectorAll('path.link, path, line, polyline, rect');
  elements.forEach((node) => {
    const isLinkPath = node.classList.contains('link') || node.closest('.link_upper, .link_lower, .link_particles, .card_break_link');
    if (isLinkPath || node.tagName === 'line' || node.tagName === 'polyline') {
      node.style.setProperty('stroke', darkStroke, 'important');
      node.style.setProperty('stroke-width', node.tagName === 'rect' ? '2px' : null, 'important');
    }
    if (node.tagName === 'path' || node.tagName === 'line' || node.tagName === 'polyline') {
      node.style.setProperty('fill', 'none', 'important');
    }
  });
}

async function loadTree() {
  const response = await fetch(new URL(`${import.meta.env.BASE_URL || './'}data/data.json`, window.location.href).toString());
  if (!response.ok) throw new Error('Не удалось загрузить данные семейного древа');
  const data = await response.json();

  const people = Array.isArray(data?.people) ? data.people : [];
  const families = Array.isArray(data?.families) ? data.families : [];

  if (!people.length) {
    const emptyState = document.createElement('main');
    emptyState.className = 'page-shell';
    emptyState.innerHTML = '<div class="empty-state">Данные семьи не загружены.</div>';
    app.appendChild(emptyState);
    return;
  }

  const allChartData = transformPeopleToChartData(people, families);
  if (!allChartData.some((person) => person.id === DEFAULT_FOCUS_ID)) {
    throw new Error(`Человек с ID ${DEFAULT_FOCUS_ID} не найден в data.json`);
  }

  const requestedFocusId = readFocusFromUrl();
  const focusId = allChartData.some((person) => person.id === requestedFocusId)
    ? requestedFocusId
    : DEFAULT_FOCUS_ID;
  const chartData = allChartData;

  const shell = document.createElement('main');
  shell.className = 'page-shell tree-page';

  shell.innerHTML = `
    <div class="tree-toolbar">
      <div class="tree-search-wrap">
        <input id="tree-search" list="tree-people-list" placeholder="Поиск по имени" aria-label="Поиск по имени" />
        <datalist id="tree-people-list"></datalist>
        <button type="button" id="tree-search-btn">Найти</button>
      </div>
      <div class="tree-controls">
        <button type="button" id="tree-zoom-in">+</button>
        <button type="button" id="tree-zoom-out">−</button>
        <button type="button" id="tree-reset" aria-label="Вернуться к выбранному" title="Вернуться к выбранному">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M3 10.5 12 3l9 7.5"></path>
            <path d="M5.5 9.5V21h13V9.5M9 21v-7h6v7"></path>
          </svg>
        </button>
      </div>
    </div>
    <div class="tree-layout">
      <div class="tree-stage"><div id="tree-container"></div></div>
      <aside id="tree-panel" class="tree-panel"></aside>
    </div>
  `;
  app.appendChild(shell);

  const list = document.getElementById('tree-people-list');
  const searchInput = document.getElementById('tree-search');

  for (const person of [...chartData].sort((a, b) => a.data.name.localeCompare(b.data.name, 'ru'))) {
    const option = document.createElement('option');
    option.value = person.data.name;
    option.dataset.personId = person.id;
    list.appendChild(option);
  }

  const chart = createChart('#tree-container', chartData);
  const card = chart.setCardHtml();
  card.setCardInnerHtmlCreator((d) => decorateTreeCard(d));
  card.setCardDim({ width: 170, height: 90, padding: 10, margin: 0, rounded: true });
  chart.setAncestryDepth(ANCESTRY_DEPTH);
  chart.setProgenyDepth(PROGENY_DEPTH);
  chart.setTransitionTime(700);
  chart.setSortChildrenFunction((a, b) => (a.data.birthDate || '').localeCompare(b.data.birthDate || ''));

  const syncTreeColors = () => {
    requestAnimationFrame(() => {
      applyTreeLinkContrast();
    });
  };

  const panel = document.getElementById('tree-panel');
  const centerPerson = (id) => {
    if (!chartData.some((person) => person.id === id)) return;
    chart.updateMainId(id);
    chart.updateTree({ tree_position: 'main_to_middle' });
    syncTreeColors();
    window.history.replaceState({}, '', `${window.location.pathname}?focus=${encodeURIComponent(id)}`);
    renderPanel(id);
  };

  const renderPanel = (id) => {
    const person = chartData.find((item) => item.id === id);
    if (!person) return;
    panel.innerHTML = formatPanel(person);
  };

  card.setOnCardClick((event, d) => {
    const record = d.data?.data ?? d.data ?? {};
    const id = record.id || d.data?.id;
    if (!id) return;
    centerPerson(id);
  });

  panel.innerHTML = formatPanel(chartData.find((person) => person.id === focusId) || chartData[0]);

  document.getElementById('tree-container').addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest('.tree-card-center-btn');
    if (!button) return;
    event.stopPropagation();
    event.stopImmediatePropagation();
    const personId = button.dataset.personId;
    if (personId) {
      centerPerson(personId);
    }
  }, true);

  document.getElementById('tree-reset').addEventListener('click', () => centerPerson(focusId));

  document.getElementById('tree-zoom-in').addEventListener('click', () => {
    chart.svg.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, bubbles: true }));
  });

  document.getElementById('tree-zoom-out').addEventListener('click', () => {
    chart.svg.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true }));
  });

  document.getElementById('tree-search-btn').addEventListener('click', () => {
    const selected = [...list.options].find((option) => option.value.toLowerCase() === searchInput.value.trim().toLowerCase());
    if (selected) {
      centerPerson(selected.dataset.personId);
    }
  });

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const selected = [...list.options].find((option) => option.value.toLowerCase() === searchInput.value.trim().toLowerCase());
      if (selected) centerPerson(selected.dataset.personId);
    }
  });

  centerPerson(focusId);
}

renderHeader('tree');

loadTree().catch((error) => {
  const errorState = document.createElement('main');
  errorState.className = 'page-shell';
  const message = document.createElement('div');
  message.className = 'empty-state';
  message.textContent = error.message;
  errorState.appendChild(message);
  app.appendChild(errorState);
});
