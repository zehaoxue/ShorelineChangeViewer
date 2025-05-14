//config
const esriToken = 'AAPTxy8BH1VEsoebNVZXo8HurFPAvfahFkXkFo1XVG-bfLoSsiEyvnpLZZZptCEuCC7nq5xa8uc0BzBjfVdId2UfyCK7nm7JyHvBPHBGKhRGhZY5WKUTFFouDxq0flT9prWX4Zw_Fmji1pr9xgj8S3BG8yF5amuJnKLBf0tP-Iif1WHmz3dsAu-fvYMJ0NRg0tnuJXP4hEy2q9NOo1c0Dcx87yfXVsxos7kM6YcfiUKEyjEk33wm-BC6OOnLAui3uo1EAT1_GrM97IOj'
const baseURL = 'http://44.225.111.109/DATA/shoreline_data/';

//folder paths
const baselineFolder = baseURL + 'baseline/';
const transectLTFolder = baseURL + 'intersectsLT/';
const transectSTFolder = baseURL + 'intersectsST/';
const ratesLTFolder = baseURL + 'ratesLT/';
const ratesSTFolder = baseURL + 'ratesST/';
const shorelinesFolder = baseURL + 'shorelines/';


const folderNames = [
    "baseline",
    "intersectsLT",
    "intersectsST",
    "ratesLT",
    "ratesST",
    "shorelines"];

let default_view = {
    center: [38.1863, -74.8773],
    zoom: 7
};

const map = initializeMap("mapId", esriToken);

function initializeMap(mapId, esriToken) {


    const {center, zoom} = getMapViewFromUrl();

    const map = L.map(mapId, {
        attributionControl: false,
        zoomControl: false,
        maxZoom: 19,
        center: center,
        zoom: zoom
    });



    //add basemaps
    const esriTopoVectorBasemap = L.esri.Vector.vectorBasemapLayer('arcgis/topographic', {
        token: esriToken,
        worldview: "unitedStatesOfAmerica"
    });
    const esriLightGrayVectorBasemap = L.esri.Vector.vectorBasemapLayer('arcgis/light-gray', {
        token: esriToken,
        worldview: "unitedStatesOfAmerica"
    });
    const esriImageryBasemap = L.esri.Vector.vectorBasemapLayer('arcgis/imagery', {
        token: esriToken,
        worldview: "unitedStatesOfAmerica"
    });

    const basemaps = {
        "Topographic": esriTopoVectorBasemap,
        "Light Gray": esriLightGrayVectorBasemap,
        "Imagery": esriImageryBasemap
    };

    map.addLayer(esriTopoVectorBasemap);
    L.control.layers(basemaps).addTo(map);

    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);


    function createLeafletButton(options) {
        const {
            position = 'bottomright',
            title = '',
            iconHTML = '',
            clickHandler = () => {}
        } = options;

        const control = L.control({ position });

        control.onAdd = function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            const button = L.DomUtil.create('a', 'leaflet-style-button-inner', container);
            button.href = '#';
            button.title = title;
            button.innerHTML = iconHTML;

            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.on(button, 'click', function(e) {
                L.DomEvent.preventDefault(e);
                clickHandler();
            });

            return container;
        };

        return control;
    }

    const fullExtentButton = createLeafletButton({
        title: 'Go to full extent',
        iconHTML: '<i class="fas fa-expand text-dark"></i>',
        clickHandler: fullExtent
    });
    fullExtentButton.addTo(map);

    const resetButton = createLeafletButton({
        title: 'Reset view',
        iconHTML: '<i class="fas fa-eraser text-dark"></i>',
        clickHandler: clearMap
    });
    resetButton.addTo(map);

    const tableButton = createLeafletButton({
        position: 'topright',
        title: 'Open Data Table',
        iconHTML: '<i class="fas fa-table text-dark"></i>',
        clickHandler: clearMap
    });
    tableButton.addTo(map);

    const infoButton = createLeafletButton({
        position: 'bottomleft',
        title: 'More Information',
        iconHTML: '<i class="fas fa-question-circle text-dark"></i>',
        clickHandler: clearMap
    });
    infoButton.addTo(map);


    return map;
}





let layersList = {};
let featureGroup = new L.FeatureGroup();
featureGroup.addTo(map);
let buttonIdSet = new Set;

function fullExtent() {
    //slightly different action if full extent is pressed
    if (featureGroup.getLayers().length) {
        map.fitBounds(featureGroup.getBounds());
    } else {
        map.setView([38.1863, -74.8773], 7);
    }
}

function clearMap(){
    featureGroup.clearLayers();
    layersList = {};
    buttonIdSet.clear();
    $('.layer-button').removeClass('selected')
    fullExtent()
}


