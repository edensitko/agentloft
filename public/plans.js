// Floor plans: how big the building is, where every room stands and where the shared areas are. No three.js, so it can be tested in node.
// Rooms are given by their edges. Shared areas are given as a shift from where they stand in the first plan.
const r = (name, x0, z0, x1, z1, door, skip = '', kind) => ({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, door, name, skip: [...skip], ...(kind ? { kind } : {}) });
/** n rooms side by side along the back wall, from x0 to x1. */
const backRow = (n, x0, x1, z0, d, lastSkip = '') => Array.from({ length: n }, (_, i) => { const w = (x1 - x0) / n; return r(`Back room ${i + 1}`, x0 + i * w, z0, x0 + (i + 1) * w, z0 + d, 's', 'nw' + (i === n - 1 ? lastSkip : '')); });
/** n rooms one behind the other along the right or left wall. */
const column = (side, n, x0, x1, z0, z1) => Array.from({ length: n }, (_, i) => { const d = (z1 - z0) / n; return r(`${side === 'e' ? 'Right' : 'Left'} room ${i + 1}`, x0, z0 + i * d, x1, z0 + (i + 1) * d, side === 'e' ? 'w' : 'e', side + 's'); });
const plant = (x, z, big) => ({ type: big ? 'plantB' : 'plantA', x, z, ry: 0, s: 1 });

