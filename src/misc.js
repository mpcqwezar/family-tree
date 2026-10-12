import './styles.css';
import { renderHeader } from './header.js';

const app = document.querySelector('#app');
const pseudoSurname = '? греческий князь';
const excludedSurnames = new Set(['пуринг', pseudoSurname.toLocaleLowerCase('ru')]);
const personSummaries = [
  {
    clan: 'Род Молчановых',
    people: [
      'Алексей Молчанов (р. между 1760–1770) — священник.',
      'Петр Алексеевич Молчанов (р. 1780–1790) — пономарь в Кашинском уезде.',
      'Павел Петрович Молчанов (р. 1808 – ум. 1833) — пономарь в селе Васьянское. Женат на Марфе Дмитриевне.',
      'Петр Павлович Молчанов (р. 1830) — псаломщик, служил 50 лет в Сретенской церкви, село Быково. Женат на Евдокии (Авдотье) Алексеевой.',
      'Александр Петрович Молчанов (р. 1862 – ум. 1930-е) — священник, настоятель, педагог, жена — София Прутенская.',
      'Павел Александрович Молчанов (1893–1941) — выдающийся метеоролог, профессор, изобретатель радиозонда, директор Аэрологического института. Жена — Надежда Петропавловская. В честь него названа улица в Павловске и корабль, участвующий в научных исследованиях.',
      'Андрей Павлович Молчанов (1918–1996) — радиоастроном, пионер наблюдений Солнца, профессор ЛГУ. Женат на Ирине Алексеевне Баранниковой.',
    ],
  },
  {
    clan: 'Род Баранниковых',
    people: [
      'Петр Иванович Баранников — сын греческого князя и украинки Ольги Александровны. Пелагея Францевна Гумеля — жена Петра, черкасская полячка.',
      'Алексей Петрович Баранников (1890–1952) — академик АН СССР, крупнейший индолог, переводчик «Рамаяны». Святой в Индии. Знал 40 языков, директор Института востоковедения. Муж Ольги Николаевны Никоновой. В честь него названа улица в Черкассах.',
      'Ирина Алексеевна Баранникова (1926–2017) — ихтиофизиолог, доктор наук, профессор СПбГУ, исследователь поведения и гормональной регуляции рыб, руководитель лаборатории в институте Ухтомского.',
    ],
  },
  {
    clan: 'Род Никоновых',
    people: [
      'Николай Никитич Никонов (1849–1918) — епархиальный архитектор Петербурга, построил более 50 храмов и домов. В честь него назван сквер в Комарово.',
      'Ольга Николаевна Никонова (1887–1969) — лингвист, преподаватель ЛГУ, автор учебников, директор женской гимназии. Жена Алексея Петровича Баранникова.',
    ],
  },
  {
    clan: 'Род Кахневичей',
    people: [
      'Михай Яковлевич Кахневич — поляк, сослан на Кавказ, говорил только по-польски. Женат на Евдокии Андреевне Табунщиковой, богатой купчихе из Украины, построившей с нуля бизнес.',
      'Павел Михайлович Кахневич (1895–1970-е) — бухгалтер. Женат на казачке Марии, хозяйство в Баксане.',
      'Лев Павлович Кахневич (1929–2014) — сын Павла и Маруси, женат на Антонине Фёдоровне Бороненко.',
    ],
  },
  {
    clan: 'Род Бороненко',
    people: [
      'Федор Бороненко — украинец из Полтавы.',
      'Елена Афонич — украинка из Винницы.',
      'Антонина Бороненко — один из главных экологов Ленинграда, общественный деятель, химик, труженик тыла с большим количеством наград, личная советница губернатора.',
    ],
  },
];

function getMasculineSurname(surname) {
  const endings = [
    [/ова$/i, 'ов'],
    [/ева$/i, 'ев'],
    [/ская$/i, 'ский'],
    [/ина$/i, 'ин'],
  ];

  for (const [ending, replacement] of endings) {
    if (ending.test(surname)) return surname.replace(ending, replacement);
  }

  return null;
}

function resolveDataUrl() {
  const base = import.meta.env.BASE_URL || './';
  return new URL(`${base}data/data.json`, window.location.href).toString();
}

function getAncestorSurnames(people, families) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const normalizedId = (id) => String(id || '').replace(/@/g, '');
  const ancestors = new Set();
  const queue = ['I500008'];

  while (queue.length) {
    const childId = queue.shift();
    for (const family of families) {
      if (!(family.children || []).some((id) => normalizedId(id) === childId)) continue;
      for (const parentId of [family.husband, family.wife].map(normalizedId)) {
        if (peopleById.has(parentId) && !ancestors.has(parentId)) {
          ancestors.add(parentId);
          queue.push(parentId);
        }
      }
    }
  }

  const surnames = new Map();
  for (const id of ancestors) {
    const surname = String(peopleById.get(id)?.surname || '').trim();
    const normalizedSurname = surname.toLocaleLowerCase('ru');
    if (!surname || excludedSurnames.has(normalizedSurname)) continue;
    surnames.set(normalizedSurname, surname);
  }

  const surnameValues = [...surnames.values()];
  const masculineSurnames = new Set(surnameValues.map((surname) => surname.toLocaleLowerCase('ru')));
  const uniqueSurnames = surnameValues.filter((surname) => {
    const masculineSurname = getMasculineSurname(surname);
    return !masculineSurname || !masculineSurnames.has(masculineSurname.toLocaleLowerCase('ru'));
  });

  return uniqueSurnames.sort((a, b) => a.localeCompare(b, 'ru'));
}

function renderSurnames(surnames) {
  const main = document.createElement('main');
  main.className = 'page-shell';

  const summariesHeading = document.createElement('h2');
  summariesHeading.className = 'misc-section-heading';
  summariesHeading.textContent = 'Краткое описание лиц';

  const summaries = document.createElement('div');
  summaries.className = 'person-summaries';
  for (const section of personSummaries) {
    const article = document.createElement('section');
    article.className = 'person-summary-section';

    const sectionHeading = document.createElement('h3');
    sectionHeading.textContent = section.clan;

    const peopleList = document.createElement('ul');
    for (const person of section.people) {
      const item = document.createElement('li');
      item.textContent = person;
      peopleList.appendChild(item);
    }

    article.append(sectionHeading, peopleList);
    summaries.appendChild(article);
  }

  const surnamesHeading = document.createElement('h2');
  surnamesHeading.className = 'misc-section-heading';
  surnamesHeading.textContent = 'Фамилии';

  const list = document.createElement('ul');
  list.className = 'surname-list';
  for (const surname of surnames) {
    const item = document.createElement('li');
    item.textContent = surname;
    list.appendChild(item);
  }

  main.append(summariesHeading, summaries, surnamesHeading, list);
  app.appendChild(main);
}

function renderError(error) {
  const main = document.createElement('main');
  main.className = 'page-shell';

  const message = document.createElement('div');
  message.className = 'empty-state';
  message.textContent = `Не удалось загрузить данные семьи: ${error.message}`;
  main.appendChild(message);
  app.appendChild(main);
}

async function loadSurnames() {
  try {
    const response = await fetch(resolveDataUrl());
    if (!response.ok) throw new Error(`Ошибка загрузки данных (${response.status})`);

    const data = await response.json();
    if (!Array.isArray(data?.people) || !Array.isArray(data?.families)) {
      throw new Error('В файле данных отсутствуют люди или семейные связи.');
    }

    renderSurnames(getAncestorSurnames(data.people, data.families));
  } catch (error) {
    renderError(error);
  }
}

renderHeader('misc');
loadSurnames();
