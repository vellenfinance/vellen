// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {VellenGapMath} from "../src/VellenGapMath.sol";

/// Replays the site's math (scripts/make-vectors.ts) against the library.
contract VellenParityTest is Test {
    string json;

    function setUp() public {
        json = vm.readFile("test/fixtures/vectors.json");
    }

    function test_parity_tickmath() public view {
        int256[] memory t = vm.parseJsonIntArray(json, ".ticks");
        uint256[] memory s = vm.parseJsonUintArray(json, ".sqrts");
        for (uint256 i = 0; i < t.length; i++) assertEq(VellenGapMath.sqrtPriceAtTick(int24(t[i])), s[i]);
    }

    function test_parity_price() public view {
        int256[] memory t = vm.parseJsonIntArray(json, ".pTicks");
        bool[] memory b0 = vm.parseJsonBoolArray(json, ".pBase0");
        uint256[] memory bd = vm.parseJsonUintArray(json, ".pBaseDec");
        uint256[] memory qd = vm.parseJsonUintArray(json, ".pQuoteDec");
        uint256[] memory p = vm.parseJsonUintArray(json, ".prices");
        for (uint256 i = 0; i < t.length; i++) {
            assertEq(VellenGapMath.priceFromSqrt(VellenGapMath.sqrtPriceAtTick(int24(t[i])), b0[i], uint8(bd[i]), uint8(qd[i])), p[i]);
        }
    }

    function test_parity_gap_and_rules() public view {
        uint256[] memory price = vm.parseJsonUintArray(json, ".gPrice");
        uint256[] memory nav = vm.parseJsonUintArray(json, ".gNav");
        int256[] memory gap = vm.parseJsonIntArray(json, ".gaps");
        uint256[] memory dir = vm.parseJsonUintArray(json, ".dirs");
        uint256[] memory bps = vm.parseJsonUintArray(json, ".bps");
        bool[] memory hit = vm.parseJsonBoolArray(json, ".hits");
        for (uint256 i = 0; i < price.length; i++) {
            int256 g = VellenGapMath.gapPpm(price[i], nav[i]);
            assertEq(g, gap[i]);
            assertEq(VellenGapMath.crosses(uint8(dir[i]), uint32(bps[i]), g), hit[i]);
        }
    }

    function test_parity_mean_tick() public view {
        int256[] memory s = vm.parseJsonIntArray(json, ".mStart");
        int256[] memory e = vm.parseJsonIntArray(json, ".mEnd");
        uint256[] memory w = vm.parseJsonUintArray(json, ".mWin");
        int256[] memory m = vm.parseJsonIntArray(json, ".means");
        for (uint256 i = 0; i < s.length; i++) assertEq(VellenGapMath.meanTick(int56(s[i]), int56(e[i]), uint32(w[i])), m[i]);
    }
}
