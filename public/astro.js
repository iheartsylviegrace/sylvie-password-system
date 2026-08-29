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

        console.log(data);

        status.style.color = "#7cffc7";

        status.textContent =
            "Chart generated.";

        drawAstroLines(data);

    }

    catch (error) {

        console.error(error);

        status.style.color = "#ff7777";

        status.textContent = error.message;

    }

});
