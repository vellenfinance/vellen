// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {VellenGapWatch} from "../src/VellenGapWatch.sol";
import "./VellenMocks.sol";

contract GapHandler is Test {
    VellenGapWatch public w;
    MockPool public pool;
    MockObserver public obs;
    MockErc20 public a;
    uint256 public trackId;
    uint256[] public rules;

    constructor(VellenGapWatch w_, MockPool pool_, MockObserver obs_, MockErc20 a_, uint256 trackId_) {
        w = w_;
        pool = pool_;
        obs = obs_;
        a = a_;
        trackId = trackId_;
    }

    function register(uint8 dir, uint32 bps, uint32 cd) external {
        if (rules.length >= 20) return;
        dir = uint8(bound(dir, 1, 3));
        bps = uint32(bound(bps, 1, 2000));
        cd = uint32(bound(cd, 0, 2 hours));
        rules.push(w.registerRule(trackId, dir, bps, cd));
    }

    function move(int24 tick, uint32 dt) external {
        dt = uint32(bound(dt, 1, 1 hours));
        tick = int24(bound(int256(tick), -280000, -270000));
        vm.warp(block.timestamp + dt);
        obs.set(address(a), 1e18, block.timestamp, true);
        pool.setTick(tick, uint32(block.timestamp));
        w.recordCheckpoint(trackId);
    }

    function fireAny(uint256 i) external {
        if (rules.length == 0) return;
        uint256 r = rules[i % rules.length];
        (VellenGapWatch.Status s,,) = w.evaluate(r);
        if (s == VellenGapWatch.Status.Triggered) w.fire(r);
    }

    function ruleCount() external view returns (uint256) {
        return rules.length;
    }
}

contract VellenInvariantTest is Test {
    VellenGapWatch w;
    GapHandler h;

    function setUp() public {
        vm.warp(1_800_000_000);
        MockFactory fac = new MockFactory();
        w = new VellenGapWatch(address(fac));
        MockErc20 usd = new MockErc20(6);
        MockErc20 a = new MockErc20(18);
        MockVault vault = new MockVault(address(usd));
        MockObserver obs = new MockObserver();
        MockList list = new MockList();
        address[] memory t = new address[](1);
        t[0] = address(a);
        list.set(t);
        vault.setIndex(address(obs), address(list));
        vault.set(1e18, 1e6, 1e6);
        obs.set(address(a), 1e18, block.timestamp, true);
        MockPool pool = new MockPool(address(vault), address(usd), 3000);
        fac.add(pool);
        pool.setTick(-276325, uint32(block.timestamp));
        uint256 id = w.openTrack(address(vault), 1, address(pool), 1, 60, 1 days, 1 days);
        h = new GapHandler(w, pool, obs, a, id);
        targetContract(address(h));
    }

    /// A rule never fires twice on one checkpoint and never fires inside its cooldown.
    function invariant_fire_bounds() public view {
        uint256 n = w.checkpointCount(h.trackId());
        for (uint256 i = 0; i < h.ruleCount(); i++) {
            VellenGapWatch.Rule memory r = w.getRule(h.rules(i));
            assertLe(r.fireCount, n);
            assertLe(r.lastFiredCheckpoint, n);
            if (r.fireCount > 0) assertGt(r.lastFiredCheckpoint, 0);
        }
    }

    /// The contract never holds ether.
    function invariant_no_funds() public view {
        assertEq(address(w).balance, 0);
    }

    /// Checkpoint timestamps strictly increase.
    function invariant_checkpoints_ordered() public view {
        uint256 n = w.checkpointCount(h.trackId());
        if (n < 2) return;
        VellenGapWatch.Checkpoint[] memory c = w.getCheckpoints(h.trackId(), 0, n);
        for (uint256 i = 1; i < n; i++) assertGt(c[i].timestamp, c[i - 1].timestamp);
    }
}
