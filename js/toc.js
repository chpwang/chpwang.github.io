(function () {
    "use strict";

    function initTocDrawer() {
        var toggle = document.querySelector(".post-toc-toggle");
        var drawer = document.querySelector(".post-toc-drawer");
        var backdrop = document.querySelector(".post-toc-backdrop");

        if (!toggle || !drawer || !backdrop) {
            return;
        }

        var closeButtons = document.querySelectorAll("[data-toc-close]");
        var tocLinks = drawer.querySelectorAll(".toc-link");
        var phoneQuery = window.matchMedia("(max-width: 768px)");

        function setOpen(isOpen, restoreFocus) {
            document.body.classList.toggle("toc-open", isOpen);
            toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
            drawer.setAttribute("aria-hidden", isOpen ? "false" : "true");

            if (!isOpen && restoreFocus !== false) {
                toggle.focus({ preventScroll: true });
            }
        }

        toggle.addEventListener("click", function () {
            setOpen(!document.body.classList.contains("toc-open"));
        });

        closeButtons.forEach(function (button) {
            button.addEventListener("click", function () {
                setOpen(false);
            });
        });

        tocLinks.forEach(function (link) {
            link.addEventListener("click", function () {
                // On tablet/desktop the drawer behaves like a sidebar and
                // remains open. On phones it overlays the article, so close it
                // immediately after navigation.
                if (phoneQuery.matches) {
                    setOpen(false, false);
                }
            });
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && document.body.classList.contains("toc-open")) {
                setOpen(false);
            }
        });

        function syncMode() {
            // Crossing into phone mode while open is fine: CSS converts the
            // same drawer into an overlay. Crossing back restores push-aside
            // sidebar behavior without rebuilding the TOC.
            drawer.setAttribute(
                "aria-hidden",
                document.body.classList.contains("toc-open") ? "false" : "true"
            );
        }

        if (typeof phoneQuery.addEventListener === "function") {
            phoneQuery.addEventListener("change", syncMode);
        } else if (typeof phoneQuery.addListener === "function") {
            phoneQuery.addListener(syncMode);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initTocDrawer);
    } else {
        initTocDrawer();
    }
}());
