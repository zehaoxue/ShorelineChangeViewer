//config
const esriToken = 'AAPTxy8BH1VEsoebNVZXo8HurFPAvfahFkXkFo1XVG-bfLoSsiEyvnpLZZZptCEuCC7nq5xa8uc0BzBjfVdId2UfyCK7nm7JyHvBPHBGKhRGhZY5WKUTFFouDxq0flT9prWX4Zw_Fmji1pr9xgj8S3BG8yF5amuJnKLBf0tP-Iif1WHmz3dsAu-fvYMJ0NRg0tnuJXP4hEy2q9NOo1c0Dcx87yfXVsxos7kM6YcfiUKEyjEk33wm-BC6OOnLAui3uo1EAT1_GrM97IOj'
const baseURL = 'http://44.225.111.109/DATA/shoreline_data/';
let default_view = {
    center: [35.10643, -78.06335],
    zoom: 7
};
const buttonList = ["ratesLT", "ratesST", "shorelines"]; //used for sorting, basically the data types

const colorBins = {
    rates: [
        { threshold: -2, label: '≤ -2', color: '#b35806' },
        { threshold: -1, label: '-2 to -1', color: '#f1a340' },
        { threshold:  0, label: '-1 to 0',  color: '#fee0b6' },
        { threshold:  1, label: '0 to 1',   color: '#d8daeb' },
        { threshold:  2, label: '1 to 2',   color: '#998ec3' },
        { threshold:  Infinity, label: '> 2', color: '#542788' }
    ],
    shorelines: [
        { threshold: 1950, label: '< 1950',     color: '#1f77b4' },
        { threshold: 1970, label: '1950–1970',  color: '#2ca02c' },
        { threshold: 1990, label: '1970–1990',  color: '#ff7f0e' },
        { threshold: 2010, label: '1990–2010',  color: '#d62728' },
        { threshold: Infinity, label: '> 2010', color: '#9467bd' }
    ]
};

let layersList = {};
let activeButtonSet = new Set;
let featureGroup = new L.FeatureGroup();

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
    let cookies = document.cookie.split(';');
        for (let cookie of cookies){
            if(cookie.trim().startsWith("infoModalShown=true")) {
                return true;
            }
        }
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
        return result;
    },

    update(map) {
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

const map = initializeMap("mapId");

function initializeMap(mapId) {

    const {center, zoom} = UrlParams.getMapView();
    const map = L.map(mapId, {
        attributionControl: false,
        zoomControl: false,
        maxZoom: 19,
        center: center,
        zoom: zoom
    });

    //add basemap
    const esriTopoVectorBasemap = L.esri.Vector.vectorBasemapLayer('arcgis/topographic', {
        token: esriToken,
        worldview: "unitedStatesOfAmerica"
    });

    map.addLayer(esriTopoVectorBasemap);

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
        title: 'Clear layers',
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
        clickHandler: UI.openInfoModal
    });
    infoButton.addTo(map);

    function fullExtent() {
        if (featureGroup.getLayers().length) {
            map.fitBounds(featureGroup.getBounds());
        } else {
            map.setView(default_view.center, default_view.zoom);
        }
    }

    function clearMap() {
        featureGroup.clearLayers();
        layersList = {};
        activeButtonSet.clear();
        $('.layer-button').removeClass('selected')
        fullExtent()
    }

    const controls = document.querySelectorAll('.leaflet-control [title], #menuInfo [title]');


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

    const legendControl = L.control({ position: 'bottomleft' });

    legendControl.onAdd = function () {
        const div = L.DomUtil.create('div', 'info legend');
        div.id = 'mapLegend';
        return div;
    };

    if (!UI.hasSeenModal()) {
        document.getElementById('infoModal').style.display = 'flex';
    }

    legendControl.addTo(map);
    featureGroup.addTo(map);
    return map;
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
                    updateLegend();
                    $('#' + buttonId).removeClass('selected');
                } else {
                    $('#' + buttonId).addClass('selected');

                    const geojsonResponse = await fetch(fullURL);
                    if (!geojsonResponse.ok) throw new Error("Failed to load" + fullURL + " : " + geojsonResponse.status);

                    const data = await geojsonResponse.json();
                    processGeoJSON(data, buttonId, fullURL);
                }
            }
        } catch (error) {
            console.error(error);
            alert("Error loading GeoJSON data.");
        } finally {
            UrlParams.update(map);
            UI.hideSpinner();
        }
    }

    function processGeoJSON(data, buttonId, fullURL) {
        const styleForLayer = getLayerStyle(buttonId);

        const geoJsonLayer = L.geoJSON(data, {
            style: function (feature) {
                // LineString and Polygon style
                return styleForLayer(feature);
            }
        }).bindPopup(layer => {
            const props = layer.feature.properties;
            return Object.entries(props)
                .map(([k, v]) => `<strong>${k}:</strong> ${v}`)
                .join("<br>");
        });

        featureGroup.addLayer(geoJsonLayer);
        layersList[fullURL] = geoJsonLayer;
        activeButtonSet.add(buttonId);
        UrlParams.update(map);
        updateLegend();
    }

    // Style logic
    function getLayerStyle(buttonId) {

        if (buttonId === 'shorelines') {
            return feature => {
                const year = parseInt(feature?.properties?.Year_, 10);
                return {
                    color: getBinnedColor(year, colorBins.shorelines),
                    weight: getLineWeight(map.getZoom()),
                    opacity: 0.8
                };
            };
        }

        if (buttonId === 'ratesLT' || buttonId === 'ratesST') {
            return feature => {
                const field = buttonId === 'ratesLT' ? 'LRR' : 'EPR';
                const value = parseFloat(feature?.properties?.[field]);
                return {
                    color: getBinnedColor(value, colorBins.rates),
                    weight: getLineWeight(map.getZoom()),
                    opacity: 0.9
                };
            };
        }

        return () => styles[buttonId] || { color: 'gray', weight: 2, opacity: 0.8 };
    }

    //
    function getLineWeight(zoom) {
        return Math.log2(zoom);
        // return Math.max(1, Math.log2(zoom));
    }

    function getBinnedColor(value, bins) {
        if (isNaN(value)) return '#999';
        for (const bin of bins) {
            if (value < bin.threshold) return bin.color;
        }
        return bins[bins.length - 1]?.color || '#999'; // fallback to last color if needed
    }

    //update legend
    function updateLegend() {
        const legend = document.getElementById('mapLegend');
        if (!legend) return;
        legend.innerHTML = '';

        buttonList.forEach(buttonId => {
            if (!activeButtonSet.has(buttonId)) return;

            if (buttonId === 'ratesLT' || buttonId === 'ratesST') {
                const label = buttonId === 'ratesLT' ? 'Long-term Rates<br>(m/year)' : 'Short-term Rates<br>(m/year)';
                legend.innerHTML += `<strong>${label}</strong><br>`;
                colorBins.rates.forEach(bin => {
                    legend.innerHTML += `<i style="background:${bin.color}"></i> ${bin.label}<br>`;
                });
            }

            if (buttonId === 'shorelines') {
                legend.innerHTML += `<strong>Shoreline Years</strong><br>`;
                colorBins.shorelines.forEach(bin => {
                    legend.innerHTML += `<i style="background:${bin.color}"></i> ${bin.label}<br>`;
                });
            }
        });

        if (legend.innerHTML === '') {
            legend.innerHTML = '<em>No layer selected</em>';
        }
    }
    //call it immediately to generate the empty text
    updateLegend()

    //update url params on move
    map.on('moveend', function () {
        UrlParams.update(map);
    });

});
