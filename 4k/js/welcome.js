


$("document").ready(function() {

	$('.overlay').click(function() {
		window.location.href="4k.html";
	});


	var fadeInOut = function(){
		$('.text-images').fadeOut(1000).delay(2000).fadeIn(1000);
	}; 

	setInterval(fadeInOut, 15000);
});