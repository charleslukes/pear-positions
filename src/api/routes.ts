import express from "express";
import { getAccountPositions } from "./position";
import { getAccountTokenInfo } from "./tokenInfo";
const router = express.Router();

// All routes are defined here
router.route("/positions").get(getAccountPositions);
router.route("/tokens-info").get(getAccountTokenInfo);

export default router;
