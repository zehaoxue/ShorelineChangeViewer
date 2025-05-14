//config
const esriToken = 'AAPTxy8BH1VEsoebNVZXo8HurFPAvfahFkXkFo1XVG-bfLoSsiEyvnpLZZZptCEuCC7nq5xa8uc0BzBjfVdId2UfyCK7nm7JyHvBPHBGKhRGhZY5WKUTFFouDxq0flT9prWX4Zw_Fmji1pr9xgj8S3BG8yF5amuJnKLBf0tP-Iif1WHmz3dsAu-fvYMJ0NRg0tnuJXP4hEy2q9NOo1c0Dcx87yfXVsxos7kM6YcfiUKEyjEk33wm-BC6OOnLAui3uo1EAT1_GrM97IOj'
const baseURL = 'http://44.225.111.109/DATA/shoreline_data/';
let default_view = {
    center: [38.1863, -74.8773],
    zoom: 7
};

//UI functions
const UI = {
    toggleSidebar() {
        const sidebar = document.getElementById("mySidebar");
        const main = document.getElementById("main");
        const menuInfo = document.getElementById("menuInfo");

        sidebar.classList.toggle("open");
        main.classList.toggle("shifted");
        menuInfo.classList.toggle("shifted");
    },

    setModalCookie() {
        document.cookie = "infoModalShown=true; path=/; max-age=2592000";
    },

    hasSeenModal() {
        return document.cookie.split(';').some(cookie =>
            cookie.trim().startsWith("infoModalShown=true")
        );
    },

    closeInfoModal() {
        document.getElementById('infoModal').style.display = 'none';
        this.setModalCookie();
    },

    openInfoModal() {
        document.getElementById('infoModal').style.display = 'flex';
    },

    showSpinner() {
        document.getElementById("loadingSpinner").classList.remove("hidden");
    },

    hideSpinner() {
        document.getElementById("loadingSpinner").classList.add("hidden");
    }
};
//URL parameter functions
const UrlParams = {
    getMapView() {
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
    },

    getActiveLayerIds() {
        const params = new URLSearchParams(window.location.search);
        const layers = params.get('layers');
        const result = layers ? layers.split(",") : [];
        console.log(result);
        return result;
    },

    update(map, activeButtonSet) {
        const center = map.getCenter();
        const zoom = map.getZoom();

        const params = new URLSearchParams(window.location.search);
        params.set('lat', center.lat.toFixed(5));
        params.set('lng', ((center.lng % 360 + 540) % 360 - 180).toFixed(5));
        params.set('zoom', zoom);

        if (activeButtonSet && activeButtonSet.size > 0) {
            params.set('layers', [...activeButtonSet].join(','));
        } else {
            params.delete('layers');
        }

        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', newUrl);
    }
};

const map = initializeMap("mapId", esriToken);

