// Name suggestions for a single-line PV input: from two typed characters, after a short pause, the first names of
// archived PVs that contain the text, offered through a <datalist> that the browser shows under the input.
import { node } from "../comm/js/aa/dom.js";

const MIN_CHARS = 2;
const DELAY_MS = 200;
const LIMIT = 20;
const MATCHING = "../bpl/getAllPVs";

export function suggestNames(input) {
    const list = node("datalist", { id: `${input.id}-names` });
    input.setAttribute("list", list.id);
    input.after(list);
    let timer = 0;
    let sequence = 0;

    async function fill(text) {
        const mine = ++sequence;
        const term = text.trim();
        if (term.length < MIN_CHARS) {
            list.textContent = "";
            return;
        }
        try {
            const query = new URLSearchParams({ pv: `*${term}*`, limit: String(LIMIT) });
            const response = await fetch(`${MATCHING}?${query}`);
            if (response.ok && mine === sequence) {
                list.replaceChildren(...(await response.json()).slice(0, LIMIT).map((name) => node("option", { value: name })));
            }
        } catch (error) {
            // Suggestions are optional.
        }
    }

    input.addEventListener("input", () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => fill(input.value), DELAY_MS);
    });
}
