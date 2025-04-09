let map;
let featureGroup;
let layersList = {};

$(document).ready(function () {

    //initialize map
    map = L.map("mapId",{attributionControl: false}).setView([32.383449, -99.974561], 6);

    //add basemap layers
    let esriTopoVectorBasemap = L.esri.Vector.vectorBasemapLayer('arcgis/topographic',{token: esriToken});
    let esriLightGrayVectorBasemap = L.esri.Vector.vectorBasemapLayer('arcgis/light-gray',{token: esriToken});
    let CyclOSMBasemap = L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {maxZoom: 20});

    let basemaps = {
        "Topographic": esriTopoVectorBasemap,
        "Light Gray": esriLightGrayVectorBasemap,
        "Biking (CyclOSM)":CyclOSMBasemap
    }

    map.addLayer(esriTopoVectorBasemap);
    L.control.layers(basemaps).addTo(map);

    //add location control
    L.control.locate().addTo(map);

    featureGroup = new L.FeatureGroup();
    featureGroup.addTo(map);


    //jquery for handling button-clicking
    $('.layer-button').on('click', function () {
        layerButtonClicked(this.id);
    });

    $('.menu-button').on('click', function () {
        menuButtonClicked(this.id);
    });

    function fullExtent() {
        //slightly different action if full extent is pressed
        if (featureGroup.getLayers().length) {
            map.fitBounds(featureGroup.getBounds());
        } else {
            map.setView([32.383449, -99.974561], 6);
        }
    }

    function clearMap(){
        featureGroup.clearLayers();
        layersList = {};
        $('.layer-button').removeClass('selected')
    }

    function menuButtonClicked(buttonId){
        if (buttonId === "menu-clear"){
            clearMap();
        } else if (buttonId === "menu-fullExtent"){
            fullExtent();
        } else if (buttonId === "menu-help"){
            toggleSidebar();
            openInfoModal();
        } else if (buttonId === "menu-close"){
            toggleSidebar();
        }
    }

    function layerButtonClicked(buttonId) {
        console.log('Clicked button ID:', buttonId);

        if (buttonId === "FullExtent") {
            fullExtent();
        } else {

            //check to see if layer is already displaying, if so, remove, if not, send ajax request
            if (buttonId in layersList) {
                featureGroup.removeLayer(layersList[buttonId]);
                delete layersList[buttonId];
                console.log('Removed layer:', buttonId);

                $('#' + buttonId).removeClass('selected');
            } else {
                $('#' + buttonId).addClass('selected');

                let requesetURL = baseURL + buttonId + '_THC.geojson';
                console.log('Requesting', requesetURL);
                $.ajax({
                    dataType: "json",
                    url: requesetURL,
                    success: function(data) {
                        processGeoJSON(data, buttonId); //passing buttonID to processing function to be added to active layers list
                    },
                });
            }
        }

    }

    //big ol function for handling drawing json layers, popups, and labels
    function processGeoJSON(data, buttonId) {
        console.log("Received GeoJSON:", data);

        let jsonLayer

        const regionColors = {
            'Brazos': '#f94144',
            'Forest': '#f3722c',
            'Forts': '#f8961e',
            'Hill Country': '#f9c74f',
            'Independence': '#90be6d',
            'Lakes': '#43aa8b',
            'Mountain': '#577590',
            'Pecos': '#277da1',
            'Plains': '#9c89b8',
            'Tropical': '#c74496'
        };

        //add labels to polygons and polylines, generate style and popup info for all layers
        if (buttonId === "Region" ) {
            jsonLayer = L.geoJson(data, {
                style: function (feature) {
                    let fillColor = regionColors[feature.properties.REGION]
                    return {
                        color: '#333333',
                        weight: 2,
                        opacity: 1,
                        fillColor: fillColor,
                        fillOpacity: 0.4
                    };
                },
                onEachFeature: function (feature, layer) {
                    layer.bindTooltip(feature.properties.REGION + " Region", {
                        permanent: true,
                        direction: 'center',
                        className: 'polygon-label'
                    });
                }
            }).bindPopup(function (layer) {
                return `<span>${layer.feature.properties.REGION} THC Region</span>`;
            });
        } else if (buttonId === "Trail") {
            jsonLayer = L.geoJson(data, {
                style: function () {
                    return {
                        color: '#265022',
                        weight: 4,
                        opacity: 0.8,
                        dashArray: '6,4'
                    };
                },
                onEachFeature: function (feature, layer) {
                    layer.bindTooltip(feature.properties.TRAIL + " Trail", {
                        permanent: true,
                        direction: 'center',
                        className: 'polygon-label'
                    });
                }
            }).bindPopup(function (layer) {
                return `<span>${layer.feature.properties.TRAIL} Trail</span>`;
            });
        } else{
            //if it's not a line or polygon, treat it as points
            jsonLayer = L.geoJSON(data, {
                pointToLayer: function (feature, latlng) {
                    const icon = layerIcons[buttonId];
                    return L.marker(latlng, { icon: icon });
                }
            }).bindPopup(function (layer) {
                return `<span>${buttonId} Name: ${layer.feature.properties.NAME}</span>`;
            });

        }

        //add new json layer to layergroup within map
        featureGroup.addLayer(jsonLayer);
        layersList[buttonId] = jsonLayer;
        console.log("Layer group:", featureGroup);
    }



    const layerIcons = {
        BBQ: L.divIcon({
            html: `
            <span class="fa-stack icon-bbq">
                <i class="fa fa-stack-2x fa-circle"></i>
                <i class="fas fa-stack-1x fa-utensils"></i>
            </span>
        `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12],
            className: 'gauge-styling'
        }),
        Winery: L.divIcon({
            html: `
            <span class="fa-stack icon-winery">
                <i class="fa fa-stack-2x fa-circle"></i>
                <i class="fas fa-stack-1x fa-wine-bottle"></i>
            </span>
        `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12],
            className: 'gauge-styling'
        }),
        Brewery: L.divIcon({
            html: `
            <span class="fa-stack icon-brewery">
                <i class="fa fa-stack-2x fa-circle"></i>
                <i class="fas fa-stack-1x fa-beer"></i>
            </span>
        `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12],
            className: 'gauge-styling'
        })
    };

});

function toggleSidebar() {
    let sidebar = document.getElementById("mySidebar");
    let main = document.getElementById("main");
    let menuInfo = document.getElementById("menuInfo");

    sidebar.classList.toggle("open");
    main.classList.toggle("shifted");
    menuInfo.classList.toggle("shifted");
}


function setModalCookie() {
    document.cookie = "infoModalShown=true; path=/; max-age=2592000"
}

function hasSeenModal() {
    let cookies = document.cookie.split(';');
    for (let cookie of cookies){
        if(cookie.trim().startsWith("infoModalShown=true")) {
            return true;
        }
    }
    return false;
}

function closeInfoModal() {
    document.getElementById('infoModal').style.display = 'none';
    setModalCookie();
}

function openInfoModal() {
    document.getElementById('infoModal').style.display = 'flex';
}

if (!hasSeenModal()) {
    document.getElementById('infoModal').style.display = 'flex';
}

