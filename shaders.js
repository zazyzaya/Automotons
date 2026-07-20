var VERT_SHADER =
`// Attributes receiving data from buffers
attribute vec2 a_position;
attribute vec4 a_color;

varying vec4 v_color;

void main() {
    // Map tensor coordinates [0.0 to 1.0] to WebGL Clip Space [-1.0 to 1.0]
    vec2 clipSpace = (a_position * 2.0) - 1.0;

    // Set particle position
    gl_Position = vec4(clipSpace, 0.0, 1.0);

    // REQUIRED FOR gl.POINTS: Set particle rendered dot size in pixels
    gl_PointSize = 6.0;

    // Pass color to fragment shader
    v_color = a_color;
}`;

var FRAG_SHADER =
`precision mediump float;

varying vec4 v_color;

void main() {
    // Distance from center of the point (0.5, 0.5)
    vec2 coord = gl_PointCoord - vec2(0.5);

    // Discard pixels outside the radius to make points circular
    if (length(coord) > 0.5) {
        discard;
    }

    gl_FragColor = v_color;
}`;