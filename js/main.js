let map;
let featureGroup;
let layersList = {};

let shorelinePointsGeoJSON = null;
let baselineGeoJSON = null;
let geojsonLayer = null;

$(document).ready(function () {

    // Initialize map
    map = L.map("mapId", { attributionControl: false, maxZoom: 19 }).setView([38.1863, -74.8773], 7);

    // Basemaps
    let esriTopoVectorBasemap = L.esri.Vector.vectorBasemapLayer('arcgis/topographic', { token: esriToken });
    let esriLightGrayVectorBasemap = L.esri.Vector.vectorBasemapLayer('arcgis/light-gray', { token: esriToken });

    let basemaps = {
        "Topographic": esriTopoVectorBasemap,
        "Light Gray": esriLightGrayVectorBasemap,
    };

    map.addLayer(esriTopoVectorBasemap);
    L.control.layers(basemaps).addTo(map);

    // Load shoreline points
    $.ajax({
        dataType: "json",
        url: baseURL + 'shoreline_points.geojson',
        success: function (data) {
            shorelinePointsGeoJSON = data;

            const markerCluster = L.markerClusterGroup({
                showCoverageOnHover: false,
                disableClusteringAtZoom: 12
            });

            // ✅ Assign to global geojsonLayer (no const here!)
            geojsonLayer = L.geoJSON(data, {
                filter: function (feature) {
                    return feature.properties.STATE === "DelMarVA SOUTH";
                },
                pointToLayer: function (feature, latlng) {
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

            tryToConnectPerpendicularly(); // safe to call now
        },
        error: function (xhr, status, error) {
            console.error("Failed to load shoreline points GeoJSON:", error);
        }
    });

    // Load baseline
    $.ajax({
        dataType: "json",
        url: baseURL + 'VA_Baseline.geojson',
        success: function (data) {
            baselineGeoJSON = data;

            const baselineLayer = L.geoJSON(data, {
                style: {
                    color: "#006699",
                    weight: 2,
                    opacity: 0.9
                }
            });

            baselineLayer.addTo(map);

            tryToConnectPerpendicularly(); // safe to call now
        },
        error: function (xhr, status, error) {
            console.error("Failed to load baseline GeoJSON:", error);
        }
    });



    function tryToConnectPerpendicularly() {
        if (!geojsonLayer || !baselineGeoJSON) return;

        const visiblePoints = [];

        geojsonLayer.eachLayer(function (layer) {
            if (layer.getLatLng) {
                const latlng = layer.getLatLng();
                const coords = [latlng.lng, latlng.lat];
                const turfPoint = turf.point(coords, layer.feature.properties);
                visiblePoints.push(turfPoint);
            }
        });

        const connectionGroup = L.layerGroup();

        // Find min/max absolute LRR for normalization
        const lrrValues = visiblePoints.map(pt => parseFloat(pt.properties.LRR)).filter(v => !isNaN(v));
        const maxAbsLRR = Math.max(...lrrValues.map(v => Math.abs(v)));

        visiblePoints.forEach(point => {
            const props = point.properties;
            const lrr = parseFloat(props.LRR);
            if (isNaN(lrr)) return;

            // Project to nearest point on baseline
            const projected = turf.nearestPointOnLine(baselineGeoJSON, point, { units: 'meters' });

            const lng1 = point.geometry.coordinates[0];
            const lat1 = point.geometry.coordinates[1];
            const lng2 = projected.geometry.coordinates[0];
            const lat2 = projected.geometry.coordinates[1];

            // 1. Draw perpendicular (red/blue/gray) line to baseline
            const start = [lat1, lng1];
            const end = [lat2, lng2];

            const color = getDivergingLRRColor(lrr, maxAbsLRR);
            const baselineLine = L.polyline([start, end], {
                color: color,
                weight: 3,
                opacity: 0.9
            });
            connectionGroup.addLayer(baselineLine);

            // 2. Draw green line in the same direction as the red one (using bearing)
            const origin = turf.point([lng1, lat1]);
            const target = turf.point([lng2, lat2]);
            const bearing = turf.bearing(origin, target);

            const lengthMeters = Math.abs(lrr) * 10; // adjust scale as needed
            const destination = turf.destination(origin, lengthMeters / 1000, bearing, { units: 'kilometers' });

            const greenLine = L.polyline([
                [lat1, lng1],
                [destination.geometry.coordinates[1], destination.geometry.coordinates[0]]
            ], {
                color: 'green',
                weight: 3,
                opacity: 0.8
            });
            connectionGroup.addLayer(greenLine);
        });

        connectionGroup.addTo(map);
    }



// Diverging red–gray–blue
    function getDivergingLRRColor(lrr, maxAbs) {
        const ratio = Math.min(Math.abs(lrr) / maxAbs, 1);

        // Linear interpolation between RGB values
        if (lrr < 0) {
            // Negative = red to gray
            return interpolateColor([255, 0, 0], [180, 180, 180], ratio); // red → gray
        } else if (lrr > 0) {
            // Positive = blue to gray
            return interpolateColor([0, 0, 255], [180, 180, 180], 1 - ratio); // blue → gray
        } else {
            return 'rgb(180,180,180)'; // Neutral gray
        }
    }

    function interpolateColor(color1, color2, t) {
        const r = Math.round(color1[0] * (1 - t) + color2[0] * t);
        const g = Math.round(color1[1] * (1 - t) + color2[1] * t);
        const b = Math.round(color1[2] * (1 - t) + color2[2] * t);
        return `rgb(${r},${g},${b})`;
    }


    //
    // function tryToConnectPerpendicularly() {
    //     if (!geojsonLayer) return;
    //
    //     const connectionGroup = L.layerGroup();
    //     const visiblePoints = [];
    //
    //     geojsonLayer.eachLayer(function (layer) {
    //         if (layer.getLatLng && layer.feature && layer.feature.properties.LRR !== null) {
    //             const latlng = layer.getLatLng();
    //             const props = layer.feature.properties;
    //             const lrr = props.LRR;
    //
    //             // Skip zero values
    //             if (!isFinite(lrr) || lrr === 0) return;
    //
    //             const lat = latlng.lat;
    //             const lng = latlng.lng;
    //
    //             // Adjust longitude by a factor proportional to LRR
    //             const scaleFactor = 0.01; // you can tweak this for visual effect
    //             const deltaLng = (lrr > 0 ? 1 : -1) * Math.abs(lrr) * scaleFactor;
    //
    //             const endLng = lng + deltaLng;
    //
    //             const line = L.polyline([
    //                 [lat, lng],
    //                 [lat, endLng]
    //             ], {
    //                 color: "#FF8800",
    //                 weight: 2,
    //                 opacity: 0.9
    //             });
    //
    //             connectionGroup.addLayer(line);
    //         }
    //     });
    //
    //     connectionGroup.addTo(map);
    // }
});
