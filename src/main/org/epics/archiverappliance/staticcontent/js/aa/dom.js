// The DOM helpers that the pages of the management and retrieval web applications share: the element builder and the SVG namespace.

/** An element with attributes (a null or undefined value sets none) and children (a null or undefined child is skipped). */
export function node(tag, attributes, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes || {})) {
        if (value !== undefined && value !== null) {
            element.setAttribute(key, value);
        }
    }
    element.append(...children.filter((child) => child !== null && child !== undefined));
    return element;
}

export const SVG_NS = "http://www.w3.org/2000/svg";
