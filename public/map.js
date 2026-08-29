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
let selectedLineId = null;
let hoveredLineId = null;
let activePopup = null;

function rotateGlobe() {
    if (userInteracting) {
        requestAnimationFrame(rotateGlobe);
        return;
    }

    if (map.getZoom() < 4) {
        map.rotateTo(
            map.getBearing() + 0.04,
            { duration: 0 }
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

function clearLineState(id, stateName) {
    if (id === null || id === undefined) return;
    if (!map.getSource("astro-lines")) return;

    try {
        map.setFeatureState(
            {
                source: "astro-lines",
                id
            },
            {
                [stateName]: false
            }
        );
    } catch (error) {
        console.warn("Could not clear line state:", error);
    }
}

function setLineState(id, stateName) {
    if (id === null || id === undefined) return;
    if (!map.getSource("astro-lines")) return;

    try {
        map.setFeatureState(
            {
                source: "astro-lines",
                id
            },
            {
                [stateName]: true
            }
        );
    } catch (error) {
        console.warn("Could not set line state:", error);
    }
}

function popupHTML(feature) {
    const planet = feature.properties.planet || "Unknown";
    const lineType = feature.properties.lineType || "";

    return `
        <div style="
            min-width:220px;
            font-family:Inter,Helvetica,Arial,sans-serif;
            color:#111;
        ">
            <div style="
                font-size:20px;
                font-weight:600;
                margin-bottom:6px;
            ">
                ${planet} ${lineType}
            </div>

            <div style="
                font-size:13px;
                line-height:1.45;
                opacity:.78;
            ">
                Interactive interpretation panel is ready.
                Detailed planetary meanings are next.
            </div>
        </div>
    `;
}

function bindAstroLineInteractions() {
    // Bind only once for this layer lifecycle.
    // If the style reloads, Mapbox destroys the layer and we rebuild it,
    // but these delegated handlers remain safe because the layer id is reused.

    if (window.__astroInteractionsBound) {
        return;
    }

    window.__astroInteractionsBound = true;

    map.on("click", "astro-lines", (e) => {
        if (!e.features || !e.features.length) return;

        const feature = e.features[0];

        clearLineState(selectedLineId, "selected");
        selectedLineId = feature.id;
        setLineState(selectedLineId, "selected");

        if (activePopup) {
            activePopup.remove();
        }

        activePopup = new mapboxgl.Popup({
            offset: 12,
            closeButton: true,
            closeOnClick: true
        })
            .setLngLat(e.lngLat)
            .setHTML(popupHTML(feature))
            .addTo(map);
    });

    map.on("mouseenter", "astro-lines", (e) => {
        map.getCanvas().style.cursor = "pointer";

        if (!e.features || !e.features.length) return;

        const feature = e.features[0];

        if (hoveredLineId !== null && hoveredLineId !== feature.id) {
            clearLineState(hoveredLineId, "hovered");
        }

        hoveredLineId = feature.id;
        setLineState(hoveredLineId, "hovered");
    });

    map.on("mousemove", "astro-lines", (e) => {
        if (!e.features || !e.features.length) return;

        const feature = e.features[0];

        if (hoveredLineId !== feature.id) {
            clearLineState(hoveredLineId, "hovered");
            hoveredLineId = feature.id;
            setLineState(hoveredLineId, "hovered");
        }
    });

    map.on("mouseleave", "astro-lines", () => {
        map.getCanvas().style.cursor = "";

        clearLineState(hoveredLineId, "hovered");
        hoveredLineId = null;
    });
}

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
            if (!lineData) return;

            // Curved AC / DC lines
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
                        id: features.length,
                        properties: {
                            planet,
                            lineType: lineData.line_type || ""
                        },
                        geometry: {
                            type: "LineString",
                            coordinates
                        }
                    });
                }
            }

            // Meridian MC / IC lines
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
                    id: features.length,
                    properties: {
                        planet,
                        lineType: lineData.line_type || ""
                    },
                    geometry: {
                        type: "LineString",
                        coordinates
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
            selectedLineId = null;
            hoveredLineId = null;

            if (activePopup) {
                activePopup.remove();
                activePopup = null;
            }

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
                    features
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

                    "line-width": [
                        "case",
                        ["boolean", ["feature-state", "selected"], false],
                        7,
                        ["boolean", ["feature-state", "hovered"], false],
                        5,
                        3
                    ],

                    "line-opacity": [
                        "case",
                        ["boolean", ["feature-state", "selected"], false],
                        1,
                        ["boolean", ["feature-state", "hovered"], false],
                        1,
                        0.88
                    ]
                }
            });

            bindAstroLineInteractions();

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
