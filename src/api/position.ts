import { RequestHandler } from "express";
import web3 from "../../web3";
import { Params, ResBody, ReqBody, ReqQuery } from "../interfaces/IPositions";
import { isTrue } from "../utils/helper";
import { OK } from "../utils/constants";

export const getAccountPositions: RequestHandler<
  Params,
  ResBody,
  ReqBody,
  ReqQuery
> = async (req, res, next) => {
  try {
    const { account, showlPnlAfterFees, isPnlInLeverage } = req.query;

    const payload = await web3.getAllPositions(
      account,
      isTrue(showlPnlAfterFees),
      isTrue(isPnlInLeverage)
    );
    res.status(OK).json({ payload });
  } catch (err) {
    next(err);
  }
};
