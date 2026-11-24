// Complete offices: a company, a look for every room, furniture, light, and what is outside the windows, all in one choice.
// Names and descriptions are English here and go through t() where they are shown.
import { PLANS } from './plans.js';

export const OFFICE_TEMPLATES = [
  { id: 'startup', plan: 'loft', name: 'Startup loft', about: 'A product company in a bright loft in the city: brick, warm wood and strong colours.', company: 'product',
    styles: ['industrial', 'creative', 'modern', 'tech'], by: { exec: 'modern', dev: 'industrial', ai: 'tech', design: 'creative', product: 'boho' }, accents: ['#c96f4a', '#3f8f86', '#5b6fb5', '#c79a3a', '#8f5a8a'], floor: 'wood',
    scene: { mood: 'day', outside: 'city', glow: 0.14 } },
  { id: 'campus', plan: 'courtyard', name: 'Green campus', about: 'A full company surrounded by trees: plants everywhere, natural wood and soft green.', company: 'full',
    styles: ['nature', 'boho', 'modern', 'library'], by: { exec: 'classic', it: 'server', dev: 'nature' }, accents: ['#4f6f52', '#6f8a5c', '#8a9a6a', '#5f7f76', '#3f5a48'], floor: 'wood',
    scene: { mood: 'day', outside: 'campus' } },
  { id: 'studio', palms: true, plan: 'shore', name: 'Beach studio', about: 'A digital studio by the sea: light rooms, stone floors and a palm at every corner.', company: 'studio',
    styles: ['boho', 'modern', 'social', 'studio'], by: { exec: 'modern', design: 'creative', ops: 'tech' }, accents: ['#3f7f94', '#d8b98a', '#6ba0a5', '#c98d66', '#e0d2b8'], floor: 'stone',
    scene: { mood: 'sunset', outside: 'beach', glow: 0.2 } },
  { id: 'classic', plan: 'corridor', name: 'Classic firm', about: 'A full company in a quiet suburb: dark wood, libraries and warm evening light.', company: 'full',
    styles: ['classic', 'library', 'classic', 'modern'], by: { exec: 'classic', it: 'server', design: 'studio' }, accents: ['#8a5a3c', '#a0764e', '#6f5a44', '#94694a', '#7a4f3c'], floor: 'wood',
    scene: { mood: 'sunset', outside: 'suburb' } },
  { id: 'night', plan: 'core', name: 'Night lab', about: 'A product company at night: dark rooms, neon, servers and the lights of the city.', company: 'product',
    styles: ['tech', 'server', 'studio', 'tech'], by: { exec: 'modern', design: 'studio' }, accents: ['#2f3b45', '#3a3f4a', '#26343a', '#443b4a', '#34404a'], floor: 'carpet',
    scene: { mood: 'night', outside: 'city', glow: 0.32, light: 1.2 } },
  { id: 'cabin', plan: 'cabin', name: 'Mountain retreat', about: 'One person and a few agents, in a small office between the mountains.', company: 'solo',
    styles: ['nature', 'library', 'boho', 'classic'], by: { exec: 'library', dev: 'nature' }, accents: ['#6f8a5c', '#94694a', '#7f9184', '#b5765a', '#5f7f76'], floor: 'wood',
    scene: { mood: 'day', outside: 'mountains' } },
];

/** The design part of a template for the company it is used with: a look for every department, the furniture and the scene. */
export function officeDesign(tpl, company) {
  const rooms = Object.fromEntries(Object.keys(company.depts).map((k, i) => ['co:' + k, { style: tpl.by[k] ?? tpl.styles[i % tpl.styles.length], accent: tpl.accents[i % tpl.accents.length], floor: tpl.floor }]));
  return { items: PLANS[tpl.plan].plants.map((it, i) => ({ ...it, type: tpl.palms ? 'plantB' : it.type, id: 'o' + i })), rooms, scene: { ...tpl.scene, plan: tpl.plan } };
}
