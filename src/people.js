import './styles.css';
import { renderHeader } from './header.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { getPersonDisplayName } from './person-name.js';

const app = document.querySelector('#app');

const STORAGE_KEY = `family-tree-people:${window.location.pathname.replace(/\/+$/, '') || 'root'}`;

function resolveDataUrl() {
  const base = import.meta.env.BASE_URL || './';
  return new URL(`${base}data/data.json`, window.location.href).toString();
}

function getYearsLabel(person) {
  const birthYear = (person?.birthDate || '').match(/\d{4}/)?.[0] || '';
  const deathYear = (person?.deathDate || '').match(/\d{4}/)?.[0] || '';

  if (person?.living) {
    return birthYear ? `род. ${birthYear}` : 'род. —';
  }

  if (birthYear && deathYear) {
    return `${birthYear}–${deathYear}`;
  }

  if (birthYear) {
    return `род. ${birthYear}`;
  }

  return '—';
}

function getComment(person) {
  const comment = person?.extra?.comment;
  return comment ? getPlainText(comment) : getPlainNotes(person).split('\n')[0] || '';
}

function getPlainText(value) {
  const body = new DOMParser().parseFromString(String(value), 'text/html').body;
  body.querySelectorAll('br').forEach((element) => element.replaceWith('\n'));
  body.querySelectorAll('p, div, li').forEach((element) => element.append('\n'));
  return body.textContent?.replace(/\u00a0/g, ' ').replace(/[ \t]*\n[ \t]*/g, '\n').trim() || '';
}

function getPlainNotes(person) {
  return (person?.notes || [])
    .map(getPlainText)
    .filter(Boolean)
    .join('\n\n');
}

function buildPhotoUrl(person, fileName) {
  if (!fileName) return createPlaceholder(person?.sex || 'M');

  const personId = person?.id || 'unknown';
  const base = import.meta.env.BASE_URL || './';
  return new URL(`${base}photos/${personId}/${fileName}`, window.location.href).toString();
}

function createPlaceholder(sex = 'M') {
  const color = sex === 'F' ? '#ddc4d1' : '#b7d9eb';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#f2f0ea"/>
      <circle cx="100" cy="68" r="36" fill="${color}"/>
      <path d="M46 172c8-30 30-44 54-44s48 14 54 44H46z" fill="${color}"/>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function safeMarkdown(markdown) {
  const html = marked.parse(markdown || '', { breaks: true, gfm: true });
  return DOMPurify.sanitize(String(html));
}

function getGroupName(person) {
  return person?.extra?.clan || 'Без рода';
}

function shouldShowInList(person) {
  if (person?.extra?.list === true) return true;
  return person?.extra?.list !== false && !person?.extra?.clan;
}

function sortGroups(groups) {
  const groupOrder = [
    'Род Молчановых',
    'Род Наипрекраснейшей Женщины',
    'Род Баранниковых',
    'Род Кахневич',
    'Род Бороненко',
    'Род Никоновых',
    'Род Шестерниных',
    'Род Тахтаджян',
  ];
  const orderIndex = new Map(groupOrder.map((name, index) => [name, index]));

  return groups.sort(([left], [right]) => {
    if (left === 'Без рода') return 1;
    if (right === 'Без рода') return -1;
    const leftIndex = orderIndex.get(left);
    const rightIndex = orderIndex.get(right);
    if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;
    if (leftIndex !== undefined) return -1;
    if (rightIndex !== undefined) return 1;
    return left.localeCompare(right, 'ru');
  });
}

function hasDescription(person) {
  return typeof person?.extra?.details === 'string' && person.extra.details.trim().length > 0;
}

function getVisibleGroups(people, families, onlyWikipedia, onlyDescription, searchTerm) {
  const groups = new Map();
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase('ru');

  for (const person of people) {
    if (!shouldShowInList(person)) continue;
    if (onlyWikipedia && !person?.extra?.wikipedia) continue;
    if (onlyDescription && !hasDescription(person)) continue;
    const searchableName = getPersonDisplayName(person, people, families).toLocaleLowerCase('ru');
    if (normalizedSearch && !searchableName.includes(normalizedSearch)) continue;
    const groupName = getGroupName(person);
    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    groups.get(groupName).push(person);
  }

  const result = [...groups.entries()].map(([name, list]) => {
    list.sort((a, b) => {
      const yearOfLife = (person) => {
        const year = (person.birthDate || person.deathDate || '').match(/\d{4}/)?.[0];
        return year ? Number(year) : Infinity;
      };
      return yearOfLife(a) - yearOfLife(b)
        || getPersonDisplayName(a, people, families).localeCompare(getPersonDisplayName(b, people, families), 'ru');
    });
    return [name, list];
  });

  return sortGroups(result);
}

function setGroupState(groupElement, expanded) {
  groupElement.dataset.expanded = String(expanded);
  const toggle = groupElement.querySelector('.group-toggle');
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(expanded));
  }
}

