import * as pdfjsLib from "./node_modules/pdfjs-dist/legacy/build/pdf.mjs";

console.log("PDF.js version:", pdfjsLib.version);

async function test() {
    try {
        const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array([0, 0, 0, 0]), // dummy
        });
        await loadingTask.promise;
    } catch (e) {
        console.log("Expected failure (bad data), but library loaded:", e.message);
    }
}

test();
