//config
const esriToken = 'AAPTxy8BH1VEsoebNVZXo8HurFPAvfahFkXkFo1XVG-bfLoSsiEyvnpLZZZptCEuCC7nq5xa8uc0BzBjfVdId2UfyCK7nm7JyHvBPHBGKhRGhZY5WKUTFFouDxq0flT9prWX4Zw_Fmji1pr9xgj8S3BG8yF5amuJnKLBf0tP-Iif1WHmz3dsAu-fvYMJ0NRg0tnuJXP4hEy2q9NOo1c0Dcx87yfXVsxos7kM6YcfiUKEyjEk33wm-BC6OOnLAui3uo1EAT1_GrM97IOj'
const baseURL = 'http://44.225.111.109/DATA/shoreline_data/';
let default_view = {
    center: [37.87485, -99.09668],
    zoom: 5
};
const buttonList = ["ratesLT", "ratesST", "shorelines"]; //used for sorting, basically the data types

const colorBins = {
    rates: [
        {threshold: -2, label: '≤ -2', color: '#b35806'},
        {threshold: -1, label: '-2 to -1', color: '#f1a340'},
        {threshold: 0, label: '-1 to 0', color: '#fee0b6'},
        {threshold: 1, label: '0 to 1', color: '#d8daeb'},
        {threshold: 2, label: '1 to 2', color: '#998ec3'},
        {threshold: Infinity, label: '> 2', color: '#542788'}
    ],
    shorelines: [
        {threshold: 1950, label: '< 1950', color: '#1f77b4'},
        {threshold: 1970, label: '1950–1970', color: '#2ca02c'},
        {threshold: 1990, label: '1970–1990', color: '#ff7f0e'},
        {threshold: 2010, label: '1990–2010', color: '#d62728'},
        {threshold: Infinity, label: '> 2010', color: '#9467bd'}
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

    infoModal: {
        open() {
            document.getElementById('infoModal').style.display = 'flex';
        },
        close() {
            document.getElementById('infoModal').style.display = 'none';
            UI.infoModal.setCookie();
        },
        hasSeen() {
            let cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                if (cookie.trim().startsWith("infoModalShown=true")) {
                    return true;
                }
            }
        },
        setCookie() {
            document.cookie = "infoModalShown=true; path=/; max-age=2592000";
        },
    },

    spinner:{
        showSpinner() {
            document.getElementById("loadingSpinner").classList.remove("hidden");
        },

        hideSpinner() {
            document.getElementById("loadingSpinner").classList.add("hidden");
        },
    },



    //update legend
    updateLegend() {
        const legend = document.getElementById('mapLegend');
        if (!legend) return;
        legend.innerHTML = ''; // Clear any existing legend content

        // Loop through all buttons to see which ones are active, this is for sorting instead of using the buttonSet
        buttonList.forEach(buttonId => {
            if (!activeButtonSet.has(buttonId)) return; //skip if not active

            // Handle shoreline change rate layers
            if (buttonId === 'ratesLT' || buttonId === 'ratesST') {
                // Choose label based on which rate button is active
                const label = buttonId === 'ratesLT'
                    ? 'Long-term Rates<br>(m/year)'
                    : 'Short-term Rates<br>(m/year)';

                legend.innerHTML += `<strong>${label}</strong><br>`;

                //Add colors bins for rates
                colorBins.rates.forEach(bin => {
                    legend.innerHTML += `<i style="background:${bin.color}"></i> ${bin.label}<br>`;
                });
            }

            //Handle shoreline layers
            if (buttonId === 'shorelines') {
                legend.innerHTML += `<strong>Shoreline Years</strong><br>`;

                //Add color bins for shoreline
                colorBins.shorelines.forEach(bin => {
                    legend.innerHTML += `<i style="background:${bin.color}"></i> ${bin.label}<br>`;
                });
            }
        });

        //if no layers selected
        if (legend.innerHTML === '') {
            legend.innerHTML = '<em>No layer selected</em>';
        }
    },

    createLeafletButton(options) {
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
    },

    graphPanel:{
        open() {
            drawHistogram();
            document.getElementById('graphPanel').classList.remove('hidden');
        },

        close() {
            document.getElementById('graphPanel').classList.add('hidden');
        },
    }


};

