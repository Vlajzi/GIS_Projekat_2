import './style.css';
import {Map, View} from 'ol';
import VectorSource from 'ol/source/Vector.js';
import ImageWMS from 'ol/source/ImageWMS.js';
import {GeoJSON, WFS} from 'ol/format.js';
import OSM from 'ol/source/OSM';
import {Stroke, Style,Fill,Circle,Icon} from 'ol/style.js';
import Projection from 'ol/proj/Projection.js';
import {Tile as TileLayer, Vector as VectorLayer, Image as ImageLayer,Group as LayerGroup} from 'ol/layer.js';
import { Point } from 'ol/geom';
import Overlay from 'ol/Overlay.js';
import XYZ from 'ol/source/XYZ.js';
import {toLonLat,transform,useGeographic} from 'ol/proj.js';
import {toStringHDMS} from 'ol/coordinate.js';
import { compose } from 'ol/transform';

useGeographic();

const pro = new Projection({
  code: 'EPSG:4326',
  units: 'degrees',
  axisOrientation: 'neu'
});

const container = document.getElementById('popup');
const content = document.getElementById('popup-content');
const closer = document.getElementById('popup-closer');


function eventCheckBox(event)
{
  vectorPruge.setVisible(document.getElementById('Opcija1').checked);
  vectorPumpe.setVisible(document.getElementById('Opcija2').checked);
  imageGranice.setVisible(document.getElementById('Opcija3').checked);
}


document.getElementById('Opcija1').addEventListener('change', eventCheckBox);
document.getElementById('Opcija2').addEventListener('change', eventCheckBox);
document.getElementById('Opcija3').addEventListener('change', eventCheckBox);


const overlay = new Overlay({
  element: container,
  autoPan: {
    animation: {
      duration: 250,
    },
  },
});

const prugeSource = new VectorSource();
const vectorPruge = new VectorLayer({
  source: prugeSource,
  style: new Style({
    stroke: new Stroke({
      color: 'rgba(0, 0, 0, 1.0)',
      width: 2,
    }),
  }),
});

const pumpeSource = new VectorSource();
const vectorPumpe = new VectorLayer({
  source: pumpeSource,
  style: new Style({
     image: new Circle({
       radius: 4,
       fill: new Fill({color: '#ffad33'}),
       stroke: new Stroke({color: '#f91615', width: 1.5}), })
  }),
});



const imageGranice = new ImageLayer({
  source: new ImageWMS({
    url: 'http://localhost:8080/geoserver/faks/wms',
    params: {'LAYERS': 'faks:Granice','FORMAT': 'image/png'},
    ratio: 1,
    serverType: 'geoserver',
  }),
});



const map = new Map({
  layers: [imageGranice,vectorPruge,vectorPumpe],
  target: 'map',
  view: new View({
    center: [21, 43],
    maxZoom: 50,
    zoom: 2,
    projection: pro,
  }),
  overlays: [overlay],
});

function fillTable(data)
{
  var tabela = document.createElement("table")
  if(data[0] && data[0][0])
  {
    for (key in data[0][0]) {
      tabela.innerHTML += ('<td>' + key + '</td>');
    }
    for(info in data)
    {
      tabela.innerHTML += ("</tr>");
      for (var i = 0; i < data.length; i++) {
        tabela.innerHTML += ('<tr>');
        for (key in data[i]) {
          tabela.innerHTML += ('<td>' + data[i][key] + '</td>');
        }
        tabela.innerHTML += ('</tr>');
      }
    }
  }
  return tabela;
}

//Funkcije za generisanje teksta // Posebno filtriranje trebalo je drugacije ali tako uvezo inicijalno

