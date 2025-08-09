import prisma from "../db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import emojiRegex from "emoji-regex";
import { clean, isProfane } from "../utils/filter.js";
import { body, validationResult } from "express-validator";

const COMBINING_MARK_REGEX = /[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF]/g;

// --- Utility Functions & Middleware ---
// Check for glitchy and distorted text
function isZalgo(text) {
  const matches = text.match(COMBINING_MARK_REGEX);
  return matches && matches.length > 2;
}

// Verify if the logged-in user is a member of the requested conversation.
const checkConversationAuth = async (req, res, next) => {
  try {
    const conversationId = req.params.id || req.body.conversationId;
    const userId = req.user.id;

    if (!conversationId) {
      return res.status(400).json({ error: "Conversation ID is required." });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { users: { select: { id: true } } },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    const isUserInConversation = conversation.users.some(user => user.id === userId);
    if (!isUserInConversation) {
      return res.status(403).json({ error: "You are not authorized to access this conversation." });
    }

    req.conversation = conversation;
    next();
  } catch (err) {
    next(err);
  }
}

// --- Route Controllers ---
export const signup_post = [
  body("username")
    .trim()
    .isLength({ min: 1 }).withMessage("Username cannot be empty.")
    .custom((value) => {
      if (isProfane(value)) throw new Error("Username contains inappropriate language.");
      if (isZalgo(value)) throw new Error("Username contains distorted text.");
      return true;
    })
    .escape(),
  body("password").isLength({ min: 3 }).withMessage("Password must be at least 3 characters long."),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) throw new Error("Passwords do not match.");
    return true;
  }),

  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const hashedPassword = await bcrypt.hash(req.body.password, 10);

      await prisma.user.create({
        data: {
          username: req.body.username,
          username_lowercase: req.body.username.toLowerCase(),
          password: hashedPassword,
          conversations: {
            connect: { id: "global" },
          },
        },
      });
      res.status(201).json({ message: "User created successfully." });
    } catch (err) {
      if (err.code === "P2002") { // Prisma unique constraint violation
        return res.status(409).json({ message: "Username already exists." });
      }
      next(err);
    }
  },
];

export const login_post = async (req, res, next) => {
  try {
    const { username } = req.body;
    const lowercaseUsername = username.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { username_lowercase: lowercaseUsername },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const payload = { id: user.id, username: user.username };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.json({ message: "Logged in successfully.", token: `Bearer ${token}` });
  } catch (err) {
    next(err);
  }
};

export const user_get = async (req, res, next) => {
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
            users: { select: { username: true, emoji: true } },
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

export const user_avatar_post = async (req, res, next) => {
  try {
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ error: "Emoji is required." });
    }

    const segmenter = new Intl.Segmenter();
    const segments = Array.from(segmenter.segment(emoji));

    if (segments.length !== 1 || !emojiRegex().test(segments[0].segment)) {
      return res.status(400).json({ error: "Avatar must be a single emoji." });
    }

    if (isZalgo(emoji)) {
      return res.status(400).json({ error: "Emoji contains distorted text." });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { emoji },
    });

    res.status(200).json({ message: "Avatar updated successfully." });
  } catch (err) {
    next(err);
  }
};

