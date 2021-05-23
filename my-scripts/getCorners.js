"use strict";

class Corners {
    constructor(pageSetup, marker, camera) {
        this.markerCenterX = pageSetup.markerCenterX;
        this.markerCenterY = pageSetup.markerCenterY;
        this.markerCenterZ = pageSetup.markerCenterZ;
        this.markerSide = pageSetup.markerSide;

        this.drawAreaW = pageSetup.drawAreaW;
        this.drawAreaH = pageSetup.drawAreaH;

        this.marker = marker;
        this.camera = camera;
    }

    getLocalCornerVectors() {
        // (x, z, -y)
        let bl = new THREE.Vector3(0 - this.markerCenterX, this.markerCenterZ, this.drawAreaH - this.markerCenterY);
        let br = new THREE.Vector3(this.drawAreaW - this.markerCenterX, this.markerCenterZ, this.drawAreaH - this.markerCenterY);
        let tr = new THREE.Vector3(this.drawAreaW - this.markerCenterX, this.markerCenterZ, 0 - this.markerCenterY);
        let tl = new THREE.Vector3(0 - this.markerCenterX, this.markerCenterZ, 0 - this.markerCenterY)

        return [tl, tr, br, bl];
    }

    // convert local draw area corners to 2D canvas coordinates
    getCorners(videoDimensions) {

        // update video dimensions
        this.videoDimensions = videoDimensions;

        let cornerVectors = this.getLocalCornerVectors();

        let corners = [];

        // convert each local draw area vector to world coordinates
        for (let i = 0; i < 4; i++) {
            let proj = this.toVideoPosition(cornerVectors[i]);
            corners.push(proj.x);
            corners.push(proj.y);
        }

        return corners;
    }

    // convert local draw area vector to world coordinates
    toVideoPosition(vec) {
        this.marker.markerObject.localToWorld(vec);

        let widthHalf = 0.5 * this.videoDimensions.videoWidth;
        let heightHalf = 0.5 * this.videoDimensions.videoHeight;

        vec.project(this.camera);

        vec.x = (vec.x * widthHalf) + widthHalf;
        vec.y = - (vec.y * heightHalf) + heightHalf;

        return {
            x: vec.x,
            y: vec.y
        };
    }

}