const mapUtils = {
    fullExtent() {
        if (featureGroup.getLayers().length) {
            map.fitBounds(featureGroup.getBounds());
        } else {
            map.setView(default_view.center, default_view.zoom);
        }
    },
    clearMap() {
        featureGroup.clearLayers();
        layersList = {};
        activeButtonSet.clear();
        $('.layer-button').removeClass('selected')
        mapUtils.updateAllServices()
        mapUtils.fullExtent()
    },

    updateExtentServices(){
        if (!document.getElementById('graphPanel').classList.contains('hidden')) {
            drawHistogram();
        }
        UrlParams.update()
    },

    updateAllServices(){
        UI.updateLegend()
        if (!document.getElementById('graphPanel').classList.contains('hidden')) {
            drawHistogram();
        }
        UrlParams.update()
    }
}

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

    getParamsFromMap() {
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
        return params;
    },

    update() {
        const params = UrlParams.getParamsFromMap(map);
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
    }).addTo(map);

    //add control buttons
    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);

    //make custom L.control buttons
    const fullExtentButton = UI.createLeafletButton({
        title: 'Go to full extent',
        iconHTML: '<i class="fas fa-expand text-dark"></i>',
        clickHandler: mapUtils.fullExtent
    }).addTo(map);

    const resetButton = UI.createLeafletButton({
        title: 'Clear layers',
        iconHTML: '<i class="fas fa-eraser text-dark"></i>',
        clickHandler: mapUtils.clearMap
    }).addTo(map);

    const graphButton = UI.createLeafletButton({
        position: 'topright',
        title: 'Show Graphs',
        iconHTML: '<i class="fas fa-chart-pie text-dark"></i>',
        clickHandler: UI.graphPanel.open
    }).addTo(map);

    const infoButton = UI.createLeafletButton({
        position: 'bottomleft',
        title: 'Help',
        iconHTML: '<i class="fas fa-question-circle text-dark"></i>',
        clickHandler: UI.infoModal.open
    }).addTo(map);


    //grab all controls needing tooltips
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
                if (!tooltip) return;

                const rect = button.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect();

                let left = rect.left - tooltipRect.width - 6;
                if (left < 0) {
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

    const legendControl = L.control({position: 'bottomleft'});

    legendControl.onAdd = function () {
        const div = L.DomUtil.create('div', 'info legend');
        div.id = 'mapLegend';
        return div;
    };
    legendControl.addTo(map);

    //draw modal on map init if not already seen
    if (!UI.infoModal.hasSeen()) {
        document.getElementById('infoModal').style.display = 'flex';
    }

    featureGroup.addTo(map);
    return map;
}







function drawHistogram() {
    const container = document.getElementById('chartContainer');
    container.innerHTML = '';

    const chartConfigs = [
        {id: 'ratesLT', field: 'LRR', label: 'Long-Term Rate (LRR)'},
        {id: 'ratesST', field: 'EPR', label: 'Short-Term Rate (EPR)'},
        {id: 'shorelines', field: 'YEAR_', label: 'Shorelines (year)'}
    ];

    if (window.histogramCharts) {
        window.histogramCharts.forEach(chart => chart.destroy());
    }
    window.histogramCharts = [];

    function isValidValue(val) {
        return val !== null && !isNaN(val) && val !== 9999 && val !== -999;
    }

    chartConfigs.forEach(config => {
        if (!activeButtonSet.has(config.id)) return;

        const values = [];

        featureGroup.eachLayer(layer => {
            if (layer instanceof L.GeoJSON) {
                layer.eachLayer(subLayer => {
                    if (!map.getBounds().intersects(subLayer.getBounds())) return;

                    const props = subLayer.feature?.properties || {};
                    const val = parseFloat(props[config.field]);

                    if (isValidValue(val)) {
                        values.push(val);
                    }
                });
            }
        });

        if (values.length === 0) return;

        // Use colorBins.rates as histogram bins
        const bins = colorBins.rates;
        const labels = [];
        const counts = [];
        const colors = [];

        let prevThreshold = -Infinity;
        for (const bin of bins) {
            const count = values.filter(v => v >= prevThreshold && v < bin.threshold).length;
            labels.push(bin.label);
            counts.push(count);
            colors.push(bin.color);
            prevThreshold = bin.threshold;
        }

        // Add title
        const title = document.createElement('h4');
        title.textContent = config.label;
        container.appendChild(title);

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 200;
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: config.label,
                    data: counts,
                    backgroundColor: colors
                }]
            },
            options: {
                responsive: false,
                scales: {
                    x: {
                        title: {display: true, text: 'Rate Range (m/year)'},
                        ticks: {autoSkip: false}
                    },
                    y: {
                        title: {display: true, text: 'Feature Count'},
                        beginAtZero: true
                    }
                }
            }
        });

        window.histogramCharts.push(chart);
    });


    if (window.histogramCharts.length === 0) {
        container.innerHTML = '<p>No data in view for selected layers.</p>';
    }
}


