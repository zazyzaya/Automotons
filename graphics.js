const REZ = 50;
let H = 150;
let W = 300;

let animId = null;
let world = null;

function resizeCanvas(){
    const canvas = document.getElementById('glcanvas');
    gl = canvas.getContext('webgl');

    H = window.innerHeight;
    W = window.innerWidth;

    let sq = Math.min(H,W)

    gl.canvas.width = sq;
    gl.canvas.height = sq;
    gl.canvas.style.width = sq + "px";
    gl.canvas.style.height = sq + "px";

    gl.viewport(0, 0, sq, sq);
}

window.addEventListener('resize', () => resizeCanvas());

function buildShader(gl, shader_src, shader_type) {
  const shader = gl.createShader(shader_type);
  gl.shaderSource(shader, shader_src);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    throw `Could not compile WebGL shaders. \n\n${info}`;
  }
  return shader;
}

function createProgam(gl, vshader, fshader) {
  var program = gl.createProgram();
  gl.attachShader(program, vshader);
  gl.attachShader(program, fshader);
  gl.linkProgram(program);

  var success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  // If it failed to compile
  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}

function createBuffer(gl, program, name) {
  var positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  var buf_ptr = gl.getAttribLocation(program, name);
  gl.enableVertexAttribArray(buf_ptr);

  return buf_ptr
}

/**
 * Generates an array of RGB float arrays [r, g, b] evenly spaced across the color spectrum.
 * @param {number} numTypes - The total number of particle types.
 * @returns {Array<[number, number, number]>} Array of RGB float colors (0.0 to 1.0).
 */
function generatePalette(numTypes) {
    const palette = [];

    for (let i = 0; i < numTypes; i++) {
        // Evenly space hues around the 360-degree color wheel
        const hue = (i / numTypes) * 360;
        const saturation = 0.85; // Vibrant color
        const lightness = 0.55;  // Balanced brightness

        // Convert HSL -> RGB (floats between 0.0 and 1.0)
        palette.push(hslToRgb(hue, saturation, lightness));
    }

    return palette;
}

/** Helper: Converts HSL values to [r, g, b] floats in range [0, 1] */
function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;

    if (0 <= h && h < 60)       { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120)  { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

    return [
        Math.round((r + m) * 1000) / 1000,
        Math.round((g + m) * 1000) / 1000,
        Math.round((b + m) * 1000) / 1000
    ];
}

/**
 * Maps the 1D type tensor to a flat Float32Array RGB array for WebGL
 * @param {Tensor1D} typeTensor
 * @param {number} N
 * @param {number} numTypes - e.g., world.attraction.shape[0]
 */
function get_type_colors(typeTensor, N, numTypes) {
    // Generate dynamic palette for any number of types
    const palette = generatePalette(numTypes);

    const types = typeTensor.arraySync(); // Extract array synchronously
    const colors = new Float32Array(N * 3);

    for (let i = 0; i < N; i++) {
        const typeIdx = types[i];
        const rgb = palette[typeIdx];

        colors[i * 3 + 0] = rgb[0];
        colors[i * 3 + 1] = rgb[1];
        colors[i * 3 + 2] = rgb[2];
    }

    return colors;
}

function kill() {
    // Allow for repeated calls to main() if we reset
    if (animId !== null) {
        cancelAnimationFrame(animId);
        animId = null;
    }

    // TF cleanup
    if (world) {
        if (world.s) world.s.dispose();
        if (world.v) world.v.dispose();
        if (world.type) world.type.dispose();
        if (world.typeAttraction) world.typeAttraction.dispose();
        if (world.typeSight) world.typeSight.dispose();
        if (world.attraction && world.attraction.dispose) world.attraction.dispose();
        if (world.sight && world.sight.dispose) world.sight.dispose();
    }
}

function main() {
    kill();

    const canvas = document.getElementById('glcanvas');
    const gl = canvas.getContext('webgl');

    if (gl == null) {
        alert("Unable to init WebGL");
        return;
    }

    // 1. Compile Shaders
    const vert_shader = buildShader(gl, VERT_SHADER, gl.VERTEX_SHADER);
    const frag_shader = buildShader(gl, FRAG_SHADER, gl.FRAGMENT_SHADER);
    const program = createProgam(gl, vert_shader, frag_shader);

    resizeCanvas(gl);

    gl.clearColor(0, 0, 0, 1);
    gl.useProgram(program);

    // 2. Get shader attribute pointers
    const position_ptr = gl.getAttribLocation(program, 'a_position');
    const color_ptr = gl.getAttribLocation(program, 'a_color');

    // 3. Create GPU Buffers
    const p_buf = gl.createBuffer();
    const c_buf = gl.createBuffer();

    // 4. Instantiate world
    // Take slices so we preserve increase/decrease n types
    // without blowing away values and so that values held
    // in world object are seperate data objects
    world = new World(
      N_PARTICLES,
      ATTRACTION.slice([0, 0], [N_TYPES, N_TYPES]),
      SIGHT.slice([0, 0], [N_TYPES, N_TYPES])
    );

    // 5. Setup Position Buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, p_buf);
    gl.enableVertexAttribArray(position_ptr);
    gl.vertexAttribPointer(position_ptr, 2, gl.FLOAT, false, 0, 0);

    // Initial position upload
    gl.bufferData(gl.ARRAY_BUFFER, world.s.dataSync(), gl.DYNAMIC_DRAW);

    // 6. Setup Color Buffer (based on particle .type)
    gl.bindBuffer(gl.ARRAY_BUFFER, c_buf);
    gl.enableVertexAttribArray(color_ptr);
    gl.vertexAttribPointer(color_ptr, 3, gl.FLOAT, false, 0, 0);

    // Colors don't change if type is static, so upload them once upfront
    const initialColors = get_type_colors(world.type, world.N, N_TYPES);
    gl.bufferData(gl.ARRAY_BUFFER, initialColors, gl.STATIC_DRAW);

    // 7. Start Animation Loop
    animId = requestAnimationFrame(() => drawFrame(gl, world, p_buf));
}

function drawFrame(gl, world, p_buf) {
    // Clear screen
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 1. Advance particle simulation physics
    world.update();

    // 2. Stream updated positions tensor to WebGL position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, p_buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, world.s.dataSync());

    // 3. Draw particles as WebGL POINTS
    gl.drawArrays(gl.POINTS, 0, world.N);

    // 4. Request next frame
    animId = requestAnimationFrame(() => drawFrame(gl, world, p_buf));
}