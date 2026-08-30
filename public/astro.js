// public/astro.js

const form = document.getElementById("birth-data-form");
const status = document.getElementById("status");

form.addEventListener("submit", async (event) => {

    event.preventDefault();

    status.style.color = "#ffffff";
    status.textContent = "Finding birthplace...";

    try {

        const city = document.getElementById("city").value.trim();

        const geoResponse = await fetch(

            "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
            encodeURIComponent(city) +
            ".json?limit=1&access_token=" +
            mapboxgl.accessToken

        );

        const geoData = await geoResponse.json();

        if (!geoData.features || !geoData.features.length) {

            status.style.color = "#ff7777";
            status.textContent = "Couldn't find that city.";

            return;

        }

        const longitude = geoData.features[0].center[0];
        const latitude = geoData.features[0].center[1];

        status.textContent = "Generating astrocartography...";

        const birthDate =
            document.getElementById("date").value.split("-");

        const birthTime =
            document.getElementById("time").value.split(":");

        const response = await fetch("/api/astrocartography", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                name: document.getElementById("name").value,

                day: Number(birthDate[2]),

                month: Number(birthDate[1]),

                year: Number(birthDate[0]),

                hour: Number(birthTime[0]),

                minute: Number(birthTime[1]),

                latitude,

                longitude,

                timezone: 0,

                birthCity: city

            })

        });

        const data = await response.json();

        // Save globally so map.js can redraw after style changes
        window.currentAstroData = data;

        console.log("API Response:", data);
        console.log("Number of lines:", data.lines?.length);

        status.style.color = "#7cffc7";
        status.textContent = "Chart generated.";

        drawAstroLines(data);

        // Stop decorative globe rotation once the generated chart is on screen.
        if (typeof window.freezeAstroGlobe === "function") {
            window.freezeAstroGlobe();
        }

        // On mobile, slide the completed form fully out of the way.
        if (typeof window.collapseAstroForm === "function") {
            window.collapseAstroForm();
        }

    }

    catch (error) {

        console.error(error);

        status.style.color = "#ff7777";
        status.textContent = error.message;

    }

});

// ---------- Mobile retractable birth form ----------
(() => {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    let handle = document.getElementById("mobile-form-handle");

    if (!handle) {
        handle = document.createElement("button");
        handle.type = "button";
        handle.id = "mobile-form-handle";
        handle.setAttribute("aria-label", "Hide birth chart form");
        handle.setAttribute("aria-expanded", "true");
        handle.textContent = "⌃";
        sidebar.prepend(handle);
    }

    const isMobile = () => window.matchMedia("(max-width: 900px)").matches;
    let collapsed = false;
    let startY = null;

    function setPanelOffset() {
        if (!isMobile()) {
            sidebar.style.transform = "";
            return;
        }

        if (collapsed) {
            // Move the ENTIRE panel above the viewport.
            // The handle is absolutely positioned below it, so it alone remains visible.
            const top = sidebar.getBoundingClientRect().top;
            const panelHeight = sidebar.offsetHeight;
            const safeGap = 8;
            sidebar.style.transform =
                `translateY(-${Math.ceil(top + panelHeight + safeGap)}px)`;
        } else {
            sidebar.style.transform = "translateY(0)";
            sidebar.scrollTop = 0;
        }
    }

    function collapsePanel() {
        if (!isMobile()) return;
        collapsed = true;
        sidebar.classList.add("mobile-collapsed");
        handle.textContent = "⌄";
        handle.setAttribute("aria-label", "Show birth chart form");
        handle.setAttribute("aria-expanded", "false");
        requestAnimationFrame(setPanelOffset);
    }

    function expandPanel() {
        collapsed = false;
        sidebar.classList.remove("mobile-collapsed");
        sidebar.style.transform = "translateY(0)";
        sidebar.scrollTop = 0;
        handle.textContent = "⌃";
        handle.setAttribute("aria-label", "Hide birth chart form");
        handle.setAttribute("aria-expanded", "true");
    }

    handle.addEventListener("click", () => {
        collapsed ? expandPanel() : collapsePanel();
    });

    sidebar.addEventListener("touchstart", (event) => {
        if (event.touches.length !== 1) return;
        startY = event.touches[0].clientY;
    }, { passive: true });

    sidebar.addEventListener("touchend", (event) => {
        if (startY === null || !event.changedTouches.length) return;

        const deltaY = event.changedTouches[0].clientY - startY;
        startY = null;

        if (deltaY < -55 && !collapsed) collapsePanel();
        if (deltaY > 55 && collapsed) expandPanel();
    }, { passive: true });

    window.addEventListener("resize", () => {
        if (!isMobile()) {
            collapsed = false;
            sidebar.classList.remove("mobile-collapsed");
            sidebar.style.transform = "";
            handle.textContent = "⌃";
            handle.setAttribute("aria-expanded", "true");
        } else {
            requestAnimationFrame(setPanelOffset);
        }
    });

    // Called after a successful chart generation.
    window.collapseAstroForm = collapsePanel;
})();
