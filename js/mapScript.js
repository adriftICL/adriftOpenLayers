

//The Main Map Class

function Map() {
	console.log("Running the map")

  this.WEIGHT_FACTOR = 100
  this.timer = null;


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
          	})
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
}

Map.prototype.onClick = function(clickEvent) {
  console.log("running onClick");
  console.log(clickEvent);
    //Check that it's not already running
    if (this.timer !== null){ //If so exit
        return;
    }

    /*
    //Clear layer
    this.markerLayer.getSource().clear();
    //Set marker position
    this.marker.getGeometry().setCoordinates(clickEvent['coordinate']);
    //Add the marker
    this.markerLayer.getSource().addFeature(this.marker);
    */

    //Reset raw Heatmap data
    this.heatMapData = [];

    //QUERY LOCAL FILE BECAUSE OF Access-Control-Allow-Origin
    //CORRECT CODE IS COMMENTED BELLOW
    //Local file query
    console.log("before the get function");
    $.get("data/sample5.csv", $.proxy(function(data) {
        console.log("got data");
        this.parseData(data);
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
};

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

//testing a simple ajax call
function doFunction(){
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
    
  
    $('#dateBox>h3').text("Changed Text");
/*
  $.get('https://swift.rc.nectar.org.au/v1/AUTH_24efaa1ca77941c18519133744a83574/globalCsvMonthly/Global_index18595_startsinJan.csv',
    function(result){
      console.log(result);
    }); */
}

//create map
var themap = new Map();
