"use strict";
/*
Code adapted from 
http://nbodyphysics.com/blog/2016/05/29/planetary-orbits-in-javascript/
*/

const yearsInACentury = 100;
const daysInAYear = 365;
const convertSecondsToDays = 86400;
const sunColor = "yellow";

var ellipse_frame_x = 0; // origin of x is at the focus
var ellipse_frame_y = 0; // origin of y is at the focus

var backgroundContext;
var orbitContext;
var axisContext;

var axisCanvas;

var daysElapsed;
var OmegaTotal;

var apihelion;
var perihelion;
var canvas_focus_x_coords;
var canvas_focus_y_coords;

var redrawTimeout;
var modelChosen;
var model;

class Model {
    constructor(GM, a, e, dOmega, displayScaleFactor, skipDays, elapsedTimeAsCenturies, elapsedTimeLabel) {
        this.a = a; // km - semi major axis
        this.GM = GM; // km^3/day^2
        this.e = e; // eccentricity
        this.dOmega = dOmega; // per day
        this.displayScaleFactor = displayScaleFactor;
        this.skipDays = skipDays;
        this.elapsedTimeAsCenturies = elapsedTimeAsCenturies;
        this.elapsedTimeLabel = elapsedTimeLabel;
    }

    // Keplers law n = 2*PI/T=SQRT(GM/a^3) 
    // Since n = 2*PI/T this gives T = 2*PI*SQRT(a^3/GM) implies the bigger GM, the smaller orbital period
    orbitPeriodInDays() {
        let period = 2.0 * Math.PI * Math.sqrt(Math.pow(this.a,3) / (this.GM)); // 
        return period;
    }
}

// Need Model class defined before can use it
var animModel = getAnimationModel();
var mercuryModel = getMercuryModel();

function runAnimation() {
    daysElapsed = 0;
    OmegaTotal = 0;

    $("#orbitPeriod").html(model.orbitPeriodInDays().toFixed());

    drawMajorAxis(backgroundContext, "lightblue");
    drawMajorAxis(axisContext, "red")
    drawBody(backgroundContext, 0, 0, sunColor, 5); // central body
    orbitBody();
}

// 1) cannot access $("#axisCanvas"), etc until document ready
// 2) need to index [0] into canvas
$(document).ready(function () {
    let backgroundCanvas = $("#backgroundCanvas");
    backgroundContext = backgroundCanvas[0].getContext("2d");

    axisCanvas = $("#axisCanvas");
    axisContext = axisCanvas[0].getContext("2d");

    let orbitCanvas = $("#orbitCanvas");
    orbitContext = orbitCanvas[0].getContext("2d");

    $('input[name="model"]:radio').change(function () {
        clearTimeout(redrawTimeout);
        clearAllCanvases();

        modelChosen = $('input[name=model]:checked').val();
        if (modelChosen == 'anim') {
            model = animModel;
        }
        else if (modelChosen == 'mercury') {
            model = mercuryModel;
        }

        apihelion =
            {
                X: -1 * model.a * (1 + model.e),
                Y: 0
            };

        perihelion =
            {
                X: model.a * (1 - model.e),
                Y: 0
            };

        // declaration of variables is important e.g. cannot use e before it is declared
        const centreOfEllipseInCanvas = 300 //
        canvas_focus_x_coords = centreOfEllipseInCanvas + model.a / model.displayScaleFactor * model.e;
        canvas_focus_y_coords = centreOfEllipseInCanvas;

        $("#yearsLabel").html(model.elapsedTimeLabel);
        runAnimation();
    });

    $("input[name='model'][value='mercury']").prop('checked', true);
    $("input[name='model']").trigger('change');
    $("input[name='model'][value='mercury']").prop('checked', true);
});

function drawMajorAxis(context, color) {
    context.strokeStyle = color;

    context.beginPath();
    let ax = apihelion.X / model.displayScaleFactor;
    let ay = apihelion.Y / model.displayScaleFactor;

    let px = perihelion.X / model.displayScaleFactor;
    let py = perihelion.Y / model.displayScaleFactor;

    context.moveTo(canvas_focus_x_coords + ax, canvas_focus_y_coords + ay);

    context.lineTo(canvas_focus_x_coords + px, canvas_focus_y_coords + py);

    context.stroke();
}

