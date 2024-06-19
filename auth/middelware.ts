import express, { NextFunction, Request, Response } from "express";
import { toData } from "./jwt";

export interface AuthRequest extends Request {
  userId?: number;
}

export const AuthMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const headers = req.headers;

  if (
    headers["authorization"] &&
    headers["authorization"].split(" ")[0] === "Bearer" &&
    headers["authorization"].split(" ")[1]
  ) {
    const token = headers["authorization"].split(" ")[1];
    try {
      const data = toData(token);
      req.userId = data.userId;
      next();
    } catch (e) {
      res.status(401).send({ message: "Token missing or invalid" });
      return;
    }
  } else {
    res.status(401).send({ message: "Token missing or invalid" });
    return;
  }
};
