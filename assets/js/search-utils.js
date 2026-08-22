(function (global) {
    const MAX_QUERY_LENGTH = 100;

    function normalizeSearchTerm(value) {
        const term = String(value ?? '').trim().slice(0, MAX_QUERY_LENGTH);
        return term.length >= 2 ? term : '';
    }

    function normalizeTag(value) {
        return String(value ?? '').trim().slice(0, 100);
    }

    function highlightSegments(value, query) {
        const text = String(value ?? '');
        const term = normalizeSearchTerm(query);
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

    function parseSearchState(search) {
        const params = new URLSearchParams(String(search ?? ''));
        return {
            query: normalizeSearchTerm(params.get('q')),
            tag: normalizeTag(params.get('tag')),
            duration: String(params.get('duration') ?? ''),
        };
    }

    function buildSearchUrl(currentUrl, state) {
        const url = new URL(currentUrl);
        const query = normalizeSearchTerm(state?.query);
        const tag = normalizeTag(state?.tag);
        const duration = Number(state?.duration);
        if (query) url.searchParams.set('q', query);
        else url.searchParams.delete('q');
        if (tag) url.searchParams.set('tag', tag);
        else url.searchParams.delete('tag');
        if (Number.isFinite(duration) && duration > 0) url.searchParams.set('duration', String(duration));
        else url.searchParams.delete('duration');
        return url.toString();
    }

    function filterResultsByTag(results, tag) {
        const needle = normalizeTag(tag).toLocaleLowerCase('de-DE');
        if (!needle) return results;
        return results.filter((result) => (result.item.tags || []).some(
            (value) => String(value).toLocaleLowerCase('de-DE') === needle,
        ));
    }

    function filterResultsByDuration(results, maximumMinutes) {
        const maximum = Number(maximumMinutes);
        if (!Number.isFinite(maximum) || maximum <= 0) return results;
        return results.filter((result) => Number.isFinite(result.item.durationMinutes)
            && result.item.durationMinutes <= maximum);
    }

    function durationFilterAvailable(recipes) {
        if (!Array.isArray(recipes) || recipes.length === 0) return false;
        const known = recipes.filter((recipe) => Number.isFinite(recipe.durationMinutes)).length;
        return known >= 3 && known / recipes.length >= 0.25;
    }

    function uniqueResults(results) {
        const seen = new Set();
        return results.filter((result) => {
            const permalink = result.item.permalink;
            if (seen.has(permalink)) return false;
            seen.add(permalink);
            return true;
        });
    }

    const api = {
        buildSearchUrl,
        durationFilterAvailable,
        filterResultsByDuration,
        filterResultsByTag,
        highlightSegments,
        normalizeSearchTerm,
        parseSearchState,
        uniqueResults,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    global.recipeSearchUtils = api;
})(typeof window !== 'undefined' ? window : globalThis);
