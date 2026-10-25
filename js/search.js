/* PLN local search: load the full-text index only when search is used.
 * Kept the historical searchFunc(path, inputId, resultsId) public API so
 * existing EJS templates need no changes.
 */
var searchFunc = function (path, searchId, resultId) {
    'use strict';

    var input = document.getElementById(searchId);
    var result = document.getElementById(resultId);

    // Post pages call searchFunc too, but have no search field. In that case
    // do not download search.xml or attach listeners.
    if (!input || !result) return;

    var entries = null;
    var pending = null;

    function plainText(html) {
        // The generated XML stores Markdown content as escaped HTML. Parsing
        // it in an inert document removes tags and decodes HTML entities.
        var doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || '';
    }

    function parseIndex(xmlText) {
        var xml = new DOMParser().parseFromString(xmlText, 'application/xml');
        if (xml.querySelector('parsererror')) {
            throw new Error('Invalid search.xml');
        }
        return Array.prototype.map.call(xml.getElementsByTagName('entry'), function (entry) {
            function field(tag) {
                var element = entry.getElementsByTagName(tag)[0];
                return element ? element.textContent : '';
            }
            var title = field('title').trim() || 'Untitled';
            var content = plainText(field('content')).trim();
            return {
                title: title,
                titleLower: title.toLowerCase(),
                content: content,
                contentLower: content.toLowerCase(),
                url: field('url').trim()
            };
        });
    }

    function loadIndex() {
        if (entries) return Promise.resolve(entries);
        if (pending) return pending;

        pending = fetch(path, { credentials: 'same-origin' })
            .then(function (response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.text();
            })
            .then(function (text) {
                entries = parseIndex(text);
                return entries;
            })
            .catch(function (error) {
                pending = null; // Allow a retry on the next focus/input.
                throw error;
            });
        return pending;
    }

    function highlight(target, source, keywords) {
        var lower = source.toLowerCase();
        var cursor = 0;
        while (cursor < source.length) {
            var nearest = -1;
            var word = '';
            keywords.forEach(function (keyword) {
                var index = lower.indexOf(keyword, cursor);
                if (index !== -1 && (nearest === -1 || index < nearest)) {
                    nearest = index;
                    word = keyword;
                }
            });
            if (nearest === -1) {
                target.appendChild(document.createTextNode(source.slice(cursor)));
                break;
            }
            if (nearest > cursor) {
                target.appendChild(document.createTextNode(source.slice(cursor, nearest)));
            }
            var em = document.createElement('em');
            em.className = 'search-keyword';
            em.textContent = source.slice(nearest, nearest + word.length);
            target.appendChild(em);
            cursor = nearest + word.length;
        }
    }

    function render() {
        var query = input.value.trim();
        result.replaceChildren();
        if (!query || !entries) return;

        var words = query.toLowerCase().split(/[\s\-]+/).filter(Boolean);
        if (!words.length) return;

        var list = document.createElement('ul');
        list.className = 'search-result-list';

        entries.forEach(function (item) {
            // Match title and full-text, with every search term required.
            if (!words.every(function (w) {
                return item.titleLower.includes(w) || item.contentLower.includes(w);
            })) return;

            var li = document.createElement('li');
            var link = document.createElement('a');
            link.className = 'search-result-title';
            link.href = item.url;
            highlight(link, item.title, words);
            li.appendChild(link);

            if (item.content) {
                // Prefer a snippet around the first content match; for a
                // title-only match, show the beginning of the article.
                var first = -1;
                words.forEach(function (word) {
                    var at = item.contentLower.indexOf(word);
                    if (at !== -1 && (first === -1 || at < first)) first = at;
                });
                var start = Math.max(0, (first === -1 ? 0 : first - 20));
                var snippet = item.content.slice(start, start + 100);
                var description = document.createElement('p');
                description.className = 'search-result';
                highlight(description, snippet, words);
                description.appendChild(document.createTextNode('…'));
                li.appendChild(description);
            }
            list.appendChild(li);
        });

        result.appendChild(list);
    }

    function showFailure() {
        if (input.value.trim()) {
            result.textContent = '搜索索引加载失败，请稍后重新输入。';
        }
    }

    function beginSearch() {
        // Focus prefetches; input can arrive before the XML has finished
        // downloading. Always render the *latest* input after it arrives.
        if (input.value.trim() && !entries) {
            result.textContent = '正在加载搜索索引…';
        }
        loadIndex().then(render, showFailure);
    }

    input.addEventListener('focus', beginSearch);
    input.addEventListener('input', function () {
        if (!input.value.trim()) {
            result.replaceChildren();
            return;
        }
        if (entries) render();
        else beginSearch();
    });
};
