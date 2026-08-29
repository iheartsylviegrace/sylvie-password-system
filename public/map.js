// public/map.js

mapboxgl.accessToken =
"pk.eyJ1Ijoic3lsdmllZ3JhY2UiLCJhIjoiY210ZG5idXF5MDVzbzM0b2puMXZscDk5NiJ9.PToyVgmuXaELzF8xoMynmg";

const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/standard-satellite",
    projection: "globe",
    center: [0, 15],
    zoom: 1.45,
    minZoom: 0.8,
    maxZoom: 18,
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
    new mapboxgl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: true
    }),
    "top-right"
);

// Make the globe easier to explore and allow close-up terrain zooming.
map.scrollZoom.enable();
map.dragPan.enable();
map.dragRotate.enable();
map.touchZoomRotate.enable();
map.doubleClickZoom.enable();
map.keyboard.enable();

// Keep rotation from fighting the user once they zoom toward real terrain.
map.on("zoomstart", () => { userInteracting = true; });
map.on("zoomend", () => { userInteracting = false; });

map.on("style.load", () => {
    map.setProjection("globe");

    // Add real 3D terrain for close-up exploration.
    if (!map.getSource("mapbox-dem")) {
        map.addSource("mapbox-dem", {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
            tileSize: 512,
            maxzoom: 14
        });
    }

    map.setTerrain({ source: "mapbox-dem", exaggeration: 1.15 });

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

    if (map.getZoom() < 2.6) {
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


// Astrocartography interpretations used by the clickable line popups.
// AC = Ascendant, DC = Descendant, MC = Midheaven, IC = Imum Coeli.
const interpretations = {
    Sun: {
        AC: {
            title: "Sun AC",
            text: "A place for visibility, vitality, confidence, and self-expression. You may feel more fully yourself here and more willing to take up space, initiate, and be seen."
        },
        DC: {
            title: "Sun DC",
            text: "Relationships become a major mirror for identity and purpose. Important partners, collaborators, or rivals can draw out your confidence and clarify who you are through connection."
        },
        MC: {
            title: "Sun MC",
            text: "Career, reputation, leadership, and public recognition are emphasized. This can be a strong place to pursue ambition, become more visible professionally, and build a name for yourself."
        },
        IC: {
            title: "Sun IC",
            text: "Home, roots, family, and your private sense of self come into focus. This can feel deeply centering and may encourage you to build a home or reconnect with what makes you feel internally secure."
        }
    },

    Moon: {
        AC: {
            title: "Moon AC",
            text: "Feelings, intuition, and sensitivity come close to the surface. You may feel unusually receptive to the environment and form immediate emotional attachments to people and places."
        },
        DC: {
            title: "Moon DC",
            text: "Relationships can feel emotionally significant, familiar, or nurturing. You may attract sensitive people or find that partnership brings your own emotional needs into sharper focus."
        },
        MC: {
            title: "Moon MC",
            text: "Your emotional life becomes more visible publicly. Work involving care, community, hospitality, food, homes, or the public can be emphasized, while professional circumstances may feel changeable."
        },
        IC: {
            title: "Moon IC",
            text: "A particularly strong line for home, memory, family, ancestry, and belonging. This place can feel instinctively familiar and may intensify both comfort and unresolved family emotions."
        }
    },

    Mercury: {
        AC: {
            title: "Mercury AC",
            text: "Curiosity, movement, conversation, learning, and networking accelerate. This is a stimulating place for writing, studying, meeting people, exchanging ideas, and reinventing how you communicate."
        },
        DC: {
            title: "Mercury DC",
            text: "Partnerships revolve around communication and intellectual exchange. You may meet teachers, writers, talkative partners, collaborators, or people who challenge the way you think."
        },
        MC: {
            title: "Mercury MC",
            text: "Communication becomes central to career and reputation. Favorable themes include writing, media, teaching, commerce, technology, research, speaking, and work that depends on connections."
        },
        IC: {
            title: "Mercury IC",
            text: "The mind turns toward home, memory, and private study. Working or writing from home can flourish, though the domestic environment may feel busy, mobile, or mentally active."
        }
    },

    Venus: {
        AC: {
            title: "Venus AC",
            text: "Charm, beauty, sociability, pleasure, and personal magnetism are heightened. This can be an especially enjoyable place for art, style, friendship, romance, and feeling comfortable in your own skin."
        },
        DC: {
            title: "Venus DC",
            text: "Partnership, attraction, cooperation, and romance are emphasized. Significant relationships may arrive more easily here, and diplomacy or creative collaboration can become especially fruitful."
        },
        MC: {
            title: "Venus MC",
            text: "Your public image can become more attractive, graceful, or socially connected. Careers involving art, music, design, beauty, hospitality, diplomacy, or relationship-building may receive support."
        },
        IC: {
            title: "Venus IC",
            text: "Comfort, beauty, affection, and harmony are drawn into home life. This can be a lovely place to nest, decorate, entertain, deepen intimate bonds, or simply enjoy a softer pace."
        }
    },

    Mars: {
        AC: {
            title: "Mars AC",
            text: "Energy, courage, competitiveness, sexuality, and initiative rise sharply. This can be excellent for action and independence, but impatience or conflict can also surface if the extra energy has nowhere to go."
        },
        DC: {
            title: "Mars DC",
            text: "Relationships become energetic, passionate, and potentially confrontational. You may attract assertive people, experience strong chemistry, or learn how to negotiate conflict and boundaries directly."
        },
        MC: {
            title: "Mars MC",
            text: "Ambition and drive become highly visible. This can accelerate career efforts, entrepreneurship, leadership, and competition, while also increasing the possibility of professional clashes."
        },
        IC: {
            title: "Mars IC",
            text: "Action and tension move into the private sphere. You may feel driven to establish independence, renovate, relocate, or confront family patterns; domestic conflict needs constructive outlets."
        }
    },

    Jupiter: {
        AC: {
            title: "Jupiter AC",
            text: "Growth, confidence, opportunity, travel, and optimism are amplified. This can broaden your world through education, new cultures, mentors, and experiences that encourage you to think bigger."
        },
        DC: {
            title: "Jupiter DC",
            text: "Relationships can bring growth, generosity, opportunity, and perspective. Helpful partners, teachers, international connections, or expansive collaborations may enter your life."
        },
        MC: {
            title: "Jupiter MC",
            text: "A classic line for professional expansion, recognition, teaching, publishing, travel, and opportunity. Ambitions can grow quickly here, though overconfidence or overcommitment is worth watching."
        },
        IC: {
            title: "Jupiter IC",
            text: "Home and inner life can feel more spacious and abundant. This may support a larger home, family growth, hospitality, study, or a deepening sense that there is room for you to flourish."
        }
    },

    Saturn: {
        AC: {
            title: "Saturn AC",
            text: "Life may feel more serious, disciplined, structured, and demanding. This line can build resilience and mastery over time, but progress often comes through patience, responsibility, and sustained effort."
        },
        DC: {
            title: "Saturn DC",
            text: "Relationships are tested for durability, commitment, boundaries, and responsibility. Connections formed here may feel weighty or karmic and can teach important lessons about reciprocity and maturity."
        },
        MC: {
            title: "Saturn MC",
            text: "Career demands discipline, accountability, and long-term construction. Recognition may arrive slowly, but this can be a powerful place to establish authority, expertise, and work with lasting consequences."
        },
        IC: {
            title: "Saturn IC",
            text: "Family, home, ancestry, and emotional foundations may carry greater responsibility. Solitude or heaviness is possible, but this line can also help you create strong internal and domestic foundations."
        }
    },

    Uranus: {
        AC: {
            title: "Uranus AC",
            text: "Freedom, experimentation, independence, and reinvention become urgent. You may behave differently here, meet unconventional people, or break abruptly with routines that no longer fit."
        },
        DC: {
            title: "Uranus DC",
            text: "Relationships can be exciting, unusual, liberating, and unpredictable. You may attract fiercely independent people or experience partnerships that require more freedom and flexibility than usual."
        },
        MC: {
            title: "Uranus MC",
            text: "Career and public identity can change suddenly or move in unconventional directions. Innovation, technology, activism, originality, and independent work are favored over rigid professional structures."
        },
        IC: {
            title: "Uranus IC",
            text: "Home life may become unconventional, mobile, or changeable. This can free you from inherited patterns and inspire a radically different way of living, though stability may be harder to maintain."
        }
    },

    Neptune: {
        AC: {
            title: "Neptune AC",
            text: "Sensitivity, imagination, spirituality, glamour, and permeability increase. This can inspire art and intuition, but identity and boundaries may feel less defined, so clarity is especially valuable."
        },
        DC: {
            title: "Neptune DC",
            text: "Relationships can feel romantic, spiritual, idealized, or difficult to define. Profound compassion is possible, but projection and blurred boundaries make discernment especially important."
        },
        MC: {
            title: "Neptune MC",
            text: "Career may become more imaginative, artistic, spiritual, charitable, or elusive. Inspiration can be strong, while practical expectations, agreements, and professional boundaries benefit from extra clarity."
        },
        IC: {
            title: "Neptune IC",
            text: "The private world becomes dreamy, intuitive, and porous. This can be restorative for retreat, art, spirituality, and contemplation, though domestic circumstances may sometimes feel vague or ungrounded."
        }
    },

    Pluto: {
        AC: {
            title: "Pluto AC",
            text: "Personal transformation, intensity, power, and psychological depth are amplified. This place can provoke profound reinvention and bring buried parts of the self to the surface."
        },
        DC: {
            title: "Pluto DC",
            text: "Relationships can become intense, magnetic, transformative, and complicated by questions of power or control. Encounters here may permanently change how you understand intimacy and partnership."
        },
        MC: {
            title: "Pluto MC",
            text: "Career, status, ambition, and power dynamics can undergo major transformation. This can be potent for influence and high-stakes work, but struggles over authority may need careful handling."
        },
        IC: {
            title: "Pluto IC",
            text: "Deep material connected with family, ancestry, home, and the unconscious may surface. This line can be emotionally intense while supporting profound healing and reconstruction at the roots."
        }
    },

    "North Node": {
        AC: {
            title: "North Node AC",
            text: "Identity and personal direction can feel pulled toward growth here. Encounters and experiences may encourage you to become a version of yourself that feels unfamiliar at first, but increasingly aligned with where you are going."
        },
        DC: {
            title: "North Node DC",
            text: "Relationships can feel unusually consequential or directional. People you meet may open doors, redirect your path, or challenge you to develop new ways of relating and collaborating."
        },
        MC: {
            title: "North Node MC",
            text: "Career and public direction can feel connected to your next chapter. Opportunities may push you toward greater visibility, responsibility, or work that feels meaningful to your long-term development."
        },
        IC: {
            title: "North Node IC",
            text: "Growth occurs through home, family, roots, and emotional foundations. This place may encourage you to build a new sense of belonging and develop an inner life that supports the person you are becoming."
        }
    },

    "South Node": {
        AC: {
            title: "South Node AC",
            text: "This place may feel immediately familiar, as though you already know how to be here. Old identities and habits can come naturally, making it comfortable but sometimes less conducive to forward movement."
        },
        DC: {
            title: "South Node DC",
            text: "Relationships may carry a strong sense of familiarity or repetition. Past relational patterns can resurface, offering both ease and an opportunity to recognize what you may be ready to outgrow."
        },
        MC: {
            title: "South Node MC",
            text: "Professional abilities can feel instinctive or already developed here. Recognition may come through familiar strengths, though the deeper question can be whether an old role still represents your future."
        },
        IC: {
            title: "South Node IC",
            text: "Home, ancestry, memory, and the past can feel especially powerful. This may be restorative and familiar, while also drawing attention to inherited patterns that no longer need to define you."
        }
    },

    Chiron: {
        AC: {
            title: "Chiron AC",
            text: "Questions of identity, vulnerability, healing, and self-acceptance may become more visible. This place can expose tender areas while also developing your capacity to guide or support others."
        },
        DC: {
            title: "Chiron DC",
            text: "Relationships may activate old wounds as well as profound opportunities for healing. Teachers, healers, students, or partners can become catalysts for greater awareness and compassion."
        },
        MC: {
            title: "Chiron MC",
            text: "Your public role may involve teaching, healing, mentoring, advocacy, or transforming difficult experience into something useful to others. Vulnerability can become part of your authority."
        },
        IC: {
            title: "Chiron IC",
            text: "Family history, belonging, and emotional foundations may reveal sensitive material. Working with these themes can create a deeper and more compassionate relationship with your roots."
        }
    }
};

window.interpretations = interpretations;


function popupHTML(feature) {
    const planet = feature.properties.planet || "Unknown";
    const lineType = feature.properties.lineType || "";

    const interpretation = window.interpretations?.[planet]?.[lineType];

    const title = interpretation?.title || `${planet} ${lineType}`;
    const text = interpretation?.text || "Interpretation coming soon.";

    return `
        <div style="min-width:260px;font-family:Inter,Helvetica,Arial,sans-serif;color:#111;">
            <div style="font-size:20px;font-weight:600;margin-bottom:8px;">
                ${title}
            </div>
            <div style="font-size:14px;line-height:1.6;">
                ${text}
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
```
