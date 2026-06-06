
import "./App.css";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";

// Initialiser tema fra localStorage før render (unngår blink)
const savedTheme = localStorage.getItem("poker_theme") || "night";
document.documentElement.setAttribute("data-theme", savedTheme);

const baseUrl = import.meta.env.BASE_URL || "/";
const basename = baseUrl === "/" ? undefined : baseUrl.replace(/\/$/, "");

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter basename={basename}>
    <App />
  </BrowserRouter>
);