function renderRow(person, people, families, expanded = false) {
  const row = document.createElement('article');
  row.className = 'person-row';
  row.dataset.personId = person.id;
  row.setAttribute('data-expanded', String(expanded));

  const summaryButton = document.createElement('button');
  summaryButton.type = 'button';
  summaryButton.className = 'person-summary';
  summaryButton.setAttribute('aria-expanded', String(expanded));
  summaryButton.setAttribute('aria-controls', `person-details-${person.id}`);

  const photo = document.createElement('img');
  photo.className = 'person-photo';
  photo.alt = getPersonDisplayName(person, people, families);
  photo.src = buildPhotoUrl(person, person?.extra?.photo || '');
  photo.loading = 'lazy';
  photo.onerror = () => {
    photo.src = createPlaceholder(person?.sex || 'M');
  };

  const nameBlock = document.createElement('div');
  nameBlock.className = 'person-name-block';
  const name = document.createElement('span');
  name.className = 'person-name';
  name.textContent = getPersonDisplayName(person, people, families);
  const years = document.createElement('span');
  years.className = 'person-years';
  years.textContent = getYearsLabel(person);
  nameBlock.append(name, years);

  const comment = document.createElement('div');
  comment.className = 'person-comment';
  comment.textContent = getComment(person) || '—';

  const place = document.createElement('div');
  place.className = 'person-place';
  place.textContent = person?.birthPlace || 'Место не указано';

  const expandMarker = document.createElement('span');
  expandMarker.className = 'expand-marker';
  expandMarker.textContent = expanded ? '▾' : '▸';

  summaryButton.append(photo, nameBlock, comment, place, expandMarker);

  const details = document.createElement('div');
  details.id = `person-details-${person.id}`;
  details.className = 'person-details';
  details.hidden = !expanded;

  const detailsWrap = document.createElement('div');
  detailsWrap.className = 'person-details-wrap';

  const content = document.createElement('div');
  content.className = 'person-text';
  const detailsMarkdown = person?.extra?.details || getPlainNotes(person) || 'Подробностей нет.';
  content.innerHTML = safeMarkdown(detailsMarkdown);

  const meta = document.createElement('div');
  meta.className = 'person-meta';

  const occupation = document.createElement('div');
  occupation.className = 'meta-item';
  occupation.innerHTML = `<strong>Профессия:</strong> ${person?.occupation || person?.extra?.occupation || '—'}`;

  const relation = document.createElement('div');
  relation.className = 'meta-item';
  const birthLabel = person?.sex === 'F' ? 'Родилась' : 'Родился';
  relation.innerHTML = `<strong>${birthLabel}:</strong> ${person?.birthDate || '—'}${person?.birthPlace ? `, ${person.birthPlace}` : ''}`;

  if (person?.deathDate || person?.deathPlace) {
    const death = document.createElement('div');
    death.className = 'meta-item';
    death.innerHTML = `<strong>Умер:</strong> ${person?.deathDate || '—'}${person?.deathPlace ? `, ${person.deathPlace}` : ''}`;
    meta.append(death);
  }

  const links = document.createElement('div');
  links.className = 'person-links';

  if (person?.extra?.link) {
    const link = document.createElement('a');
    link.href = person.extra.link;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = 'Внешняя ссылка';
    links.appendChild(link);
  }

  if (person?.extra?.wikipedia) {
    const wiki = document.createElement('a');
    wiki.href = person.extra.wikipedia;
    wiki.target = '_blank';
    wiki.rel = 'noreferrer';
    wiki.textContent = 'Wikipedia';
    links.appendChild(wiki);
  }

  const treeButton = document.createElement('a');
  treeButton.href = `./index.html?focus=${person.id}`;
  treeButton.className = 'tree-link';
  treeButton.textContent = 'Показать в древе';

  meta.append(occupation, relation, links, treeButton);
  detailsWrap.append(content, meta);
  details.appendChild(detailsWrap);

  const gallery = person?.extra?.gallery || [];
  if (gallery.length) {
    const galleryWrap = document.createElement('div');
    galleryWrap.className = 'gallery';

    for (const imageName of gallery) {
      const slide = document.createElement('button');
      slide.type = 'button';
      slide.className = 'gallery-item';
      slide.setAttribute('aria-label', `Увеличить фото ${imageName}`);

      const img = document.createElement('img');
      img.src = buildPhotoUrl(person, imageName);
      img.alt = `${getPersonDisplayName(person, people, families)} — фото`;
      img.loading = 'lazy';
      img.onerror = () => {
        img.src = createPlaceholder(person?.sex || 'M');
      };

      slide.appendChild(img);
      galleryWrap.appendChild(slide);
    }

    detailsWrap.appendChild(galleryWrap);
  }

  row.append(summaryButton, details);

  summaryButton.addEventListener('click', () => {
    const nextExpanded = !row.dataset.expanded || row.dataset.expanded === 'false';
    row.dataset.expanded = String(nextExpanded);
    summaryButton.setAttribute('aria-expanded', String(nextExpanded));
    details.hidden = !nextExpanded;
    expandMarker.textContent = nextExpanded ? '▾' : '▸';
    const storage = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    storage[person.id] = nextExpanded;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  });

  return row;
}

