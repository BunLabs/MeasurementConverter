//@ts-check
(function (he) {
    'use strict';

    const ignoreList = ['script', 'style', 'noscript', 'iframe', 'text', 'input', 'textarea'];
    const genericRegex = /(?<value>-?\d+(\.\d+)?)\s?(?<unit>°C|°F|℉|℃|°|degrees F|degrees C|degrees)(?=\W|$)/g;
    const fractionalRegex = /(?<value>(\d+|(\d+\s?)?([½⅓¼¾⅛⅜⅝⅞]|(\d\/\d))))\s?(?<unit>cups?|tsp|tbsp)/g

    const mlPerUSCup = 240; // technically 236.5882365 but who cares, really
    const mlPerTsp = 5; // 4.92892159375
    const mlPerTbsp = 15; // 14.78676478125 mL

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

            if (node.parentElement.isContentEditable) {
                // Skip editable content (e.g. weird WYSIWYG editors that don't use textarea)
                return NodeFilter.FILTER_REJECT;
            }

            if (node.parentElement.className === 'converted-measurement') {
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
     * Attempts to parse a string as a number, supports fractions.
     * @param {string} value The text to parse for a number.
     * @returns {number} Returns the parsed number, or `null`.
     */
    function parseNumber(value) {
        const fractionPattern = /(\d+\s?)?([½⅓¼¾⅛⅜⅝⅞]|\d\/\d)/;
        if (!fractionPattern.test(value)) {
            return parseFloat(value);
        }

        const [p1, p2] = fractionPattern.exec(value);
        let n1 = parseFloat(p1);
        if (!n1) {
            n1 = 0;
        }

        let n2 = parseFraction(p2);
        if (!n2) {
            n2 = 0;
        }

        return n1 + n2;
    }

    /**
     * Parse a fraction as a number.
     * @param {string} value The fraction to parse as number.
     */
    function parseFraction(value) {
        switch (value) {
            case '⅞': return 0.875;
            case '¾': return 0.75;
            case '⅝': return 0.625;
            case '½': return 0.5;
            case '⅜': return 0.375;
            case '⅓': return 0.333;
            case '¼': return 0.25;
            case '⅛': return 0.125;
        }

        if (/(\d+)\/(\d+)/g.test(value)) {
            const [num, denom] = /(\d+)\/(\d+)/g.exec(value);
            return parseInt(num) / parseInt(denom);
        }

        return parseFloat(value);
    }

    /**
     * @typedef {Object} Measurement
     * @property {number} value The converted value.
     * @property {string} unit The converted unit.
     * @property {string} [interpretation] The interpreted unit.
     */
    /**
     * Converts a measurement to metric
     * @param {number} value The value to convert.
     * @param {string} unit The unit of the original value.
     * @returns {Measurement[]} The metric measurement, or `null` if no conversion was done.
     */
    function convertToMetric(value, unit) {
        switch (unit) {
            case 'F':
            case '°F':
            case '℉':
            case 'degrees F':
                return [{
                    value: FtoC(value), unit: '°C'
                }];

            case '°':
            case 'degrees':
                return [
                    { value: FtoC(value), unit: '°C', interpretation: '°F' },
                    { value: CtoF(value), unit: '°F', interpretation: '°C' }
                ];

            case 'cups':
            case 'cup':
                return [
                    {
                        value: Math.round(value * mlPerUSCup),
                        unit: 'mL',
                        interpretation: 'US cups'
                    }
                ];

            case 'tsp':
                return [{
                    value: Math.round(value * mlPerTsp),
                    unit: 'mL',
                    interpretation: 'tsp.'
                }];

            case 'tbsp':
                return [{
                    value: Math.round(value * mlPerTbsp),
                    unit: 'mL',
                    interpretation: 'tbsp.'
                }];

            default:
                return null;
        }
    }

    /**
     * Renders an HTML replacement for a detected measurement.
     * @param {number} value The original value.
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
            node, NodeFilter.SHOW_TEXT, textNodeFilter
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
                    const value = parseFloat(match.value);
                    return render(value, match.unit, args[0]);
                });
            }

            if (fractionalRegex.test(e.innerHTML)) {
                e.innerHTML = e.innerHTML.replaceAll(fractionalRegex, (...args) => {
                    console.info('[Unit Converter] Processing "%s" in %o', args[0], e);

                    const match = args.pop();
                    const value = parseFraction(match.value);
                    return render(value, match.unit, args[0]);
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