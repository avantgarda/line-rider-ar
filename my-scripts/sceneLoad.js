"use strict";

function loadScene() {

    let renderer = new THREE.WebGLRenderer({
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
    let scene = new THREE.Scene();
    let camera = new THREE.Camera();
    scene.add(camera);

    let markerGroup = new THREE.Group();
    scene.add(markerGroup);

    let source = new THREEAR.Source({ renderer, camera });

    let sceneInit = THREEAR.initialize({ source: source }).then((controller) => {

        let patternMarker = new THREEAR.PatternMarker({
            patternUrl: 'res/hiro.patt',
            markerObject: markerGroup
        });

        controller.trackMarker(patternMarker);

        // run the rendering loop
        let lastTimeMsec = 0;
        requestAnimationFrame(function animate(nowMsec) {
            // keep looping
            requestAnimationFrame(animate);
            // measure time
            lastTimeMsec = lastTimeMsec || nowMsec - 1000 / 60;
            let deltaMsec = Math.min(200, nowMsec - lastTimeMsec);
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
            marker: patternMarker,
            camera: camera
        };
    });

    // return promise with scene controller, marker, and camera
    return sceneInit;

}