function renderListPage(people, families) {
  const listedPeople = people.filter(shouldShowInList);
  const page = document.createElement('main');
  page.className = 'page-shell page-list';

  const topBar = document.createElement('div');
  topBar.className = 'toolbar';

  const filter = document.createElement('label');
  filter.className = 'wiki-filter';
  filter.innerHTML = '<input type="checkbox" /> Только с Википедией';

  const descriptionFilter = document.createElement('label');
  descriptionFilter.className = 'wiki-filter';
  descriptionFilter.innerHTML = '<input type="checkbox" /> Только с описанием';

  const search = document.createElement('input');
  search.className = 'people-search';
  search.type = 'search';
  search.placeholder = 'Поиск по имени или фамилии';
  search.setAttribute('aria-label', 'Поиск по имени или фамилии');

  const count = document.createElement('div');
  count.className = 'people-count';

  topBar.append(search, filter, descriptionFilter, count);
  page.appendChild(topBar);

  const groupsRoot = document.createElement('div');
  groupsRoot.className = 'people-groups';
  page.appendChild(groupsRoot);

  function navigateToHash() {
    const personId = window.location.hash.slice(1);
    if (!personId) return;

    const target = [...groupsRoot.querySelectorAll('[data-person-id]')]
      .find((row) => row.dataset.personId === personId);
    if (!target) return;

    const group = target.closest('.person-group');
    const groupList = group?.querySelector('.group-list');
    if (group && groupList?.hidden) {
      const storage = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const groupName = group.dataset.group;
      group.dataset.expanded = 'true';
      group.querySelector('.group-toggle')?.setAttribute('aria-expanded', 'true');
      groupList.hidden = false;
      storage[`group:${groupName}`] = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    }

    if (target.dataset.expanded !== 'true') {
      target.querySelector('.person-summary')?.click();
    }

    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function refresh() {
    const onlyWikipedia = filter.querySelector('input').checked;
    const onlyDescription = descriptionFilter.querySelector('input').checked;
    const visibleGroups = getVisibleGroups(people, families, onlyWikipedia, onlyDescription, search.value);
    groupsRoot.innerHTML = '';

    if (!visibleGroups.length) {
      groupsRoot.innerHTML = '<div class="empty-state">Люди не найдены. Измените запрос или фильтр.</div>';
      count.textContent = `Показано 0 из ${listedPeople.length}`;
      return;
    }

    count.textContent = `Показано ${visibleGroups.reduce((sum, [, list]) => sum + list.length, 0)} из ${listedPeople.length}`;

    for (const [groupName, list] of visibleGroups) {
      const group = document.createElement('section');
      group.className = 'person-group';
      group.dataset.group = groupName;

      const groupHeader = document.createElement('button');
      groupHeader.type = 'button';
      groupHeader.className = 'group-toggle';
      const storage = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const expanded = storage[`group:${groupName}`] !== false;
      groupHeader.setAttribute('aria-expanded', String(expanded));
      groupHeader.innerHTML = `<span>${groupName}</span><span class="group-count">${list.length}</span>`;

      const listWrap = document.createElement('div');
      listWrap.className = 'group-list';

      for (const person of list) {
        const expanded = !!storage[person.id];
        const row = renderRow(person, people, families, expanded);
        listWrap.appendChild(row);
      }

      groupHeader.addEventListener('click', () => {
        const isExpanded = group.dataset.expanded !== 'false';
        group.dataset.expanded = String(!isExpanded);
        setGroupState(group, !isExpanded);
        listWrap.hidden = isExpanded;
        storage[`group:${groupName}`] = !isExpanded;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
      });

      group.dataset.expanded = String(expanded);
      listWrap.hidden = !expanded;
      group.append(groupHeader, listWrap);
      groupsRoot.appendChild(group);
    }

    navigateToHash();
  }

  const wikipediaCheckbox = filter.querySelector('input');
  const descriptionCheckbox = descriptionFilter.querySelector('input');

  wikipediaCheckbox.addEventListener('change', () => {
    if (wikipediaCheckbox.checked) descriptionCheckbox.checked = false;
    refresh();
  });
  descriptionCheckbox.addEventListener('change', () => {
    if (descriptionCheckbox.checked) wikipediaCheckbox.checked = false;
    refresh();
  });
  search.addEventListener('input', refresh);
  window.addEventListener('hashchange', navigateToHash);
  refresh();

  app.appendChild(page);
}

async function loadPeople() {
  const url = resolveDataUrl();

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Ошибка загрузки данных (${response.status})`);
    }

    const data = await response.json();
    const people = Array.isArray(data?.people) ? data.people : [];

    if (!people.length) {
      const emptyState = document.createElement('main');
      emptyState.className = 'page-shell';
      emptyState.innerHTML = '<div class="empty-state">Не удалось загрузить список людей: данные пусты.</div>';
      app.appendChild(emptyState);
      return;
    }

    const families = Array.isArray(data?.families) ? data.families : [];
    renderListPage(people, families);
  } catch (error) {
    const errorState = document.createElement('main');
    errorState.className = 'page-shell';
    const message = document.createElement('div');
    message.className = 'empty-state';
    message.textContent = `Не удалось загрузить данные семьи: ${error.message}`;
    errorState.appendChild(message);
    app.appendChild(errorState);
  }
}

renderHeader('people');
loadPeople();
