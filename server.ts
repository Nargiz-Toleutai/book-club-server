import express, { json } from "express";
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import { toToken } from "./auth/jwt";
import { AuthRequest } from "./auth/middelware";
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
