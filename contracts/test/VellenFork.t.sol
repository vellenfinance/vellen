// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {VellenGapWatch, IVellenIndexVault, IVellenV3Pool} from "../src/VellenGapWatch.sol";
import {VellenGapMath} from "../src/VellenGapMath.sol";

/// Fork tests against Robinhood Chain mainnet (4663). Run with:
///   forge test --match-contract Fork --fork-url <rpc> --evm-version cancun
contract VellenForkTest is Test {
    address constant V3_FACTORY = 0x1f7d7550B1b028f7571E69A784071F0205FD2EfA;
    address constant INDEX = 0x4B129357B164d65834bdBA935c3cD08FcB7e14DA;
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant CRCL = 0xdF0992E440dD0be65BD8439b609d6D4366bf1CB5;
    address constant SPCX = 0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa;
    address constant CRCL_USDG_3000 = 0x654E4143e82a5824445Ade0824351C2A9ACD95a8;
    address constant SPCX_USDG_500 = 0xc61284332117c3FB23A2A56cceFFD07F7aF60029;

    VellenGapWatch w;

    function setUp() public {
        if (block.chainid != 4663) return;
        w = new VellenGapWatch(V3_FACTORY);
    }

    modifier onFork() {
        if (block.chainid != 4663) {
            vm.skip(true);
        }
        _;
    }

    function test_fork_nav_only_matches_vault() public onFork {
        uint256 id = w.openTrack(INDEX, 0, address(0), 1, 0, 3 days, 0);
        uint256 idx = w.recordCheckpoint(id);
        VellenGapWatch.Checkpoint memory c = w.getCheckpoints(id, idx, 1)[0];
        assertEq(c.nav, IVellenIndexVault(INDEX).convertToAssets(1e18) * 1e12);
        assertGt(c.navUpdatedAt, 0);
        assertEq(c.flags & w.F_NO_MARKET(), w.F_NO_MARKET());
        emit log_named_uint("nav 1e18", c.nav);
    }

    function test_fork_no_direct_pool_exists() public onFork {
        // No v3 pool pairs the index token with its asset at any standard fee tier on the fork block.
        (bool ok, bytes memory r) = V3_FACTORY.staticcall(abi.encodeWithSignature("getPool(address,address,uint24)", INDEX, USDG, uint24(3000)));
        assertTrue(ok);
        assertEq(abi.decode(r, (address)), address(0));
    }

    function test_fork_basket_lookthrough() public onFork {
        uint256 id = w.openTrack(INDEX, 2, address(0), 1, 1800, 7 days, 7 days);
        address[] memory t = new address[](2);
        t[0] = CRCL;
        t[1] = SPCX;
        address[] memory p = new address[](2);
        p[0] = CRCL_USDG_3000;
        p[1] = SPCX_USDG_500;
        w.setLegs(id, t, p);
        VellenGapWatch.Checkpoint memory c = w.preview(id);
        emit log_named_uint("nav", c.nav);
        emit log_named_uint("basket at pools", c.price);
        emit log_named_int("gap ppm", c.gapPpm);
        emit log_named_uint("flags", c.flags);
        assertEq(c.flags & w.F_COVERAGE(), 0, "constituent list covers holdings");
        assertApproxEqRel(c.price, c.nav, 0.1e18); // within 10 %: pools track the feeds
        uint256 r = w.registerRule(id, 3, 1, 0);
        w.recordCheckpoint(id);
        (VellenGapWatch.Status s,,) = w.evaluate(r);
        assertTrue(uint8(s) >= uint8(VellenGapWatch.Status.NavStale));
    }

    function test_fork_tickmath_brackets_live_sqrt_price() public onFork {
        address[2] memory pools = [CRCL_USDG_3000, SPCX_USDG_500];
        for (uint256 i = 0; i < 2; i++) {
            (uint160 sqrtP, int24 tick,,,,,) = IVellenV3Pool(pools[i]).slot0();
            assertLe(VellenGapMath.sqrtPriceAtTick(tick), sqrtP);
            assertGt(VellenGapMath.sqrtPriceAtTick(tick + 1), sqrtP);
        }
    }

    function test_fork_rejects_unlisted_pool() public onFork {
        vm.expectRevert(VellenGapWatch.PoolPairMismatch.selector);
        w.openTrack(INDEX, 1, CRCL_USDG_3000, 1, 600, 1 days, 1 days);
    }
}
