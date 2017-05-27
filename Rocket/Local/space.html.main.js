(function (wnd) {
    var siGameVersion = "v0.1",
        siscFrameWidth = wnd.innerWidth,
        siscFrameHeight = wnd.innerHeight,

        siWorldToScrScale = 0, // to be init on resize
        siwcFrameWidth = 0,    // to be init on resize
        siwcFrameHeight = 230, // Scale is set by height ratio, so world visible height is constant
        siwcEarthHeight = 30,  // Scale is set by height ratio, so earth visible height is constant

        siwcMouse = { x: 0, y: 0 }, //to be init on mouse move
        siscMouse = { x: 0, y: 0 }, //to be init on mouse move

        siwcPlayerShipWidth = 4,  // Scale is set by height ratio, so earth visible height is constant
        siwcPlayerShipHeight = 35, // Scale is set by height ratio, so world visible height is constant
        siwcPlayerShipCenter = { x: 0, y: siwcPlayerShipHeight / 2 },
        siscPlayerShipCenter = { x: 0, y: 0 }, // to be init on render
        siwcPlayerShipEngineForce = 0,
        siwcPlayerShipEngineForceDeltaPerSec = 4,
        siwcPlayerShipEngineForceLimit = 20,
        siwcPlayerShipMass = .5
        siwcGravityAcceleration = 9.8,
        siwcAirFrictionFactor = 0.07;
        siwcPlayerShipVelocity = { x: 0, y: 0 }, // to be init on physics processing
        siwcPlayerShipAcceleration = { x: 0, y: 0 }, // to be init on physics processing
        siwcPlayerShipRotationAngle = 0,
        siwcPlayerShipDirectionOrt = { x: 0, y: 0 }, // to be init on ship direction update

        siPrevTimeQuantumPreciseTimeMS = 0, 
        siPrevDebugInfoStatUpdatePreciseTimeMS = 0,
        siPrevDebugInfoDisplayUpdatePreciseTimeMS = 0,

        siDebugInfoStatUpdateIntervalMS = 1000,
        siDebugInfoDisplayUpdateIntervalMS = 200,

        siFrameCount = 0,
        siFrameCountBeforeCurrSec = 0,
        siFPS = 0,

        siWorldTimeQuantumCount = 0,
        siWorldTimeQuantumCountBeforeCurSec = 0,
        siTQPS = 0,

        siBackgroundProcessingIntervalMS = 200,
        siFlameBlowIntervalMS = 50,
        siTimeQuantumMS = 5,

        mouseDown = [0, 0, 0, 0, 0, 0, 0, 0, 0],
        mouseDownCount = 0,

        siMouseButton = {
            Left: 0,
            Right: 2
        },

        siSpaceObjectType = {
            Ship: 0,
            Meteor_Gem: 1,
            Meteor_Iron: 2,
            Meteor_Ice: 3,
            Meteor_Radioctive: 4,
            Meteor_Stone: 5,
            Wreck: 6,
            FlameBall: 7
        },

        siSpaceObjects = [],

        siDebugMode = true;

    function SI_Init() {
        if (siDebugMode) { appendDiv("sidiv-FrameDebugInfo"); }
        SI_InitHTML();
        requestAnimationFrame(SI_RenderFrame);
    }

    function SI_InitHTML() {
        SI_HTMLSetElems();
        SI_HTMLResize();
        window.onresize = handleWindowResize;
        document.onmousemove = handleMouseMove;

        document.body.onmousedown = function (event) {
            ++mouseDown[event.button];
            ++mouseDownCount;
        }

        document.body.onmouseup = function (event) {
            --mouseDown[event.button];
            --mouseDownCount;
        }

        document.body.oncontextmenu = function (event) {
            return false;
        }

        setTimeout(SI_BackgroundProcessing, siBackgroundProcessingIntervalMS);
        setTimeout(SI_FlameBlowProcessing, siFlameBlowIntervalMS);
        setTimeout(SI_WorldTimeQuantumProcessing, siTimeQuantumMS);
    }

    function SI_BackgroundProcessing() {
        for (var count = 0; count < siSpaceObjects.length; count++) {
            switch (siSpaceObjects[count].ObjectType) {
                case siSpaceObjectType.FlameBall:
                    siSpaceObjects[count].wcSize -= siSpaceObjects[count].wcSizeDeltaPerProcessingInterval;
                    if (siSpaceObjects[count].wcSize < 0) siSpaceObjects[count].wcSize = 0;
                    break;
            }
            if (siSpaceObjects[count].wcSize == 0) siSpaceObjects.splice(count, 1);
        }
        setTimeout(SI_BackgroundProcessing, siBackgroundProcessingIntervalMS);
    }

    function SI_FlameBlowProcessing() {
        if (siwcPlayerShipEngineForce > 0) {
            var FlameBall = {
                ObjectType: siSpaceObjectType.FlameBall,
                wcCenter: { x: siwcPlayerShipCenter.x - siwcPlayerShipHeight / 8 * Math.sin(siwcPlayerShipRotationAngle), y: siwcPlayerShipCenter.y - siwcPlayerShipHeight / 8 * Math.cos(siwcPlayerShipRotationAngle) },
                wcVelocity: { x: -siwcPlayerShipVelocity.x - siwcPlayerShipDirectionOrt.x * siwcPlayerShipEngineForce, y: -siwcPlayerShipVelocity.y - siwcPlayerShipDirectionOrt.y * siwcPlayerShipEngineForce},
                wcAirFrictionFactor: 0.001,
                wcMass: 0.001,
                wcSizeDeltaPerProcessingInterval: .5,
                wcSize: siwcPlayerShipEngineForce / 4
            }
            siSpaceObjects.push(FlameBall);
        }
        setTimeout(SI_FlameBlowProcessing, siFlameBlowIntervalMS);
    }

    function SI_WorldTimeQuantumProcessing() {
        var currTimeQuantumPreciseTimeMS = performance.now();
//        if (siPrevTimeQuantumPreciseTimeMS != 0) { //otherwise skip one loop
            SI_ProcessTimeQuantumPhysics(currTimeQuantumPreciseTimeMS);
//        }
        siPrevTimeQuantumPreciseTimeMS = currTimeQuantumPreciseTimeMS;
        siWorldTimeQuantumCount++;
        setTimeout(SI_WorldTimeQuantumProcessing, siTimeQuantumMS);
    }

    function SI_ProcessTimeQuantumPhysics(currTimeQuantumPreciseTimeMS) {
        var timeQuantumDelta = currTimeQuantumPreciseTimeMS - siPrevTimeQuantumPreciseTimeMS;

        // Ship physics
        if (mouseDown[siMouseButton.Left]) {
            siwcPlayerShipEngineForce = siwcPlayerShipEngineForce + siwcPlayerShipEngineForceDeltaPerSec * (timeQuantumDelta) / 1000;
            if (siwcPlayerShipEngineForce > siwcPlayerShipEngineForceLimit) siwcPlayerShipEngineForce = siwcPlayerShipEngineForceLimit;
        }

        if (mouseDown[siMouseButton.Right]) {
            siwcPlayerShipEngineForce = siwcPlayerShipEngineForce - siwcPlayerShipEngineForceDeltaPerSec * (timeQuantumDelta) / 1000;
            if (siwcPlayerShipEngineForce < 0) siwcPlayerShipEngineForce = 0;
        }

        siwcPlayerShipAcceleration.x = (siwcPlayerShipEngineForce * Math.sin(siwcPlayerShipRotationAngle) - siwcPlayerShipVelocity.x * siwcAirFrictionFactor) / siwcPlayerShipMass;
        siwcPlayerShipAcceleration.y = (siwcPlayerShipEngineForce * Math.cos(siwcPlayerShipRotationAngle) - siwcGravityAcceleration - siwcPlayerShipVelocity.y * siwcAirFrictionFactor) / siwcPlayerShipMass;

        siwcPlayerShipVelocity.x = siwcPlayerShipVelocity.x + siwcPlayerShipAcceleration.x * (timeQuantumDelta) / 1000;
        siwcPlayerShipVelocity.y = siwcPlayerShipVelocity.y + siwcPlayerShipAcceleration.y * (timeQuantumDelta) / 1000;

        siwcPlayerShipCenter.x = siwcPlayerShipCenter.x + siwcPlayerShipVelocity.x * (timeQuantumDelta) / 1000;
        siwcPlayerShipCenter.y = siwcPlayerShipCenter.y + siwcPlayerShipVelocity.y * (timeQuantumDelta) / 1000;

        if (siwcPlayerShipCenter.y < 0) {
            siwcPlayerShipCenter.y = 0;
            siwcPlayerShipVelocity.y = 0;
            siwcPlayerShipAcceleration.y = 0;
            siwcPlayerShipVelocity.x = 0; // ground friction
        }

        updatePlayerShipDirection();

        // Other objects physics
        for (var count = 0; count < siSpaceObjects.length; count++) {
            switch (siSpaceObjects[count].ObjectType) {
                case siSpaceObjectType.FlameBall:
                    siSpaceObjects[count].wcVelocity.x = siSpaceObjects[count].wcVelocity.x - siSpaceObjects[count].wcVelocity.x * siSpaceObjects[count].wcAirFrictionFactor / siSpaceObjects[count].wcMass * (timeQuantumDelta) / 1000;
                    siSpaceObjects[count].wcVelocity.y = siSpaceObjects[count].wcVelocity.y - siSpaceObjects[count].wcVelocity.y * siSpaceObjects[count].wcAirFrictionFactor / siSpaceObjects[count].wcMass * (timeQuantumDelta) / 1000;

                    siSpaceObjects[count].wcCenter.x = siSpaceObjects[count].wcCenter.x + siSpaceObjects[count].wcVelocity.x * (timeQuantumDelta) / 1000;
                    siSpaceObjects[count].wcCenter.y = siSpaceObjects[count].wcCenter.y + siSpaceObjects[count].wcVelocity.y * (timeQuantumDelta) / 1000;
            }
            if (siSpaceObjects[count].wcSize == 0) siSpaceObjects.splice(count, 1);
        }
    }

    function updatePlayerShipDirection() {
        var dX = siwcMouse.x - siwcPlayerShipCenter.x,
            dY = siwcMouse.y - siwcPlayerShipCenter.y;
        if (siwcMouse.y != siwcPlayerShipCenter.y) {
            siwcPlayerShipRotationAngle = Math.atan((dX) / (dY));

            if (dX > 0 && dY < 0) {
                siwcPlayerShipRotationAngle = Math.PI + siwcPlayerShipRotationAngle;
            }
            else if (dX < 0 && dY < 0) {
                siwcPlayerShipRotationAngle = -Math.PI + siwcPlayerShipRotationAngle;
            }
        }
        else
            siwcPlayerShipRotationAngle = 0;
        siwcPlayerShipDirectionOrt.x = Math.sin(siwcPlayerShipRotationAngle);
        siwcPlayerShipDirectionOrt.y = Math.cos(siwcPlayerShipRotationAngle);
    }

    function SI_UpdateDebugInfo(currTimeQuantumPreciseTimeMS) {
        var nowPreciseTimeMS = performance.now();
        if (siDebugMode) {
            if (nowPreciseTimeMS - siPrevDebugInfoStatUpdatePreciseTimeMS > siDebugInfoStatUpdateIntervalMS) {
                siFPS = siFrameCount - siFrameCountBeforeCurrSec;
                siFrameCountBeforeCurrSec = siFrameCount;
                siTQPS = siWorldTimeQuantumCount - siWorldTimeQuantumCountBeforeCurSec;
                siWorldTimeQuantumCountBeforeCurSec = siWorldTimeQuantumCount;
                siPrevDebugInfoStatUpdatePreciseTimeMS = nowPreciseTimeMS;
            }

            if (nowPreciseTimeMS - siPrevDebugInfoDisplayUpdatePreciseTimeMS > siDebugInfoDisplayUpdateIntervalMS) {
                var div = document.getElementById("sidiv-FrameDebugInfo");
                div.innerHTML = "FPS: " + siFPS + "; Frame count: " + siFrameCount +
                    " TQPS: " + siTQPS + "; Time quantum count: " + siWorldTimeQuantumCount +
                    "; Time elapsed (sec): " + (nowPreciseTimeMS / 1000).toFixed(2) +
                    "<br> World ship center position: (" + siwcPlayerShipCenter.x.toFixed(2) + ", " + siwcPlayerShipCenter.y.toFixed(2) + ");" +
                    " acceleration: (" + siwcPlayerShipAcceleration.x.toFixed(2) + ", " + siwcPlayerShipAcceleration.y.toFixed(2) + ");" +
                    " velocity: (" + siwcPlayerShipVelocity.x.toFixed(2) + ", " + siwcPlayerShipVelocity.y.toFixed(2) + ");" +
                    " rotation angle: " + siwcPlayerShipRotationAngle.toFixed(2) +
                    "<br> Screen ship center position: (" + siscPlayerShipCenter.x.toFixed(2) + ", " + siscPlayerShipCenter.y.toFixed(2) + ")" +
                    "<br> World mouse position: (" + siwcMouse.x.toFixed(2) + ", " + siwcMouse.y.toFixed(2) + ")" +
                    "<br> Screen mouse position: (" + siscMouse.x.toFixed() + ", " + siscMouse.y.toFixed() + ")" +
                    "<br> Ship engine force: " + siwcPlayerShipEngineForce.toFixed(2) +
                    "<br> Space objects count: " + siSpaceObjects.length;
                siPrevDebugInfoDisplayUpdatePreciseTimeMS = nowPreciseTimeMS;
            }
        }
    }

    function SI_HTMLSetElems() {
        SI_HTMLSetElemsEarth();

        var cnv = document.createElement("canvas");
        cnv.id = "sicnv-MainFrame";
        cnv.style = "position:fixed";
        document.body.appendChild(cnv);
    }

    function SI_HTMLSetElemsEarth() {
        appendDiv("sidiv-Earth", "", "position:fixed");
    }

    function SI_HTMLResize() { // siscFrameWidth and siscFrameHeight size need to be set before call
        // Scale is set by height ratio, so world visible height is constant
        siWorldToScrScale = siwcFrameHeight / siscFrameHeight;
        siwcFrameWidth = siscFrameWidth * siWorldToScrScale;

        var cnv = document.getElementById("sicnv-MainFrame");
        cnv.left = 0;
        cnv.top = 0;
        cnv.width = SI_WCSizeToScr(siwcFrameWidth);
        cnv.height = SI_WCSizeToScr(siwcFrameHeight);

        SI_HTMLResizeEarth();
    }

    function SI_HTMLResizeEarth() {
        var div = document.getElementById("sidiv-Earth");
        var siscEarthTopLeft = SI_WCPointToScr({ x: -siwcFrameWidth / 2, y: 0 });
        div.style.left = siscEarthTopLeft.x.toString() +"px";
        div.style.top = siscEarthTopLeft.y.toString() + "px";
        div.style.width = SI_WCSizeToScr(siwcFrameWidth).toString() + "px";
        div.style.height = SI_WCSizeToScr(siwcEarthHeight).toString() + "px";
    }


    function SI_RenderFrame() {
        var cnv = document.getElementById("sicnv-MainFrame");
        var context = cnv.getContext('2d');
        context.clearRect(0, 0, cnv.width, cnv.height);

        SI_RenderPlayerShip(context);
        //Render other objects
        for (var count = 0; count < siSpaceObjects.length; count++) {
            switch (siSpaceObjects[count].ObjectType) {
                case siSpaceObjectType.FlameBall:
                    var ScrCenter = SI_WCPointToScr(siSpaceObjects[count].wcCenter);
                    var centerX = ScrCenter.x;
                    var centerY = ScrCenter.y;
                    var radius = SI_WCSizeToScr(siSpaceObjects[count].wcSize) / 2;

                    context.beginPath();
                    context.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
                    context.fillStyle = 'red';
                    context.fill();
                    break;
            }
        }

        SI_UpdateDebugInfo();

        siFrameCount++;
        requestAnimationFrame(SI_RenderFrame);
    }

    function SI_RenderPlayerShip(context) {
        siscPlayerShipCenter = SI_WCPointToScr(siwcPlayerShipCenter);

        // draw player ship
        var scX = siscPlayerShipCenter.x,
            scY = siscPlayerShipCenter.y,
            sW = SI_WCSizeToScr(siwcPlayerShipWidth),
            sH = SI_WCSizeToScr(siwcPlayerShipHeight);
        context.save(); // save context state
        context.beginPath();
        context.translate(scX, scY);
        context.rotate(siwcPlayerShipRotationAngle);

        var grd = context.createLinearGradient(0, 0, sW / 2, 0);
        grd.addColorStop(0, "white");
        grd.addColorStop(1, "gray");
        context.fillStyle = grd;
        context.fillRect(-sW / 2, -sH / 2 + sW / 2, sW, sH / 2);
        context.closePath();

        context.beginPath();
        context.moveTo(0, -sH / 2);
        context.lineTo(sW / 2, -sH / 2 + sW / 2);
        context.lineTo(-sW / 2, -sH / 2 + sW / 2);
        context.lineTo(0, -sH / 2);
        context.closePath();
        context.fillStyle = grd;
        context.fill();

        context.restore(); // restore context state
    }

    function SI_WCPointToScr(siwcPoint) {
        return { x: siwcPoint.x / siWorldToScrScale + siscFrameWidth / 2, y: siscFrameHeight - (siwcPoint.y + siwcEarthHeight) / siWorldToScrScale };
    }

    function SI_WCPointToWorld(siscPoint) {
        return { x: siscPoint.x * siWorldToScrScale - siwcFrameWidth / 2, y: siwcFrameHeight - (siscPoint.y + SI_WCSizeToScr(siwcEarthHeight)) * siWorldToScrScale };
    }

    function SI_WCSizeToScr(siwcSize) {
        return siwcSize / siWorldToScrScale;
    }

    function SI_WCSizeToWorld(siscSize) {
        return siscSize * siWorldToScrScale;
    }

    function appendDiv(id, className, style) {
        var div = document.createElement("div");
        if (id) {
            div.id = id;
        }
        if (className) {
            div.className = className;
        }
        if (style) {
            div.style = style;
        }
        document.body.appendChild(div);
    }

    function handleWindowResize(event) {
        siscFrameWidth = window.innerWidth,
            siscFrameHeight = window.innerHeight,
            SI_HTMLResize();
    }

    function handleMouseMove(event) {
        var dot, eventDoc, doc, body, pageX, pageY;

        event = event || window.event; // IE-ism

        // If pageX/Y aren't available and clientX/Y are,
        // calculate pageX/Y - logic taken from jQuery.
        // (This is to support old IE)
        if (event.pageX == null && event.clientX != null) {
            eventDoc = (event.target && event.target.ownerDocument) || document;
            doc = eventDoc.documentElement;
            body = eventDoc.body;

            event.pageX = event.clientX +
                (doc && doc.scrollLeft || body && body.scrollLeft || 0) -
                (doc && doc.clientLeft || body && body.clientLeft || 0);
            event.pageY = event.clientY +
                (doc && doc.scrollTop || body && body.scrollTop || 0) -
                (doc && doc.clientTop || body && body.clientTop || 0);
        }

        siscMouse = { x: event.pageX, y: event.pageY };
        siwcMouse = SI_WCPointToWorld(siscMouse);

        updatePlayerShipDirection();
    }

    SI_Init();
})(window);
