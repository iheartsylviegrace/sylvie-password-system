// public/map.js

mapboxgl.accessToken =
"pk.eyJ1Ijoic3lsdmllZ3JhY2UiLCJhIjoiY210ZG5idXF5MDVzbzM0b2puMXZscDk5NiJ9.PToyVgmuXaELzF8xoMynmg";

const map = new mapboxgl.Map({

    container: "map",

    style: "mapbox://styles/mapbox/standard-satellite",

    projection: "globe",

    center: [0,15],

    zoom: 1.45,

    pitch: 0,

    bearing: 0,

    antialias: true,

    config:{

        basemap:{

            showRoadLabels:false,
            showPointOfInterestLabels:false,
            showPlaceLabels:false,
            showTransitLabels:false,
            showPedestrianRoads:false,
            showRoadsAndTransit:false,
            showAdminBoundaries:false

        }

    }

});

window.map = map;

map.addControl(
    new mapboxgl.NavigationControl(),
    "top-right"
);

map.on("style.load",()=>{

    map.setProjection("globe");

    map.setFog({

        color:"rgb(170,200,235)",

        "high-color":"rgb(25,45,90)",

        "space-color":"rgb(2,2,8)",

        "horizon-blend":0.08,

        "star-intensity":0.8

    });

    if(window.currentAstroData){

        drawAstroLines(window.currentAstroData);

    }

});

let userInteracting = false;

function rotateGlobe(){

    if(userInteracting) return;

    if(map.getZoom() < 4){

        map.rotateTo(

            map.getBearing()+0.04,

            {

                duration:0

            }

        );

    }

    requestAnimationFrame(rotateGlobe);

}

map.on("mousedown",()=>{

    userInteracting=true;

});

map.on("mouseup",()=>{

    userInteracting=false;

});

map.on("dragend",()=>{

    userInteracting=false;

});

map.on("touchend",()=>{

    userInteracting=false;

});

map.on("load",()=>{

    rotateGlobe();

});

function drawAstroLines(data){

    if(!data.lines){

        console.log("No astro lines.");

        return;

    }

    const features = data.lines.map(line=>({

        type:"Feature",

        properties:{

            planet:line.object,

            lineType:line.line_type

        },

        geometry:{

            type:"LineString",

            coordinates:line.points.map(point=>([

                point.longitude_deg,

                point.latitude_deg

            ]))

        }

    }));

    function addLines(){

        if(map.getLayer("astro-lines")){

            map.removeLayer("astro-lines");

        }

        if(map.getSource("astro-lines")){

            map.removeSource("astro-lines");

        }

        map.addSource("astro-lines",{

            type:"geojson",

            data:{

                type:"FeatureCollection",

                features

            }

        });

        try{

            map.addLayer({

                id:"astro-lines",

                type:"line",

                source:"astro-lines",

                layout:{

                    "line-join":"round",

                    "line-cap":"round"

                },

                paint:{

                    "line-color":[

                        "match",

                        ["get","planet"],

                        "Sun","#FFD84D",

                        "Moon","#DDE9FF",

                        "Mercury","#66FFFF",

                        "Venus","#FF66CC",

                        "Mars","#FF4040",

                        "Jupiter","#FFB366",

                        "Saturn","#FFE066",

                        "Uranus","#66FFEE",

                        "Neptune","#4F7BFF",

                        "Pluto","#CC66FF",

                        "#FFFFFF"

                    ],

                    "line-width":3,

                    "line-opacity":0.95

                }

            });

            console.log("Astrocartography lines added.");

        }

        catch(error){

            console.error("MAPBOX LAYER ERROR",error);

        }

    }

    if(map.isStyleLoaded()){

        addLines();

    }

    else{

        map.once("style.load",addLines);

    }

}
