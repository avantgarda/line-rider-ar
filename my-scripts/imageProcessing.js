"use strict";

class ImageProcessing {
    constructor(processingParams, pageSetupParams, video, liveCanvas) {
        // image processing parameters
        this.canny_low_threshold = processingParams.canny_low_threshold;
        this.canny_high_threshold = processingParams.canny_high_threshold;

        this.dilateKernel = processingParams.dilateKernel;
        this.erodeKernel = processingParams.erodeKernel;
        this.dilateIters = processingParams.dilateIters;
        this.erodeIters = processingParams.erodeIters;

        // page setup parameters
        this.markerCenterX = pageSetupParams.markerCenterX;
        this.markerCenterY = pageSetupParams.markerCenterY;
        this.markerCenterZ = pageSetupParams.markerCenterZ;
        this.markerSide = pageSetupParams.markerSide;

        this.drawAreaW = pageSetupParams.drawAreaW;
        this.drawAreaH = pageSetupParams.drawAreaH;

        this.drawAreaBorderPercent = pageSetupParams.drawAreaBorderPercent;

        // video stream element
        this.video = video;
        this.updateVideoDimensions();

        // hidden canvas elements for image processing
        this.canvas = document.createElement("canvas");
        this.context2d = this.canvas.getContext('2d');

        // canvas for live streaming of image processing
        this.liveCanvas = liveCanvas;
    }

    // download image from URI
    downloadURI(uri, name) {
        let link = document.createElement("a");
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
    imageProcessing(sourceCorners) {

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
        let srcPts = sourceCorners;
        let destPts = [0, 0, w, 0, w, h, 0, h];

        let dsize = new cv.Size(w, h);
        let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, srcPts);
        let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, destPts);
        let M = cv.getPerspectiveTransform(srcTri, dstTri);
        cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
        src.delete(); M.delete(); srcTri.delete(); dstTri.delete();

        // grayscale
        cv.cvtColor(dst, dst, cv.COLOR_RGBA2GRAY, 0);

        // canny edge detection
        cv.Canny(dst, dst, this.canny_low_threshold, this.canny_high_threshold, 3, false);

        // dilate and erode
        let dilateK = cv.Mat.ones(this.dilateKernel, this.dilateKernel, cv.CV_8U);
        let erodeK = cv.Mat.ones(this.erodeKernel, this.erodeKernel, cv.CV_8U);
        let anchor = new cv.Point(-1, -1);
        // maybe change M or anchor paramter for each
        cv.dilate(dst, dst, dilateK, anchor, this.dilateIters, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
        cv.erode(dst, dst, erodeK, anchor, this.erodeIters, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
        dilateK.delete(); erodeK.delete();

        // mask out marker and border lines
        let numCells = 1 + Math.floor(dst.rows * (this.markerSide + this.markerCenterX) / this.drawAreaH);
        let border = 1 + Math.floor(numCells * this.drawAreaBorderPercent / 100);
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

        // // find contours
        // let contours = new cv.MatVector();
        // let hierarchy = new cv.Mat();
        // let poly = new cv.MatVector();
        // // You can try more different parameters
        // cv.findContours(dst, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);
        // // draw contours with random Scalar
        // // let cnt = contours.get(0);
        // for (let i = 0; i < contours.size(); ++i) {
        //     let tmp = new cv.Mat();
        //     let cnt = contours.get(i);
        //     cv.approxPolyDP(cnt, tmp, 3, false);
        //     poly.push_back(tmp);
        //     // console.log(cnt.data32S[i]);
        //     // console.log(contours.get(i));
        //     // let color = new cv.Scalar(Math.round(Math.random() * 255), Math.round(Math.random() * 255),
        //     //     Math.round(Math.random() * 255));
        //     // cv.drawContours(dst, contours, i, color, 1, cv.LINE_8, hierarchy, 100);
        // }

        // function plotPoints(canvas, points) {
        //     const ctx = canvas.getContext('2d')
        //     ctx.strokeStyle = 'green'

        //     Object.values(points).forEach(ps => {
        //         ctx.beginPath()
        //         ctx.moveTo(ps[0].x, ps[1].y)
        //         ctx.arc(ps[0].x, ps[1].y, 2, 0, 2 * Math.PI)
        //         ps.slice(1).forEach(({ x, y }) => {
        //             ctx.lineTo(x, y)
        //             ctx.arc(x, y, 2, 0, 2 * Math.PI)
        //         })
        //         ctx.closePath()
        //         ctx.stroke()
        //     })
        // }

        // const points = {}
        // for (let i = 0; i < contours.size(); ++i) {
        //     const ci = contours.get(i)
        //     points[i] = []
        //     for (let j = 0; j < ci.data32S.length; j += 2) {
        //         let p = {}
        //         p.x = ci.data32S[j]
        //         p.y = ci.data32S[j + 1]
        //         points[i].push(p)
        //     }
        // }
        // this.liveCanvas.width = w;
        // this.liveCanvas.height = h;
        // plotPoints(this.liveCanvas, points)

        // contours.delete(); hierarchy.delete(); poly.delete();

        // // save processed image back to hidden canvas
        // this.canvas.width = w;
        // this.canvas.height = h;
        // cv.imshow(this.canvas, dst);

        // show processing on visible canvas
        this.liveCanvas.width = w;
        this.liveCanvas.height = h;
        cv.imshow(this.liveCanvas, dst);

        // free remaining memory
        dst.delete();

        // this.downloadURI(this.canvas.toDataURL("image/png"), "cropped");
    }

}