document.addEventListener('DOMContentLoaded', function () {


    //jquery for handling button-clicking
    $('.layer-button').on('click', function () {
        layerButtonClicked(this.id);
    });

    $('.menu-button').on('click', function () {
        menuButtonClicked(this.id);
    });

    let layersOn = getLayersFromUrl()
    layersOn.forEach(buttonId => {
        layerButtonClicked(buttonId);
    })



    function clearMap(){
        featureGroup.clearLayers();
        layersList = {};
        $('.layer-button').removeClass('selected')
    }

    // //TODO
    // function menuButtonClicked(buttonId){
    //     if (buttonId === "menu-clear"){
    //         clearMap();
    //     } else if (buttonId === "menu-fullExtent"){
    //         fullExtent();
    //     } else if (buttonId === "menu-help"){
    //         toggleSidebar();
    //         openInfoModal();
    //     } else if (buttonId === "menu-close"){
    //         toggleSidebar();
    //     }
    // }

    function layerButtonClicked(buttonId) {
        console.log('Clicked button ID:', buttonId);
        let requestFolderURL = baseURL + buttonId + "/";
        loadGeoJSONFromDirectory(requestFolderURL, buttonId);
    }


    async function loadGeoJSONFromDirectory(requestFolderURL, buttonId) {

        // load folder html page
        console.log('Requesting folder:', requestFolderURL);
        const response = await fetch(requestFolderURL);
        if (!response.ok) throw new Error("Failed to load directory HTML:" + response.status);

        const htmlText = await response.text();


        // find <a> tags and get .geojson files
        const parser = new DOMParser();
        const htmlDoc = parser.parseFromString(htmlText, "text/html");

        const nodeList = htmlDoc.querySelectorAll("a");
        const links = Array.from(nodeList);
        const geojsonFiles = links
            .map(link => link.getAttribute("href"))
            .filter(href => href && href.toLowerCase().endsWith(".geojson"))
            .map(href => href.split("/").pop());

        // request each .geojson file and add to map
        for (const fileName of geojsonFiles) {
            const fullURL = requestFolderURL + fileName

            if (fullURL in layersList) {
                featureGroup.removeLayer(layersList[fullURL]);
                delete layersList[fullURL];
                buttonIdSet.delete(buttonId);
                updateUrlParams(map);
                $('#' + buttonId).removeClass('selected');
            } else {
                $('#' + buttonId).addClass('selected');

                const geojsonResponse = await fetch(fullURL);
                if (!geojsonResponse.ok) throw new Error("Failed to load" + fullURL + " : " + geojsonResponse.status);

                const data = await geojsonResponse.json();
                console.log(fileName)
                processGeoJSONVectorTile(data, buttonId, fullURL)
            }
        }

    }


    function processGeoJSONVectorTile(data, buttonId, fullURL){
        let vtLayer = L.geoJSON(data, {
            style: function (feature) {
                // This style is applied to LineString and Polygon geometries
                return {
                    color: 'blue',        // border color
                    weight: 2,            // border thickness
                    opacity: 0.8,         // border opacity
                    fillColor: 'cyan',    // fill color (for polygons)
                    fillOpacity: 0.3      // fill opacity (for polygons)
                };
            },
            pointToLayer: function (feature, latlng) {
                // This is used for Point geometries
                return L.circleMarker(latlng, {
                    radius: 6,
                    fillColor: 'red',
                    color: 'black',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            }
        }).bindPopup(function (layer) {
            return `${buttonId} Name: ${fullURL}`;
        });


        featureGroup.addLayer(vtLayer);
        layersList[fullURL] = vtLayer;
        buttonIdSet.add(buttonId);
        updateUrlParams(map);
        console.log(buttonIdSet)
    }



    const controls = document.querySelectorAll('.leaflet-control a[title]');

    controls.forEach(button => {
        let tooltip;

        button.addEventListener('mouseenter', () => {
            const title = button.getAttribute('title');
            if (!title) return;

            // Prevent default browser tooltip
            button.dataset.title = title;
            button.removeAttribute('title');

            tooltip = document.createElement('div');
            tooltip.className = 'custom-tooltip';
            tooltip.innerText = title;
            document.body.appendChild(tooltip);

            // Wait for tooltip to render before measuring
            requestAnimationFrame(() => {
                const rect = button.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect();

                let left = rect.left - tooltipRect.width - 6;
                if (left < 0) {
                    // fallback if too far left
                    left = rect.right + 6;
                }

                tooltip.style.left = `${left}px`;
                tooltip.style.top = `${rect.top + window.scrollY + (rect.height - tooltipRect.height) / 2}px`;
                tooltip.style.opacity = '1';
            });
        });

        button.addEventListener('mouseleave', () => {
            if (tooltip) {
                tooltip.remove();
                tooltip = null;
            }

            // Restore the original title
            if (button.dataset.title) {
                button.setAttribute('title', button.dataset.title);
                delete button.dataset.title;
            }
        });
    });



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


function getMapViewFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const lat = parseFloat(params.get('lat'));
    const lng = parseFloat(params.get('lng'));
    const zoom = parseInt(params.get('zoom'), 10);

    if (
        !isNaN(lat) &&
        !isNaN(lng) &&
        !isNaN(zoom) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180 &&
        zoom >= 0 && zoom <= 19
    ) {
        return {center: [lat, lng], zoom};
    }
    return default_view;
}

function getLayersFromUrl() {
    let params = new URLSearchParams(window.location.search);
    let layers = params.get('layers');
    if (layers) {
        // If the parameter exists, split it into a list
        layers = layers.split(",");  // ["shorelines", "ratesST"]
    } else {
        // If not present in the URL, just use an empty list
        layers = [];
    }
    console.log(layers);
    return layers
}



function updateUrlParams(map) {
    const center = map.getCenter();
    const zoom = map.getZoom();

    const params = new URLSearchParams(window.location.search);
    params.set('lat', center.lat.toFixed(5));
    params.set('lng', ((center.lng % 360 + 540) % 360 - 180).toFixed(5));
    params.set('zoom', zoom);

    if (buttonIdSet && buttonIdSet.size > 0) {
        params.set('layers', [...buttonIdSet].join(','));
    } else {
        params.delete('layers'); // optional: clean up empty state
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
}

map.on('moveend', function () {
    updateUrlParams(map);
});