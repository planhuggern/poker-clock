
import "./App.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <pre style={{ color: "red", padding: 24, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {"React-feil:\n"}{String(this.state.error)}\n{this.state.error?.stack}
        </pre>
      );
    }
    return this.props.children;
  }
}

const baseUrl = import.meta.env.BASE_URL || "/";
const basename = baseUrl === "/" ? undefined : baseUrl.replace(/\/$/, "");

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </ErrorBoundary>
);
