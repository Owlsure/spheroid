/*
Code adapted from 
http://nbodyphysics.com/blog/2016/05/29/planetary-orbits-in-javascript/
*/

var orbitContext;
var axisContext;
var axisCanvas;

var time = 0;
var ellipse_frame_x = 0; // origin of x is at the focus
var ellipse_frame_y = 0; // origin of y is at the focus

class Elements {
    constructor(GM, a, e) {
        this.a = a; // semi major axis
        this.GM = GM; // we just choose GM to give a decent orbit speed
        this.e = e; // eccentricity
    }

    // Keplers law n = 2*PI/T=SQRT(GM/a^3) 
    // Since n = 2*PI/T this gives T = 2*PI*SQRT(a^3/GM) implies the bigger GM, the smaller orbital period
    orbitPeriod() {
        var period = 2.0 * Math.PI * Math.sqrt(this.a * this.a * this.a / (this.GM)); // 
        return period;
    }
}

var animationElements = new Elements(3000, 150, 0.7);
elements = animationElements;

// declaration of variables is important e.g. cannot use e before it is declared
const canvas_focus_x_coords = 300 + elements.a * elements.e;
const canvas_focus_y_coords = 300;

var apihelion =
    {
        X: -1 * elements.a * (1 + elements.e),
        Y:0
    };

var perihelion = 
    {
        X: elements.a * (1 - elements.e),
        Y: 0
    };

// 1) cannot access $("#axisCanvas"), etc until document ready
// 2) need to index [0] into canvas
$(document).ready(function () {
    axisCanvas = $("#axisCanvas");
    axisContext = axisCanvas[0].getContext("2d");

    let orbitCanvas = $("#orbitCanvas");
    orbitContext = orbitCanvas[0].getContext("2d");

    $("#orbitPeriod").html(elements.orbitPeriod().toFixed());

    drawMajorAxis()
    drawBody(0, 0, "blue", 5); // central body
    orbitBody();
});

function clearMajorAxis() {
    axisContext.clearRect(0, 0, axisCanvas[0].width, axisCanvas[0].height);
}

function drawMajorAxis() {
    axisContext.strokeStyle = "red";

    axisContext.beginPath();
    axisContext.moveTo(canvas_focus_x_coords + apihelion.X, canvas_focus_y_coords + apihelion.Y);
    axisContext.lineTo(canvas_focus_x_coords + perihelion.X, canvas_focus_y_coords + perihelion.Y);
    axisContext.stroke();
}

function drawBody(x, y, color, radius) {
    // Draw the face
    orbitContext.beginPath();
    orbitContext.fillStyle = color;
    orbitContext.arc(canvas_focus_x_coords + x, canvas_focus_y_coords + y, radius, 0, 2 * Math.PI);
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
    let numOrbits = time / elements.orbitPeriod()
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
    $("#time").html(time);

    // animate
    ellipse_frame_x = r * cos_f;
    ellipse_frame_y = r * sin_f;

    // rotate the ellipse and calculate x and y in the inertial frame of reference
    let dOmega = - 0.2 * Math.PI / 360

    let inertialCoords = transformCoords(0, dOmega * time, ellipse_frame_x, ellipse_frame_y)

    drawBody(inertialCoords.X, inertialCoords.Y, "black", 1);

    clearMajorAxis();
    rotateAxis(0, dOmega);
    drawMajorAxis();

    setTimeout(orbitBody, 10);
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
