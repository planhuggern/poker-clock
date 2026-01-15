import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fs from "fs";

export function loadConfig() {
  const raw = fs.readFileSync(new URL("./config.json", import.meta.url));
  return JSON.parse(raw.toString("utf-8"));
}

export async function buildUserDb(config) {
  // Hash passord ved oppstart (enkelt for MVP; i prod lagrer du hashes)
  const users = [];
  for (const u of config.users) {
    const hash = await bcrypt.hash(u.password, 10);
    users.push({ username: u.username, passwordHash: hash, role: u.role });
  }
  return users;
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
