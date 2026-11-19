// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {VellenGapWatch} from "../src/VellenGapWatch.sol";
import {VellenGapMath} from "../src/VellenGapMath.sol";
import "./VellenMocks.sol";

contract MathHarness {
    function gap(uint256 p, uint256 n) external pure returns (int256) {
        return VellenGapMath.gapPpm(p, n);
    }

    function sqrtAt(int24 t) external pure returns (uint160) {
        return VellenGapMath.sqrtPriceAtTick(t);
    }

    function price(uint160 s, bool b0, uint8 bd, uint8 qd) external pure returns (uint256) {
        return VellenGapMath.priceFromSqrt(s, b0, bd, qd);
    }

    function mean(int56 a, int56 b, uint32 w) external pure returns (int24) {
        return VellenGapMath.meanTick(a, b, w);
    }

    function mulDiv(uint256 a, uint256 b, uint256 d) external pure returns (uint256) {
        return VellenGapMath.mulDiv(a, b, d);
    }
}

contract VellenGapWatchTest is Test {
    VellenGapWatch w;
    MathHarness m;
    MockFactory fac;
    MockErc20 usd;
    MockErc20 a;
    MockErc20 b;
    MockVault vault;
    MockObserver obs;
    MockList list;
    MockPool poolA;
    MockPool poolB;
    MockPool direct;

    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        vm.warp(1_800_000_000);
        m = new MathHarness();
        fac = new MockFactory();
        w = new VellenGapWatch(address(fac));
        usd = new MockErc20(6);
        a = new MockErc20(18);
        b = new MockErc20(18);
        vault = new MockVault(address(usd));
        obs = new MockObserver();
        list = new MockList();
        address[] memory t = new address[](2);
        t[0] = address(a);
        t[1] = address(b);
        list.set(t);
        vault.setIndex(address(obs), address(list));
        // Holdings: 0.01 A at $50, 0.004 B at $125 => 0.5 + 0.5 = $1.00 plus 0.000686 cash.
        a.setBalance(address(vault), 1e16);
        b.setBalance(address(vault), 4e15);
        usd.setBalance(address(vault), 686);
        obs.set(address(a), 50e18, block.timestamp - 100, true);
        obs.set(address(b), 125e18, block.timestamp - 200, true);
        vault.set(1e18, 1_000_686, 1_000_686);

        poolA = new MockPool(address(a), address(usd), 3000);
        poolB = new MockPool(address(b), address(usd), 500);
        direct = new MockPool(address(vault), address(usd), 3000);
        fac.add(poolA);
        fac.add(poolB);
        fac.add(direct);
        // Ticks chosen so A ~ $50 and B ~ $125 in USD units (6 dec) per 1e18 token.
        poolA.setTick(_tickFor(address(a), poolA, 50e6), uint32(block.timestamp - 30));
        poolB.setTick(_tickFor(address(b), poolB, 125e6), uint32(block.timestamp - 60));
    }

    /// @dev Tick whose price of one whole base token is closest below `quoteRaw` asset units.
    function _tickFor(address base, MockPool pool, uint256 quoteRaw) internal view returns (int24) {
        bool b0 = pool.token0() == base;
        int24 lo = -887000;
        int24 hi = 887000;
        while (hi - lo > 1) {
            int24 mid = int24((int256(lo) + int256(hi)) / 2);
            uint256 p = m.price(m.sqrtAt(mid), b0, 18, 6) / 1e12;
            bool up = b0 ? p <= quoteRaw : p >= quoteRaw;
            if (up) lo = mid;
            else hi = mid;
        }
        return lo;
    }

    function _basketTrack() internal returns (uint256 id) {
        vm.prank(alice);
        id = w.openTrack(address(vault), 2, address(0), 1, 1800, 3 days, 3 days);
        address[] memory t = new address[](2);
        t[0] = address(a);
        t[1] = address(b);
        address[] memory p = new address[](2);
        p[0] = address(poolA);
        p[1] = address(poolB);
        vm.prank(alice);
        w.setLegs(id, t, p);
    }

    // ------------------------------------------------------------ math

    function test_gap_examples() public view {
        assertEq(m.gap(1.05e18, 1e18), 50_000); // PK example: 1.05 vs 1.00 = +5 %
        assertEq(m.gap(0.95e18, 1e18), -50_000);
        assertEq(m.gap(1e18, 1e18), 0);
        assertEq(m.gap(1, 3), -666_666); // truncation toward zero
    }

    function test_gap_navZero_reverts() public {
        vm.expectRevert(VellenGapMath.NavZero.selector);
        m.gap(1, 0);
    }

    function test_crosses_boundaries() public view {
        assertTrue(w.crosses(1, 500, 50_000));
        assertFalse(w.crosses(1, 500, 49_999));
        assertTrue(w.crosses(2, 500, -50_000));
        assertFalse(w.crosses(2, 500, -49_999));
        assertTrue(w.crosses(3, 500, -50_000));
        assertTrue(w.crosses(3, 500, 50_000));
        assertFalse(w.crosses(3, 500, 0));
        assertFalse(w.crosses(0, 500, 99_999));
        assertFalse(w.crosses(4, 500, 99_999));
    }

    function test_tickmath_known_values() public view {
        assertEq(m.sqrtAt(0), 2 ** 96);
        assertEq(m.sqrtAt(-887272), 4295128739);
        assertEq(m.sqrtAt(887272), 1461446703485210103287273052203988822378723970342);
    }

    function test_tickmath_out_of_range() public {
        vm.expectRevert(VellenGapMath.TickOutOfRange.selector);
        m.sqrtAt(887273);
    }

    function testFuzz_tickmath_monotonic(int24 t) public view {
        t = int24(bound(int256(t), -887271, 887271));
        assertLt(m.sqrtAt(t), m.sqrtAt(t + 1));
    }

    function test_meanTick_rounds_down() public view {
        assertEq(m.mean(0, -7, 2), -4);
        assertEq(m.mean(0, 7, 2), 3);
        assertEq(m.mean(0, -6, 2), -3);
    }

    function testFuzz_mulDiv_matches_small(uint128 x, uint128 y, uint128 d) public view {
        vm.assume(d > 0);
        assertEq(m.mulDiv(x, y, d), uint256(x) * y / d);
    }

    function test_mulDiv_full_precision() public view {
        assertEq(m.mulDiv(type(uint256).max, type(uint256).max, type(uint256).max), type(uint256).max);
        assertEq(m.mulDiv(2 ** 200, 2 ** 100, 2 ** 150), 2 ** 150);
    }

    function test_price_from_sqrt_both_orientations() public view {
        // tick 0 with equal decimals = 1:1
        assertEq(m.price(uint160(2 ** 96), true, 18, 18), 1e18);
        assertEq(m.price(uint160(2 ** 96), false, 18, 18), 1e18);
        // Both branches agree at the boundary between them (sqrt = 2^128 - 1 uses the small branch, 2^128 the large one).
        uint256 small = m.price(type(uint128).max, true, 0, 0);
        uint256 large = m.price(uint160(uint256(type(uint128).max) + 1), true, 0, 0);
        assertApproxEqRel(small, large, 1e6);
        assertApproxEqRel(large, uint256(2 ** 64) * 1e18, 1e6);
        // Mid-range: price and its inverse multiply to ~1.
        uint160 s = m.sqrtAt(40000);
        assertApproxEqRel(m.price(s, true, 18, 18) * m.price(s, false, 18, 18) / 1e18, 1e18, 1e12);
    }

    // ------------------------------------------------------------ tracks

    function test_navOnly_track_records_no_market() public {
        uint256 id = w.openTrack(address(vault), 0, address(0), 1, 0, 3 days, 0);
        uint256 idx = w.recordCheckpoint(id);
        VellenGapWatch.Checkpoint[] memory c = w.getCheckpoints(id, idx, 1);
        assertEq(c[0].nav, 1.000686e18);
        assertEq(c[0].price, 0);
        assertEq(c[0].flags & w.F_NO_MARKET(), w.F_NO_MARKET());
        assertEq(c[0].navUpdatedAt, block.timestamp - 200); // oldest constituent
        uint256 r = w.registerRule(id, 3, 100, 0);
        (VellenGapWatch.Status s,,) = w.evaluate(r);
        assertEq(uint8(s), uint8(VellenGapWatch.Status.NoMarket));
    }

    function test_direct_pool_premium_triggers_and_cooldown() public {
        // Index token at ~$1.05 against NAV $1.000686.
        direct.setTick(_tickFor(address(vault), direct, 1.05e6), uint32(block.timestamp - 10));
        uint256 id = w.openTrack(address(vault), 1, address(direct), 1, 600, 3 days, 1 days);
        vm.prank(bob);
        uint256 r = w.registerRule(id, 1, 400, 1 hours);
        w.recordCheckpoint(id);
        (VellenGapWatch.Status s, int256 g,) = w.evaluate(r);
        assertEq(uint8(s), uint8(VellenGapWatch.Status.Triggered));
        assertApproxEqAbs(g, 49_300, 200);
        w.fire(r);
        (s,,) = w.evaluate(r);
        assertEq(uint8(s), uint8(VellenGapWatch.Status.Cooldown));
        vm.expectRevert(abi.encodeWithSelector(VellenGapWatch.NotTriggered.selector, VellenGapWatch.Status.Cooldown));
        w.fire(r);
        vm.warp(block.timestamp + 30 minutes);
        obs.set(address(a), 50e18, block.timestamp, true);
        obs.set(address(b), 125e18, block.timestamp, true);
        direct.setTick(direct.tick(), uint32(block.timestamp));
        w.recordCheckpoint(id);
        (s,,) = w.evaluate(r);
        assertEq(uint8(s), uint8(VellenGapWatch.Status.Cooldown));
        vm.warp(block.timestamp + 31 minutes);
        w.recordCheckpoint(id);
        (s,,) = w.evaluate(r);
        assertEq(uint8(s), uint8(VellenGapWatch.Status.Triggered));
        w.fire(r);
        assertEq(w.getRule(r).fireCount, 2);
    }

    function test_discount_rule_clear_on_premium() public {
        direct.setTick(_tickFor(address(vault), direct, 1.05e6), uint32(block.timestamp - 10));
        uint256 id = w.openTrack(address(vault), 1, address(direct), 1, 600, 3 days, 1 days);
        uint256 r = w.registerRule(id, 2, 100, 0);
        w.recordCheckpoint(id);
        (VellenGapWatch.Status s,,) = w.evaluate(r);
        assertEq(uint8(s), uint8(VellenGapWatch.Status.Clear));
    }

    function test_basket_matches_holdings() public {
        uint256 id = _basketTrack();
        VellenGapWatch.Checkpoint memory c = w.preview(id);
        // Basket at pools ~ NAV within tick granularity (1 bp per tick).
        assertApproxEqRel(c.price, c.nav, 3e14);
        assertEq(c.flags & w.BLOCKING(), 0);
        assertEq(c.priceUpdatedAt, block.timestamp - 60); // oldest leg observation
    }

    function test_basket_discount_when_pool_price_drops() public {
        uint256 id = _basketTrack();
        poolA.setTick(_tickFor(address(a), poolA, 40e6), uint32(block.timestamp - 5)); // A trades 20 % below oracle
        uint256 r = w.registerRule(id, 2, 900, 0);
        w.recordCheckpoint(id);
        (VellenGapWatch.Status s, int256 g,) = w.evaluate(r);
        assertEq(uint8(s), uint8(VellenGapWatch.Status.Triggered));
        assertApproxEqAbs(g, -99_930, 400); // half the basket 20 % lower => ~ -10 %
    }

    function test_basket_coverage_flag_when_list_misses_holdings() public {
        uint256 id = _basketTrack();
        vault.set(1e18, 2_000_000, 2_000_000); // totalAssets no longer matches listed holdings
        VellenGapWatch.Checkpoint memory c = w.preview(id);
        assertEq(c.flags & w.F_COVERAGE(), w.F_COVERAGE());
    }

    function test_stale_nav_and_price_flags() public {
        uint256 id = _basketTrack();
        vm.warp(block.timestamp + 4 days);
        VellenGapWatch.Checkpoint memory c = w.preview(id);
        assertEq(c.flags & w.F_NAV_STALE(), w.F_NAV_STALE());
        assertEq(c.flags & w.F_PRICE_STALE(), w.F_PRICE_STALE());
        uint256 r = w.registerRule(id, 3, 1, 0);
        w.recordCheckpoint(id);
        (VellenGapWatch.Status s,,) = w.evaluate(r);
        assertEq(uint8(s), uint8(VellenGapWatch.Status.NavStale));
    }

    function test_invalid_oracle_flag() public {
        uint256 id = _basketTrack();
        obs.set(address(b), 125e18, block.timestamp, false);
        VellenGapWatch.Checkpoint memory c = w.preview(id);
        assertEq(c.flags & w.F_NAV_INVALID(), w.F_NAV_INVALID());
    }

    function test_basket_missing_leg_reverts() public {
        vm.prank(alice);
        uint256 id = w.openTrack(address(vault), 2, address(0), 1, 1800, 3 days, 3 days);
        vm.expectRevert(abi.encodeWithSelector(VellenGapWatch.LegMissing.selector, address(a)));
        w.recordCheckpoint(id);
    }

    function test_twap_unavailable_reverts() public {
        uint256 id = _basketTrack();
        poolA.setTooYoung(true);
        vm.expectRevert(bytes("OLD"));
        w.recordCheckpoint(id);
    }

    // ------------------------------------------------------------ hostile inputs

    function test_pool_not_from_factory_rejected() public {
        MockPool fake = new MockPool(address(vault), address(usd), 3000);
        vm.expectRevert(VellenGapWatch.PoolNotFromFactory.selector);
        w.openTrack(address(vault), 1, address(fake), 1, 600, 1 days, 1 days);
    }

    function test_pool_wrong_pair_rejected() public {
        vm.expectRevert(VellenGapWatch.PoolPairMismatch.selector);
        w.openTrack(address(vault), 1, address(poolA), 1, 600, 1 days, 1 days);
    }

    function test_leg_wrong_pair_rejected() public {
        vm.prank(alice);
        uint256 id = w.openTrack(address(vault), 2, address(0), 1, 1800, 3 days, 3 days);
        address[] memory t = new address[](1);
        t[0] = address(a);
        address[] memory p = new address[](1);
        p[0] = address(poolB);
        vm.prank(alice);
        vm.expectRevert(VellenGapWatch.PoolPairMismatch.selector);
        w.setLegs(id, t, p);
    }

    function test_only_creator_sets_legs_and_only_before_first_checkpoint() public {
        uint256 id = _basketTrack();
        address[] memory t = new address[](1);
        t[0] = address(a);
        address[] memory p = new address[](1);
        p[0] = address(poolA);
        vm.prank(bob);
        vm.expectRevert(VellenGapWatch.NotCreator.selector);
        w.setLegs(id, t, p);
        w.recordCheckpoint(id);
        vm.prank(alice);
        vm.expectRevert(VellenGapWatch.TrackSealed.selector);
        w.setLegs(id, t, p);
    }

    function test_open_track_input_checks() public {
        vm.expectRevert(VellenGapWatch.BadMode.selector);
        w.openTrack(address(vault), 3, address(0), 1, 600, 1 days, 1 days);
        vm.expectRevert(VellenGapWatch.NotAContract.selector);
        w.openTrack(address(0xdead), 0, address(0), 1, 0, 1 days, 0);
        vm.expectRevert(VellenGapWatch.BadWindow.selector);
        w.openTrack(address(vault), 1, address(direct), 1, 59, 1 days, 1 days);
        vm.expectRevert(VellenGapWatch.BadAge.selector);
        w.openTrack(address(vault), 0, address(0), 1, 0, 0, 0);
        vm.expectRevert(VellenGapWatch.BadMode.selector);
        w.openTrack(address(vault), 0, address(direct), 1, 0, 1 days, 0);
        MockPlainVault plain = new MockPlainVault(address(usd));
        vm.expectRevert(VellenGapWatch.AgeSourceUnavailable.selector);
        w.openTrack(address(plain), 0, address(0), 1, 0, 1 days, 0);
        vm.expectRevert(VellenGapWatch.AgeSourceUnavailable.selector);
        w.openTrack(address(plain), 2, address(0), 0, 600, 1 days, 1 days);
        uint256 id = w.openTrack(address(plain), 0, address(0), 0, 0, 1 days, 0);
        VellenGapWatch.Checkpoint memory c = w.preview(id);
        assertEq(c.flags & w.F_NAV_AGE_UNKNOWN(), w.F_NAV_AGE_UNKNOWN());
        assertEq(c.nav, 1e18);
    }

    function test_one_checkpoint_per_second() public {
        uint256 id = w.openTrack(address(vault), 0, address(0), 1, 0, 3 days, 0);
        w.recordCheckpoint(id);
        vm.expectRevert(VellenGapWatch.SameTimestamp.selector);
        w.recordCheckpoint(id);
        vm.warp(block.timestamp + 1);
        w.recordCheckpoint(id);
        assertEq(w.checkpointCount(id), 2);
    }

    function test_rule_input_checks_and_owner_only() public {
        uint256 id = w.openTrack(address(vault), 0, address(0), 1, 0, 3 days, 0);
        vm.expectRevert(VellenGapWatch.BadDirection.selector);
        w.registerRule(id, 0, 100, 0);
        vm.expectRevert(VellenGapWatch.BadThreshold.selector);
        w.registerRule(id, 1, 0, 0);
        vm.expectRevert(VellenGapWatch.BadThreshold.selector);
        w.registerRule(id, 1, 50_001, 0);
        vm.expectRevert(VellenGapWatch.BadCooldown.selector);
        w.registerRule(id, 1, 10, 31 days);
        vm.expectRevert(VellenGapWatch.UnknownTrack.selector);
        w.registerRule(9, 1, 10, 0);
        vm.prank(alice);
        uint256 r = w.registerRule(id, 1, 10, 0);
        vm.prank(bob);
        vm.expectRevert(VellenGapWatch.NotRuleOwner.selector);
        w.setRuleActive(r, false);
        vm.prank(alice);
        w.setRuleActive(r, false);
        (VellenGapWatch.Status s,,) = w.evaluate(r);
        assertEq(uint8(s), uint8(VellenGapWatch.Status.NoCheckpoint));
        w.recordCheckpoint(id);
        (s,,) = w.evaluate(r);
        assertEq(uint8(s), uint8(VellenGapWatch.Status.Inactive));
    }

    function test_rule_cap_per_owner() public {
        uint256 id = w.openTrack(address(vault), 0, address(0), 1, 0, 3 days, 0);
        for (uint256 i = 0; i < 64; i++) w.registerRule(id, 1, 10, 0);
        vm.expectRevert(VellenGapWatch.TooManyRules.selector);
        w.registerRule(id, 1, 10, 0);
        assertEq(w.rulesOf(address(this)).length, 64);
    }

    function test_rejects_ether() public {
        (bool ok,) = address(w).call{value: 1}("");
        assertFalse(ok);
        assertEq(address(w).balance, 0);
    }
}
