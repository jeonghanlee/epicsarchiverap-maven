// The menu bar of every management page: marks the entry of the page in view, and mirrors the narrow-screen menu
// toggle to the attributes assistive technology reads. The toggle is a checkbox that the stylesheet hides and a label
// that draws the Menu button; the checkbox is the focusable control, so it carries aria-expanded and aria-controls.
// Escape folds the open menu.
(function () {
    const menu = document.querySelector("ul.mainmenu");
    if (!menu) {
        return;
    }
    // An entry covers the page its href names and the pages its data-pages attribute lists (the System tabs).
    const external = document.body.dataset.consoleNavigation === "external";
    const page = document.body.dataset.menuPage || window.location.pathname.split("/").pop() || "index.html";
    const pagesOf = (link) => [(link.getAttribute("href") || "").split(/[?#]/)[0]]
        .concat((link.dataset.pages || "").split(/\s+/).filter(Boolean));
    const current = Array.from(menu.querySelectorAll("a")).find((link) => pagesOf(link).includes(page));
    if (current) {
        current.classList.add("active");
        current.setAttribute("aria-current", "page");
    }

    // A menu entry opens its page at the last address that the page had in this browser tab. The address is kept in
    // sessionStorage, so a new tab starts fresh, and it is recorded on pagehide (never unload or beforeunload, which
    // would remove the page from the back/forward cache). The browser still follows the link itself, so opening an
    // entry in a new tab or with the middle button keeps working; an entry with an address of its own is left alone.
    const KEY = "aa.lastAddress:";
    const storage = {
        get: (key) => { try { return window.sessionStorage.getItem(KEY + key); } catch (e) { return null; } },
        set: (key, value) => { try { window.sessionStorage.setItem(KEY + key, value); } catch (e) { /* storage unavailable */ } },
        remove: (key) => { try { window.sessionStorage.removeItem(KEY + key); } catch (e) { /* storage unavailable */ } }
    };
    const entryHref = new Map(Array.from(menu.querySelectorAll("a")).map((link) => [link, link.getAttribute("href") || ""]));
    const record = () => {
        if (!current || external) {
            return;
        }
        const key = entryHref.get(current);
        const rest = window.location.search + window.location.hash;
        if (rest) {
            storage.set(key, page + rest);
        } else {
            storage.remove(key);
        }
    };
    // The classic menu script follows the preference modules through their shared storage and change events.
    // Effective defaults are explicit so another origin cannot replace the source page's choices with its own store.
    const preference = (parameter, key, choices, fallback) => {
        const fromAddress = new URLSearchParams(window.location.hash.slice(1)).get(parameter)
            || new URLSearchParams(window.location.search).get(parameter);
        let stored = null;
        try {
            stored = window.localStorage.getItem(key);
        } catch (e) {
            // The current page's choices remain available through the change events.
        }
        const value = fromAddress || stored;
        return choices.includes(value) ? value : fallback;
    };
    let profile = preference("profile", "aa.chartProfile", ["default", "redgreen", "mono"], "default");
    let zone = preference("tz", "aa.timeZone",
        ["browser", "UTC", "America/Los_Angeles", "America/Chicago", "America/New_York", "Asia/Seoul", "Europe/Berlin"], "browser");
    const restore = () => {
        if (external) return;
        entryHref.forEach((plain, link) => {
            if (link === current || /[?#]/.test(plain)) {
                return;
            }
            if (plain === "analyzer.html") {
                link.setAttribute("href", `${plain}?${new URLSearchParams({ tz: zone, profile })}`);
                return;
            }
            const saved = storage.get(plain);
            if (saved && pagesOf(link).includes(saved.split(/[?#]/)[0])) {
                link.setAttribute("href", saved);
            } else {
                link.setAttribute("href", plain);
            }
        });
    };
    restore();
    window.addEventListener("hashchange", record);
    document.addEventListener("aa-chart-profile", (event) => { profile = event.detail.profile; restore(); });
    document.addEventListener("aa-timezone", (event) => { zone = event.detail.zone; restore(); });
    window.addEventListener("pagehide", record);
    window.addEventListener("pageshow", (event) => {
        if (event.persisted) {
            restore();
        }
    });

    const toggle = document.getElementById("menu-toggle");
    if (!toggle) {
        return;
    }
    if (!menu.id) {
        menu.id = "mainmenu";
    }
    toggle.setAttribute("aria-controls", menu.id);
    const reflect = () => toggle.setAttribute("aria-expanded", String(toggle.checked));
    reflect();
    toggle.addEventListener("change", reflect);
    // Escape folds an open menu and returns the focus to its toggle.
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && toggle.checked) {
            toggle.checked = false;
            reflect();
            toggle.focus();
        }
    });
    // Choosing an entry on a narrow screen folds the menu again, so the page behind it is not left covered on return.
    menu.addEventListener("click", (event) => {
        if (event.target.closest("a") && toggle.checked) {
            toggle.checked = false;
            reflect();
        }
    });
})();
