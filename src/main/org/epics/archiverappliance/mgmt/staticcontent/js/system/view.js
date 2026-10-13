// Small pieces the System pages share.
import { node } from "./api.js";
import { MARKS, WORDS } from "./judge.js";

/** A judgement as a word with a mark, so the color is never the only carrier, and the sentence that explains it. */
export function statusNode(kind, text) {
    const box = node("div", { class: "status" }, node("span", { class: `st ${kind}` }, `${MARKS[kind]} ${WORDS[kind]}`));
    if (text) {
        box.append(node("span", { class: "why" }, text));
    }
    return box;
}

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
    const left = Math.min(Math.max(8, box.left + window.scrollX + box.width / 2 - 24), window.scrollX + document.documentElement.clientWidth - width - 8);
    card.style.left = `${left}px`;
    card.style.top = `${box.bottom + window.scrollY + 8}px`;
    card.style.setProperty("--arrow", `${box.left + window.scrollX + box.width / 2 - left - 6}px`);
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
    button.insertAdjacentElement("afterend", card);
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

/**
 * An information control: a small "i" button that opens a card with the text (one paragraph, or rows of a term and
 * its text), what to do about it and a link into the help page. The card stays open across a refresh of the page
 * that rebuilds its button.
 */
export function infoButton(title, text, action, helpHref) {
    const button = node("button", { type: "button", class: "info", "aria-expanded": "false", "aria-label": `About ${title}` }, "i");
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

export function timeText(seconds) {
    return seconds ? new Date(seconds * 1000).toLocaleString([], { hour12: false }) : "";
}

export function clock() {
    return new Date().toLocaleTimeString([], { hour12: false });
}

/**
 * The appliance of the address (?appliance=name) or the first one. The choice is kept in the address and in the
 * links to the other System pages. A select is shown only when the cluster has more than one appliance.
 */
let carried = "";

/** The address of another System page for the chosen appliance; a #fragment stays at the end. */
export function pageHref(target) {
    const [page, fragment] = target.split("#");
    return `${page}${carried}${fragment ? `#${fragment}` : ""}`;
}

export function chooseAppliance(list, select, onChange) {
    const wanted = new URLSearchParams(window.location.search).get("appliance");
    let current = list.find((row) => row.instance === wanted) || list[0] || null;
    select.textContent = "";
    for (const row of list) {
        select.append(node("option", { value: row.instance }, row.instance));
    }
    select.hidden = list.length < 2;
    if (current) {
        select.value = current.instance;
    }
    const carry = () => {
        const suffix = current && list.length > 1 ? `?appliance=${encodeURIComponent(current.instance)}` : "";
        carried = suffix;
        document.querySelectorAll(".tabs a").forEach((link) => {
            const target = link.getAttribute("data-page");
            if (target) {
                link.setAttribute("href", `${target}${suffix}`);
            }
        });
    };
    carry();
    select.onchange = () => {
        current = list.find((row) => row.instance === select.value) || current;
        window.history.replaceState(null, "", `?appliance=${encodeURIComponent(current.instance)}${window.location.hash}`);
        carry();
        onChange(current);
    };
    return current;
}
