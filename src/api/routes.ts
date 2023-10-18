import express from "express";
import { getAccountPositions } from "./position";
const router = express.Router();

// All routes are defined here
router.route("/").get(getAccountPositions);

export default router;
