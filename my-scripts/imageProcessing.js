"use strict";

class ImageProcessing {
    constructor(processingParams, pageSetupParams, video, liveCanvas) {
        // image processing parameters
        this.low_threshold = processingParams.low_threshold;
        this.high_threshold = processingParams.high_threshold;

        // page setup parameters
        this.markerCenterX = pageSetupParams.markerCenterX;
        this.markerCenterY = pageSetupParams.markerCenterY;
        this.markerCenterZ = pageSetupParams.markerCenterZ;
        this.markerSide = pageSetupParams.markerSide;

        this.drawAreaW = pageSetupParams.drawAreaW;
        this.drawAreaH = pageSetupParams.drawAreaH;

        // video stream element
        this.video = video;
        this.updateVideoDimensions();

        // hidden canvas elements for image processing
        this.canvas = document.createElement("canvas");
        this.context2d = this.canvas.getContext('2d');

        // canvas for live streaming of image processing
        this.liveCanvas = liveCanvas;
        // liveCanvas.width = w;
        // liveCanvas.height = h;

    }

    // download image from URI
    downloadURI(uri, name) {
        var link = document.createElement("a");
        link.download = name;
        link.href = uri;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        link = null;
    }

    updateVideoDimensions() {
        this.videoWidth = this.video.videoWidth;
        this.videoHeight = this.video.videoHeight;
    }

    // image processing
    imageProcessing() {

        // update video dimensions
        this.updateVideoDimensions();

        // reset canvas dimensions and get latest video frame
        this.canvas.width = this.videoWidth;
        this.canvas.height = this.videoHeight;
        this.context2d.drawImage(this.video, 0, 0);

        // make draw area the same height as the video (arbitrary)
        let h = parseInt(this.videoHeight);
        let w = h * this.drawAreaW / this.drawAreaH;

        //// image processing OpenCV

        let src = cv.imread(this.canvas);
        let dst = new cv.Mat();

        // perspective transform

        // get source and destinations parallelogram corners
        var srcPts = cornerClass.getCorners({ videoWidth: this.videoWidth, videoHeight: this.videoHeight });
        var destPts = [0, 0, w, 0, w, h, 0, h];

        let dsize = new cv.Size(w, h);
        let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, srcPts);
        let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, destPts);
        let M = cv.getPerspectiveTransform(srcTri, dstTri);
        cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

        // grayscale
        cv.cvtColor(dst, dst, cv.COLOR_RGBA2GRAY, 0);

        // canny edge detection
        cv.Canny(dst, dst, this.low_threshold, this.high_threshold, 3, false);

        // dilate and erode
        let N = cv.Mat.ones(5, 5, cv.CV_8U);
        let anchor = new cv.Point(-1, -1);
        // maybe change M or anchor paramter for each
        cv.dilate(dst, dst, M, anchor, 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
        cv.erode(dst, dst, M, anchor, 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());

        // mask out marker and border lines
        numCells = 1 + Math.floor(dst.rows * (this.markerSide + this.markerCenterX) / this.drawAreaH);
        border = 1 + Math.floor(numCells * this.drawAreaBorderPercent / 100);
        numCells += border;
        // marker
        for (let i = 0; i < numCells; i++) {
            for (let j = 0; j < numCells; j++) {
                dst.ucharPtr(i, j)[0] = 0;
            }
        }
        // border
        for (let i = 0; i < dst.rows; i++) {
            for (let j = 0; j < dst.cols; j++) {
                if ((i < border) || (i > (dst.rows - border)) || (j < border) || (j > (dst.cols - border))) {
                    dst.ucharPtr(i, j)[0] = 0;
                }
            }
        }

        // find contours
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        // You can try more different parameters
        cv.findContours(dst, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);
        // draw contours with random Scalar
        for (let i = 0; i < contours.size(); ++i) {
            let color = new cv.Scalar(Math.round(Math.random() * 255), Math.round(Math.random() * 255),
                Math.round(Math.random() * 255));
            cv.drawContours(dst, contours, i, color, 1, cv.LINE_8, hierarchy, 100);
        }
        contours.delete(); hierarchy.delete();

        // save processed image back to hidden canvas
        cv.imshow(this.canvas, dst);

        // show processing on visible canvas
        // cv.imshow(processingCanvas, dst);

        // free memory
        src.delete(); dst.delete(); M.delete(); N.delete(); srcTri.delete(); dstTri.delete();

        this.downloadURI(this.canvas.toDataURL("image/png"), "cropped");
    }

}