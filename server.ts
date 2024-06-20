import express, { json } from "express";
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import { toToken } from "./auth/jwt";
import { AuthMiddleware, AuthRequest } from "./auth/middelware";
import { z } from "zod";

const app = express();
app.use(cors());
const port = 3001;

const prisma = new PrismaClient();

app.use(json());

const UserDataValidator = z
  .object({
    username: z.string().min(5, {
      message: "Username should have a minimum length of 5 characters",
    }),
    password: z.string().min(10, {
      message: "Password should have a minimum length of 10 characters",
    }),
  })
  .strict();

const ProgressDataValidator = z
  .object({
    pageProgress: z.number(),
    id: z.preprocess((val) => Number(val), z.number().int().positive()),
  })
  .strict();

app.get("/books", async (req, res) => {
  const books = await prisma.book.findMany({
    include: {
      _count: {
        select: {
          bookProgress: true,
        },
      },
    },
  });
  res.json(books);
});

app.get("/books/:id", async (req, res) => {
  const bookId = Number(req.params.id);
  if (isNaN(bookId)) {
    res.status(400).send();
    return;
  }
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      bookProgress: true,
    },
  });

  if (book === null) {
    res.status(404).send({ message: "Something went wrong!" });
    return;
  }
  const bookProgressCount = book.bookProgress.length;

  const averagePageProgress =
    book.bookProgress.reduce(
      (acc, progress) => acc + progress.pageProgress,
      0
    ) / bookProgressCount;
  res.json({ ...book, bookProgressCount, averagePageProgress });
});

app.post("/bookprogress", AuthMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) {
    return res.status(401).send("You are not authorized");
  }
  const { bookId, pageProgress } = req.body;

  if (bookId && pageProgress !== undefined) {
    try {
      const newBookProgress = await prisma.bookProgress.create({
        data: {
          bookId,
          userId: req.userId,
          pageProgress,
        },
      });
      res.status(201).send({
        message: "Book Progress was added!",
        bookProgress: newBookProgress,
      });
    } catch (error) {
      res.status(500).send({ message: "Something went wrong" });
    }
  } else {
    res.status(400).send({ message: "bookId and pageProgress are required" });
  }
});

app.patch(
  "/bookprogress/:id",
  AuthMiddleware,
  async (req: AuthRequest, res) => {
    if (!req.userId) {
      return res.status(401).send("You are not authorized");
    }

    const id = Number(req.params.id);
    const validated = ProgressDataValidator.safeParse({ ...req.body, id });

    if (!validated.success) {
      return res.status(400).send(validated.error.flatten());
    }

    const progressId = validated.data.id;

    try {
      const existingProgress = await prisma.bookProgress.findUnique({
        where: { id: progressId },
        include: { book: true },
      });

      if (!existingProgress || existingProgress.userId !== req.userId) {
        return res.status(404).send({ message: "Progress not found" });
      }

      const { pageProgress } = validated.data;
      if (pageProgress > existingProgress.book.pageCount) {
        return res
          .status(400)
          .send({ message: "Page progress exceeds book page count" });
      }

      const updatedBookProgress = await prisma.bookProgress.update({
        where: { id: progressId },
        data: { pageProgress },
      });

      res.send(updatedBookProgress);
    } catch (error) {
      console.error("Error updating book progress:", error);
      res.status(500).send({ message: "Something went wrong" });
    }
  }
);

app.get("/my-progress", AuthMiddleware, async (req: AuthRequest, res) => {
  if (!req.userId) {
    return res.status(401).send("You are not authorized");
  }
  try {
    const bookProgressList = await prisma.bookProgress.findMany({
      where: { userId: req.userId },
      include: {
        book: true,
      },
    });
    res.status(200).send(bookProgressList);
  } catch (error) {
    res.status(500).send({ message: "Something went wrong" });
  }
});

app.post("/login", async (req: AuthRequest, res) => {
  const bodyFromRequest = req.body;
  if ("username" in bodyFromRequest && "password" in bodyFromRequest) {
    try {
      const userToLogin = await prisma.user.findUnique({
        where: {
          username: bodyFromRequest.username,
        },
      });
      if (userToLogin && userToLogin.password === bodyFromRequest.password) {
        const token = toToken({ userId: userToLogin.id });
        res.status(200).send({ token: token });
        return;
      }
      res.status(400).send({ message: "Login failed" });
    } catch (error) {
      res.status(500).send({ message: "Something went wrong!" });
    }
  } else {
    res
      .status(400)
      .send({ message: "'username' and 'password' are required!" });
  }
});

app.post("/register", async (req, res) => {
  const bodyFromReq = req.body;
  const validated = UserDataValidator.safeParse(bodyFromReq);

  if (validated.success) {
    try {
      const newUser = await prisma.user.create({
        data: {
          username: validated.data.username,
          password: validated.data.password,
        },
      });
      res.status(201).send({ message: "User created", user: newUser });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).send({ error: "Something went wrong" });
    }
  } else {
    res.status(400).send(validated.error.flatten());
  }
});

app.listen(port, () => console.log(`Listening on port: ${port}`));
