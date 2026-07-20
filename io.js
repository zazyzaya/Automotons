function set_values() {
    document.getElementById('n-types').value = N_TYPES
    document.getElementById('n-particles').value = N_PARTICLES
    document.getElementById('friction').value = FRICTION
}

function get_values() {
    N_TYPES = parseInt(document.getElementById('n-types').value);
    N_PARTICLES = parseInt(document.getElementById('n-particles').value);
    FRICTION = parseFloat(document.getElementById('friction').value);
}

function expand_mats(newN, oldN, oldTensor, minVal, maxVal) {
    return tf.tidy(() => {
        const added = newN - oldN;

        // 1. Pad oldTensor with zeros on the right and bottom
        // [[top, bottom], [left, right]] -> [[0, added], [0, added]]
        const paddedOld = tf.pad(oldTensor, [[0, added], [0, added]]);

        // 2. Generate random values for the whole new shape [newN, newN]
        const randomValues = tf.randomUniform([newN, newN], minVal, maxVal);

        // 3. Create a boolean mask where true = old matrix region, false = new region
        // Array of 1s for old size, 0s for padded size
        const mask1D = tf.concat([tf.ones([oldN]), tf.zeros([added])]);

        // Outer product gives a 2D matrix of 1s for [:oldN, :oldN] and 0s elsewhere
        const mask2D = tf.outerProduct(mask1D, mask1D).toBool();

        // 4. Select paddedOld where mask is true, and randomValues where mask is false
        return tf.where(mask2D, paddedOld, randomValues);
    });
}

function resize_mats() {
    const oldAttraction = ATTRACTION;
    const oldSight = SIGHT;
    old_n = ATTRACTION.shape[0];

    if (N_TYPES <= old_n) {
        return; // Do nothing, we just slice out the top N square
    } else {
        // Expand: pad extra rows/cols with random values
        const newAtt = expand_mats(N_TYPES, old_n, oldAttraction, -1, 1)
        const newSight = expand_mats(N_TYPES, old_n, oldSight, MIN_SIGHT, MAX_SIGHT);

        // (For simplicity, re-rolling when expanding is common, or construct via tf.concat)
        ATTRACTION = newAtt;
        SIGHT = newSight;
    }

    // Cleanup
    oldAttraction.dispose();
    oldSight.dispose();
}

function load() {
    get_values();
    resize_mats();
    main();
}

function random() {
    N_TYPES = 2 + Math.floor(Math.random() * 24)    // 2-25
    FRICTION = 0.05 + Math.random() * 0.45          // 0.05 - 0.5

    // Cleanup old
    if (ATTRACTION) ATTRACTION.dispose();
    if (SIGHT) SIGHT.dispose();

    // Generate new
    ATTRACTION = tf.randomUniform([N_TYPES, N_TYPES], -1, 1);
    SIGHT = tf.randomUniform([N_TYPES, N_TYPES], MIN_SIGHT, MAX_SIGHT);

    set_values();
    main();
}