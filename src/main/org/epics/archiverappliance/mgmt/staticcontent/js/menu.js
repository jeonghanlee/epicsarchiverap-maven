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
    const page = window.location.pathname.split("/").pop() || "index.html";
    const pagesOf = (link) => [(link.getAttribute("href") || "").split(/[?#]/)[0]]
        .concat((link.dataset.pages || "").split(/\s+/).filter(Boolean));
    const current = Array.from(menu.querySelectorAll("a")).find((link) => pagesOf(link).includes(page));
    if (current) {
        current.classList.add("active");
        current.setAttribute("aria-current", "page");
    }

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
