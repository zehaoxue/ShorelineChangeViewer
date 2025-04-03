import { esriToken } from './config.js';

$(document).ready(function () {

    let mapFocus = L.map("mapId",{attributionControl: false}).setView([32.383449, -99.974561], 6);
    //var esriTopoFocusLayer = L.esri.basemapLayer("Topographic", {hideLogo: "true"}).addTo(mapFocus);

    let esriTopoVectorBasemap = L.esri.Vector.vectorBasemapLayer('arcgis/topographic',{token: esriToken})
    let esriLightGrayVectorBasemap = L.esri.Vector.vectorBasemapLayer('arcgis/light-gray',{token: esriToken})

    let basemaps = {
        "Topographic": esriTopoVectorBasemap,
        "Light Gray": esriLightGrayVectorBasemap
    }

    mapFocus.addLayer(esriTopoVectorBasemap);


    L.control.layers(basemaps).addTo(mapFocus);

    let bbqJoints;

    $('.layer-button').on('click', function () {
        const buttonId = $(this).attr('id') || $(this).find('i').attr('id');
        layerButtonClicked(buttonId);
    });

    function layerButtonClicked(buttonId) {
        console.log('Clicked button ID:', buttonId);
    }


    $('#BBQ').on('click', function () {
        console.log('Hi bbq');
        bbqClick();
    })


    function bbqClick() {
        console.log(bbqJoints);

        if (typeof bbqJoints !== 'undefined' && mapFocus.hasLayer(bbqJoints)) {
            console.log("Bull");
            mapFocus.removeLayer(bbqJoints);
        } else {
            let url1 = 'http://44.225.111.109/thc_data/BBQ_THC.geojson';
            $.ajax({
                dataType: "json",
                url: url1,
                success: bbqLayerFunc
            });
        }
    }

    let faBBQ_Icon = L.divIcon({
        html: '<span class="fa-stack">' +
            '<i style="color: red;" class="fa fa-stack-2x fa-circle"></i>' +
            '<i style="color: blue;" class="fas fa-utensils fa-stack-1x"></i>' +
            '</span>',
        iconSize: [24, 24],
        iconAnchor: [6, 40],
        popupAnchor: [0, -30],
        className: 'gauge-styling'
    });

    function bbqLayerFunc(dataBBQ) {
        bbqJoints = L.geoJSON(dataBBQ, {
            pointToLayer: function (feature, latlng) {
                return L.marker(latlng, { icon: faBBQ_Icon });
            }
        })
            .bindPopup(function (layer) {
                return "<span class=''> BBQ Name: </span>" + layer.feature.properties.NAME;
            });

        console.log(bbqJoints);
        mapFocus.addLayer(bbqJoints);
    }
});