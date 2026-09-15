/**
 * Drone Grass Cleanup Setup.jsx
 * ------------------------------------------------------------------------
 * Automates the standard layer/mask scaffold used to isolate a foreground
 * subject (e.g. a sculpture) from drone/grass background footage so it can
 * be cleaned up with Mocha AE planar tracking + masks.
 *
 * WHAT IT DOES
 *   1. Validates there is an active comp and exactly one footage layer
 *      selected.
 *   2. Renames the selected layer to "[BG] Grass_Base".
 *   3. Duplicates it (placed above the original) and renames the copy to
 *      "[FG] Sculpture_Isolated".
 *   4. Adds a centered circular placeholder mask to the FG layer
 *      ("Sculpture_Isolate_Mask", blend mode Add).
 *   5. Applies the Mocha AE effect to the BG layer and adds two rectangular
 *      placeholder masks ("Grass_Line_01" / "Grass_Line_02", blend mode
 *      Subtract) near the center for grass-line removal.
 *   6. Wraps everything in a single Undo Group ("Drone Grass Cleanup
 *      Setup") so the whole operation can be reverted with one Ctrl/Cmd+Z.
 *
 * USAGE
 *   Select a single footage layer in an active composition, then run this
 *   script via File > Scripts > Run Script File... (or place it in the
 *   ScriptUI Panels folder to run from File > Scripts).
 * ------------------------------------------------------------------------
 */

/**
 * Builds a closed, ellipse-shaped Shape object (Bezier approximation of a
 * circle/ellipse using the standard 0.5522848 tangent handle constant).
 * @param {number} cx - Center X, in comp pixel space.
 * @param {number} cy - Center Y, in comp pixel space.
 * @param {number} rx - Horizontal radius.
 * @param {number} ry - Vertical radius.
 * @returns {Shape}
 */
function createEllipseMaskShape(cx, cy, rx, ry) {
    var kappa = 0.5522848; // Bezier magic number for approximating a circle.
    var ox = rx * kappa;
    var oy = ry * kappa;

    var vertices = [
        [cx, cy - ry], // top
        [cx + rx, cy], // right
        [cx, cy + ry], // bottom
        [cx - rx, cy]  // left
    ];
    var inTangents = [
        [-ox, 0],
        [0, -oy],
        [ox, 0],
        [0, oy]
    ];
    var outTangents = [
        [ox, 0],
        [0, oy],
        [-ox, 0],
        [0, -oy]
    ];

    var shape = new Shape();
    shape.vertices = vertices;
    shape.inTangents = inTangents;
    shape.outTangents = outTangents;
    shape.closed = true;
    return shape;
}

/**
 * Builds a closed, axis-aligned rectangular Shape object.
 * @param {number} cx - Center X, in comp pixel space.
 * @param {number} cy - Center Y, in comp pixel space.
 * @param {number} w  - Full width of the rectangle.
 * @param {number} h  - Full height of the rectangle.
 * @returns {Shape}
 */
function createRectMaskShape(cx, cy, w, h) {
    var halfW = w / 2;
    var halfH = h / 2;
    var zero = [0, 0];

    var vertices = [
        [cx - halfW, cy - halfH],
        [cx + halfW, cy - halfH],
        [cx + halfW, cy + halfH],
        [cx - halfW, cy + halfH]
    ];

    var shape = new Shape();
    shape.vertices = vertices;
    shape.inTangents = [zero, zero, zero, zero];
    shape.outTangents = [zero, zero, zero, zero];
    shape.closed = true;
    return shape;
}

/**
 * Adds a new mask to a layer, names it, sets its shape and blend mode.
 * @param {AVLayer} layer
 * @param {string} maskName
 * @param {Shape} shape
 * @param {MaskMode} maskMode
 * @returns {MaskPropertyGroup} the created mask.
 */
function addNamedMask(layer, maskName, shape, maskMode) {
    var mask = layer.Masks.addProperty("Mask");
    mask.name = maskName;
    mask.maskShape.setValue(shape);
    mask.maskMode = maskMode;
    return mask;
}

/**
 * Attempts to apply the Mocha AE effect to a layer, trying several known
 * display/match names since Adobe has renamed the bundled effect across
 * versions (e.g. "Mocha AE" pre-2021, "Boris FX Mocha" in newer builds).
 * @param {AVLayer} layer
 * @returns {boolean} true if the effect was applied successfully.
 */
function applyMochaAE(layer) {
    var candidateNames = [
        "Mocha AE",
        "ADBE MochaAE",
        "Mocha AE CC",
        "Boris FX Mocha"
    ];

    for (var i = 0; i < candidateNames.length; i++) {
        try {
            layer.Effects.addProperty(candidateNames[i]);
            return true; // Success - stop trying other names.
        } catch (e) {
            // This candidate name didn't match an installed effect; try the next one.
        }
    }
    return false;
}

