// public/astro.js

const form = document.getElementById("birth-data-form");
const status = document.getElementById("status");

const sidebar = document.getElementById("sidebar");
const sidebarHandle = document.getElementById("sidebar-handle");

// On phones/tablets, swipe the glass form up to tuck it away and down to bring it back.
if (sidebar && sidebarHandle) {
    let startY = 0;
    let currentY = 0;

    sidebarHandle.addEventListener("touchstart", (event) => {
        startY = event.touches[0].clientY;
        currentY = startY;
    }, { passive: true });

    sidebarHandle.addEventListener("touchmove", (event) => {
        currentY = event.touches[0].clientY;
    }, { passive: true });

    sidebarHandle.addEventListener("touchend", () => {
        const distance = currentY - startY;
        if (distance < -35) sidebar.classList.add("is-collapsed");
        if (distance > 35) sidebar.classList.remove("is-collapsed");
    });

    // A tap on the handle also toggles it, useful for accessibility and desktop emulation.
    sidebarHandle.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 900px)").matches) {
            sidebar.classList.toggle("is-collapsed");
        }
    });
}


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

        // On mobile, tuck the completed form up so the chart is immediately visible.
        if (sidebar && window.matchMedia("(max-width: 900px)").matches) {
            sidebar.classList.add("is-collapsed");
        }

    }

    catch (error) {

        console.error(error);

        status.style.color = "#ff7777";
        status.textContent = error.message;

    }

});
