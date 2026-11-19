// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title VellenGapMath
/// @notice Pure helpers shared by VellenGapWatch and mirrored one-to-one by the site (src/lib/gap/math.ts).
///         All prices are "asset units per one whole token, scaled to 1e18". The gap is in parts per million (ppm):
///         gapPpm = (price - nav) * 1_000_000 / nav, truncated toward zero. 10_000 ppm = 1 % = 100 bps.
library VellenGapMath {
    uint256 internal constant PPM = 1_000_000;
    /// @dev 1 bps = 100 ppm.
    int256 internal constant PPM_PER_BPS = 100;

    int24 internal constant MIN_TICK = -887272;
    int24 internal constant MAX_TICK = 887272;

    uint8 internal constant DIR_PREMIUM = 1;
    uint8 internal constant DIR_DISCOUNT = 2;
    uint8 internal constant DIR_EITHER = 3;

    error NavZero();
    error TickOutOfRange();
    error DecimalsTooLarge();

    /// @notice Signed gap of a price against NAV in ppm, truncated toward zero (same as BigInt division).
    function gapPpm(uint256 price, uint256 nav) internal pure returns (int256) {
        if (nav == 0) revert NavZero();
        return ((int256(price) - int256(nav)) * int256(PPM)) / int256(nav);
    }

    /// @notice True when a gap crosses a rule threshold. Exactly at the threshold counts as crossed.
    /// @param direction 1 premium (price above NAV), 2 discount (below), 3 either side.
    function crosses(uint8 direction, uint32 thresholdBps, int256 gap) internal pure returns (bool) {
        int256 t = int256(uint256(thresholdBps)) * PPM_PER_BPS;
        if (direction == DIR_PREMIUM) return gap >= t;
        if (direction == DIR_DISCOUNT) return gap <= -t;
        if (direction == DIR_EITHER) return gap >= t || gap <= -t;
        return false;
    }

    /// @notice Scales an amount with `decimals` decimals to 1e18.
    function to1e18(uint256 amount, uint8 decimals) internal pure returns (uint256) {
        if (decimals > 36) revert DecimalsTooLarge();
        if (decimals == 18) return amount;
        if (decimals < 18) return amount * 10 ** (18 - decimals);
        return amount / 10 ** (decimals - 18);
    }

    /// @notice Price of one whole base token in quote units, scaled to 1e18, from a pool's sqrt price (Q64.96).
    /// @param baseIsToken0 true when the priced token is token0 of the pool.
    function priceFromSqrt(uint160 sqrtPriceX96, bool baseIsToken0, uint8 baseDecimals, uint8 quoteDecimals)
        internal
        pure
        returns (uint256)
    {
        if (baseDecimals > 36 || quoteDecimals > 36) revert DecimalsTooLarge();
        uint256 baseAmount = 10 ** baseDecimals;
        uint256 quoteAmount;
        if (sqrtPriceX96 <= type(uint128).max) {
            uint256 ratioX192 = uint256(sqrtPriceX96) * sqrtPriceX96;
            quoteAmount = baseIsToken0 ? mulDiv(ratioX192, baseAmount, 1 << 192) : mulDiv(1 << 192, baseAmount, ratioX192);
        } else {
            uint256 ratioX128 = mulDiv(sqrtPriceX96, sqrtPriceX96, 1 << 64);
            quoteAmount = baseIsToken0 ? mulDiv(ratioX128, baseAmount, 1 << 128) : mulDiv(1 << 128, baseAmount, ratioX128);
        }
        return to1e18(quoteAmount, quoteDecimals);
    }

    /// @notice Arithmetic mean tick from two tick cumulatives over `secondsAgo`, rounded toward negative infinity.
    function meanTick(int56 cumulativeStart, int56 cumulativeEnd, uint32 secondsAgo) internal pure returns (int24) {
        int56 delta = cumulativeEnd - cumulativeStart;
        int56 span = int56(uint56(secondsAgo));
        int24 tick = int24(delta / span);
        if (delta < 0 && (delta % span != 0)) tick--;
        return tick;
    }

    /// @notice sqrt(1.0001^tick) * 2^96, the standard tick-to-price mapping of concentrated-liquidity pools.
    function sqrtPriceAtTick(int24 tick) internal pure returns (uint160) {
        uint256 absTick = tick < 0 ? uint256(-int256(tick)) : uint256(int256(tick));
        if (absTick > uint256(int256(MAX_TICK))) revert TickOutOfRange();

        uint256 ratio = absTick & 0x1 != 0 ? 0xfffcb933bd6fad37aa2d162d1a594001 : 0x100000000000000000000000000000000;
        if (absTick & 0x2 != 0) ratio = (ratio * 0xfff97272373d413259a46990580e213a) >> 128;
        if (absTick & 0x4 != 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdcc) >> 128;
        if (absTick & 0x8 != 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0) >> 128;
        if (absTick & 0x10 != 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644) >> 128;
        if (absTick & 0x20 != 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0) >> 128;
        if (absTick & 0x40 != 0) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861) >> 128;
        if (absTick & 0x80 != 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053) >> 128;
        if (absTick & 0x100 != 0) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4) >> 128;
        if (absTick & 0x200 != 0) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54) >> 128;
        if (absTick & 0x400 != 0) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3) >> 128;
        if (absTick & 0x800 != 0) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9) >> 128;
        if (absTick & 0x1000 != 0) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825) >> 128;
        if (absTick & 0x2000 != 0) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5) >> 128;
        if (absTick & 0x4000 != 0) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7) >> 128;
        if (absTick & 0x8000 != 0) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6) >> 128;
        if (absTick & 0x10000 != 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9) >> 128;
        if (absTick & 0x20000 != 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604) >> 128;
        if (absTick & 0x40000 != 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98) >> 128;
        if (absTick & 0x80000 != 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2) >> 128;

        if (tick > 0) ratio = type(uint256).max / ratio;
        return uint160((ratio >> 32) + (ratio % (1 << 32) == 0 ? 0 : 1));
    }

    /// @notice floor(a * b / denominator) with a 512-bit intermediate. Reverts when the result overflows or denominator is 0.
    function mulDiv(uint256 a, uint256 b, uint256 denominator) internal pure returns (uint256 result) {
        unchecked {
            uint256 prod0;
            uint256 prod1;
            assembly {
                let mm := mulmod(a, b, not(0))
                prod0 := mul(a, b)
                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
            }
            if (prod1 == 0) {
                require(denominator > 0);
                assembly {
                    result := div(prod0, denominator)
                }
                return result;
            }
            require(denominator > prod1);
            uint256 remainder;
            assembly {
                remainder := mulmod(a, b, denominator)
                prod1 := sub(prod1, gt(remainder, prod0))
                prod0 := sub(prod0, remainder)
            }
            uint256 twos = denominator & (~denominator + 1);
            assembly {
                denominator := div(denominator, twos)
                prod0 := div(prod0, twos)
                twos := add(div(sub(0, twos), twos), 1)
            }
            prod0 |= prod1 * twos;
            uint256 inv = (3 * denominator) ^ 2;
            inv *= 2 - denominator * inv;
            inv *= 2 - denominator * inv;
            inv *= 2 - denominator * inv;
            inv *= 2 - denominator * inv;
            inv *= 2 - denominator * inv;
            inv *= 2 - denominator * inv;
            result = prod0 * inv;
            return result;
        }
    }
}
