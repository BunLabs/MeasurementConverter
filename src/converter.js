(function (he) {
    'use strict';

    const ignoreList = ['script', 'style', 'noscript', 'iframe', 'svg'];
    const genericRegex = /(?<value>-?\d+(\.\d+)?)\s?(?<unit>°C|°F|C|F|℉|℃|°|degrees F|degrees C)|degrees(?=\W)/g;

    /**
     * A node filter for processing text elements.
     * @type {NodeFilter}
     */
    const textNodeFilter = {
        acceptNode: function (node) {
            if (node.nodeValue.trim().length === 0) {
                // We're not interested in nodes without text
                return NodeFilter.FILTER_REJECT;
            }

            if (ignoreList.includes(node.parentElement.localName)) {
                // We're only interested in actual, visible text 
                return NodeFilter.FILTER_REJECT;
            }

            if (node.parentElement.classList === 'converted-measurement') {
                // Skip previously converted measurements
                return NodeFilter.FILTER_REJECT;
            }

            return NodeFilter.FILTER_ACCEPT;
        }
    }

    /**
     * Converts Fahrenheit to Celsius.
     * @param {number} f Fahrenheit.
     */
    const FtoC = f => Math.round((f - 32) / 1.8);

    /**
     * Converts Celsius to Fahrenheit.
     * @param {number} c Celsius.
     */
    const CtoF = c => Math.round((c * 1.8) + 32);

    /**
     * @typedef {Object} Measurement
     * @property {number} value The converted value.
     * @property {string} unit The converted unit.
     * @property {string} [interpretation] The interpreted unit.
     */
    /**
     * Converts a measurement to metric
     * @param {string} value The raw value to convert.
     * @param {string} unit The unit of the original value.
     * @returns {Measurement[]} The metric measurement, or `null` if no conversion was done.
     */
    function convertToMetric(value, unit) {
        const x = parseFloat(value);
        switch (unit) {
            case 'F':
            case '°F':
            case '℉':
            case 'degrees F':
                return [{ value: FtoC(x), unit: '°C' }];

            case '°':
            case 'degrees':
                return [
                    { value: FtoC(x), unit: '°C', interpretation: '°F' },
                    { value: CtoF(x), unit: '°F', interpretation: '°C' }
                ];

            default:
                return null;
        }
    }

    /**
     * Renders an HTML replacement for a detected measurement.
     * @param {string} value The original value.
     * @param {string} unit The original unit.
     * @param {string} original The raw, original string.
     * @returns {string} HTML text to replace the original string with.
     */
    function render(value, unit, original) {
        var conversions = convertToMetric(value, unit);
        if (!conversions || conversions.length === 0) {
            return original;
        }

        if (conversions.length === 1) {
            const result = conversions[0];
            return `<abbr class='converted-measurement' title='${he.encode(original)}'>${result.value} ${result.unit}</abbr>`;
        }

        let result = conversions
            .map(x => `${value} ${x.interpretation} = ${x.value} ${x.unit}`)
            .join('\n');
        return `<abbr class='converted-measurement' title='${he.encode(result)}'>${he.encode(original)}</abbr>`;
    }

    /**
     * Returns an array of text nodes under the specified node.
     * @param {Node} node The root node whose text nodes to find.
     * @returns {HTMLElement[]} An array of HTML elements containing only text under `node`.
     */
    function getTextElements(node) {
        const walker = document.createTreeWalker(
            node, NodeFilter.SHOW_TEXT, textNodeFilter, false
        );

        let textNodes = [];
        let cursor = null;
        while (cursor = walker.nextNode()) {
            textNodes.push(cursor.parentElement);
        };
        return textNodes;
    }

    /**
     * Processes the specified element, converting measurements in in place.
     * @param {Node} element The HTML node to process, e.g. `document.body`.
     */
    function process(element) {
        let textNodes = getTextElements(element);
        textNodes.forEach(e => {
            if (genericRegex.test(e.innerHTML)) {
                e.innerHTML = e.innerHTML.replaceAll(genericRegex, (...args) => {
                    console.info('[Unit Converter] Processing "%s" in %o', args[0], e);

                    const match = args.pop();
                    return render(match.value, match.unit, args[0]);
                });
            }
        });
    }

    /**
     * Hooks page load and update events to process the page for measurements to convert.
     */
    function init() {
        const observer = new MutationObserver((mutationsList, observer) => {
            observer.disconnect();
            mutationsList
                .flatMap(x => Array.from(x.addedNodes))
                .forEach(process);
            observer.observe(document.body, config);
        });

        const config = {
            subtree: true,
            childList: true,
            characterData: true
        };

        process(document.body);
        observer.observe(document.body, config);
    }

    init();
})(he);