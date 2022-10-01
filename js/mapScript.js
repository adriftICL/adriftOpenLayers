

//The Main Map Class

function Map() {
  this.serverAddress = 'https://plasticadrift.science.uu.nl'
  this.loop = true;

  this.WEIGHT_FACTOR = 200;
  this.timer = null;
  this.landpoints = null; //array to store landpoint bools
  this.direction = 'fwd';
  this.startMon = 'jan';

  this.clickLon = null;
  this.clickLat = null;

  this.markerLon = null;
  this.markerLat = null;

  this.center = null;
  this.heatMapData = [];

  this.markerUrl = 'img/MarkerDuckie.png';

  //check if 4k screen, adjust attributes accordingly
  if ($(window).width() > 3000){
    this.WEIGHT_FACTOR = 800;
    this.markerUrl = 'img4k/MarkerDuckie.png';
  }

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
        src: this.markerUrl
      })
    })
  });

  // z-index set to 2 to make sure marker is always above heatmap
  this.markerLayer.setZIndex(2);

  this.mapOptions = {
    target: 'mapClass',
    controls: [],
    interactions: ol.interaction.defaults({
     doubleClickZoom:false,
     mouseWheelZoom:false,
     pinchRotate:false,
     pinchZoom:false,
     dragPan: true,
   }),
    layers: [
    new ol.layer.Tile({
      //source: new ol.source.MapQuest({layer: 'sat'})
      //source: new ol.source.OSM({ wrapX: true })
      source: new ol.source.Stamen({layer: 'watercolor'})
      //source: new ol.source.MapQuest({layer: 'osm'})
      /*source: new ol.source.OSM({
        url: 'tiles/watercolor/{z}/{x}/{y}.jpg'
      }) */ 

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
  this.extent = [-70, 60 , 60, -50]; //[lon, lat, lon, lat]
  this.extent = ol.extent.applyTransform(this.extent, ol.proj.getTransform("EPSG:4326", "EPSG:3857")); 
  this.map.getView().fit(this.extent, this.map.getSize());



  this.heatMapSource = new ol.source.Vector({});

  this.heatMap = new ol.layer.Heatmap({
    weight: "weight",
    source: this.heatMapSource,
    visible: true,
    supdateWhileAnimating: true,
    updateWhileInteracting: true,
  });

  //add heatmap layer to the map
  this.map.addLayer(this.heatMap);

  //save the centre of the map (longitude only)
  this.saveCenter();

  this.checkLocalServer();
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
  $('#backward').click($.proxy(function(){
    this.setDirection('bwd');
  }, this));

  $('#forward').click($.proxy(function(){
    this.setDirection('fwd');
  }, this));
}

//get index of the heatmap data packet to be fetched
Map.prototype.getDataIndex = function(lon, lat){
  lon = Math.floor(lon);
  lat = Math.floor(lat);
  lat += 90;
  if (lon < 0) {
    lon += 361;
  }
  return (((lat-1) * 361) + lon);
}

//check if a point is on land
Map.prototype.checkLandPoint = function(index, callback){
  var saveLandpoints = function(data){
    this.landpoints = data.split(',');
    var landpointValue = parseInt(this.landpoints[index]);
    callback(landpointValue);
  }
  //load the landpoints file if not already done so
  if (this.landpoints == null) {
    $.get("https://plasticadrift.org/data/landpoints.csv").success($.proxy(saveLandpoints,this))
    .error($.proxy(function(result){
      console.log("Error fetching landpoints.csv file");
        callback(-2); //use -2 for error code as -1 is already taken
      }, this));
  } else {
    var landpointValue = parseInt(this.landpoints[index]);
    callback(landpointValue);
  } 
}

Map.prototype.onClick = function(clickEvent) { 
   //convert the projection of the coordinates
   var lonlat = ol.proj.transform(clickEvent.coordinate, "EPSG:3857", "EPSG:4326");
   this.clickLon = oneDecimalPlace(lonlat[0]);
   this.clickLat = oneDecimalPlace(lonlat[1]);
   var dataIndex = this.getDataIndex(this.clickLon, this.clickLat);
   this.checkLandPoint(dataIndex, $.proxy(this.run, this));
 };

// the main function which acquires fetches data and runs heatmap
Map.prototype.run = function(landpointValue){
    //Check correct landpoint value
    if (landpointValue == -2){
      console.log("error fetching landpont file and value");
      this.showWarning('Sorry, we were unable to retrieve data for that location', 5000);
      return;
    } else if (landpointValue == 1) {
      //alert('point was on land, please choose a point on sea');
      this.showWarning('You clicked on land, please click on the ocean', 4000);
      return;
    } else if (landpointValue == -1){
      this.showWarning('Sorry we have no data for that ocean area', 4000);
      return;
    }
    //clear any existing warning messages
    this.clearWarning();

    //Make the Marker Visible
    this.markerLayer.getSource().clear();
    this.marker.getGeometry().setCoordinates(ol.proj.transform([this.clickLon, this.clickLat],"EPSG:4326","EPSG:3857"));
    this.markerLayer.getSource().addFeature(this.marker);
    this.markerLayer.setVisible(true);

    this.markerLon = this.clickLon;
    this.markerLat = this.clickLat;

    //abort any existing request
    if (this.req != null){
      this.req.abort();
    }
    
    this.setURL();

    //start the loading icon
    $(".spinner").css("visibility","visible");


    //Reset Heatmap in case it is presently running
    this.timer == null;
    this.heatMap.setSource(null);
    this.heatMapSource.clear();
    this.heatMapData = [];
    window.clearInterval(this.timer);

    //Get the index of the csv file to fetch
    var dataIndex = this.getDataIndex(this.clickLon, this.clickLat);

    //TODO: backwardsQueries

    //Construct the query

    var query = this.getDataURL(dataIndex);
    console.log(query);
    
    //Update the download-link text
    $("div#downloadbar_text").html('<b><a href="'+query+'">Click here for csv file</a></b></p><p>This experiment starts at latitude = <b>'+this.markerLat+'</b>, longitude = <b>'+this.markerLon+'</b> and starts in the two-month period Jan-Feb</b>. To change, alter the values in the address bar. <i>Note that currently startmonth can not be changed.</i></p>')

    //https://swift.rc.nectar.org.au/v1/AUTH_24efaa1ca77941c18519133744a83574/globalbwdCsv/Global_index36784.csv

    /*var query = this.serverAddress + '/globalCsvMonthly/Global_index'
    + String(dataIndex) + '_startsinJan.csv'
    */
    this.req = $.get(query, $.proxy(function(data) {
      console.log("got data");
      this.parseData(data);
      //turn off loading signal
      $(".spinner").css("visibility","hidden");
      var counter = 0;
      this.timer = window.setInterval($.proxy(function() {
        var y = Math.floor(counter / 12);
        var m = counter % 12;
        this.updateHeatMap(y, m);
        counter++;
        if (counter > 12 * 10) {
          if (this.loop == true) {
            console.log("reset counter");
            counter = 0
          } else {
            window.clearInterval(this.timer);
            this.timer = null;
          }
        }
      }, this), 125);
    }, this))
    .fail($.proxy(function(result){
      $(".spinner").css("visibility","hidden");
      /* Status 0 would be called if query is aborted
       * only show alert message if fail resulted in fetching error (status 404)
       */
       if (result.status != 0){
        this.showWarning("Sorry, we have no data for that ocean area",5000);
      }
    }, this));
  }

  Map.prototype.getDataURL = function(dataIndex){
    if (this.direction == 'fwd'){
      var pad = "00000"
      var str = String(dataIndex)
      return this.serverAddress + '/data/globalfwdCsv/Global_index'
      + pad.substring(0, pad.length - str.length) + str + '_startsinJan.csv';
    } else if (this.direction == 'bwd') {
      return this.serverAddress + '/data/globalbwdCsv/Global_index' + String(dataIndex) + '.csv';
    }
  }

  //When the center is updated
  //Stay on the middle latitude
  Map.prototype.centerUpdate = function(event) {
    var oldCenter = event['oldValue'];
    var newCenter = this.map.getView().getCenter();
    //If the delta on latitude if very little: do nothing
    //This prevents the call stack to explode
    if (Math.abs(newCenter[1] - oldCenter[1]) < 1e-4) {
      return this;
    }
    newCenter[1] = oldCenter[1];
    this.map.getView().setCenter(newCenter);
    this.saveCenter();
    //update url only if ocean point has been clicked
    if (this.markerLat != null) {
      this.setURL();
    }
    return this;
  };

  //Saves the center point of the map (longitude only)
  Map.prototype.saveCenter = function(){
    var cent = this.map.getView().getCenter();
    this.center = oneDecimalPlace(ol.proj.transform(cent, "EPSG:3857", "EPSG:4326")[0]);
  }

  Map.prototype.setCenter = function(centerLon){
    this.map.getView().setCenter(ol.proj.transform([centerLon, 0], "EPSG:4326", "EPSG:3857"))
  }

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
  };

      Map.prototype.updateHeatMap = function(year, month) {
  //If we have data for this year/month
  //Clear, update and display
  if (this.heatMapData[year] && this.heatMapData[year][month]) {
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
    var url_parts = window.location.href.replace(/\/\s*$/,'').split('/');
    if (url_parts.at(-2).includes('nl')) {
      $('#dateBox').text('Marine plastics na ' + year + ' jaar en ' + month + ' maanden');
    } else {
      $('#dateBox').text('Marine Plastics after ' + year + ' years and ' + month + ' months');
    }
  }
};

Map.prototype.setURL = function() {
  var url = window.location.href.split('?')[0];
  url += '?lat=' + this.markerLat + '&lng=' + this.markerLon
  + '&center=' + this.center + '&startmon=' + this.startMon + '&direction=' + this.direction;
  history.pushState({}, null, url);
}

Map.prototype.checkURL = function(){
  var vars = getUrlVars();
  var variables = ['lon', 'lat', 'center', 'startmon', 'direction' ];
  //check all required parameters exist 
  if ($.isEmptyObject(vars)){
    return;
  }
  for (i=0; i < variables.length; i++){
    if (vars.hasOwnProperty(variables[i]) == null){
      return;
    }
  }
  //set direction
  if (vars.direction == 'fwd' || vars.direction == 'bwd') {
    this.direction = vars.direction;
  }
  this.setCenter(Number(vars.center));
  //simulate a click
  var click = {coordinate: ol.proj.transform([Number(vars.lng), Number(vars.lat)], "EPSG:4326", "EPSG:3857")};
  this.onClick(click);

}

Map.prototype.showWarning = function(message, milliseconds){
  $('#warningBox').text(message);
  $('#warningBox').finish().fadeIn("fast").delay(milliseconds).fadeOut("slow");
}

Map.prototype.clearWarning = function(){
  $('#warningBox').finish().fadeOut("fast");
}

Map.prototype.checkLocalServer = function(){
  if (!this.serverAddress.startsWith('https')){
    $('.spinner').hide(500);
  }
}

Map.prototype.setDirection = function(newDirection){
  var url_parts = window.location.href.replace(/\/\s*$/,'').split('/');
  if (newDirection == 'fwd'){
    this.direction = 'fwd';
    if (url_parts.at(-2).includes('nl')) {
      $('#fwdbwdlink').text('Laat zien waar plastic eindigt');
    } else {
      $('#fwdbwdlink').text('Showing where plastic ends up');
    }
  } else if (newDirection == 'bwd'){
    this.direction = 'bwd';
    if (url_parts.at(-2).includes('nl')) {
      $('#fwdbwdlink').text('Laat zien waar plastic vandaan komt');
    } else {
      $('#fwdbwdlink').text('Showing plastic origin');
    }
  }
  $(window).colorbox.close();
  this.run()
}

function oneDecimalPlace(x) {
  return Math.round(x*10)/10;
}

function getUrlVars() {
  var vars = {};
  var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
    vars[key] = value;
  });
  return vars;
}

//create map
var themap = new Map();
themap.checkURL();

