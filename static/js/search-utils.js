(function (global) {
    function highlightSegments(value, query) {
        const text = String(value ?? '');
        const term = String(query ?? '').slice(0, 100);
        if (term === '') return [{ text, highlighted: false }];

        const segments = [];
        const haystack = text.toLocaleLowerCase('de-DE');
        const needle = term.toLocaleLowerCase('de-DE');
        let offset = 0;
        let match;
        while ((match = haystack.indexOf(needle, offset)) !== -1) {
            if (match > offset) segments.push({ text: text.slice(offset, match), highlighted: false });
            segments.push({ text: text.slice(match, match + term.length), highlighted: true });
            offset = match + term.length;
        }
        if (offset < text.length) segments.push({ text: text.slice(offset), highlighted: false });
        return segments.length > 0 ? segments : [{ text, highlighted: false }];
    }

    const api = { highlightSegments };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    global.recipeSearchUtils = api;
})(typeof window !== 'undefined' ? window : globalThis);