export const PLANS = {
  atrium: { name: 'Atrium', about: 'A large hall in the middle, rooms on three sides', floor: [58, 42], ground: 'floor', wall: null,
    slots: [r('Main hall', -13.5, -9, 4.5, 4, 's', '', 'hall'), r('Executive office', 16, -21, 29, -11.8, 's', 'new', 'boss'), ...backRow(4, -29, 5, -21, 8.5, 'e'), ...column('e', 4, 18.5, 29, -9.2, 21), ...column('w', 2, -29, -18.5, 5.6, 21),
      r('Middle room 1', 4.5, -9, 12.5, -2.5, 'e', 'ws'), r('Middle room 2', 4.5, -2.5, 12.5, 4, 'e', 'w'), r('Front room', 8, 13.4, 15, 21, 'w', 's')],
    meeting: r('', 5, -21, 16, -11.8, 's', 'n'), kitchen: [0, 0], lounge: [0, 0], reception: [0, 0], booths: [13.6, 8.4],
    plants: [plant(-14.2, 16.6), plant(-4, 19.6, 1), plant(4, 19.6, 1), plant(-27.6, -10.6, 1), plant(14.6, -8, 1)] },
  loft: { name: 'Loft', about: 'One open floor, with a few rooms around it', floor: [48, 34], ground: 'concrete', wall: '#b9a99a',
    slots: [r('Main hall', -9, -6.5, 9, 5, 's', '', 'hall'), r('Executive office', 11, -17, 24, -7.8, 'w', 'ne', 'boss'), r('Right room 1', 13, 2.6, 24, 9.8, 'w', 'es'), r('Right room 2', 13, 9.8, 24, 17, 'w', 'es'), ...backRow(3, -24, 5, -17, 7.6), r('Left room 1', -24, 9, -14.5, 17, 'e', 'ws')],
    meeting: r('', 13, -7.2, 24, 2, 'w', 'e'), kitchen: [5, 4], lounge: [0, 0.5], reception: [0, 0.6], plants: [plant(9.6, -15.4, 1), plant(11, 16, 1), plant(-13, 7.4), plant(-4, 15.8, 1), plant(7.4, 7.2)] },
  courtyard: { name: 'Courtyard', about: 'Rooms all around an indoor garden', floor: [62, 46], ground: 'floor', wall: '#e9ebe0', garden: [3, -2.6, 24, 12.4],
    slots: [r('Main hall', -17, 7, 1, 18, 's', '', 'hall'), r('Executive office', 18, -23, 31, -13.8, 's', 'new', 'boss'), ...backRow(4, -31, 7, -23, 8.5, 'e'), ...column('e', 4, 20.5, 31, -11, 23), ...column('w', 2, -31, -20.5, 7, 23),
      r('Middle room 1', 8, 7, 16, 13.5, 'e', 's'), r('Middle room 2', 8, 13.5, 16, 20, 'e', ''), r('Front room', -17, -8.4, -10.4, -0.6, 'w', '')],
    meeting: r('', 7, -23, 18, -13.8, 's', 'n'), kitchen: [-2, 0], lounge: [11, -14.8], reception: [0.5, 6.6],
    plants: [plant(-7, -7.6), plant(13.4, -7.6, 1), plant(-7, 2.4, 1), plant(13.4, 2.4), plant(-1.8, -7.8, 1), plant(8.2, -7.8), plant(4.6, 21.4, 1), plant(-4.6, 21.4, 1)] },
  shore: { name: 'Shoreline', about: 'Long and narrow: every room has the view', floor: [56, 28], ground: 'stone', wall: '#f3efe6',
    slots: [r('Main hall', -3, -1.6, 15, 8.4, 's', '', 'hall'), r('Executive office', 15, -14, 28, -4.8, 's', 'new', 'boss'), ...backRow(4, -28, 4, -14, 8.5, 'e'), ...column('e', 2, 17.8, 28, -1.4, 14)],
    meeting: r('', 4, -14, 15, -4.8, 's', 'n'), kitchen: [1, 5.6], lounge: [-2.4, -3.6], reception: [4, -1.4], plants: [plant(-5, 12.4, 1), plant(4.2, 12.6, 1), plant(16.4, 12.6, 1), plant(-16, -4, 1), plant(-15.6, 12.4, 1)] },
  corridor: { name: 'Long corridors', about: 'Rows of closed rooms and quiet corridors', floor: [60, 44], ground: 'herring', wall: '#ded3bf',
    slots: [r('Main hall', -3, 2.4, 15, 13.4, 's', '', 'hall'), r('Executive office', 17, -22, 30, -12.8, 's', 'new', 'boss'), ...backRow(4, -30, 6, -22, 9.2, 'e'), ...column('e', 4, 19.4, 30, -9.4, 22), ...column('w', 2, -30, -19.4, 7, 22),
      r('Middle room 1', -15.5, -9.4, -5, -1.6, 's', ''), r('Middle room 2', -5, -9.4, 5.5, -1.6, 's', 'w'), r('Middle room 3', 5.5, -9.4, 16, -1.6, 's', 'w')],
    meeting: r('', 6, -22, 17, -12.8, 's', 'n'), kitchen: [-1, 0.6], lounge: [-3.2, 1.6], reception: [4, 5.6], plants: [plant(-4.4, 20.4, 1), plant(13.6, 20.4, 1), plant(-17.4, 20.4), plant(17.6, 0, 1), plant(-17, -11, 1)] },
  core: { name: 'Core', about: 'Everything turns around one dark centre', floor: [50, 38], ground: 'dark', wall: '#4b505b',
    slots: [r('Main hall', -9, -7, 9, 5.4, 's', '', 'hall'), r('Executive office', 12, -19, 25, -9.8, 's', 'new', 'boss'), ...backRow(2, -25, 1, -19, 8.6, 'e'), ...column('e', 3, 14.5, 25, -6.6, 19), r('Left room 1', -25, 10, -14.5, 19, 'e', 'ws')],
    meeting: r('', 1, -19, 12, -9.8, 's', 'n'), kitchen: [4, 1.6], lounge: [-1, 2], reception: [3, 3.6], plants: [plant(-4, 17.6, 1), plant(12.6, 17.4, 1), plant(11.6, -7.8, 1), plant(-13, 7.6)] },
  cabin: { name: 'Cabin', about: 'Small and warm, for one person and a few agents', floor: [36, 28], ground: 'herring', wall: '#c9a27c',
    slots: [r('Right room 1', 8, -2.2, 18, 5.9, 'w', 'es'), r('Executive office', 5, -14, 18, -4.8, 's', 'new', 'boss'), r('Back room 1', -18, -14, -6, -5.5, 's', 'nwe'), r('Right room 2', 8, 5.9, 18, 14, 'w', 'es')],
    meeting: r('', -6, -14, 5, -4.8, 's', 'n'), kitchen: [11, 6], lounge: [9, -2.6], reception: [-1.6, -13.6], plants: [plant(6.4, 12.8, 1), plant(-5.4, 12.8, 1), plant(-16.6, -4, 1), plant(6.6, -2.6)] },
};
