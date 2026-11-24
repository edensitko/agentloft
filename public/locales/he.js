// Hebrew. Each part of the interface keeps its own dictionary, so they can be edited side by side.
import app from './he/app.js';
import editor from './he/editor.js';
import shared from './he/shared.js';
import office from './he/office.js';
import server from './he/server.js';

export default { ...server, ...shared, ...office, ...editor, ...app };
