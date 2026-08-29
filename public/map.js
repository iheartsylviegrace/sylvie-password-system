// public/map.js

mapboxgl.accessToken =
"pk.eyJ1Ijoic3lsdmllZ3JhY2UiLCJhIjoiY210ZG5idXF5MDVzbzM0b2puMXZscDk5NiJ9.PToyVgmuXaELzF8xoMynmg";

const map = new mapboxgl.Map({

    container: "map",

    style: "mapbox://styles/mapbox/standard-satellite",

    projection: "globe",

    center: [0, 15],

    zoom: 1.45,

    pitch: 0,

    bearing: 0,

    antialias: true,

    config: {

        basemap: {

            showRoadLabels: false,
            showPointOfInterestLabels: false,
            showPlaceLabels: false,
            showTransitLabels: false,
            showPedestrianRoads: false,
            showRoadsAndTransit: false,
            showAdminBoundaries: false

        }

    }

});

window.map = map;

map.addControl(
    new mapboxgl.NavigationControl(),
    "top-right"
);

map.on("style.load", () => {

    map.setProjection("globe");

    map.setFog({

        color: "rgb(170,200,235)",

        "high-color": "rgb(25,45,90)",

        "space-color": "rgb(2,2,8)",

        "horizon-blend": 0.08,

        "star-intensity": 0.8

    });

    if (window.currentAstroData) {

        drawAstroLines(window.currentAstroData);

    }

});


let userInteracting = false;


function rotateGlobe() {

    if (userInteracting) {

        requestAnimationFrame(rotateGlobe);
        return;

    }

    if (map.getZoom() < 4) {

        map.rotateTo(
            map.getBearing() + 0.04,
            {
                duration: 0
            }
        );

    }

    requestAnimationFrame(rotateGlobe);

}


map.on("mousedown", () => {

    userInteracting = true;

});


map.on("mouseup", () => {

    userInteracting = false;

});


map.on("dragend", () => {

    userInteracting = false;

});


map.on("touchstart", () => {

    userInteracting = true;

});


map.on("touchend", () => {

    userInteracting = false;

});


map.on("load", () => {

    rotateGlobe();

});


function drawAstroLines(data) {

    if (!data || !Array.isArray(data.lines)) {

        console.error("No astrocartography lines found.", data);
        return;

    }


    const features = [];


    data.lines.forEach((planetData) => {

        const planet = planetData.object || "Unknown";

        const lineGroups = [
            planetData.asc,
            planetData.dsc,
            planetData.ic,
            planetData.mc
        ];


        lineGroups.forEach((lineData) => {

            if (!lineData) {

                return;

            }


            /*
            CURVED LINES
            AC / DC normally arrive as:
            {
                kind: "curve",
                line_type: "AC",
                points: [...]
            }
            */

            if (
                lineData.kind === "curve" &&
                Array.isArray(lineData.points) &&
                lineData.points.length >= 2
            ) {

                const coordinates = lineData.points
                    .filter((point) =>
                        Number.isFinite(point.longitude_deg) &&
                        Number.isFinite(point.latitude_deg)
                    )
                    .map((point) => [

                        point.longitude_deg,
                        point.latitude_deg

                    ]);


                if (coordinates.length >= 2) {

                    features.push({

                        type: "Feature",

                        properties: {

                            planet: planet,
                            lineType: lineData.line_type || ""

                        },

                        geometry: {

                            type: "LineString",
                            coordinates: coordinates

                        }

                    });

                }

            }


            /*
            MERIDIAN LINES
            MC / IC normally arrive as:
            {
                kind: "meridian",
                line_type: "MC",
                longitude_deg: ...
            }

            These don't contain a points array, so we create
            the north/south line ourselves.
            */

            else if (
                lineData.kind === "meridian" &&
                Number.isFinite(lineData.longitude_deg)
            ) {

                const longitude = lineData.longitude_deg;

                const coordinates = [];


                for (let latitude = -85; latitude <= 85; latitude += 5) {

                    coordinates.push([

                        longitude,
                        latitude

                    ]);

                }


                features.push({

                    type: "Feature",

                    properties: {

                        planet: planet,
                        lineType: lineData.line_type || ""

                    },

                    geometry: {

                        type: "LineString",
                        coordinates: coordinates

                    }

                });

            }

        });

    });


    console.log(
        "Astrocartography GeoJSON features:",
        features.length,
        features
    );


    function addLines() {

        try {

            if (map.getLayer("astro-lines")) {

                map.removeLayer("astro-lines");

            }

            if (map.getSource("astro-lines")) {

                map.removeSource("astro-lines");

            }


            map.addSource("astro-lines", {

                type: "geojson",

                data: {

                    type: "FeatureCollection",
                    features: features

                }

            });


            map.addLayer({

                id: "astro-lines",

                type: "line",

                source: "astro-lines",

                layout: {

                    "line-join": "round",
                    "line-cap": "round"

                },

                paint: {

                    "line-color": [

                        "match",

                        ["get", "planet"],

                        "Sun", "#FFD84D",

                        "Moon", "#DDE9FF",

                        "Mercury", "#66FFFF",

                        "Venus", "#FF66CC",

                        "Mars", "#FF4040",

                        "Jupiter", "#FFB366",

                        "Saturn", "#FFE066",

                        "Uranus", "#66FFEE",

                        "Neptune", "#4F7BFF",

                        "Pluto", "#CC66FF",

                        "#FFFFFF"

                    ],

                    "line-width": 3,

                    "line-opacity": 0.95

                }

            });


            console.log(
                "Astrocartography lines added successfully."
            );

        }

        catch (error) {

            console.error(
                "MAPBOX LAYER ERROR",
                error
            );

        }

    }


    if (map.isStyleLoaded()) {

        addLines();

    }

    else {

        map.once("style.load", addLines);

    }

}