function drawBody(context, x, y, color, radius) {
    // Draw the face
    context.beginPath();
    context.fillStyle = color;
    context.arc(canvas_focus_x_coords + x / model.displayScaleFactor, canvas_focus_y_coords + y / model.displayScaleFactor, radius, 0, 2 * Math.PI);
    context.lineWidth = 1;
    context.closePath();
    context.stroke();
    context.fill();
}

function calculateE(M) {
    // let seems to be preferred over var
    //https://stackoverflow.com/questions/762011/whats-the-difference-between-using-let-and-var    
    let LOOP_LIMIT = 10;

    let u = M; // seed with mean anomoly
    let u_next = 0;
    let loopCount = 0;
    // iterate until within 10-6
    while (loopCount++ < LOOP_LIMIT) {
        // this should always converge in a small number of iterations - but be paranoid
        u_next = u + (M - (u - model.e * Math.sin(u))) / (1 - model.e * Math.cos(u));
        if (Math.abs(u_next - u) < 1E-6)
            break;
        u = u_next;
    }
    $("#eccentricAnomaly").html(u.toLocaleString());

    return u;
}

var lastOrbitCount = 0
var orbitCounter = 0;

function orbitBody() {

    // 1) find the relative time in the orbit and convert to Radians
    let n = 2.0 * Math.PI / model.orbitPeriodInDays(); // mean angular velocity = 2*PI/T
    let M = n * daysElapsed;
    $("#meanAnomaly").html(M.toLocaleString());

    let completeOrbits = Math.floor(M / (2 * Math.PI));
    $("#completeOrbits").html(completeOrbits.toLocaleString());

    let changeInDays = 1;
    if (model.skipDays > 0) {
        // skip days every 6 orbits
        if (completeOrbits > lastOrbitCount) {
            orbitCounter++;

            if (orbitCounter == 6) {
                orbitCounter = 0
                changeInDays = model.skipDays;
            }
        }
    }

    daysElapsed += changeInDays;
    lastOrbitCount = completeOrbits;

    // 2) Seed with mean anomaly and solve Kepler's eqn for E
    let u = calculateE(M);

    // 2) eccentric anomoly is angle from center of ellipse, not focus (where centerObject is). Convert
    //    to true anomoly, f - the angle measured from the focus. (see Fig 3.2 in Gravity) 
    let cos_f = (Math.cos(u) - model.e) / (1 - model.e * Math.cos(u));
    let sin_f = (Math.sqrt(1 - model.e * model.e) * Math.sin(u)) / (1 - model.e * Math.cos(u));
    let r = model.a * (1 - model.e * model.e) / (1 + model.e * cos_f);

    let elapsed = displayTimeElapsed(daysElapsed, model.elapsedTimeAsCenturies);
    $("#years").html(elapsed.toLocaleString());

    // animate
    ellipse_frame_x = r * cos_f;
    ellipse_frame_y = r * sin_f;

    let dOmega = model.dOmega * changeInDays;
    OmegaTotal += dOmega;
    $("#Omega").html(convertRadiansToDegrees(OmegaTotal));

    // rotate the ellipse and calculate x and y in the inertial frame of reference
    let inertialCoords = transformCoords(0, OmegaTotal, ellipse_frame_x, ellipse_frame_y)

    drawBody(orbitContext, inertialCoords.X, inertialCoords.Y, "black", 1);
        
    clearMajorAxis();
    rotateAxis(0, dOmega);
    drawMajorAxis(axisContext, "red");

    redrawTimeout = setTimeout(orbitBody, 10);
}

function rotateAxis(Omega, omega) {
    let R0 = [Math.cos(Omega) * Math.cos(omega) - Math.sin(Omega) * Math.sin(omega), -Math.cos(Omega) * Math.sin(omega) - Math.sin(Omega) * Math.cos(omega), 0]

    let R1 = [Math.sin(Omega) * Math.cos(omega) + Math.cos(Omega) * Math.sin(omega), -Math.sin(Omega) * Math.sin(omega) + Math.cos(Omega) * Math.cos(omega), 0]

    let R2 = [0, 0, 1]

    apihelion.X = R0[0] * apihelion.X + R0[1] * apihelion.Y;
    apihelion.Y = R1[0] * apihelion.X + R1[1] * apihelion.Y;

    perihelion.X = R0[0] * perihelion.X + R0[1] * perihelion.Y;
    perihelion.Y = R1[0] * perihelion.X + R1[1] * perihelion.Y;
}

