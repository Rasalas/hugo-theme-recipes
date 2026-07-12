const test = require('node:test');
const assert = require('node:assert/strict');

const { formatNumber, formatScaledAmount, formatTimer, shouldDismissSheet } = require('../static/js/cook-mode.js');

test('formatNumber keeps useful kitchen fractions', () => {
    assert.equal(formatNumber(0.5), '1/2');
    assert.equal(formatNumber(1.5), '1 1/2');
    assert.equal(formatNumber(0.25), '1/4');
    assert.equal(formatNumber(2), '2');
});

test('formatScaledAmount scales exact fractions and ranges', () => {
    assert.equal(formatScaledAmount(0.5, null, 1, '1/2'), '1/2');
    assert.equal(formatScaledAmount(0.5, null, 2, '1/2'), '1');
    assert.equal(formatScaledAmount(100, 125, 2, '100–125'), '200–250');
});

test('formatScaledAmount preserves qualifiers and family wording', () => {
    assert.equal(formatScaledAmount(2, null, 2, 'ca. 2'), 'ca. 4');
    assert.equal(formatScaledAmount(1, null, 2, '1+'), '2+');
    assert.equal(formatScaledAmount(2, null, 2, 'guter Schubbs'), '4 · guter Schubbs');
});

test('formatTimer supports minute and hour durations', () => {
    assert.equal(formatTimer(65), '01:05');
    assert.equal(formatTimer(3661), '1:01:01');
});

test('bottom sheet dismisses for sufficient distance or velocity', () => {
    assert.equal(shouldDismissSheet(95, 1000), false);
    assert.equal(shouldDismissSheet(96, 1000), true);
    assert.equal(shouldDismissSheet(50, 100), false);
    assert.equal(shouldDismissSheet(61, 100), true);
});
