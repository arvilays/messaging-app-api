const express = require("express");
const router = express.Router();
const passport = require("passport");
const controller = require("../controllers/controller");

// --- Public Routes ---
router.post("/login", controller.login_post);
router.post("/signup", controller.signup_post);

// --- Protected Routes ---
const protect = passport.authenticate("jwt", { session: false });

router.get("/user", protect, controller.user_get);

router.get("/conversation/:id", protect, controller.conversation_get);
router.post("/conversation", protect, controller.conversation_post);
router.post("/conversation-add-user", protect, controller.conversation_add_user_post);

router.post("/message", protect, controller.message_post);

module.exports = router;