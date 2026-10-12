export function getPersonDisplayName(person, people = [], families = []) {
  const given = String(person?.given || '').trim();
  const surname = String(person?.surname || '').trim();

  if (given && surname) return `${given} ${surname}`;

  if (surname && !given) {
    const unknownGiven = person?.sex === 'F' ? 'Неизвестная' : 'Неизвестный';
    return `${unknownGiven} ${surname}`;
  }

  if (given) {
    const personId = String(person?.id || '').replace(/^@|@$/g, '');
    const spouseFamilyIds = new Set(
      (person?.families?.spouse || []).map((id) => String(id).replace(/^@|@$/g, ''))
    );

    for (const family of families) {
      if (!spouseFamilyIds.has(String(family.id).replace(/^@|@$/g, ''))) continue;

      const spouseId = [family.husband, family.wife]
        .map((id) => String(id || '').replace(/^@|@$/g, ''))
        .find((id) => id && id !== personId);
      const spouse = spouseId
        ? people.find((item) => String(item.id).replace(/^@|@$/g, '') === spouseId)
        : null;
      const spouseNameParts = String(spouse?.name || '').trim().split(/\s+/).filter(Boolean);
      const spouseSurname = String(spouse?.surname || '').trim()
        || (spouseNameParts.length > 1 ? spouseNameParts.at(-1) : '');

      if (spouseSurname) return `${given} ${spouseSurname}`;
    }

    return given;
  }

  return String(person?.name || '').trim() || 'Неизвестно';
}
