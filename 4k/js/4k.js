$("document").ready(function() {

	//disable right clicks
	window.oncontextmenu = function() {return false;};
	
	//idle timer
	var idleTime = 60; // seconds
	setInterval(function() {
		idleTime -= 1;
		$('#s_timer').text(idleTime);
		if (idleTime < 1) {
		window.location.href = '4kwelcome.html';
		}
		}, 1000);
		// Reset timer on mouse or touch events, the user is interacting
		$(this).mousedown(function() {
		idleTime = 60;
	});

	document.addEventListener('touchstart', function(e) {
		idleTime = 60;
	}, false);

});