import App from "./App.tsx";
import { createRoot } from "react-dom/client";
import "./main.scss";

const $root = document.getElementById("root");
if ($root) {
	createRoot($root).render(<App />);
}
