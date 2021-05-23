"use strict";

function loadScene() {

    var renderer = new THREE.WebGLRenderer({
        // antialias : true,
        alpha: true
    });
    renderer.setClearColor(new THREE.Color('lightgrey'), 0)
    // renderer.setPixelRatio(2);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.top = '0px'
    renderer.domElement.style.left = '0px'
    document.body.appendChild(renderer.domElement);

    // init scene and camera
    var scene = new THREE.Scene();
    var camera = new THREE.Camera();
    scene.add(camera);

    var markerGroup = new THREE.Group();
    scene.add(markerGroup);

    var source = new THREEAR.Source({ renderer, camera });

    var patternMarker = new THREEAR.PatternMarker({
        patternUrl: 'res/hiro.patt',
        markerObject: markerGroup
    });

    let sceneInit = THREEAR.initialize({ source: source }).then((controller) => {

        controller.trackMarker(patternMarker);

        // run the rendering loop
        var lastTimeMsec = 0;
        requestAnimationFrame(function animate(nowMsec) {
            // keep looping
            requestAnimationFrame(animate);
            // measure time
            lastTimeMsec = lastTimeMsec || nowMsec - 1000 / 60;
            var deltaMsec = Math.min(200, nowMsec - lastTimeMsec);
            lastTimeMsec = nowMsec;
            // call each update function
            controller.update(source.domElement);
            renderer.render(scene, camera);
        });

        // notify that scene is ready
        console.log("Scene loaded!");

        // return [controller, patternMarker, camera];
        return {
            controller: controller,
            patternMarker: patternMarker,
            camera: camera
        };
    });

    // return promise with scene controller, marker, and camera
    return sceneInit;

}