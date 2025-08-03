require("dotenv").config();

const prisma = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { clean, isProfane } = require("../utils/filter");
const { body, validationResult } = require("express-validator");

const COMBINING_MARK_REGEX = /[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF]/g;

function isZalgo(text) {
  const matches = text.match(COMBINING_MARK_REGEX);
  return matches && matches.length > 2; // Allow max 2 combining marks
}

exports.signup_post = [
  body("username")
    .trim()
    .isLength({ min: 1 })
    .custom((value) => {
      if (isProfane(value)) {
        throw new Error("Username contains inappropriate language.");
      } else if (isZalgo(value)) {
        throw new Error("Username contains distorted or glitchy text.");
      }
      return true;
    })
    .escape(),
  body("password").isLength({ min: 6 }),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Passwords do not match.");
    }
    return true;
  }),

  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const hashedPassword = await bcrypt.hash(req.body.password, 10);

      const user = await prisma.user.create({
        data: {
          username: req.body.username,
          password: hashedPassword,
          conversations: {
            connect: { id: "global" },
          },
        }
      });

      res.status(201).json({ message: "User created successfully." });
    } catch (err) {
      if (err.code === "P2002") {
        return res.status(400).json({ message: "Username already exists." });
      }
      return next(err);
    }
  }
];

exports.login_post = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.body.username },
    });

    if (!user) {
      return res.status(401).json({ message: "Login failed. User not found." });
    }

    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Login failed. Wrong password." });
    }

    const payload = { id: user.id, username: user.username };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.json({ message: "Logged in successfully.", token: `Bearer ${token}` });
  } catch (err) {
    return next(err);
  }
};

exports.user_get = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        username: true,
        emoji: true,
        conversations: {
          where: {
            NOT: { id: "global" },
          },
          select: {
            id: true,
            title: true,
            users: {
              select: {
                username: true,
                emoji: true,
              },
            },
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user data" });
  }
};

exports.user_avatar_post = async (req, res) => {
  try {
    const { character } = req.body;
    const userId = req.user.id;

    if (!character) {
      res.status(400).json({ error: "Character is required" });
    }

    if (character.length !== 1) {
      res.status(400).json({ error: "Avatar must be exactly one visible character" });
    }

    if (isZalgo(character)) {
      return res.status(400).json({ error: "Character contains distorted or glitchy text" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        emoji: character,
      },
    });

    res.status(200).json({ message: "Avatar successfully changed" });
  } catch (err) {
    res.status(500).json({ error: "Failed to set user avatar" });
  }
}

exports.conversation_get = async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id;

    if (!conversationId) {
      return res.status(400).json({ error: "Conversation ID is required " });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        users: {
          select: {
            id: true,
            username: true,
            emoji: true,
          },
          orderBy: { username: "asc" },
        },
        messages: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            user: {
              select: { username: true, emoji: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const isUserInConversation = conversation.users.some(user => user.id === userId);
    if (!isUserInConversation) {
      return res.status(403).json({ error: "Failed to fetch conversation data" });
    }

    const response = {
      users: conversation.users.map(({ username, emoji }) => ({ username, emoji })),
      messages: conversation.messages,
    };
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch conversation data" });
  }
};

exports.conversation_post = async (req, res, next) => {
  try {
    const { usernames } = req.body;
    const creatorId = req.user.id;

    if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
      return res.status(400).json({ error: "No users provided for new conversation."});
    }

    // Fetch creator
    const creator = await prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true, username: true },
    })

    if (!creator) {
      return res.status(400).json({ error: "Creator not found." });
    }

    // Fetch other users
    const otherUsers = await prisma.user.findMany({
      where: {
        username: {
          in: usernames,
        },
      },
      select: { id: true, username: true },
    });

    // Combine creator and other users
    const allUsers = [creator, ...otherUsers];

    // Check if all requested users were found
    if (usernames.length !== otherUsers.length) {
      const foundUsernames = new Set(allUsers.map(u => u.username));
      const notFound = usernames.filter(name => !foundUsernames.has(name));
      return res.status(404).json({
        error: "Some users not found.",
        notFoundUsers: notFound,
      });
    }

    // Create new conversation
    const newConversation = await prisma.conversation.create({
      data: {
        users: {
          connect: allUsers.map(u => ({ id: u.id })),
        },
        creator: {
          connect: { id: creator.id },
        },
      },
    });  

    res.status(201).json({
      message: "Conversation created successfully!",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create conversation data" });
  }
};

exports.conversation_add_user_post = async(req, res, next) => {
  try {
    const { conversationId, addUserId } = req.body;
    const userId = req.user.id;

    if (!conversationId || !addUserId) {
      res.status(400).json({ error: "Conversation ID and added user ID is required" });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { users: true },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const isUserInConversation = conversation.users.some(user => user.id === userId);
    if (!isUserInConversation) {
      return res.status(403).json({ error: "Failed to add user to conversation" });
    }

    const alreadyInConversation = conversation.users.some(user => user.id === addUserId);
    if (alreadyInConversation) {
      return res.status(400).json({ error: "User is already in the conversation" });
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        users: {
          connect: { id: addUserId },
        },
      },
    });

    res.status(200).json({ success: true, message: "User added to the conversation" });
  } catch (err) {
    res.status(500).json({ error: "Failed to add user to conversation" });
  }
};

exports.message_post = async(req, res, next) => {
  try {
    const { conversationId } = req.body;
    let message = req.body.message?.trim();
    const userId = req.user.id;

    if (!message || !conversationId) {
      return res.status(400).json({ error: "Message and conversation ID is required" });
    }

    if (isProfane(message)) {
      message = clean(message);
    }

    if (isZalgo(message)) {
      return res.status(400).json({ error: "Message contains distorted or glitchy text" });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        users: {
          select: { id: true },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    const isUserInConversation = conversation.users.some(user => user.id === userId);
    if (!isUserInConversation) {
      return res.status(403).json({ error: "Failed to post message" });
    }

    const newMessage = await prisma.message.create({
      data: {
        content: message,
        conversation: { connect: {id: conversationId } },
        user: { connect: { id: userId } },
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    res.status(201).json({ 
      message: "Message successfully posted",
      sentMessage: newMessage,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to post message" });
  }
}