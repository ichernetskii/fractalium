import { useEffect, useRef, useState } from "react";
import styles from "./App.module.scss";

interface Position {
	x: number;
	y: number;
}

interface WorkerResponse {
	startY: number;
	endY: number;
	pixelData: Uint8ClampedArray<ArrayBuffer>;
}

const MAX_ITERATIONS = 100;
const DEFAULT_WORLD_DENSITY = 1 / 800;
const DEFAULT_WORLD_CENTER: Position = { x: -0.5, y: 0 };

const screenToWorld = (
	position: Position,
	worldCenter: Position,
	density: number,
	screenWidth: number,
	screenHeight: number,
	dpr: number,
): Position => ({
	x: worldCenter.x + (position.x - screenWidth / 2) * density * dpr,
	y: worldCenter.y + (position.y - screenHeight / 2) * density * dpr,
});

function App() {
	const refCanvas = useRef<HTMLCanvasElement>(null);
	const refSelection = useRef<HTMLDivElement>(null);

	const [density, setDensity] = useState(DEFAULT_WORLD_DENSITY);
	const [center, setCenter] = useState<Position>(DEFAULT_WORLD_CENTER);
	const [dragStart, setDragStart] = useState<Position | null>(null);
	const [mousePosition, setMousePosition] = useState<Position | null>(null);
	const dpr = window.devicePixelRatio || 1;
	const worldPosition = mousePosition
		? screenToWorld(mousePosition, center, density, window.innerWidth, window.innerHeight, dpr)
		: null;

	useEffect(() => {
		if (!refCanvas.current) return;
		if (!refSelection.current) return;

		refCanvas.current.focus();
		const canvas = refCanvas.current;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Retina fix for canvas
		if (canvas.width !== window.innerWidth * dpr || canvas.height !== window.innerHeight * dpr) {
			canvas.width = window.innerWidth * dpr;
			canvas.height = window.innerHeight * dpr;
		}
		canvas.style.width = `${window.innerWidth}px`;
		canvas.style.height = `${window.innerHeight}px`;
		ctx.scale(dpr, dpr);

		const CPUs = navigator.hardwareConcurrency || 4;
		const workers = new Array(CPUs)
			.fill(null)
			.map(() => new Worker(new URL("./mandelbrotWorker.ts", import.meta.url)));

		const imageData = ctx.createImageData(canvas.width, canvas.height);

		// Split an image on chunks
		const chunkSize = Math.ceil(canvas.height / CPUs);
		let finishedChunks = 0;

		workers.forEach((worker, i) => {
			const startY = i * chunkSize;
			const endY = Math.min(startY + chunkSize, canvas.height);

			worker.postMessage({
				startY,
				endY,
				width: canvas.width,
				height: canvas.height,
				centerX: center.x,
				centerY: center.y,
				density,
				maxIterations: MAX_ITERATIONS,
			});

			worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
				const { startY, endY, pixelData } = e.data;
				let offset = 0;
				for (let row = startY; row < endY; row++) {
					const rowIndex = row * canvas.width * 4; // start position in imageData
					const rowLength = canvas.width * 4; // number of bytes
					imageData.data.set(pixelData.slice(offset, offset + rowLength), rowIndex);
					offset += rowLength;
				}

				finishedChunks++;
				if (finishedChunks === CPUs) {
					ctx.putImageData(imageData, 0, 0);
					workers.forEach(w => {
						w.terminate();
					});
				}
			};
		});

		return () => {
			workers.forEach(w => {
				w.terminate();
			});
		};
	}, [center, density, dpr]);

	return (
		<>
			<canvas
				ref={refCanvas}
				tabIndex={1000}
				onKeyDown={e => {
					if (e.key === "ArrowUp") setCenter({ x: center.x, y: center.y - 100 * density });
					if (e.key === "ArrowDown") setCenter({ x: center.x, y: center.y + 100 * density });
					if (e.key === "ArrowLeft") setCenter({ x: center.x - 100 * density, y: center.y });
					if (e.key === "ArrowRight") setCenter({ x: center.x + 100 * density, y: center.y });
					if (e.key === "Escape") {
						setCenter(DEFAULT_WORLD_CENTER);
						setDensity(DEFAULT_WORLD_DENSITY);
					}
				}}
				onMouseDown={e => {
					if (e.button === 0) {
						setDragStart({ x: e.clientX, y: e.clientY });
					}
				}}
				onMouseUp={e => {
					if (dragStart && e.clientX !== dragStart.x && e.clientY !== dragStart.y) {
						const maxX = Math.max(Math.abs(e.clientX), Math.abs(dragStart.x));
						const minX = Math.min(Math.abs(e.clientX), Math.abs(dragStart.x));
						const maxY = Math.max(Math.abs(e.clientY), Math.abs(dragStart.y));
						const minY = Math.min(Math.abs(e.clientY), Math.abs(dragStart.y));

						if ((maxX - minX) / (maxY - minY) > window.innerWidth / window.innerHeight) {
							setDensity(density => (density * Math.abs(e.clientX - dragStart.x)) / window.innerWidth);
						} else {
							setDensity(density => (density * Math.abs(e.clientY - dragStart.y)) / window.innerHeight);
						}

						setCenter(center =>
							screenToWorld(
								{ x: (maxX + minX) / 2, y: (maxY + minY) / 2 },
								center,
								density,
								window.innerWidth,
								window.innerHeight,
								dpr,
							),
						);
					}
					setDragStart(null);
				}}
				onMouseMove={e => {
					setMousePosition({ x: e.clientX, y: e.clientY });
				}}
				onDoubleClick={e => {
					if (e.button === 0) {
						const scale = 2;
						setDensity(density => density / scale);
						setCenter(center =>
							screenToWorld(
								{
									x: e.clientX - (e.clientX - 0.5 * window.innerWidth) / scale,
									y: e.clientY - (e.clientY - 0.5 * window.innerHeight) / scale,
								},
								center,
								density,
								window.innerWidth,
								window.innerHeight,
								dpr,
							),
						);
					}
				}}
				onWheel={e => {
					if (e.ctrlKey) {
						e.preventDefault();
					}
					const scale = e.deltaY > 0 ? 0.9 : 1.1;
					setDensity(density => density / scale);
					setCenter(center =>
						screenToWorld(
							{
								x: e.clientX - (e.clientX - 0.5 * window.innerWidth) / scale,
								y: e.clientY - (e.clientY - 0.5 * window.innerHeight) / scale,
							},
							center,
							density,
							window.innerWidth,
							window.innerHeight,
							dpr,
						),
					);
				}}
				onContextMenu={e => {
					e.preventDefault();
					setDensity(DEFAULT_WORLD_DENSITY);
					setCenter(DEFAULT_WORLD_CENTER);
				}}
			/>
			<div
				ref={refSelection}
				className={styles.selection}
				style={{
					display: dragStart ? "block" : "none",
					left: dragStart && mousePosition ? Math.min(dragStart.x, mousePosition.x) : 0,
					top: dragStart && mousePosition ? Math.min(dragStart.y, mousePosition.y) : 0,
					width: dragStart && mousePosition ? Math.abs(dragStart.x - mousePosition.x) : 0,
					height: dragStart && mousePosition ? Math.abs(dragStart.y - mousePosition.y) : 0,
				}}
			/>
			<div className={styles.info}>
				<div>
					center: {center.x.toFixed(5)}, {center.y.toFixed(5)}
				</div>
				<div>
					x: {worldPosition?.x.toFixed(7) ?? 0}, y: {worldPosition?.y.toFixed(7) ?? 0}
				</div>
				<div>density: {density.toExponential(6)}</div>
			</div>
		</>
	);
}

export default App;
