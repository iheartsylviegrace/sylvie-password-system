// public/lines.js

function drawAstroLines(data) {

    // remove old lines
    if (map.getLayer("astro-lines")) {
        map.removeLayer("astro-lines");
    }

    if (map.getSource("astro-lines")) {
        map.removeSource("astro-lines");
    }

    if (!data.lines || !Array.isArray(data.lines)) {
        console.error("No astrocartography lines found.");
        return;
    }

    const features = [];

    data.lines.forEach(line => {

        if (!line.points || line.points.length < 2) return;

        const coordinates = line.points.map(point => [

            point.longitude_deg,
            point.latitude_deg

        ]);

        features.push({

            type: "Feature",

            properties: {

                object: line.object,
                line_type: line.line_type

            },

            geometry: {

                type: "LineString",
                coordinates

            }

        });

    });

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

        paint: {

            "line-color": "#ffdd55",

            "line-width": 2,

            "line-opacity": 0.9

        }

    });

}
