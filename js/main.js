let map;
let featureGroup;
let layersList = {};

$(document).ready(function () {

    //initialize map
    map = L.map("mapId",{attributionControl: false, maxZoom: 19}).setView([38.1863, -74.8773], 7);

    //add basemap layers
    let esriTopoVectorBasemap = L.esri.Vector.vectorBasemapLayer('arcgis/topographic',{token: esriToken});
    let esriLightGrayVectorBasemap = L.esri.Vector.vectorBasemapLayer('arcgis/light-gray',{token: esriToken});

    let basemaps = {
        "Topographic": esriTopoVectorBasemap,
        "Light Gray": esriLightGrayVectorBasemap,
    }

    map.addLayer(esriTopoVectorBasemap);
    L.control.layers(basemaps).addTo(map);


    let requestURL = baseURL + 'shoreline_points.geojson';
    console.log('Requesting', requestURL);

    $.ajax({
        dataType: "json",
        url: requestURL,
        success: function (data) {
            const markerCluster = L.markerClusterGroup({
                showCoverageOnHover: false,
                disableClusteringAtZoom: 12
            });

            const geojsonLayer = L.geoJSON(data, {
                pointToLayer: function (feature, latlng) {
                    // styled cluster-compatible marker
                    const icon = L.divIcon({
                        className: 'custom-marker',
                        html: `<div class="circle-marker"></div>`,
                        iconSize: [10, 10]
                    });

                    const marker = L.marker(latlng, { icon: icon });

                    const props = feature.properties;
                    let popupContent = `
          <strong>State:</strong> ${props.STATE}<br>
          <strong>Baseline ID:</strong> ${props.BASELINEID}<br>
          <strong>LRR:</strong> ${props.LRR}<br>
          <strong>LSE:</strong> ${props.LSE}<br>
          <strong>LCI90:</strong> ${props.LCI90}
        `;
                    marker.bindPopup(popupContent);

                    return marker;
                }
            });

            markerCluster.addLayer(geojsonLayer);
            map.addLayer(markerCluster);
        },
        error: function (xhr, status, error) {
            console.error("Failed to load GeoJSON:", error);
        }
    });

    requestURL = baseURL + 'VA_Baseline.geojson';
    console.log('Requesting', requestURL);

    $.ajax({
        dataType: "json",
        url: requestURL,
        success: function (data) {
            const geojsonLayer = L.geoJSON(data);
            geojsonLayer.addTo(map);
        },
    })



});