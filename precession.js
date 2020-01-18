"use strict";
/*
Code adapted from 
http://nbodyphysics.com/blog/2016/05/29/planetary-orbits-in-javascript/
*/

var ellipse_frame_x = 0; // origin of x is at the focus
var ellipse_frame_y = 0; // origin of y is at the focus

var backgroundContext;
var orbitContext;
var axisContext;

var axisCanvas;

var time;
var OmegaTotal;

var elements;
var apihelion;
var perihelion;
var canvas_focus_x_coords;
var canvas_focus_y_coords;

var redrawTimeout;

function runAnimation() {
    time = 0;
    OmegaTotal = 0;

    $("#orbitPeriod").html(elements.orbitPeriodInDays().toFixed());

    drawMajorAxis(backgroundContext, "lightblue");
    drawMajorAxis(axisContext, "red")
    drawBody(0, 0, "blue", 5); // central body
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

        let model = $('input[name=model]:checked').val();
        if (model == 'anim') {
            elements = animElements;
        }
        else if (model == 'mercury') {
            elements = mercuryElements;
        }

        apihelion =
            {
                X: -1 * elements.a * (1 + elements.e),
                Y: 0
            };

        perihelion =
            {
                X: elements.a * (1 - elements.e),
                Y: 0
            };

        // declaration of variables is important e.g. cannot use e before it is declared
        const centreOfEllipseInCanvas = 300 //
        canvas_focus_x_coords = centreOfEllipseInCanvas + elements.a / elements.displayScaleFactor * elements.e;
        canvas_focus_y_coords = centreOfEllipseInCanvas;


        runAnimation();
    });

    $("input[name='model'][value='anim']").prop('checked', true);

});

function clearAllCanvases() {
    clearMajorAxis;
    backgroundContext.clearRect(0, 0, axisCanvas[0].width, axisCanvas[0].height);
    orbitContext.clearRect(0, 0, axisCanvas[0].width, axisCanvas[0].height);
}

function clearMajorAxis() {
    axisContext.clearRect(0, 0, axisCanvas[0].width, axisCanvas[0].height);
}

function drawMajorAxis(context, color) {
    context.strokeStyle = color;

    context.beginPath();
    let ax = apihelion.X / elements.displayScaleFactor;
    let ay = apihelion.Y / elements.displayScaleFactor;

    let px = perihelion.X / elements.displayScaleFactor;
    let py = perihelion.Y / elements.displayScaleFactor;

    context.moveTo(canvas_focus_x_coords + ax, canvas_focus_y_coords + ay);

    context.lineTo(canvas_focus_x_coords + px, canvas_focus_y_coords + py);

    context.stroke();
}

function drawBody(x, y, color, radius) {
    // Draw the face
    orbitContext.beginPath();
    orbitContext.fillStyle = color;
    orbitContext.arc(canvas_focus_x_coords + x / elements.displayScaleFactor, canvas_focus_y_coords + y / elements.displayScaleFactor, radius, 0, 2 * Math.PI);
    orbitContext.lineWidth = 1;
    orbitContext.closePath();
    orbitContext.stroke();
    orbitContext.fill();
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
        u_next = u + (M - (u - elements.e * Math.sin(u))) / (1 - elements.e * Math.cos(u));
        if (Math.abs(u_next - u) < 1E-6)
            break;
        u = u_next;
    }
    $("#eccentricAnomaly").html(u.toFixed(2))    ;

    return u;
}

function orbitBody() {

    // 1) find the relative time in the orbit and convert to Radians
    let numOrbits = time / elements.orbitPeriodInDays()
    let M = 2.0 * Math.PI * (numOrbits);
    $("#meanAnomaly").html(M.toFixed(2));

    $("#completeOrbits").html(Math.floor(numOrbits));

    // 2) Seed with mean anomaly and solve Kepler's eqn for E
    let u = calculateE(M);

    // 2) eccentric anomoly is angle from center of ellipse, not focus (where centerObject is). Convert
    //    to true anomoly, f - the angle measured from the focus. (see Fig 3.2 in Gravity) 
    let cos_f = (Math.cos(u) - elements.e) / (1 - elements.e * Math.cos(u));
    let sin_f = (Math.sqrt(1 - elements.e * elements.e) * Math.sin(u)) / (1 - elements.e * Math.cos(u));
    let r = elements.a * (1 - elements.e * elements.e) / (1 + elements.e * cos_f);

    time = time + 1;
    let years = Math.floor(time / 365);
    $("#years").html(years);

    // animate
    ellipse_frame_x = r * cos_f;
    ellipse_frame_y = r * sin_f;

    let dOmega = elements.dOmega;
    OmegaTotal += dOmega;
    $("#Omega").html(OmegaTotal.toExponential(10));

    // rotate the ellipse and calculate x and y in the inertial frame of reference
    let inertialCoords = transformCoords(0, dOmega * time, ellipse_frame_x, ellipse_frame_y)

    drawBody(inertialCoords.X, inertialCoords.Y, "black", 1);
        
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

class Elements {
    constructor(GM, a, e, dOmega, displayScaleFactor) {
        this.a = a; // km - semi major axis
        this.GM = GM; // km^3/day^2
        this.e = e; // eccentricity
        this.dOmega = dOmega; // per day
        this.displayScaleFactor = displayScaleFactor;
    }

    // Keplers law n = 2*PI/T=SQRT(GM/a^3) 
    // Since n = 2*PI/T this gives T = 2*PI*SQRT(a^3/GM) implies the bigger GM, the smaller orbital period
    orbitPeriodInDays() {
        let period = 2.0 * Math.PI * Math.sqrt(this.a * this.a * this.a / (this.GM)); // 
        return period;
    }
}

function getMercuryElements() {
    const mercurySemiMajorAxis_KmE6 = 57.91; // 1E6 km
    const mercuryOrbitalEccentricity = 0.2056;
    const mercuryOrbitalPeriod_Days = 87.969;
    const sunGM_kME6_PerSec2 = 132712; //  1E6 km3/s2) https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html
    const sunMeanRadius_Km = 695700; // km
    const sunJ2 = 2e-7;
    const convertSecondsToDays = 86400;

    let gm = sunGM_kME6_PerSec2 * 1E6 * convertSecondsToDays * convertSecondsToDays; // units KM and days
    let a = mercurySemiMajorAxis_KmE6 * 1E6 // units KM

    // per day
    let dOmega = 3 * 2 * Math.PI / mercuryOrbitalPeriod_Days * sunMeanRadius_Km * sunMeanRadius_Km * -sunJ2 / 2 / (mercurySemiMajorAxis_KmE6 * 1E6) / (mercurySemiMajorAxis_KmE6 * 1E6);

    dOmega *= 1E8;
    
    let elements = new Elements(gm, a, mercuryOrbitalEccentricity, dOmega, (a/150).toFixed(1));

    return elements;
}

function getAnimationElements() {
    let dOmega = -0.2 * Math.PI / 360;
    let elements = new Elements(3000, 150, 0.7, dOmega, 1);

    return elements;
}

// Need Elements class defined before can use it
var animElements = getAnimationElements();
var mercuryElements = getMercuryElements();

