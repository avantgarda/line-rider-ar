"use strict";

function convertToTrack(contoursArray, scale) {

    let trackJSON = { "startPosition": { "x": 0, "y": 0 }, "lines": [] };
    let currentID = 1;

    let topLeftPoint = { "x": 0, "y": 0 };
    let topLeftDistance = 99999;

    for (const [key, contour] of Object.entries(contoursArray)) {

        var contourLength = contour.length;

        for (let i = 0; i < contourLength; i++) {

            var x1 = contour[i].x / scale;
            var y1 = contour[i].y / scale;
            var x2 = contour[(i + 1) % contourLength].x / scale;
            var y2 = contour[(i + 1) % contourLength].y / scale;

            trackJSON.lines.push({
                "id": currentID++,
                "type": 0,
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2,
                "flipped": false
            });

            // find top left contour start
            var currentDistance = Math.sqrt(Math.pow(x1, 2) + Math.pow(y1, 2));
            if (currentDistance < topLeftDistance) {
                topLeftDistance = currentDistance;
                topLeftPoint.x = x1;
                topLeftPoint.y = y1;
            }
        }
    }

    trackJSON.startPosition.x = topLeftPoint.x + 15;
    trackJSON.startPosition.y = topLeftPoint.y - 15;

    return trackJSON;
}

function trackToMarkerCoordinates(coords, pageSetupParams, videoHeight, scale) {
    var _x = 0.025 - pageSetupParams.markerCenterX + pageSetupParams.drawAreaH * (coords.x * scale) / videoHeight;
    var _y = -0.085 - pageSetupParams.markerCenterY + pageSetupParams.drawAreaH * (coords.y * scale) / videoHeight;
    // note z is specified instead of y
    return { x: _x, z: _y };
}