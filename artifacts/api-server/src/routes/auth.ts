import { Router } from "express";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { eq, and } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import type { AuthRequest } from "../middleware/requireAuth.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}
const secret = new TextEncoder().encode(process.env.SESSION_SECRET);

async function makeToken(userId: number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(secret);
}

// POST /api/auth/register
router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const normalized = email.toLowerCase().trim();
  const existing = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.email, normalized), eq(usersTable.app, "vanity")));

  if (existing.length > 0) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(usersTable)
    .values({ email: normalized, app: "vanity", passwordHash })
    .returning();

  const token = await makeToken(user.id);
  res.status(201).json({ token, user: { id: user.id, email: user.email } });
});

// POST /api/auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.email, email.toLowerCase().trim()), eq(usersTable.app, "vanity")));

  if (!user) {
    res.status(401).json({ error: "Incorrect email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Incorrect email or password" });
    return;
  }

  const token = await makeToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email } });
});

// PATCH /api/auth/me — change email and/or password
router.patch("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { currentPassword, newEmail, newPassword } = req.body as {
    currentPassword?: string;
    newEmail?: string;
    newPassword?: string;
  };

  if (!currentPassword) {
    res.status(400).json({ error: "Current password is required" });
    return;
  }
  if (!newEmail && !newPassword) {
    res.status(400).json({ error: "Provide a new email or new password" });
    return;
  }
  if (newPassword && newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) { res.status(401).json({ error: "Current password is incorrect" }); return; }

  const updates: Partial<{ email: string; passwordHash: string }> = {};

  if (newEmail) {
    const normalized = newEmail.toLowerCase().trim();
    if (normalized === user.email) {
      res.status(400).json({ error: "That's already your email address" });
      return;
    }
    const [taken] = await db.select().from(usersTable).where(and(eq(usersTable.email, normalized), eq(usersTable.app, "vanity")));
    if (taken) { res.status(409).json({ error: "An account with that email already exists" }); return; }
    updates.email = normalized;
  }

  if (newPassword) {
    updates.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, userId))
    .returning({ id: usersTable.id, email: usersTable.email });

  res.json({ user: updated });
});

// DELETE /api/auth/me — permanently delete account and all data
router.delete("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { password } = req.body as { password?: string };

  if (!password) {
    res.status(400).json({ error: "Password is required to delete your account" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) { res.status(401).json({ error: "Incorrect password" }); return; }

  // Cascade deletes clothing_items, saved_outfits, outfit_items automatically
  await db.delete(usersTable).where(eq(usersTable.id, userId));

  res.status(204).send();
});

// GET /api/auth/me
router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const [user] = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ user });
});

export default router;
