import "./App.css";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ensureAuthenticated } from "@shared/auth/authClient.js";

const savedTheme = localStorage.getItem("poker_theme") || "night";
document.documentElement.setAttribute("data-theme", savedTheme);

const baseUrl = import.meta.env.BASE_URL || "/";
const basename = baseUrl === "/" ? undefined : baseUrl.replace(/\/$/, "");

const root = ReactDOM.createRoot(document.getElementById("root")!);

ensureAuthenticated().finally(() => {
  root.render(
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  );
});
