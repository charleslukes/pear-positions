import {
  BASIS_POINTS_DIVISOR,
  MARGIN_FEE_BASIS_POINTS,
  abs,
  address,
  nativeTokenAddress,
} from "../utils/constants";
import { abiAndContractMapper } from "../utils/init";
import { Token, Position } from "../types";
import {
  getDeltaStr,
  getFundingFee,
  getLeverage,
  getLeverageStr,
  getPositionContractKey,
  getPositionKey,
  getPositionKeyWithAdapter,
  getPositionQuery,
  getTokenInfo,
  getValidWhitelistedTokensAndAddress,
  instantiateContract,
  isAddressValid,
} from "../utils/helpers";
import { getDetailedTokenInfos } from "./tokenInfo";

export const getAllPositions = async (
  account: string,
  showlPnlAfterFees: boolean = false,
  isPnlInLeverage: boolean = false
) => {
  let positionPropsLength = 9;
  let positions: any = [];

  // CHECK ACCOUNT
  if (!isAddressValid(account)) {
    const error = new Error("Invalid wallet address");
    throw error;
  }
  const infoTokens = await getDetailedTokenInfos(account);

  const { whitelistedTokens } = getValidWhitelistedTokensAndAddress();

  const { positionQuery, positionsData, positionIds, positionsAdapters } =
    await getPositions(account, whitelistedTokens);
  const { collateralTokens, indexTokens, isLong } = positionQuery;

  for (let i = 0; i < collateralTokens.length; i++) {
    const collateralToken = getTokenInfo(
      infoTokens,
      collateralTokens[i],
      true,
      nativeTokenAddress
    );
    const indexToken = getTokenInfo(
      infoTokens,
      indexTokens[i],
      true,
      nativeTokenAddress
    );
    const key = getPositionKey(
      account,
      collateralTokens[i],
      indexTokens[i],
      isLong[i]
    );
    let contractKey;
    if (account) {
      contractKey = getPositionContractKey(
        account,
        collateralTokens[i],
        indexTokens[i],
        isLong[i]
      );
    }

    const position = {
      collateralToken,
      indexToken,
      isLong: isLong[i],
      size: positionsData[i * positionPropsLength],
      collateral: positionsData[i * positionPropsLength + 1],
      averagePrice: positionsData[i * positionPropsLength + 2],
      entryFundingRate: positionsData[i * positionPropsLength + 3],
      cumulativeFundingRate: collateralToken.cumulativeFundingRate,
      hasRealisedProfit:
        positionsData[i * positionPropsLength + 4] == BigInt(1),
      realisedPnl: positionsData[i * positionPropsLength + 5],
      lastIncreasedTime: positionsData[i * positionPropsLength + 6],
      hasProfit: positionsData[i * positionPropsLength + 7] == BigInt(1),
      delta: positionsData[i * positionPropsLength + 8],
      markPrice: isLong[i] ? indexToken.minPrice : indexToken.maxPrice,
      positionId: positionIds[i],
      adapter: positionsAdapters[i],
      key,
      contractKey,
    };
    positions.push(position);
  }

  const { derivedPositions, positionsMap } = derivePositions(
    positions,
    account,
    showlPnlAfterFees,
    isPnlInLeverage
  );

  return {
    positions: JSON.parse(
      JSON.stringify(derivedPositions, (_, v) =>
        typeof v === "bigint" ? v.toString() : v
      )
    ),
  };
};

