import "dotenv/config";
import express from "express";
import cors from "cors";
import passport from "passport";
import "./config/passport.js";
import apiRoutes from "./routes/routes.js";

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(passport.initialize());

// --- Routes ---
app.get("/", (req, res) => {
  res.json({ message: "Welcome to the Echo Messenger API! ✨" });
});
app.use("/api", apiRoutes);

// --- Error Handler ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!", error: err.message });
});

// --- Server Listener ---
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});