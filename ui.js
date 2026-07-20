// Need to store this so toolbar remains same size when collapsed
let TOOLBAR_WIDTH = document.getElementById('toggles').offsetWidth;
document.getElementById('toggles').style.minWidth = TOOLBAR_WIDTH + 'px';

// Unfurl toolbar
const toggle_icon = document.getElementById('toggle-icon');
toggle_icon.addEventListener('pointerdown', (e) => {
    // Don't also move the toolbox
    e.stopPropagation();

    console.log("toggle!")
    document.getElementById('all-inputs').classList.toggle('collapsed');
    document.getElementById('toggle-icon').classList.toggle('collapsed');
});


// Drag the toolbox around
const tbox = document.getElementById('toggles');
const tbox_header = document.getElementById('settings-header');

let start_x, start_y;
let box_x, box_y;
let isDragging = false;

tbox_header.addEventListener('pointerdown', (e) => {
    start_x = e.clientX;
    start_y = e.clientY;
    isDragging = true;

    let tbox_pos = document.getElementById('toggles').getBoundingClientRect();
    box_x = tbox_pos.left;
    box_y = tbox_pos.top;

    // Undo the initial settings that center it
    tbox.style.transform = 'none';
    tbox.style.margin = '0';

    // Tell it it's explicit coords
    tbox.style.left = box_x + 'px';
    tbox.style.top = box_y + 'px';

    tbox_header.setPointerCapture(e.pointerId);
});

tbox_header.addEventListener('pointermove', (e) => {
    if (!isDragging) return;

    // Calculate displacement (delta)
    const dx = e.clientX - start_x;
    const dy = e.clientY - start_y;

    tbox.style.left = box_x + dx + 'px';
    tbox.style.top = box_y + dy + 'px';
});

tbox_header.addEventListener('pointerup', () => {
    isDragging = false;if (!isDragging) return;
    isDragging = false;
    tbox_header.releasePointerCapture(e.pointerId);
});

tbox_header.addEventListener('pointercancel', (e) => {
    isDragging = false;
});