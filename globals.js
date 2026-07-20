let N_TYPES = 5;
let N_PARTICLES = 2500;
let FRICTION = 0.25;
let TIME = 0.0001;
let REPEL_DIST = 0.005;
let MAX_SPEED = 0.005;

let ATTRACTION = tf.randomUniform([N_TYPES, N_TYPES], -1, 1);

let MIN_SIGHT = 0.01;
let MAX_SIGHT = 0.1;
let SIGHT = tf.randomUniform([N_TYPES, N_TYPES], MIN_SIGHT, MAX_SIGHT);