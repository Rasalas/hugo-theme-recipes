const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildSearchUrl,
    durationFilterAvailable,
    filterResultsByDuration,
    filterResultsByTag,
    highlightSegments,
    normalizeSearchTerm,
    parseSearchState,
    uniqueResults,
} = require('../static/js/search-utils.js');

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

test('highlightSegments matches German characters without changing the text', () => {
    assert.deepEqual(highlightSegments('SÜẞ und süß', 'süß'), [
        { text: 'SÜẞ', highlighted: true },
        { text: ' und ', highlighted: false },
        { text: 'süß', highlighted: true },
    ]);
});

test('normalizeSearchTerm trims input and enforces query boundaries', () => {
    assert.equal(normalizeSearchTerm('  Hefe  '), 'Hefe');
    assert.equal(normalizeSearchTerm('x'), '');
    assert.equal(normalizeSearchTerm('x'.repeat(101)), 'x'.repeat(100));
    assert.equal(normalizeSearchTerm(null), '');
});

test('parseSearchState normalizes direct URL parameters', () => {
    assert.deepEqual(parseSearchState('?q=%20K%C3%A4se%20&tag=S%C3%BC%C3%9F'), {
        query: 'Käse',
        tag: 'Süß',
        duration: '',
    });
    assert.deepEqual(parseSearchState('?q=%5B'), { query: '', tag: '', duration: '' });
});

test('buildSearchUrl preserves unrelated parameters and removes empty search state', () => {
    assert.equal(
        buildSearchUrl('https://example.test/?page=2', { query: '.*', tag: 'backen', duration: 30 }),
        'https://example.test/?page=2&q=.*&tag=backen&duration=30',
    );
    assert.equal(
        buildSearchUrl('https://example.test/?page=2&q=alt&tag=suppe&duration=60', { query: '', tag: '', duration: '' }),
        'https://example.test/?page=2',
    );
});

test('filterResultsByTag combines exact tag filtering with Fuse results', () => {
    const results = [
        { item: { permalink: '/a/', tags: ['Backen', 'Süß'] }, score: 0.1 },
        { item: { permalink: '/b/', tags: ['Suppe'] }, score: 0.2 },
    ];
    assert.deepEqual(filterResultsByTag(results, 'süß'), [results[0]]);
    assert.deepEqual(filterResultsByTag(results, ''), results);
});

test('uniqueResults keeps the first result for each permalink', () => {
    const first = { item: { permalink: '/a/' }, score: 0.1 };
    const duplicate = { item: { permalink: '/a/' }, score: 0.2 };
    const second = { item: { permalink: '/b/' }, score: 0.3 };
    assert.deepEqual(uniqueResults([first, duplicate, second]), [first, second]);
});

test('duration filter only includes recipes with a known total within the limit', () => {
    const results = [
        { item: { permalink: '/quick/', durationMinutes: 25 } },
        { item: { permalink: '/slow/', durationMinutes: 90 } },
        { item: { permalink: '/unknown/' } },
    ];
    assert.deepEqual(filterResultsByDuration(results, 30), [results[0]]);
    assert.deepEqual(filterResultsByDuration(results, ''), results);
});

test('duration filter requires useful index coverage', () => {
    const sufficientlyCovered = Array.from({ length: 10 }, (_, index) => ({
        durationMinutes: index < 3 ? 30 : null,
    }));
    assert.equal(durationFilterAvailable(sufficientlyCovered), true);
    assert.equal(durationFilterAvailable(sufficientlyCovered.slice(0, 2).concat(Array(18).fill({}))), false);
});
