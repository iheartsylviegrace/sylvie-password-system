// public/astro.js

const form = document.getElementById("birth-data-form");
const status = document.getElementById("status");


// ---------- Birth city autocomplete ----------
const cityInput = document.getElementById("city");
let selectedBirthplace = null;
let citySearchTimer = null;
let citySearchController = null;

function setupCityAutocomplete() {
    if (!cityInput) return;

    const wrapper = document.createElement("div");
    wrapper.id = "city-autocomplete-wrap";

    cityInput.parentNode.insertBefore(wrapper, cityInput);
    wrapper.appendChild(cityInput);

    const suggestions = document.createElement("div");
    suggestions.id = "city-suggestions";
    suggestions.setAttribute("role", "listbox");
    wrapper.appendChild(suggestions);

    function closeSuggestions() {
        suggestions.classList.remove("is-open");
        suggestions.innerHTML = "";
    }

    function featureLabel(feature) {
        const props = feature.properties || {};
        const name = props.name || feature.text || "";
        const full =
            props.full_address ||
            feature.place_name ||
            [name, props.place_formatted].filter(Boolean).join(", ");

        return { name, full };
    }

    function featureCoordinates(feature) {
        if (Array.isArray(feature.geometry?.coordinates)) {
            return feature.geometry.coordinates;
        }
        if (Array.isArray(feature.center)) {
            return feature.center;
        }
        return null;
    }

    async function searchCities(query) {
        if (citySearchController) citySearchController.abort();
        citySearchController = new AbortController();

        const url =
            "https://api.mapbox.com/search/geocode/v6/forward" +
            "?q=" + encodeURIComponent(query) +
            "&types=place,locality" +
            "&autocomplete=true" +
            "&limit=6" +
            "&language=en" +
            "&access_token=" + encodeURIComponent(mapboxgl.accessToken);

        const response = await fetch(url, {
            signal: citySearchController.signal
        });

        if (!response.ok) {
            throw new Error("Location suggestions failed.");
        }

        return response.json();
    }

    function showSuggestions(features) {
        suggestions.innerHTML = "";

        features.forEach((feature) => {
            const coordinates = featureCoordinates(feature);
            if (!coordinates) return;

            const { name, full } = featureLabel(feature);

            const button = document.createElement("button");
            button.type = "button";
            button.className = "city-suggestion";
            button.setAttribute("role", "option");

            const nameSpan = document.createElement("span");
            nameSpan.className = "city-suggestion-name";
            nameSpan.textContent = name || full;

            const contextSpan = document.createElement("span");
            contextSpan.className = "city-suggestion-context";
            contextSpan.textContent =
                full && full !== name
                    ? full.replace(new RegExp("^" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ",?\\s*"), "")
                    : "";

            button.appendChild(nameSpan);
            if (contextSpan.textContent) button.appendChild(contextSpan);

            button.addEventListener("click", () => {
                selectedBirthplace = {
                    label: full || name,
                    longitude: Number(coordinates[0]),
                    latitude: Number(coordinates[1])
                };

                cityInput.value = selectedBirthplace.label;
                closeSuggestions();
                cityInput.focus();
            });

            suggestions.appendChild(button);
        });

        suggestions.classList.toggle(
            "is-open",
            suggestions.children.length > 0
        );
    }

    cityInput.setAttribute("autocomplete", "off");
    cityInput.setAttribute("spellcheck", "false");

    cityInput.addEventListener("input", () => {
        selectedBirthplace = null;

        clearTimeout(citySearchTimer);

        const query = cityInput.value.trim();

        if (query.length < 2) {
            closeSuggestions();
            return;
        }

        citySearchTimer = setTimeout(async () => {
            try {
                const data = await searchCities(query);
                showSuggestions(data.features || []);
            } catch (error) {
                if (error.name !== "AbortError") {
                    console.warn("City autocomplete:", error);
                    closeSuggestions();
                }
            }
        }, 220);
    });

    cityInput.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeSuggestions();
    });

    document.addEventListener("pointerdown", (event) => {
        if (!wrapper.contains(event.target)) closeSuggestions();
    });
}

setupCityAutocomplete();


form.addEventListener("submit", async (event) => {

    event.preventDefault();

    status.style.color = "#ffffff";
    status.textContent = "Finding birthplace...";

    try {

        const city = document.getElementById("city").value.trim();

        let longitude;
        let latitude;
        let resolvedBirthCity = city;

        // Prefer the exact place the user chose from the suggestions.
        if (
            selectedBirthplace &&
            selectedBirthplace.label === city &&
            Number.isFinite(selectedBirthplace.longitude) &&
            Number.isFinite(selectedBirthplace.latitude)
        ) {
            longitude = selectedBirthplace.longitude;
            latitude = selectedBirthplace.latitude;
            resolvedBirthCity = selectedBirthplace.label;
        } else {
            // If they typed a city without selecting a suggestion,
            // resolve it once at submit time instead of silently using stale coordinates.
            const geoUrl =
                "https://api.mapbox.com/search/geocode/v6/forward" +
                "?q=" + encodeURIComponent(city) +
                "&types=place,locality" +
                "&limit=1" +
                "&language=en" +
                "&access_token=" + encodeURIComponent(mapboxgl.accessToken);

            const geoResponse = await fetch(geoUrl);
            const geoData = await geoResponse.json();

            if (!geoResponse.ok || !geoData.features || !geoData.features.length) {
                status.style.color = "#ff7777";
                status.textContent = "Couldn't find that city.";
                return;
            }

            const feature = geoData.features[0];
            const coordinates =
                feature.geometry?.coordinates ||
                feature.center;

            if (!Array.isArray(coordinates)) {
                status.style.color = "#ff7777";
                status.textContent = "Couldn't find that city.";
                return;
            }

            longitude = Number(coordinates[0]);
            latitude = Number(coordinates[1]);

            resolvedBirthCity =
                feature.properties?.full_address ||
                feature.place_name ||
                city;
        }

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

                birthCity: resolvedBirthCity

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