function initializeMap(mapId, esriToken) {
    const {center, zoom} = UrlParams.getMapView();
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
            clickHandler = () => {
            }
        } = options;

        const control = L.control({position});

        control.onAdd = function (map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            const button = L.DomUtil.create('a', 'leaflet-style-button-inner', container);
            button.href = '#';
            button.title = title;
            button.innerHTML = iconHTML;

            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.on(button, 'click', function (e) {
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
let activeButtonSet = new Set;


function fullExtent() {
    //slightly different action if full extent is pressed
    if (featureGroup.getLayers().length) {
        map.fitBounds(featureGroup.getBounds());
    } else {
        map.setView([38.1863, -74.8773], 7);
    }
}

function clearMap() {
    featureGroup.clearLayers();
    layersList = {};
    activeButtonSet.clear();
    $('.layer-button').removeClass('selected')
    fullExtent()
}


document.addEventListener('DOMContentLoaded', function () {


    //jquery for handling button-clicking
    $('.layer-button').on('click', function () {
        layerButtonClicked(this.id);
    });


    let initialActiveLayers = UrlParams.getActiveLayerIds()
    initialActiveLayers.forEach(buttonId => {
        layerButtonClicked(buttonId);
    })

    // $('.menu-button').on('click', function () {
    //     menuButtonClicked(this.id);
    // });
    // //TODO
    // function menuButtonClicked(buttonId){
    //     if (buttonId === "menu-clear"){
    //         clearMap();
    //     } else if (buttonId === "menu-fullExtent"){
    //         fullExtent();
    //     } else if (buttonId === "menu-help"){
    //         UI.toggleSidebar();
    //         UI.openInfoModal();
    //     } else if (buttonId === "menu-close"){
    //         UI.toggleSidebar();
    //     }
    // }

    function layerButtonClicked(buttonId) {
        console.log('Clicked button ID:', buttonId);
        let requestFolderURL = baseURL + buttonId + "/";
        loadGeoJSONFromDirectory(requestFolderURL, buttonId);
    }

    async function loadGeoJSONFromDirectory(requestFolderURL, buttonId) {
        // Show spinner before loading
        UI.showSpinner();
        try {
            const response = await fetch(requestFolderURL);
            if (!response.ok) throw new Error("Failed to load directory HTML:" + response.status);

            const htmlText = await response.text();
            const parser = new DOMParser();
            const htmlDoc = parser.parseFromString(htmlText, "text/html");

            const nodeList = htmlDoc.querySelectorAll("a");
            const links = Array.from(nodeList);
            const geojsonFiles = links
                .map(link => link.getAttribute("href"))
                .filter(href => href && href.toLowerCase().endsWith(".geojson"))
                .map(href => href.split("/").pop());

            for (const fileName of geojsonFiles) {
                const fullURL = requestFolderURL + fileName;

                if (fullURL in layersList) {
                    featureGroup.removeLayer(layersList[fullURL]);
                    delete layersList[fullURL];
                    activeButtonSet.delete(buttonId);
                    UrlParams.update(map);
                    $('#' + buttonId).removeClass('selected');
                } else {
                    $('#' + buttonId).addClass('selected');

                    const geojsonResponse = await fetch(fullURL);
                    if (!geojsonResponse.ok) throw new Error("Failed to load" + fullURL + " : " + geojsonResponse.status);

                    const data = await geojsonResponse.json();
                    processGeoJSONVectorTile(data, buttonId, fullURL);
                }
            }
        } catch (error) {
            console.error(error);
            alert("Error loading GeoJSON data.");
        } finally {
            UI.hideSpinner();
        }
    }


    function processGeoJSONVectorTile(data, buttonId, fullURL) {
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
        }).bindPopup(layer => {
            const props = layer.feature.properties;
            return Object.entries(props).map(([k, v]) => `<strong>${k}:</strong> ${v}`).join("<br>");
        });


        featureGroup.addLayer(vtLayer);
        layersList[fullURL] = vtLayer;
        activeButtonSet.add(buttonId);
        UrlParams.update(map);
        console.log(activeButtonSet)
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


//
// function getMapViewFromUrl() {
//     const params = new URLSearchParams(window.location.search);
//     const lat = parseFloat(params.get('lat'));
//     const lng = parseFloat(params.get('lng'));
//     const zoom = parseInt(params.get('zoom'), 10);
//
//     if (
//         !isNaN(lat) &&
//         !isNaN(lng) &&
//         !isNaN(zoom) &&
//         lat >= -90 && lat <= 90 &&
//         lng >= -180 && lng <= 180 &&
//         zoom >= 0 && zoom <= 19
//     ) {
//         return {center: [lat, lng], zoom};
//     }
//     return default_view;
// }
//
// function getLayersFromUrl() {
//     let params = new URLSearchParams(window.location.search);
//     let layers = params.get('layers');
//     if (layers) {
//         // If the parameter exists, split it into a list
//         layers = layers.split(",");  // ["shorelines", "ratesST"]
//     } else {
//         // If not present in the URL, just use an empty list
//         layers = [];
//     }
//     console.log(layers);
//     return layers
// }
//
//
// function updateUrlParams(map) {
//     const center = map.getCenter();
//     const zoom = map.getZoom();
//
//     const params = new URLSearchParams(window.location.search);
//     params.set('lat', center.lat.toFixed(5));
//     params.set('lng', ((center.lng % 360 + 540) % 360 - 180).toFixed(5));
//     params.set('zoom', zoom);
//
//     if (activeButtonSet && activeButtonSet.size > 0) {
//         params.set('layers', [...activeButtonSet].join(','));
//     } else {
//         params.delete('layers'); // optional: clean up empty state
//     }
//
//     const newUrl = `${window.location.pathname}?${params.toString()}`;
//     window.history.replaceState({}, '', newUrl);
// }


map.on('moveend', function () {
    UrlParams.update(map);
});