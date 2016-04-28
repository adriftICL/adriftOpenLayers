

//The Main Map Class

function Map() {
	console.log("Running the map")

  this.WEIGHT_FACTOR = 100
  this.timer = null;
  this.landpoints = null; //array to store landpoint booles
  this.direction = 'bwd';

  this.clickLon = null;
  this.clickLat = null;

  //Create the marker
  this.markerOptions = {
      name: 'marker',
      type: 'icon',
      geometry: new ol.geom.Point(ol.proj.fromLonLat([8, 22]))
  };
  this.marker = new ol.Feature(this.markerOptions);
  this.markerLayer = new ol.layer.Vector({
      source: new ol.source.Vector({
          features: []
      }),
      style: new ol.style.Style({
        image: new ol.style.Icon({
        anchor: [0.5, 1],
        src: 'img/MarkerDuckie.png'
        })
      })
  });


  this.mapOptions = {
    target: 'mapClass',
    controls: [],
    interactions: ol.interaction.defaults({
     doubleClickZoom:false,
     mouseWheelZoom:false,
     dragPan: true,
   }),
    layers: [
    new ol.layer.Tile({
     source: new ol.source.MapQuest({layer: 'sat'})
            	//source: new ol.source.OSM({ wrapX: true })
            }),
    this.markerLayer
    ],
    view: new ol.View({
     center: ol.proj.fromLonLat([0.0, 0]), 
     zoom: 2.8,
     /*extent: maxExtent */
     /* resolution: 30000 */ 
   }),
  }

  this.map = new ol.Map(this.mapOptions);

  this.extent = [-70, 55 , 60, -55];
  this.extent = ol.extent.applyTransform(this.extent, ol.proj.getTransform("EPSG:4326", "EPSG:3857")); 
  this.map.getView().fit(this.extent, this.map.getSize());


//Heatmap Parts

var heatMapPoints  = [];

var lon1 = -29.355;
var lat1 =  48.392;

/*
  heatMapPoints.push(new ol.Feature({
    geometry: new ol.geom.Point(ol.proj.fromLonLat([lon1, lat1])),
    weight: 0.8
  }));

  this.heatMapSource = new ol.source.Vector({
    features: heatMapPoints,
  }) */

this.heatMapSource = new ol.source.Vector({});

this.heatMap = new ol.layer.Heatmap({
  weight: "weight",
  source: this.heatMapSource,
  visible: true,
  supdateWhileAnimating: true,
  updateWhileInteracting: true,
});

  //add layer to the map
  this.map.addLayer(this.heatMap);
  console.log("heatmap added");

  //heatMap.changed();


  //map events
  //map panned
  this.map.getView().on('change:center', $.proxy(function(changeEvent) {
   this.centerUpdate(changeEvent);
 }, this));

  //map clicked
  this.map.on('click', $.proxy(function(clickEvent) {
    this.onClick(clickEvent);
  }, this));

  //map direction
  $('#backward').click(function(){
    console.log("backward clicked");
  })

  $('#forward').click(function(){
    console.log("forward clicked");
  })
}


//get index of the heatmap data packet to be fetched
Map.prototype.getDataIndex = function(lon, lat){
  lon = Math.floor(lon);
  lat = Math.floor(lat);
  lat += 75;
  if (lon < 0) {
    lon += 360;
  }
  return (((lat-1) * 360) + lon);
 }


//check if a point is on land
Map.prototype.checkLandPoint = function(index, callback){
  var saveLandpoints = function(data){
    console.log("gotlandpoints data");
    this.landpoints = data.split(',');
    var landpointValue = parseInt(this.landpoints[index]);
    callback(landpointValue);
  }
  //load the landpoints file if not already done so
  if (this.landpoints == null) {
    $.get("data/landpoints.csv").success($.proxy(saveLandpoints,this))
    .error($.proxy(function(result){
        console.log("Error fetching landpoints.csv file");
        callback(-2); //use -2 for error code as -1 is already taken
     }, this));
  } else {
    //console.log(callback);
    var landpointValue = parseInt(this.landpoints[index]);
    callback(landpointValue);
  } 
}


Map.prototype.onClick = function(clickEvent) {
  console.log("running onClick");
  console.log(clickEvent);
    //Check that it's not already running
    if (this.timer !== null){ //If so exit
      return;
    }

    //Clear layer
    this.markerLayer.getSource().clear();
    //Set marker position
    this.marker.getGeometry().setCoordinates(clickEvent['coordinate']);



    
    //convert the projection of the coordinates
    console.log(clickEvent.coordinate);
    var lonlat = ol.proj.transform(clickEvent.coordinate, "EPSG:3857", "EPSG:4326");
    this.clickLon = Math.round(10 * lonlat[0]) / 10;
    this.clickLat = Math.round(10 * lonlat[1]) / 10;
    //console.log(lat);
    //console.log(lon);   



    var dataIndex = this.getDataIndex(this.clickLon, this.clickLat);

    this.checkLandPoint(dataIndex, $.proxy(this.run, this));

};

