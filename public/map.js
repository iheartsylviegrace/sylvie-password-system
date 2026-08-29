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

});

let userInteracting = false;

function rotateGlobe(){

    if(userInteracting) return;

    if(map.getZoom() < 4){

        map.rotateTo(
            map.getBearing() + 0.04,
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
