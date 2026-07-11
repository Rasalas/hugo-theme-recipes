const test = require('node:test');
const assert = require('node:assert/strict');

const { highlightSegments } = require('../static/js/search-utils.js');

test('highlightSegments treats search syntax as literal text', () => {
    assert.deepEqual(highlightSegments('Salz (fein) + Pfeffer', '(fein) +'), [
        { text: 'Salz ', highlighted: false },
        { text: '(fein) +', highlighted: true },
        { text: ' Pfeffer', highlighted: false },
    ]);
});

test('highlightSegments never interprets indexed HTML', () => {
    assert.deepEqual(highlightSegments('<img src=x onerror=alert(1)>', 'img'), [
        { text: '<', highlighted: false },
        { text: 'img', highlighted: true },
        { text: ' src=x onerror=alert(1)>', highlighted: false },
    ]);
});
