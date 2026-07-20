// Makes VSCode autocomplete tf functions for me
/** @type {import('@tensorflow/tfjs')} */
const tf = window.tf;

/** @typedef {import('@tensorflow/tfjs').Tensor1D} Tensor1D */
/** @typedef {import('@tensorflow/tfjs').Tensor2D} Tensor2D */

/**
 * @property {number} N
 * @property {Tensor1D} attraction
 * @property {Tensor2D} s
 * @property {Tensor2D} v
 * @property {Tensor1D} type
 */
class World {
    /**
     * @param {number} N
     * @param {Tensor2D} attraction
     * @param {Tensor2D} sight
     */
    constructor(N, attraction, sight) {
        this.N = N;
        this.attraction = attraction;
        this.sight = sight;

        this.s = tf.randomUniform([N, 2]);
        this.v = tf.randomUniform([N, 2], 0, 0.001);
        this.type = tf.randomUniformInt([N], 0, attraction.shape[0]);

        // How far we can see and how much we attract/repel
        const [typeAtt, typeSight] = tf.tidy(() => {
            const attMatrix = tf.gather(
                tf.gather(this.attraction, this.type, 0),
                this.type, 1
            );
            const sightMatrix = tf.gather(
                tf.gather(this.sight, this.type, 0),
                this.type, 1
            );
            return [attMatrix, sightMatrix];
        });

        this.typeAttraction = typeAtt;
        this.typeSight = typeSight;
    }

    update() {
        const oldS = this.s;
        const oldV = this.v;

        const [nextS, nextV] = tf.tidy(() => {
            const s1 = this.s.expandDims(1);    // [N, 1, 2]
            const s2 = this.s.expandDims(0);    // [1, N, 2]
            let dx_dy = s2.sub(s1);           // [N, N, 2]

            // Wrap displacements across boundaries
            dx_dy = dx_dy.sub(dx_dy.round());

            const distMatrix = dx_dy.square().sum(-1).sqrt(); // [N, N]

            // Repulsion Force: Linear slope from -1.0 (at dist = 0) up to 0.0 (at dist = repelDist)
            const repelMask = distMatrix.less(REPEL_DIST)
                                    .logicalAnd(distMatrix.greater(0))
                                    .toFloat();

            // (dist / repelDist) - 1.0 creates range [-1.0, 0.0]
            const repelForce = distMatrix.div(REPEL_DIST).sub(1.0).mul(repelMask);

            // Attraction Zone: Triangular/Bell curve between repelDist and sightDist
            const sightMask = distMatrix.greaterEqual(REPEL_DIST)
                                       .logicalAnd(distMatrix.lessEqual(this.typeSight))
                                       .toFloat();

            const sightRange = this.typeSight.sub(REPEL_DIST).maximum(1e-5);
            const normDist = distMatrix.sub(REPEL_DIST).div(sightRange);

            // Smooth triangle curve that peaks at 1.0 in the middle of the sight zone:
            // 1.0 - |2.0 * normDist - 1.0|
            const smoothFactor = tf.scalar(1.0).sub(normDist.mul(2.0).sub(1.0).abs());

            // Scale by particle pair's typeAttraction rule
            const attractForce = smoothFactor.mul(this.typeAttraction).mul(sightMask);

            // Combine Repulsion + Attraction into total force magnitude matrix [N, N]
            const forceMagnitude = repelForce.add(attractForce);

            // Total force vector on each particle: sum over all neighbors (axis 1)
            // [N, N, 1] * [N, N, 2] -> sum along axis 1 -> [N, 2]
            const directions = dx_dy.div(distMatrix.add(1e-5).expandDims(-1));
            const totalForce = forceMagnitude.expandDims(-1).mul(directions).sum(1);

            // Update velocity and position
            let newV = this.v.mul(1 - FRICTION).add(totalForce.mul(TIME));
            newV = newV.clipByValue(-MAX_SPEED, MAX_SPEED);
            let newS = this.s.add(newV);
            newS = newS.mod(1.0);

            return [newS, newV];
        });

        // Update
        this.s = nextS;
        this.v = nextV;

        // Cleanup
        oldS.dispose();
        oldV.dispose();
    }
}