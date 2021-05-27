"use strict";

function convertToTrack(contoursArray) {
    console.log(contoursArray);
    let trackJSON = { "startPosition": { "x": 0, "y": 0 }, "lines": [] };
    let currentID = 1;
    for (const [key, contour] of Object.entries(contoursArray)) {
        var contourLength = contour.length;
        for (let i = 0; i < contourLength; i++) {
            var x1 = contour[i].x;
            var y1 = contour[i].y;
            var x2 = contour[(i + 1) % contourLength].x;
            var y2 = contour[(i + 1) % contourLength].y;

            trackJSON.lines.push({
                "id": currentID++,
                "type": 0,
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2,
                "flipped": false
            });
        }
    }
    return trackJSON;
}