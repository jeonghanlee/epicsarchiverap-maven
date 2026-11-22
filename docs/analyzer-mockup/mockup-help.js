/* Context help uses the console's information-card component and retains essential values and statuses inline. */
function helpHint(title, text) {
    return `<span data-help-title="${escapeText(title)}" data-help-text="${escapeText(text)}"></span>`;
}

function activateHelp(root) {
    for (const slot of root.querySelectorAll('[data-help-title]')) {
        slot.replaceWith(SharedChart.infoButton(slot.dataset.helpTitle, slot.dataset.helpText));
    }
}

function closeHelp() {
    document.querySelector('#infoCard .close')?.click();
}

function setHelp(element, label, title, text) {
    element.replaceChildren(document.createTextNode(label), SharedChart.infoButton(title, text));
}

function compactPanelHelp() {
    const panel = $('panel-content');
    const groups = new Map();
    for (const paragraph of panel.querySelectorAll(':scope > p:not([id]):not(.fit-equation), .fit-advanced > p')) {
        if (paragraph.querySelector('a, button, [data-help-title]') || paragraph.textContent.length < 65) continue;
        let heading = paragraph.closest('.fit-advanced')?.querySelector('summary');
        if (!heading) {
            let before = paragraph.previousElementSibling;
            while (before && !before.matches('h3')) before = before.previousElementSibling;
            heading = before || $('inspector-title');
        }
        if (!groups.has(heading)) groups.set(heading, []);
        groups.get(heading).push(paragraph.textContent);
        paragraph.remove();
    }
    for (const [heading, paragraphs] of groups) {
        heading.append(SharedChart.infoButton(`${VIEWS.find(view => view.id === state.view).name}: ${heading.textContent}`, paragraphs.join('\n\n')));
    }
    activateHelp(panel);
}
