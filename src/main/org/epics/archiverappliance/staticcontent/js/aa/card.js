// The information control of the pages: a small button with an italic "i" that opens a card with the text, what to do and a link into
// the help page. One card is open at a time; it closes with Esc, a click outside, a scroll of a box inside the page, and it moves with a resize.
import { node, SVG_NS } from "./dom.js";

let openTitle = null;
let openCard = null;

function closeCard() {
    if (openCard) {
        openCard.card.remove();
        openCard.button.setAttribute("aria-expanded", "false");
        openCard.button.classList.remove("on");
        openCard = null;
    }
    openTitle = null;
}

function placeCard(button, card) {
    const box = button.getBoundingClientRect();
    // The card is as wide as the text wants, up to 340 px, and never wider than the page without its scrollbar.
    const width = Math.min(card.classList.contains("wide") ? 420 : 340, document.documentElement.clientWidth - 16);
    card.style.width = `${width}px`;
    // The place is worked out in the window and then shifted into the coordinates of the element the card sits in: the
    // page itself, or a positioned parent such as the box of a chart or a dialog.
    const parent = card.offsetParent;
    const inPage = !parent || parent === document.body || parent === document.documentElement;
    const base = inPage ? { left: -window.scrollX, top: -window.scrollY } : parent.getBoundingClientRect();
    const inset = inPage ? { left: 0, top: 0 } : { left: parent.clientLeft - parent.scrollLeft, top: parent.clientTop - parent.scrollTop };
    const viewLeft = Math.min(Math.max(8, box.left + box.width / 2 - 24), document.documentElement.clientWidth - width - 8);
    // The card opens below its button, or above it when it does not fit below and does fit above.
    const height = card.offsetHeight;
    const below = box.bottom + 8;
    const above = box.top - 8 - height;
    const flip = below + height > window.innerHeight - 8 && above >= 8;
    card.classList.toggle("above", flip);
    card.style.left = `${viewLeft - base.left - inset.left}px`;
    card.style.top = `${(flip ? above : below) - base.top - inset.top}px`;
    card.style.setProperty("--arrow", `${box.left + box.width / 2 - viewLeft - 6}px`);
}

function showCard(button, title, text, action, helpHref) {
    closeCard();
    const rows = Array.isArray(text);
    const body = rows
        ? node("dl", { class: "rows" }, ...text.flatMap(([term, detail]) => [node("dt", null, term), node("dd", null, detail)]))
        : node("p", null, text);
    const card = node("div", { class: rows ? "card wide" : "card", role: "dialog", "aria-label": title, id: "infoCard" },
        node("h4", null, title),
        body,
        action ? node("p", { class: "act" }, action) : null,
        node("div", { class: "foot" }, node("a", { href: helpHref }, "More in Help"), node("button", { type: "button", class: "plain close" }, "Close")),
    );
    card.querySelector(".close").addEventListener("click", () => {
        const owner = openCard && openCard.button;
        closeCard();
        if (owner) {
            owner.focus();
        }
    });
    // The box of a chart clips what overflows it, so the card of a control inside one is placed after the box.
    (button.closest(".chart") || button).insertAdjacentElement("afterend", card);
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-controls", "infoCard");
    button.classList.add("on");
    openCard = { card, button };
    openTitle = title;
    placeCard(button, card);
}

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && openCard) {
        const owner = openCard.button;
        closeCard();
        owner.focus();
    }
});
document.addEventListener("click", (event) => {
    if (openCard && !openCard.card.contains(event.target) && !openCard.button.contains(event.target)) {
        closeCard();
    }
});
// A table that scrolls sideways moves the button from under its card; the card is closed then. Page scrolling is
// not a reason: the card scrolls with the page.
document.addEventListener(
    "scroll",
    (event) => {
        if (openCard && event.target !== document && event.target !== document.documentElement) {
            closeCard();
        }
    },
    true,
);
window.addEventListener("resize", () => {
    if (openCard) {
        placeCard(openCard.button, openCard.card);
    }
});

// The italic serif "i" of the information control as an SVG path (the outline of the letter i of Noto Serif Bold Italic,
// SIL Open Font License 1.1), so that the mark looks the same on every platform whatever fonts it has.
const INFO_GLYPH_PATH =
    "M12.82 6.48Q12.08 6.48 11.57 6.13Q11.07 5.79 11.07 5.09Q11.07 4.1 11.7 3.68Q12.33 3.25 13.16 3.25Q13.87 3.25 14.41 3.58" +
    "Q14.95 3.9 14.95 4.66Q14.95 5.58 14.29 6.03Q13.63 6.48 12.82 6.48ZM11.72 20.75Q10.44 20.75 9.75 20.13Q9.05 19.52 9.05 18.44" +
    "Q9.05 17.97 9.14 17.29Q9.23 16.62 9.41 15.77L10.28 11.6Q10.35 11.3 10.4 11.01Q10.44 10.72 10.44 10.63Q10.44 10.03 10.17 9.86" +
    "Q9.9 9.69 9.25 9.69H8.85L9.07 8.5H14.37L12.82 15.79Q12.68 16.4 12.59 16.94Q12.5 17.47 12.5 17.95Q12.5 18.96 13.29 18.96" +
    "Q13.65 18.96 13.94 18.82Q14.23 18.69 14.61 18.44L15.15 19.2Q14.61 19.76 13.78 20.26Q12.95 20.75 11.72 20.75Z";

/** The SVG element of the "i" of an information control, built from the path above. */
function infoGlyph() {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", INFO_GLYPH_PATH);
    svg.append(path);
    return svg;
}

/**
 * An information control: a small raised button with an italic "i" that opens a card with the text (one paragraph, or
 * rows of a term and its text), what to do about it and a link into the help page. The card stays open across a
 * refresh of the page that rebuilds its button.
 */
export function infoButton(title, text, action, helpHref) {
    const button = node("button", { type: "button", class: "info", "aria-expanded": "false", "aria-label": `About ${title}` }, infoGlyph());
    button.addEventListener("click", () => {
        if (openCard && openCard.button === button) {
            closeCard();
        } else {
            showCard(button, title, text, action, helpHref);
        }
    });
    if (openTitle === title) {
        requestAnimationFrame(() => {
            if (button.isConnected) {
                showCard(button, title, text, action, helpHref);
            }
        });
    }
    return button;
}
