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

        // PLN TOC Scrollspy v1: begin
        // Reuse Hexo's TOC anchors; do not regenerate or modify article markup.
        var tocScroller = drawer.querySelector(".post-toc-drawer-content");
        var tocEntries = [];
        var activeEntry = null;
        var pendingFrame = 0;

        tocLinks.forEach(function (link) {
            var href = link.getAttribute("href") || "";
            if (href.charAt(0) !== "#") return;

            var headingId;
            try {
                headingId = decodeURIComponent(href.slice(1));
            } catch (error) {
                return;
            }
            var heading = document.getElementById(headingId);
            if (!heading || !heading.matches("h2, h3, h4")) return;
            tocEntries.push({ heading: heading, link: link });
        });

        function markActiveEntry(nextEntry) {
            if (nextEntry === activeEntry) return;
            if (activeEntry) {
                activeEntry.link.classList.remove("toc-current");
                activeEntry.link.removeAttribute("aria-current");
            }
            activeEntry = nextEntry;
            if (activeEntry) {
                activeEntry.link.classList.add("toc-current");
                activeEntry.link.setAttribute("aria-current", "location");
            }
        }

        function syncActiveHeading() {
            if (!tocEntries.length) return;
            // A heading becomes current near the upper reading zone.
            // A scroll position in a long section retains that section.
            var readingLine = Math.min(170, Math.max(85, window.innerHeight * 0.2));
            var nextEntry = null;
            tocEntries.forEach(function (entry) {
                if (entry.heading.getBoundingClientRect().top <= readingLine) {
                    nextEntry = entry;
                }
            });
            // At the very end, make the last section discoverable even if
            // its heading cannot scroll as high as the reading line.
            if (window.scrollY > 0 &&
                window.scrollY + window.innerHeight >=
                document.documentElement.scrollHeight - 5) {
                nextEntry = tocEntries[tocEntries.length - 1];
            }
            markActiveEntry(nextEntry);
        }

        function scheduleActiveSync() {
            if (pendingFrame) return;
            pendingFrame = window.requestAnimationFrame(function () {
                pendingFrame = 0;
                syncActiveHeading();
            });
        }

        function showActiveInDrawer() {
            if (!activeEntry || !tocScroller) return;
            // Scroll only the TOC's own scroller, not the article itself.
            var scrollerRect = tocScroller.getBoundingClientRect();
            var linkRect = activeEntry.link.getBoundingClientRect();
            var desiredTop = tocScroller.scrollTop + linkRect.top - scrollerRect.top -
                (tocScroller.clientHeight - linkRect.height) / 2;
            if (Math.abs(desiredTop - tocScroller.scrollTop) > 8) {
                tocScroller.scrollTop = Math.max(0, desiredTop);
            }
        }

        window.addEventListener("scroll", scheduleActiveSync, { passive: true });
        window.addEventListener("resize", scheduleActiveSync);
        window.addEventListener("hashchange", scheduleActiveSync);
        window.addEventListener("pageshow", scheduleActiveSync);
        if (document.readyState !== "complete") {
            window.addEventListener("load", scheduleActiveSync, { once: true });
        }
        scheduleActiveSync();
        // PLN TOC Scrollspy v1: end


        function setOpen(isOpen, restoreFocus) {
            document.body.classList.toggle("toc-open", isOpen);
            toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
            drawer.setAttribute("aria-hidden", isOpen ? "false" : "true");

            if (isOpen) {
                // PLN scrollspy: reveal the current section on open.
                window.requestAnimationFrame(function () {
                    syncActiveHeading();
                    showActiveInDrawer();
                });
            }

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
            link.addEventListener("click", function (event) {
                // PLN TOC Scrollspy v2: fragment-free local navigation.
                // Never intercept modified clicks, nonprimary clicks or events
                // already handled by another script.
                if (event.defaultPrevented || event.button !== 0 ||
                    event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
                    (link.target && link.target !== "_self") ||
                    link.hasAttribute("download")) {
                    return;
                }

                var selected = tocEntries.find(function (entry) {
                    return entry.link === link;
                });
                if (!selected) return; // Keep native navigation as fallback.

                event.preventDefault();
                markActiveEntry(selected);

                // If the page was opened via an external #fragment, remove
                // that stale fragment on an intentional *local TOC click*.
                // replaceState is same-document and does not scroll or add a
                // Back-button history entry. Do not disable native scroll
                // restoration: reload should keep the user's reading position.
                if (window.location.hash) {
                    try {
                        window.history.replaceState(
                            window.history.state,
                            "",
                            window.location.pathname + window.location.search
                        );
                    } catch (error) {
                        // Nonfatal: navigation still works if History API is
                        // unavailable in an unusual preview environment.
                    }
                }

                function navigateToHeading() {
                    // 'auto' honors CSS scroll-behavior: smooth, and the
                    // prefers-reduced-motion override in toc.scss.
                    selected.heading.scrollIntoView({
                        behavior: "auto",
                        block: "start"
                    });
                }

                if (phoneQuery.matches) {
                    // Release the mobile scroll lock before scrolling.
                    setOpen(false, false);
                    window.requestAnimationFrame(navigateToHeading);
                } else {
                    // Desktop drawer remains open, as before.
                    navigateToHeading();
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