// the main function which acquires fetches data and runs heatmap
Map.prototype.run = function(landpointValue){
    console.log("landpoint value is: " + landpointValue);
    //Check correct landpoint value
    if (landpointValue == -2){
      console.log("error fetching landpont file and value");
      return;
    } else if (landpointValue == 1) {
      alert('point was on land, please choose a point on sea');
      return;
    } else if (landpointValue == -1){
      alert('Sorry, we do not have data for this point');
      return;
    }

    
    //Add the marker
    this.markerLayer.getSource().addFeature(this.marker);
    //set the layer visible
    this.markerLayer.setVisible(true);


    //Reset raw Heatmap Data
    this.heatMapData = [];

    //TESTING RETURN EARLY
    console.log(this.clickLat);

    //QUERY LOCAL FILE BECAUSE OF Access-Control-Allow-Origin
    //CORRECT CODE IS COMMENTED BELLOW
    //Local file query

    //Get the index of the csv file to fetch
    var dataIndex = this.getDataIndex(this.clickLon, this.clickLat);
    console.log(dataIndex);



    return;
    //TODO: backwardsQueries

    //Construct the query
    var query = 'https://swift.rc.nectar.org.au/v1/AUTH_24efaa1ca77941c18519133744a83574/globalCsvMonthly/Global_index'
      + String(dataIndex) + '_startsinJan.csv'

    console.log("before the get function");
    $.get(query, $.proxy(function(data) {
      console.log("got data");
      this.parseData(data);
      console.log("starting the counter");
      var counter = 0;
      this.timer = window.setInterval($.proxy(function() {
        var y = Math.floor(counter / 12);
        var m = counter % 12;
        this.updateHeatMap(y, m);

        counter++;
        if (counter > 12 * 10) {
          window.clearInterval(this.timer);
          this.timer = null;
        }
      }, this), 125);
    }, this)).done(function() {
      console.log( "second success" );
    }).fail($.proxy(function(){
      console.log("error in the get function");
    }));
    //End local file query

    /*
    //Request Rest API
    $.getJSON(this.apiUrl
        + "?lat="
        + clickEvent['coordinate'][1]
        + "&lng="
        + clickEvent['coordinate'][0]
        + "&startmon="
        + this.startMonth,
        $.proxy(function(data) { // On API response
            if (data && data.substring(0, 5) == "https") {
                $.get(data, $.proxy(this.parseData, this))
            }
        }, this));
// */
}


//When the center is updated
//Stay on the middle latitude
Map.prototype.centerUpdate = function(event) {
  console.log("doing a centre update thing");
  var oldCenter = event['oldValue'];
  var newCenter = this.map.getView().getCenter();

    //If the delta on latitude if very little: do nothing
    //This prevents the call stack to explode
    if (Math.abs(newCenter[1] - oldCenter[1]) < 1e-4) {
      return this;
    }
    newCenter[1] = oldCenter[1];
    this.map.getView().setCenter(newCenter);
    return this;
  };

  Map.prototype.createHeatMapPoint = function(long, lat, data) {
    return new ol.Feature({
      name: 'heatPoint',
      geometry: new ol.geom.Point(ol.proj.fromLonLat([long, lat])),
      weight: data * this.WEIGHT_FACTOR
    });
  };


//parses data from the csv file
Map.prototype.parseData = function(filecontent) {
  console.log("parsing data");
  var lines = filecontent.split("\n");

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var parts = line.split(',');
    if (!isNaN(parts[0]) && parts[0]!='') {

      var heatPointRaw = {
        year: parseInt(parts[0]),
        month: parseInt(parts[1]),
        lat: parseFloat(parts[2]),
        long: parseFloat(parts[3]),
        probability: parseFloat(parts[4])
      };
            //Fix long coordinates to be in the [-180, 180] range
            if (heatPointRaw.long > 180.0) {
              heatPointRaw.long -= 360.0;
            }
            //Fix lat coordinates to be in the [-180, 180] range
            if (heatPointRaw.lat > 180.0) {
              heatPointRaw.lat -= 360.0;
            }

            var  heatPoint = this.createHeatMapPoint(heatPointRaw.long, heatPointRaw.lat, heatPointRaw.probability);

            if (this.heatMapData[heatPointRaw.year] == undefined) { //Year doesn't exists
                this.heatMapData[heatPointRaw.year] = []; //Create it
            }
            if (this.heatMapData[heatPointRaw.year][heatPointRaw.month] == undefined) { //Month doesn't exists
                this.heatMapData[heatPointRaw.year][heatPointRaw.month] = []; // Create It
            }
            //Push it to storage
            this.heatMapData[heatPointRaw.year][heatPointRaw.month].push(heatPoint);
          }
        }
        console.log("finished parsing the data");
      };

    Map.prototype.updateHeatMap = function(year, month) {
    //If we have data for this year/month
    //Clear, update and display
    if (this.heatMapData[year] && this.heatMapData[year][month]) {
      console.log("UpdateHeat map at year=" + year + " month=" + month);

        //Cleanup heatmap
        this.heatMap.setSource(null);
        this.heatMapSource.clear();

        //console.log(this.heatMapData[year][month]);
        this.heatMapSource.addFeatures(this.heatMapData[year][month]);

        //Update Heatmap
        this.heatMap.setSource(this.heatMapSource);
        this.heatMap.setVisible(true);
        this.heatMap.setExtent(undefined);
        this.heatMap.changed();

        //update text in the dateBox
        $('#dateBox').text('Marine Plastics after ' + year + ' years and ' + month + ' months');
      }
    };



//create map
var themap = new Map();



//testing a simple ajax call
function doFunction(){

  themap.markerLayer.setVisible(false);
  /*
  console.log("doing the do funciton");
  $.ajax({
    url: 'http://www.doc.ic.ac.uk/~ksm113/adrift/js/navigation.js',
    dataType: 'jsonp',
    success: function(result){
      console.log("the result was successful");
    },
    error: function(result, textStatus, errorThrown){
      console.log("error in result");
      console.log(result);
      console.log(textStatus);
      console.log(errorThrown);
    } 
  }) */


//$('#dateBox>h3').text("Changed Text");

/*
  $.get('https://swift.rc.nectar.org.au/v1/AUTH_24efaa1ca77941c18519133744a83574/globalCsvMonthly/Global_index18595_startsinJan.csv',
    function(result){
      console.log(result);
    });
  */
}