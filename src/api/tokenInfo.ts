import { RequestHandler } from "express";
import web3 from "../../web3";
import { OK } from "../utils/constants";
import { bigIntToJson } from "../../web3/utils/helpers";

export const getAccountTokenInfo: RequestHandler<
  unknown,
  unknown,
  unknown,
  { account: string }
> = async (req, res, next) => {
  try {
    const account = req.query.account;
    const payload = await web3.getDetailedTokenInfos(account);
    res.status(OK).json({
      payload: bigIntToJson(payload),
    });
  } catch (error) {
    next(error);
  }
};
