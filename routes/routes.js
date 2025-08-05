

import { Router } from "express";
import passport from "passport";
import * as controller from "../controllers/controller.js";

const router = Router();

// --- Authentication Routes ---
router.post("/signup", ...controller.signup_post);
router.post("/login", controller.login_post);

// --- Protected Routes Middleware ---
const protect = passport.authenticate("jwt", { session: false });

// --- User Routes ---
router.get("/user", protect, controller.user_get);
router.post("/user-avatar", protect, controller.user_avatar_post);

// --- Conversation Routes ---
router.post("/conversation", protect, controller.conversation_post);
router.get("/conversation/:id", protect, ...controller.conversation_get);
router.post("/conversation-add-user", protect, ...controller.conversation_add_user_post);

// --- Message Routes ---
router.post("/message", protect, ...controller.message_post);

// --- Polling Routes ---
router.get("/conversations/updates", protect, controller.conversation_updates_get);
router.get("/conversation/:id/messages/new", protect, ...controller.new_messages_get);

export default router;