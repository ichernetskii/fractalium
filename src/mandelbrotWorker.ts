/// <reference lib="webworker" />
interface WorkerInput {
	startY: number;
	endY: number;
	width: number;
	height: number;
	centerX: number;
	centerY: number;
	density: number;
	maxIterations: number;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;

	let r, g, b;
	if (h < 60) [r, g, b] = [c, x, 0];
	else if (h < 120) [r, g, b] = [x, c, 0];
	else if (h < 180) [r, g, b] = [0, c, x];
	else if (h < 240) [r, g, b] = [0, x, c];
	else if (h < 300) [r, g, b] = [x, 0, c];
	else [r, g, b] = [c, 0, x];

	return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function mandelbrot(px: number, py: number, input: WorkerInput): number {
	// screenToWorld:
	const x0 = input.centerX + (px - input.width / 2) * input.density;
	const y0 = input.centerY + (py - input.height / 2) * input.density;

	let zx = 0;
	let zy = 0;
	let i = 0;
	while (i < input.maxIterations && zx * zx + zy * zy < 4) {
		const tmp = zx * zx - zy * zy + x0;
		zy = 2 * zx * zy + y0;
		zx = tmp;
		i++;
	}
	return i;
}

self.onmessage = (e: MessageEvent<WorkerInput>) => {
	const input = e.data;
	const { startY, endY, width, maxIterations } = input;

	// Buffer for (endY - startY) lines, each line width pixels, 4 bytes per pixel (RGBA)
	const bufferSize = (endY - startY) * width * 4;
	const pixelData = new Uint8ClampedArray(bufferSize);

	let offset = 0;
	for (let y = startY; y < endY; y++) {
		for (let x = 0; x < width; x++) {
			const iterations = mandelbrot(x, y, input);
			let R, G, B;
			if (iterations === maxIterations) {
				[R, G, B] = [0, 0, 0];
			} else {
				const hue = (iterations / maxIterations) * 360;
				[R, G, B] = hslToRgb(hue, 1, 0.5);
			}
			pixelData[offset] = R;
			pixelData[offset + 1] = G;
			pixelData[offset + 2] = B;
			pixelData[offset + 3] = 255;
			offset += 4;
		}
	}

	postMessage({ startY, endY, pixelData }, [pixelData.buffer]);
};
