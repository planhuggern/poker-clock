import jwt from "jsonwebtoken";
import fs from "fs";

export function loadConfig() {
  const configUrl = new URL("./config.json", import.meta.url);
  const exampleUrl = new URL("./config.example.json", import.meta.url);

  const configPath = fs.existsSync(configUrl) ? configUrl : exampleUrl;
  const raw = fs.readFileSync(configPath);
  return JSON.parse(raw.toString("utf-8"));
}

export function signToken(config, user) {
  return jwt.sign(
    { username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: "12h" }
  );
}

export function verifyToken(config, token) {
  return jwt.verify(token, config.jwtSecret);
}
