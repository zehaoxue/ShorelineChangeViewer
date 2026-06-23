//config
const DATA_BASE_URL = 'https://shoreline-change-viewer-data.s3.us-east-2.amazonaws.com/';

let defaultView = {
    center: [37.87485, -99.09668],
    zoom: 5
};

//metadata for layer information
const buttonInfo = {
    ratesST: {
        buttonLabel: "Short-term rates",
        tooltip: "Short-term (~30 years) rates of shoreline change for open-ocean shorelines of the United States ranging from 1970's to 2018."
    },
    ratesLT: {
        buttonLabel: "Long-term rates",
        tooltip: "Long-term (78+ years) rates of shoreline change for open-ocean shorelines of the United States ranging from 1800's to 2018."
    },
    shorelines: {
        buttonLabel: "Historical shorelines",
        tooltip: "Historical shoreline positions for ocean shorelines of the United States ranging from 1800's to present."
    }
};
//generate button list from keys
let buttonList = Object.keys(buttonInfo);

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


    legend: {

        create() {
            const legendControl = L.control({ position: 'bottomleft' });

            legendControl.onAdd = function () {
                const div = L.DomUtil.create('div', 'info legend');
                div.id = 'mapLegend';
                return div;
            };

            return legendControl;
        },

        //update legend
        update() {
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
                    legend.innerHTML += `<strong>Historical Shorelines<br>(years)</strong><br>`;

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
    },

    attachCustomTooltips() {
        // Initial selector: find elements that still have a native title
        const initSelector = '.leaflet-control [title], #menuInfo [title]';
        // Live selector: after init, we use data-tooltip instead of title
        const liveSelector = '.leaflet-control [data-tooltip], #menuInfo [data-tooltip]';

        const controls = document.querySelectorAll(initSelector);

        // Single tooltip element reused
        let tooltip = document.createElement('div');
        tooltip.className = 'custom-tooltip';
        tooltip.style.position = 'absolute';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.opacity = '0';
        tooltip.style.transition = 'opacity 120ms ease-out';
        document.body.appendChild(tooltip);

        let currentTarget = null;
        let showTimeout = null;
        let hideTimeout = null;

        function clearTimers() {
            if (showTimeout) {
                clearTimeout(showTimeout);
                showTimeout = null;
            }
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
        }

        function positionTooltip(target) {
            const rect = target.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();

            // Default: left side of control
            let left = rect.left - tooltipRect.width - 6;
            if (left < 0) {
                // If off-screen, flip to right side
                left = rect.right + 6;
            }

            let top = rect.top + window.scrollY + (rect.height - tooltipRect.height) / 2;

            tooltip.style.left = `${left + window.scrollX}px`;
            tooltip.style.top = `${top}px`;
        }

        function showTooltip(target) {
            const text = target.dataset.tooltip;
            if (!text) return;

            tooltip.textContent = text;
            tooltip.style.opacity = '0';

            requestAnimationFrame(() => {
                positionTooltip(target);
                tooltip.style.opacity = '1';
            });
        }

        function hideTooltip() {
            clearTimers();
            currentTarget = null;
            tooltip.style.opacity = '0';
        }

        // 1) On init, move native title into data-tooltip and keep aria-label
        controls.forEach(el => {
            const nativeTitle = el.getAttribute('title');
            if (nativeTitle) {
                el.dataset.tooltip = nativeTitle;
                el.setAttribute('aria-label', nativeTitle);
                el.removeAttribute('title'); // prevent native browser tooltip
            }
        });

        // 2) Use event delegation (mouseover / mouseout) on *data-tooltip* elements
        document.addEventListener('mouseover', e => {
            const target = e.target.closest(liveSelector);
            if (!target || !target.dataset.tooltip) return;

            if (currentTarget === target) return;

            clearTimers();
            currentTarget = target;

            showTimeout = setTimeout(() => {
                showTooltip(target);
            }, 100); // small delay
        });

        document.addEventListener('mouseout', e => {
            const from = e.target.closest(liveSelector);
            const to = e.relatedTarget && e.relatedTarget.closest(liveSelector);

            // Moving within same element or between its children
            if (from && to && from === to) return;

            if (from && from === currentTarget) {
                clearTimers();
                hideTimeout = setTimeout(hideTooltip, 100);
            }
        });

        // 3) Global “hide” events
        ['mousedown', 'touchstart', 'scroll'].forEach(evt => {
            window.addEventListener(evt, hideTooltip, { passive: true });
        });
        window.addEventListener('resize', hideTooltip);

        // 4) Hide on Escape
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                hideTooltip();
            }
        });
    },




    generateLayerButtons() {
        const menuInfo = document.getElementById('menuInfo');
        menuInfo.innerHTML = ''; // clear existing

        buttonList.forEach(id => {
            const btn = document.createElement('button');
            btn.className = 'layer-button';
            btn.id = id;
            btn.type = 'button';
            btn.title = buttonInfo[id].tooltip;
            btn.textContent = buttonInfo[id].buttonLabel;
            btn.innerHTML = `
                <span class="drag-handle" title="Drag to reorder">&#x2630;</span>
                <span class="button-label">${buttonInfo[id].buttonLabel}</span>
            `;

            menuInfo.appendChild(btn);
        });
    }


};