export const conversation_get = [
  checkConversationAuth,
  async (req, res, next) => {
    try {
      const conversationDetails = await prisma.conversation.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          users: {
            select: { username: true, emoji: true },
            orderBy: { username: "asc" },
          },
          messages: {
            select: {
              id: true,
              content: true,
              createdAt: true,
              user: { select: { username: true, emoji: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      res.json(conversationDetails);
    } catch (err) {
      next(err);
    }
  },
];

export const conversation_post = async (req, res, next) => {
  try {
    const { usernames = [] } = req.body;
    const creatorId = req.user.id;

    if (usernames.length === 0) {
      return res.status(400).json({ error: "Usernames are required to start a conversation." });
    }

    const usersToFind = [...new Set([req.user.username, ...usernames])];

    if (usersToFind.length < 2) {
      return res.status(400).json({ error: "You cannot create a conversation with only yourself." });
    }

    const lowercasedUsersToFind = usersToFind.map(name => name.toLowerCase());
    const foundUsers = await prisma.user.findMany({
      where: {
        username_lowercase: {
          in: lowercasedUsersToFind,
        },
      },
      select: { id: true, username: true },
    });

    if (foundUsers.length !== usersToFind.length) {
      const foundUsernames = new Set(foundUsers.map(u => u.username));
      const notFound = usersToFind.filter(name => !foundUsernames.has(name));
      return res.status(404).json({ error: "One or more users were not found.", notFound });
    }

    const allUserIds = foundUsers.map(u => u.id);

    // Check if conversation with provided users already exist
    const conversations = await prisma.conversation.findMany({
      where: {
        users: {
          every: {
            id: { in: allUserIds },
          },
        },
      },
      include: {
        users: {
          select: { id: true },
        },
      },
    });

    const existingConversation = conversations.find((conv) => {
      const memberIds = conv.users.map((u) => u.id).sort();
      const targetIds = [...allUserIds].sort();
      return (
        memberIds.length === targetIds.length &&
        memberIds.every((id, i) => id === targetIds[i])
      );
    });

    if (existingConversation) {
      return res.status(200).json({
        message: "Conversation with these members already exists.",
        conversationId: existingConversation.id,
      });
    }

    // Create new conversation
    const newConversation = await prisma.conversation.create({
      data: {
        users: { connect: foundUsers.map(u => ({ id: u.id })) },
        creator: { connect: { id: creatorId } },
      },
    });

    res.status(201).json({
      message: "Conversation created successfully!",
      conversationId: newConversation.id,
    });
  } catch (err) {
    next(err);
  }
};

export const conversation_add_user_post = [
  checkConversationAuth,
  async (req, res, next) => {
    try {
      const { addUsername } = req.body;
      const { conversation } = req;

      if (!addUsername) {
        return res.status(400).json({ error: "Username of user to add is required." });
      }

      const userToAdd = await prisma.user.findUnique({
        where: {
          username_lowercase: addUsername.toLowerCase(),
        },
        select: { id: true },
      });

      if (!userToAdd) {
        return res.status(404).json({ error: "User not found." });
      }

      const alreadyInConversation = conversation.users.some(
        (user) => user.id === userToAdd.id
      );

      if (alreadyInConversation) {
        return res.status(409).json({ error: "User is already in the conversation." });
      }

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          users: { connect: { id: userToAdd.id } },
        },
      });

      res.status(200).json({ message: "User added successfully." });
    } catch (err) {
      next(err);
    }
  },
];

export const conversation_leave_post = [
  checkConversationAuth,
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { conversation } = req;

      if (conversation.id === "global") {
        return res.status(403).json({ error: "You cannot leave the global chat." });
      }

      // Delete conversation if last user leaves
      if (conversation.users.length === 1) {
        await prisma.conversation.delete({
          where: { id: conversation.id },
        });
        return res.status(200).json({ message: "Conversation deleted as you were the last member." });
      }

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          users: {
            disconnect: { id: userId },
          },
        },
      });

      res.status(200).json({ message: "You have successfully left the conversation." });
    } catch (err) {
      next(err);
    }
  },
];

// Fetches only new messages in a conversation since a given timestamp.
export const new_messages_get = [
  checkConversationAuth,
  async (req, res, next) => {
    try {
      const { since } = req.query; // ex. "2025-08-04T22:26:39.000Z"

      if (!since) {
        return res.status(400).json({ error: "A 'since' timestamp is required." });
      }

      const newMessages = await prisma.message.findMany({
        where: {
          conversationId: req.params.id,
          createdAt: {
            gt: new Date(since),
          },
        },
        include: {
          user: { select: { username: true, emoji: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      res.json(newMessages);
    } catch (err) {
      next(err);
    }
  }
];

// Checks if any of the user's conversations have been updated since a given timestamp
export const conversation_updates_get = async (req, res, next) => {
  try {
    const { since } = req.query;
    const userId = req.user.id;

    if (!since) {
      return res.status(400).json({ error: "A 'since' timestamp is required." });
    }

    const count = await prisma.conversation.count({
      where: {
        users: { some: { id: userId } },
        updatedAt: { gt: new Date(since) },
      },
    });

    res.json({ hasUpdates: count > 0 });
  } catch (err) {
    next(err);
  }
};

export const message_post = [
  checkConversationAuth,
  async (req, res, next) => {
    try {
      let { message } = req.body;
      const { conversationId } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ error: "Message content cannot be empty." });
      }

      if (isZalgo(message)) {
        return res.status(400).json({ error: "Message contains distorted text." });
      }

      if (isProfane(message)) {
        message = clean(message);
      }

      const [newMessage] = await prisma.$transaction([
        prisma.message.create({
          data: {
            content: message,
            conversation: { connect: { id: conversationId } },
            user: { connect: { id: req.user.id } },
          },
        }),
        prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        }),
      ]);

      res.status(201).json({ message: "Message posted successfully.", sentMessage: newMessage });
    } catch (err) {
      next(err);
    }
  },
];

