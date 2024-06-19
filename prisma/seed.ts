import { PrismaClient } from "@prisma/client";
import users from "./data/users.json";
import books from "./data/books.json";
import bookProgress from "./data/bookProgress.json";

const prisma = new PrismaClient();

const seed = async () => {
  try {
    for (const userData of users) {
      if (userData) await prisma.user.create({ data: userData });
    }

    for (const bookData of books) {
      if (bookData) await prisma.book.create({ data: bookData });
    }

    for (const bookProgressData of bookProgress) {
      if (bookProgressData) {
        await prisma.bookProgress.create({ data: bookProgressData });
      }
    }

    console.log("Seeding completed successfully.");
  } catch (error) {
    console.error("Error during seeding:", error);
  }
};

seed();