function transformCoords(Omega, omega, x, y) {
    let R0 = [Math.cos(Omega) * Math.cos(omega) - Math.sin(Omega) * Math.sin(omega), -Math.cos(Omega) * Math.sin(omega) - Math.sin(Omega) * Math.cos(omega), 0]

    let R1 = [Math.sin(Omega) * Math.cos(omega) + Math.cos(Omega) * Math.sin(omega), -Math.sin(Omega) * Math.sin(omega) + Math.cos(Omega) * Math.cos(omega), 0]

    let R2 = [0, 0, 1]

    let X = R0[0] * x + R0[1] * y;
    let Y = R1[0] * x + R1[1] * y;

    return { X, Y };
}

function getMercuryModel() {
    const mercurySemiMajorAxis_KmE6 = 57.91; // 1E6 km
    const mercuryOrbitalEccentricity = 0.2056;
    const mercuryOrbitalPeriod_Days = 87.969;
    const sunGM_kME6_PerSec2 = 132712; //  1E6 km3/s2) https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html
    const sunMeanRadius_Km = 695700; // km
    const sunJ2 = 2e-7;

    let gm = sunGM_kME6_PerSec2 * 1E6 * convertSecondsToDays * convertSecondsToDays; // units KM and days
    let a = mercurySemiMajorAxis_KmE6 * 1E6 // units KM

    // per day
    let dOmega = 3 * (2 * Math.PI / mercuryOrbitalPeriod_Days) * sunMeanRadius_Km * sunMeanRadius_Km * -sunJ2 / 2 / (mercurySemiMajorAxis_KmE6 * 1E6) / (mercurySemiMajorAxis_KmE6 * 1E6);
    dOmega = dOmega / Math.pow(1 - Math.pow(mercuryOrbitalEccentricity,2), 2);

    const deltaCenturies = 150000;
    let skipDays = daysInAYear * yearsInACentury * deltaCenturies;

    let model = new Model(gm, a, mercuryOrbitalEccentricity, dOmega, (a / 150).toFixed(1), skipDays, true, 'Centuries Elapsed: ');

    return model;
}

function getAnimationModel() {
    // pick numbers to give a "nice" animation
    let dOmega = -0.2 * Math.PI / 360;
    let model = new Model(3000, 150, 0.7, dOmega, 1, 0, false, 'Years Elapsed: ');

    return model;
}

function clearAllCanvases() {
    clearMajorAxis();
    clearBackgroundCanvis();
    clearOrbitCanvis();
}

function clearMajorAxis() {
    axisContext.clearRect(0, 0, axisCanvas[0].width, axisCanvas[0].height);
}

function clearOrbitCanvis() {
    orbitContext.clearRect(0, 0, axisCanvas[0].width, axisCanvas[0].height);
}

function clearBackgroundCanvis() {
    backgroundContext.clearRect(0, 0, axisCanvas[0].width, axisCanvas[0].height);
}

function displayTimeElapsed(daysElapsed, asCenturies) {
    if (asCenturies) {
        let centuries = Math.floor(daysElapsed / daysInAYear / yearsInACentury);
        return centuries;
    }
    else {
        let years = Math.floor(daysElapsed / daysInAYear);
        return years;
    }
}

function convertRadiansToDegrees(radiansIn) {

    var radians = Math.abs(radiansIn)
    var degrees = radians / 2 / Math.PI * 360;

    var arcDegrees = Math.floor(degrees);

    var minutes = (degrees - arcDegrees) * 60;

    var arcMinutes = Math.floor(minutes);

    var seconds = (minutes - arcMinutes);

    var arcSeconds = seconds.toFixed();

    var result = arcDegrees.toString() + "\xB0 " + arcMinutes + "' " + arcSeconds + "'' ";

    return result;
}

