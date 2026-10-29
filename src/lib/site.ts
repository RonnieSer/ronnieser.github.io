import { getCollection, getEntry } from 'astro:content';

export const url = (path = '') => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

export function formatResearchDate(date: string) {
  const hasDay = date.length === 10;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: hasDay ? 'numeric' : undefined, year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${hasDay ? date : `${date}-01`}T00:00:00Z`));
}

export async function page(id: 'home' | 'about') {
  const entry = await getEntry('page', id);
  if (!entry) throw new Error(`Missing content/${id}/index.md`);
  return entry;
}

export async function research() {
  return (await getCollection('research', ({ data }) => !data.draft))
    .sort((a, b) => {
      const aDate = a.data.date || String(a.data.year || '');
      const bDate = b.data.date || String(b.data.year || '');
      return bDate.localeCompare(aDate) || a.data.order - b.data.order || a.data.title.localeCompare(b.data.title);
    });
}

export async function selectedResearch() {
  const home = await page('home');
  const entries = await research();
  if (home.data.selected === undefined) return entries;
  const selectedIds = new Set(home.data.selected);
  for (const id of selectedIds) {
    if (!entries.some((entry) => entry.id === id)) {
      throw new Error(`Home selected entry "${id}" is missing or a draft. Update content/home/index.md.`);
    }
  }
  return entries.filter((entry) => selectedIds.has(entry.id));
}