/**
 * Determines whether a layer is a usable "footage" layer (i.e. an AVLayer
 * with a footage/comp source, as opposed to a text, shape, camera, or
 * light layer).
 * @param {Layer} layer
 * @returns {boolean}
 */
function isFootageLayer(layer) {
    return (layer instanceof AVLayer) && (layer.source !== null && layer.source !== undefined);
}

(function droneGrassCleanupSetup() {
    app.beginUndoGroup("Drone Grass Cleanup Setup");

    try {
        // --------------------------------------------------------------
        // STEP 1: Validate active comp + selection.
        // --------------------------------------------------------------
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Drone Grass Cleanup Setup\n\nNo active composition found.\nPlease open a composition and try again.");
            return;
        }

        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length !== 1) {
            alert(
                "Drone Grass Cleanup Setup\n\n" +
                "Please select EXACTLY ONE footage layer in the timeline before running this script.\n\n" +
                "Currently selected: " + selectedLayers.length + " layer(s)."
            );
            return;
        }

        var sourceLayer = selectedLayers[0];
        if (!isFootageLayer(sourceLayer)) {
            alert(
                "Drone Grass Cleanup Setup\n\n" +
                "The selected layer (\"" + sourceLayer.name + "\") is not a valid footage layer.\n" +
                "Please select a footage/video/image layer and try again."
            );
            return;
        }

        // --------------------------------------------------------------
        // STEP 2: Store original name, rename selected layer -> BG.
        // --------------------------------------------------------------
        var originalName = sourceLayer.name;
        sourceLayer.name = "[BG] Grass_Base";
        var bgLayer = sourceLayer;

        // --------------------------------------------------------------
        // STEP 3: Duplicate -> FG layer, placed above BG automatically.
        // --------------------------------------------------------------
        var fgLayer = bgLayer.duplicate();
        fgLayer.name = "[FG] Sculpture_Isolated";

        // --------------------------------------------------------------
        // STEP 4: FG layer - centered circular isolation mask (~10% of
        // the frame's smaller dimension), blend mode Add.
        // --------------------------------------------------------------
        var compW = comp.width;
        var compH = comp.height;
        var centerX = compW / 2;
        var centerY = compH / 2;

        var fgMaskDiameter = Math.min(compW, compH) * 0.10;
        var fgMaskRadius = fgMaskDiameter / 2;
        var fgMaskShape = createEllipseMaskShape(centerX, centerY, fgMaskRadius, fgMaskRadius);
        addNamedMask(fgLayer, "Sculpture_Isolate_Mask", fgMaskShape, MaskMode.ADD);

        // --------------------------------------------------------------
        // STEP 5: BG layer - Mocha AE effect + two grass-line removal
        // masks near the center, blend mode Subtract.
        // --------------------------------------------------------------
        var mochaApplied = applyMochaAE(bgLayer);

        var lineMaskWidth = compW * 0.12;
        var lineMaskHeight = compH * 0.03;
        var lineOffsetY = compH * 0.08;

        var line1Shape = createRectMaskShape(centerX, centerY - lineOffsetY, lineMaskWidth, lineMaskHeight);
        addNamedMask(bgLayer, "Grass_Line_01", line1Shape, MaskMode.SUBTRACT);

        var line2Shape = createRectMaskShape(centerX, centerY + lineOffsetY, lineMaskWidth, lineMaskHeight);
        addNamedMask(bgLayer, "Grass_Line_02", line2Shape, MaskMode.SUBTRACT);

        // --------------------------------------------------------------
        // Done - report results (and flag if Mocha AE could not be found).
        // --------------------------------------------------------------
        var summary =
            "Drone Grass Cleanup Setup complete.\n\n" +
            "Original layer \"" + originalName + "\" was renamed and duplicated:\n" +
            "  - [BG] Grass_Base (Mocha AE + Grass_Line_01/02 masks)\n" +
            "  - [FG] Sculpture_Isolated (Sculpture_Isolate_Mask)\n\n" +
            "Adjust the placeholder mask shapes to fit your footage.";

        if (!mochaApplied) {
            summary +=
                "\n\nNOTE: The Mocha AE effect could not be applied automatically " +
                "(it may not be installed under a recognized name on this system). " +
                "Please apply it manually to \"[BG] Grass_Base\" via Effect > Boris FX Mocha.";
        }

        alert(summary);

    } catch (err) {
        alert(
            "Drone Grass Cleanup Setup - Error\n\n" +
            err.toString() +
            (err.line ? ("\n(line " + err.line + ")") : "") +
            "\n\nThe operation was wrapped in a single Undo step - press Ctrl/Cmd+Z to revert any partial changes."
        );
    } finally {
        app.endUndoGroup();
    }
})();
