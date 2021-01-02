# MeasurementConverter

![Screenshot showing inline replacements in an ingredients list](https://github.com/CodingBuns/MeasurementConverter/blob/main/docs/readme_inline_replacement.png?raw=true)

A Chrome/Edge extension that automatically converts measurements on websites.

Current units supported:

- Fahrenheit to Celsius
- Cups, teaspoons and tablespoons to milliliters

Measurements are converted in place. If the unit can't be determined exactly (e.g. `350 °` instead of `350 °F` or `350 °C`) it will show all possible interpretations in the tooltip, and keep the original text.



## Known issues

- It only works on plain text. Sites that have special markup for measurements are not supported, as this could potentially break the site, and it is infeasible to support every site on the internet that does it in their own special way.

---

Icons beautifully crafted by the talented [@Fearswe](https://twitter.com/fearswe).