const mapUtils = {
    fullExtent() {
        if (featureGroup.getLayers().length) {
            map.fitBounds(featureGroup.getBounds());
        } else {
            map.setView(defaultView.center, defaultView.zoom);
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

    redrawLayersByButtonList() {
        featureGroup.clearLayers();
        // Reverse the order of buttonList for drawing
        [...buttonList].reverse().forEach(buttonId => {
            Object.entries(layersList).forEach(([url, layer]) => {
                if (activeButtonSet.has(buttonId) && url.includes(`/${buttonId}/`)) {
                    featureGroup.addLayer(layer);
                }
            });
        });
    },


    updateExtentServices(){
        if (!document.getElementById('graphPanel').classList.contains('hidden')) {
            drawHistogram();
        }
        UrlParams.update()
    },

    updateAllServices(){
        UI.legend.update()
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
        return defaultView;
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

    var USGS_USTopo = L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
        attribution: '<a href="https://usgs.gov/">U.S. Geological Survey</a>'
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


    //draw layer buttons
    UI.generateLayerButtons();

    //draw legend
    UI.legend.create().addTo(map);

    //draw modal on map init if not already seen
    if (!UI.infoModal.hasSeen()) {
        document.getElementById('infoModal').style.display = 'flex';
    }

    //make all custom tooltips for icon buttons and layer buttons
    UI.attachCustomTooltips();

    featureGroup.addTo(map);
    return map;
}

const sortable = Sortable.create(document.getElementById('menuInfo'), {
    animation: 150,
    handle: '.drag-handle', // <-- Only allow drag from the handle
    onEnd: function (evt) {
        const newOrder = Array.from(evt.to.children).map(btn => btn.id);
        buttonList = newOrder;
        mapUtils.redrawLayersByButtonList();
        mapUtils.updateAllServices();
    }
});

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
    UI.legend.update()

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

    function buildFolderURLs(DATA_BASE_URL, folderName) {
        if (!folderName.endsWith("/")) folderName += "/";

        return `${DATA_BASE_URL}?list-type=2&prefix=${folderName}`
    }

    function layerButtonClicked(buttonId) {
        const xmlURL = buildFolderURLs(DATA_BASE_URL, buttonId);
        loadGeoJSONFromS3(xmlURL, buttonId);
    }

    //big function for loading json
    async function loadGeoJSONFromS3(xmlURL, buttonId) {
        // Show spinner before loading
        UI.spinner.showSpinner();
        try {
            //grab directory listing (XML from S3)
            const response = await fetch(xmlURL);
            if (!response.ok) throw new Error("Failed to load S3 XML listing: " + response.status);

            //parse xml
            const xmlText = await response.text();
            const xmlDoc = new DOMParser().parseFromString(xmlText, "application/xml");

            //get geojson files from keys
            const keys = Array.from(xmlDoc.getElementsByTagName("Key"))
                .map(node => node.textContent)
                .filter(key => key.toLowerCase().endsWith(".geojson"));

            console.log(keys)
            //loop through geojson in folder
            for (const key of keys) {
                // build the actual file URL the same way as before:
                const fullURL = `${DATA_BASE_URL}${key}`;

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
                    if (!geojsonResponse.ok) {
                        throw new Error("Failed to load " + fullURL + " : " + geojsonResponse.status);
                    }

                    const data = await geojsonResponse.json();
                    processGeoJSON(data, buttonId, fullURL);
                }
            }

            mapUtils.updateAllServices();

        } catch (error) {
            console.error(error);
            alert("Error loading GeoJSON data.");
        } finally {
            mapUtils.redrawLayersByButtonList();
            mapUtils.updateAllServices();
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

    //some weird math for line weight, zoom*0.5 didn't work
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