export const derivePositions = (
  positions: Position[],
  account: string,
  showPnlAfterFees: boolean,
  includeDelta: boolean
) => {
  let derivedPositions: Position[] = [];

  const positionsMap: Record<string, Position> = {};

  for (let i = 0; i < positions.length; i++) {
    let position = positions[i];
    const key = getPositionKey(
      account,
      position.collateralToken.address,
      position.indexToken.address,
      position.isLong,
      nativeTokenAddress
    );

    const adapterKey = getPositionKeyWithAdapter(
      account,
      position.collateralToken.address,
      position.indexToken.address,
      position.adapter,
      position.isLong,
      nativeTokenAddress
    );

    position.key = key;
    position.adapterKey = adapterKey;

    let fundingFee = getFundingFee(position);
    position.fundingFee = fundingFee ? fundingFee : BigInt(0);
    position.collateralAfterFee = position.fundingFee
      ? position.collateral - position.fundingFee
      : position.collateral;

    position.closingFee =
      (position.size * BigInt(MARGIN_FEE_BASIS_POINTS)) /
      BigInt(BASIS_POINTS_DIVISOR);
    position.positionFee =
      (position.size * BigInt(MARGIN_FEE_BASIS_POINTS) * BigInt(2)) /
      BigInt(BASIS_POINTS_DIVISOR);
    position.totalFees = position.fundingFee
      ? position.positionFee + position.fundingFee
      : position.positionFee;

    position.pendingDelta = position.delta;

    if (position.collateral > 0) {
      position.hasLowCollateral =
        position.collateralAfterFee < 0 ||
        position.size / abs(position.collateralAfterFee) > BigInt(50);

      if (position.averagePrice && position.markPrice) {
        const priceDelta =
          position.averagePrice > position.markPrice
            ? position.averagePrice - position.markPrice
            : position.markPrice - position.averagePrice;
        position.pendingDelta =
          (position.size * priceDelta) / position.averagePrice;

        position.delta = position.pendingDelta;

        if (position.isLong) {
          position.hasProfit = position.markPrice >= position.averagePrice;
        } else {
          position.hasProfit = position.markPrice <= position.averagePrice;
        }
      }

      position.deltaPercentage =
        (position.pendingDelta * BigInt(BASIS_POINTS_DIVISOR)) /
        position.collateral;

      const { deltaStr, deltaPercentageStr } = getDeltaStr({
        delta: position.pendingDelta,
        deltaPercentage: position.deltaPercentage,
        hasProfit: position.hasProfit,
      });

      position.deltaStr = deltaStr;
      position.deltaPercentageStr = deltaPercentageStr;
      position.deltaBeforeFeesStr = deltaStr;

      let hasProfitAfterFees: boolean;
      let pendingDeltaAfterFees: bigint;

      if (position.hasProfit) {
        if (position.pendingDelta > position.totalFees) {
          hasProfitAfterFees = true;
          pendingDeltaAfterFees = position.pendingDelta - position.totalFees;
        } else {
          hasProfitAfterFees = false;
          pendingDeltaAfterFees = position.totalFees - position.pendingDelta;
        }
      } else {
        hasProfitAfterFees = false;
        pendingDeltaAfterFees = position.pendingDelta + position.totalFees;
      }

      position.hasProfitAfterFees = hasProfitAfterFees;
      position.pendingDeltaAfterFees = pendingDeltaAfterFees;
      // while calculating delta percentage after fees, we need to add opening fee (which is equal to closing fee) to collateral
      position.deltaPercentageAfterFees =
        position.pendingDeltaAfterFees *
        (BigInt(BASIS_POINTS_DIVISOR) / position.collateral +
          position.closingFee);

      const {
        deltaStr: deltaAfterFeesStr,
        deltaPercentageStr: deltaAfterFeesPercentageStr,
      } = getDeltaStr({
        delta: position.pendingDeltaAfterFees,
        deltaPercentage: position.deltaPercentageAfterFees,
        hasProfit: hasProfitAfterFees,
      });

      position.deltaAfterFeesStr = deltaAfterFeesStr;
      position.deltaAfterFeesPercentageStr = deltaAfterFeesPercentageStr;

      if (showPnlAfterFees) {
        position.deltaStr = position.deltaAfterFeesStr;
        position.deltaPercentageStr = position.deltaAfterFeesPercentageStr;
      }

      let netValue = position.hasProfit
        ? position.collateral + position.pendingDelta
        : position.collateral - position.pendingDelta;

      netValue = position.fundingFee
        ? netValue - position.fundingFee - position.closingFee
        : netValue;
      position.netValue = netValue;
    }

    position.leverage = getLeverage({
      size: position.size,
      collateral: position.collateral,
      entryFundingRate: position.entryFundingRate,
      cumulativeFundingRate: position.cumulativeFundingRate,
      hasProfit: position.hasProfit,
      delta: position.delta,
      includeDelta,
    });
    position.leverageStr = getLeverageStr(position.leverage);

    derivedPositions.push(position);
    positionsMap[adapterKey] = position;
  }

  return { derivedPositions, positionsMap };
};

export const getPositions = async (
  account: string,
  whitelistedTokens: Token[] = []
) => {
  const reader = instantiateContract(
    address.contracts.GMX_READER,
    abiAndContractMapper.reader.abi
  );

  const positionQuery = getPositionQuery(whitelistedTokens);

  const positionsData = await reader.getPositions(
    address.contracts.GMX_VAULT,
    account,
    positionQuery.collateralTokens,
    positionQuery.indexTokens,
    positionQuery.isLong
  );
  // POSITION_PROPS_LENGTH
  const positionPropsLength = await reader.POSITION_PROPS_LENGTH();

  const positionIds: string[] = [];
  const positionsAdapters: string[] = [];

  const factory = instantiateContract(
    address.contracts.GMX_FACTORY_ADDRESS,
    abiAndContractMapper.factory.abi
  );

  const { indexTokens } = positionQuery;

  for (let index = 0; index < indexTokens.length; index++) {
    const id = await factory.getPositionId(account, index);
    positionIds.push(id);
  }

  for (let index = 0; index < positionIds.length; index++) {
    const adapter = await factory.getPositionAdapter(positionIds[index]);
    positionsAdapters.push(adapter);
  }

  return {
    positionQuery,
    positionsData,
    positionIds,
    positionsAdapters,
    positionPropsLength,
  };
};
