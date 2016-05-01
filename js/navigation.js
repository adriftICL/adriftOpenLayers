$(document).ready(function() {

    /* Toggle active nav element*/
    $('.navbar-nav li').on('click', function() {
        $('.navbar-nav li').removeClass('active');
        $(this).addClass('active');
    });

    /* Home */
    $('#home-nav').on('click', function() {
        $('.content-container').css("display", "none");
        $('#mapContainer').css('display', 'block');
    });

    /* How navigation */
    $('#how-nav').on('click', function() {
        $('.content-container').css("display", "none");
        $('#how-container').css('display', 'block');
    });

    /* Faq navigation */
    $('#faq-nav').on('click', function() {
        $('.content-container').css("display", "none");
        $('#faq-container').css('display', 'block');
    });

    /* Team navigation */
    $('#team-nav').on('click', function() {
        $('.content-container').css("display", "none");
        $('#team-container').css('display', 'block');
    });

    /* Plasitc navigation */
    $('#plastic-nav').on('click', function() {
        $('.content-container').css("display", "none");
        $('#plastic-container').css('display', 'block');
    });


})