function getDataVektor(coordinate,vektroWFS,tip,naziv)
{
  
  var distance = [2000,2000]; //u m;
  distance = toLonLat(distance);
  console.log(distance);
  var okvirniBox = [coordinate.at(0) - distance[0],coordinate.at(1) - distance[1],coordinate.at(0) + distance[0],coordinate.at(1) + distance[1]];

  var view = map.getView();
  //var viewResolution = view.getResolution();
  var obj = vektroWFS.getFeaturesInExtent(okvirniBox);
  if(obj)
  {
    obj.forEach(element => {
      if(element.values_)
      {
        console.log(element.values_);
        if(tip == 1)
        {
          content.innerHTML += "<p class='informacija'> " + naziv + " - ID:" + element.values_.way_id  + " Tip: " +element.values_.type+ '</p>';
          overlay.setPosition(coordinate);
        }
        else //if(tip == 2)
        {
          var ime = element.values_.name?element.values_.name:'NEPOZNAT';
          content.innerHTML += "<p class='informacija'> " + naziv + " - ID:" + element.values_.node_id  + " Naziv: " +ime+ '</p>';
          overlay.setPosition(coordinate);
        }
      }
    });

  }
     

}

function getDataRaster(coordinate,rasterWMS,naziv)
{
  var view = map.getView();
  var viewResolution = view.getResolution();
  var source = rasterWMS.getSource();
  var url = source.getFeatureInfoUrl(
    coordinate, viewResolution, view.getProjection(),
    {'INFO_FORMAT': 'application/json', 'FEATURE_COUNT': 50});
  if (url) {
    return fetch(url)
      .then(function (response) { return response.text(); })
      .then(function (json) {
        var obj = JSON.parse(json);
        if(obj)
        {
          if(obj.features)
          {
            obj.features.forEach(element => 
            {
                var tagovi = JSON.parse(element.properties.tags)
                content.innerHTML += "<p class='informacija'> " + naziv +" ID:" + element.properties.area_id  + " Naziv: " +tagovi.name+ '</p>';
                overlay.setPosition(coordinate);
            });
          }
        }
      });
  }
}
 

map.on('singleclick', function(evt) {

  const coordinate = evt.coordinate;
  console.log(coordinate);
  //const hdms = toStringHDMS(coordinate);
  //transform(coordinate, 'EPSG:4326','EPSG:3857');
  content.innerHTML = "";
  overlay.setPosition(undefined);
  closer.blur();
  if(imageGranice.isVisible())
  {
    getDataRaster(coordinate,imageGranice,'Granice');
  }
  if(vectorPruge.isVisible())
  {
    getDataVektor(coordinate,prugeSource,1,'Pruge');
  }
  if(vectorPumpe.isVisible())
  {
    getDataVektor(coordinate,pumpeSource,2,'Pumpe');
  }
  
});


const featureRequestZeleznice = new WFS().writeGetFeature({
  srsName: 'EPSG:4326',
  featureNS: 'http://www.vladimirGIS.org/faks',
  featurePrefix: 'faks',
  featureTypes: ['railway'],
  outputFormat: 'application/json',
});

fetch('http://localhost:8080/geoserver/wfs', {
  method: 'POST',
  body: new XMLSerializer().serializeToString(featureRequestZeleznice),
})
  .then(function (response) {
    return response.json();
  })
  .then(function (json) {
    console.log('STIGLO_1');
    const features = new GeoJSON().readFeatures(json);
    prugeSource.addFeatures(features);
    map.getView().fit(prugeSource.getExtent());
  });
  //Zeleznice
  const featureRequestPumpe = new WFS().writeGetFeature({
    srsName: 'EPSG:4326',
    featureNS: 'http://www.vladimirGIS.org/faks',
    featurePrefix: 'faks',
    featureTypes: ['Pumpe'],
    outputFormat: 'application/json',
  });
  
  fetch('http://localhost:8080/geoserver/wfs', {
    method: 'POST',
    body: new XMLSerializer().serializeToString(featureRequestPumpe),
  })
    .then(function (response) {
      return response.json();
    })
    .then(function (json) {
      console.log('STIGLO_2');
      const features = new GeoJSON().readFeatures(json);
      pumpeSource.addFeatures(features);
      map.getView().fit(pumpeSource.getExtent());
    });


    closer.onclick = function () {
      overlay.setPosition(undefined);
      closer.blur();
      return false;
    };