document.addEventListener('DOMContentLoaded', function () {

    let initialActiveLayers = UrlParams.getActiveLayerIds()
    initialActiveLayers.forEach(buttonId => {
        layerButtonClicked(buttonId);
    })

    //generate the empty text in legend in start
    UI.updateLegend()

    // functionality for sidebar
    $('.menu-button').on('click', function () {
        menuButtonClicked(this.id);
    });

    function menuButtonClicked(buttonId) {
        if (buttonId === "menu-clear") {
            mapUtils.clearMap();
        } else if (buttonId === "menu-fullExtent") {
            mapUtils.fullExtent();
        } else if (buttonId === "menu-help") {
            UI.toggleSidebar();
            UI.infoModal.open();
        } else if (buttonId === "menu-close") {
            UI.toggleSidebar();
        }
    }


    //functions for handling layer button presses
    $('.layer-button').on('click', function () {
        layerButtonClicked(this.id);
    });
    function layerButtonClicked(buttonId) {
        let requestFolderURL = baseURL + buttonId + "/";
        loadGeoJSONFromDirectory(requestFolderURL, buttonId);
    }


    //big function for loading json
    async function loadGeoJSONFromDirectory(requestFolderURL, buttonId) {
        // Show spinner before loading
        UI.spinner.showSpinner();
        try {
            //grab directory
            const response = await fetch(requestFolderURL);
            if (!response.ok) throw new Error("Failed to load directory HTML:" + response.status);

            //parse links from html
            const htmlText = await response.text();
            const parser = new DOMParser();
            const htmlDoc = parser.parseFromString(htmlText, "text/html");
            const nodeList = htmlDoc.querySelectorAll("a");
            const links = Array.from(nodeList);

            //get geojson files from links
            const geojsonFiles = links
                .map(link => link.getAttribute("href"))
                .filter(href => href && href.toLowerCase().endsWith(".geojson"))
                .map(href => href.split("/").pop());

            //loop through geojson in folder (this might be a problem later on if there is more, but theoretically there
            // shouldn't be more than like 30? this is a TODO for later
            for (const fileName of geojsonFiles) {
                const fullURL = requestFolderURL + fileName;

                //if layer is already on, turn it off, remove from trackers
                if (fullURL in layersList) {
                    featureGroup.removeLayer(layersList[fullURL]);
                    delete layersList[fullURL];
                    activeButtonSet.delete(buttonId);
                    $('#' + buttonId).removeClass('selected');
                } else {
                    //load geojson
                    $('#' + buttonId).addClass('selected');

                    const geojsonResponse = await fetch(fullURL);
                    if (!geojsonResponse.ok) throw new Error("Failed to load" + fullURL + " : " + geojsonResponse.status);

                    const data = await geojsonResponse.json();
                    processGeoJSON(data, buttonId, fullURL);
                }
            }
            mapUtils.updateAllServices();
        } catch (error) {
            console.error(error);
            alert("Error loading GeoJSON data.");
        } finally {
            //runs on both success and fails
            //writes active layer groups to url and finish spinning spinner
            UI.spinner.hideSpinner();
        }
    }


    function processGeoJSON(data, buttonId, fullURL) {
        const styleForLayer = getLayerStyle(buttonId);

        const geoJsonLayer = L.geoJSON(data, {
            style: function (feature) {
                return styleForLayer(feature);
            }
        }).bindPopup(layer => {

            //add custom popups based on buttonId
            const attr = layer.feature?.properties || {};
            if (buttonId === 'shorelines') {
                return `<strong>Year:</strong> ${attr.Year_ ?? ''}`;
            }
            if (buttonId === 'ratesLT') {
                return `<strong>LRR:</strong> ${attr.LRR ?? ''} m/year`;
            }
            if (buttonId === 'ratesST') {
                return `<strong>EPR:</strong> ${attr.EPR ?? ''} m/year`;
            }
            return ""
        });

        featureGroup.addLayer(geoJsonLayer);
        layersList[fullURL] = geoJsonLayer;
        activeButtonSet.add(buttonId);
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

        //default style
        return () => styles[buttonId] || {color: 'gray', weight: 2, opacity: 0.8};
    }

    //some weird math for line weight, originally tried zoom*0.5 but that wasn't great
    function getLineWeight(zoom) {
        return Math.max(1, Math.log2(zoom));
    }

    function getBinnedColor(value, bins) {
        if (isNaN(value)) return '#999';
        for (const bin of bins) {
            if (value < bin.threshold) return bin.color;
        }
        return bins[bins.length - 1]?.color || '#999';
    }




    //update url params on move
    map.on('moveend', function () {
        mapUtils.updateExtentServices();
    });

});


