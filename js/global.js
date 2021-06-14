//RESPONSIVE VARS
var tablet = 768;
var mobileMax = 767;

////////////////////////////////////////////////
// Smooth Scrolling //
////////////////////////////////////////////////


var defaultDuration = 777; // ms
var edgeOffset = 0; // px
zenscroll.setup(defaultDuration, edgeOffset);


///////////
// NAV  //
//////////

var nav = document.getElementById('anchor-nav');

//remove any nav buttons linking to modules that have been removed from HTML
function dynamicNavLinks() {
	if ( !nav ) return;
	//create array of nav link ids without -link to match module ids
	let linkedSectionIds = Array.prototype.slice.call( document.getElementsByClassName("nav-link") ).map( section => {
		let lastIndex = section.id.lastIndexOf("-");
		return section.id.substring(0, lastIndex);
	});
	//collect HTML elements with "module" class and convert to array of ids
	let sectionIds = Array.prototype.slice.call( document.getElementsByClassName("module") ).map( section => section.id );
	//remove links to sections not found in DOM
	linkedSectionIds.forEach( id => {
		if (sectionIds.indexOf(id) === -1) {
			let el = document.getElementById(id + "-link");
			if (el) { el.parentNode.removeChild(el); }
		}
	});
}


//////////////////////////
// SINGLEVIDEO MODULE  //
////////////////////////

var singleVideo = videojs.getPlayer('single-video-js');

function loadSingleVideoSrc() {
	if (!singleVideo) return;
	
	let srcToLoad;
	let currentVidId;
	//responsive video src
	if ( window.innerWidth < mobileMax ) {
		srcToLoad = singleVideo.getAttribute('data-mobile-id');
	} else {
		srcToLoad = singleVideo.getAttribute('data-desktop-id');
	}
	
	currentVidId = singleVideo.getAttribute('data-video-id');
	if (srcToLoad !== currentVidId) {
		singleVideo.catalog.getVideo(srcToLoad, function (error, video) {
			singleVideo.catalog.load(video);
		});
	}
}


///////////////////////
// RETAILER MODULE  //
/////////////////////


var retailerModule = document.getElementById('retailer-module');

function setColumnHeight() {
	if ( !retailerModule ) return;
	//get choose pc columns and convert to array
	let els = Array.prototype.slice.call( document.querySelectorAll("#retailer-module .use-case") );
	//reset column height
	els.forEach( el => { el.style.height = 'auto'; });
	//get calculated heights and sort, setting var to last in resulting array
	let tallest = els.map( el => el.offsetHeight ).sort( (a,b) => a-b )[els.length-1];
	//set all to tallest px height
	els.forEach( el => { el.style.height = tallest + 'px'; });
}


//////////////////////////////////////////////
// PRELOADER  //
////////////////////////////////////////////

var preloadModule = document.getElementById('preload-module');

function hidePreloader() {
	if (!preloadModule) return;

    preloadModule.classList.add('fadeOut');
    setTimeout(function() {preloadModule.style.display = 'none';}, 800);
}

/////////////////
// 3D MODULE  //
///////////////

var evo3dModule = document.getElementById('explore-evo-3d-module');
var evo3dIframe = evo3dModule ? evo3dModule.querySelector('iframe') : null;

function evo3dLoadResponsiveSrc() {
	if (!evo3dModule) return;
	
	if (!evo3dIframe) {
		evo3dModule.classList.add('static');
	}
	else {		
		var evo3dModuleDesktopSrc = evo3dModule.getAttribute('data-desktop-url');
		var evo3dModuleMobileSrc = evo3dModule.getAttribute('data-mobile-url');
		
		if (window.innerWidth <= mobileMax && evo3dIframe.src !== evo3dModuleMobileSrc) {
			evo3dIframe.src = evo3dModuleMobileSrc;
		}
		else if ( window.innerWidth > mobileMax && evo3dIframe.src !== evo3dModuleDesktopSrc) {
			evo3dIframe.src = evo3dModuleDesktopSrc;
		}
	}

}

///////////////////////////////////////////////////////////
// WINDOW ON LOAD AND ONRESIZE EVENTS FROM ALL MODULES  //
/////////////////////////////////////////////////////////

$(document).ready(function(){
	$('.slider-experience').slick({
		slidesToShow: 1,
		slidesToScroll: 1,
		draggable: false,
		dots: true,
		arrows: false,
		speed: 500
	});
});

document.addEventListener('DOMContentLoaded', (event) => {	
	dynamicNavLinks();
	//single video
	loadSingleVideoSrc();
	//retailer module
	setColumnHeight();
	//3D module
	evo3dLoadResponsiveSrc();
	//preloader
	setTimeout(function() {
		hidePreloader();
	}, 500);
});

window.onresize = function() {
	setTimeout(function() {
		//single video
		loadSingleVideoSrc();
		//retailer module
		setColumnHeight();
		//3D module
		evo3dLoadResponsiveSrc();
	}, 100);
};
