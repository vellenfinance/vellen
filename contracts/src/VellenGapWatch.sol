// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {VellenGapMath} from "./VellenGapMath.sol";

/// @dev ERC-4626 index token (vault) as read by Vellen. navOracle()/indexRegistry() are optional: only used by tracks
///      that ask for NAV ages ("index oracle" age source).
interface IVellenIndexVault {
    function asset() external view returns (address);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function totalAssets() external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);
    function navOracle() external view returns (address);
    function indexRegistry() external view returns (address);
}

/// @dev Constituent list of the index (selector 0x5f5817e3, read from the live registry's bytecode and checked by calls).
interface IVellenConstituentList {
    function getActiveTokens() external view returns (address[] memory);
}

/// @dev Per-token price view of the index's NAV oracle (selector 0xe8f1d23f): price scaled to 1e18 USD, the Chainlink
///      round's updatedAt, and a validity flag. Matched against the underlying Chainlink feeds on 19 Nov 2026.
interface IVellenNavObserver {
    function observe(address token) external view returns (uint256 price, uint256 updatedAt, bool ok);
}

interface IVellenErc20 {
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

interface IVellenV3Pool {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee() external view returns (uint24);
    function slot0()
        external
        view
        returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 cardinality, uint16 cardinalityNext, uint8 feeProtocol, bool unlocked);
    function observations(uint256 index)
        external
        view
        returns (uint32 blockTimestamp, int56 tickCumulative, uint160 secondsPerLiquidityX128, bool initialized);
    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityX128s);
}

interface IVellenV3Factory {
    function getPool(address a, address b, uint24 fee) external view returns (address);
}

/// @title VellenGapWatch
/// @notice Premium / discount watch for index tokens on Robinhood Chain. Holds no funds and has no owner.
///         - A track names an ERC-4626 index token and how its market side is priced: no market (NAV only), a pool of the
///           index token against its asset, or the basket of holdings priced at constituent pools (look-through).
///         - Anyone records a checkpoint; the contract computes NAV, the market-side price (time-weighted over the track's
///           window, so a single-block pool push cannot set it), both ages, and the gap itself.
///         - Users register threshold rules (direction, bps, cooldown). evaluate(rule) says whether the latest checkpoint
///           crosses it; fire(rule) records a crossing once per cooldown so alert services have one event to follow.
contract VellenGapWatch {
    using VellenGapMath for uint256;

    uint8 public constant MODE_NAV_ONLY = 0;
    uint8 public constant MODE_DIRECT_POOL = 1;
    uint8 public constant MODE_BASKET = 2;

    uint8 public constant AGE_NONE = 0;
    uint8 public constant AGE_INDEX_ORACLE = 1;

    // Checkpoint flags.
    uint16 public constant F_NO_MARKET = 1 << 0;
    uint16 public constant F_NAV_INVALID = 1 << 1;
    uint16 public constant F_NAV_STALE = 1 << 2;
    uint16 public constant F_PRICE_STALE = 1 << 3;
    uint16 public constant F_COVERAGE = 1 << 4;
    uint16 public constant F_NAV_AGE_UNKNOWN = 1 << 5;

    uint16 public constant BLOCKING = F_NO_MARKET | F_NAV_INVALID | F_NAV_STALE | F_PRICE_STALE | F_COVERAGE;

    uint32 public constant MIN_WINDOW = 60;
    uint32 public constant MAX_WINDOW = 1 days;
    uint32 public constant MAX_AGE_LIMIT = 30 days;
    uint32 public constant MAX_THRESHOLD_BPS = 50_000;
    uint32 public constant MAX_COOLDOWN = 30 days;
    uint256 public constant MAX_LEGS = 32;
    uint256 public constant MAX_RULES_PER_OWNER = 64;
    /// @notice Basket-at-oracle value must match totalAssets within this many ppm, else the constituent list does not
    ///         cover the holdings and the checkpoint is flagged.
    uint256 public constant COVERAGE_TOLERANCE_PPM = 1_000;

    enum Status {
        NoCheckpoint,
        Inactive,
        NoMarket,
        NavInvalid,
        NavStale,
        PriceStale,
        Coverage,
        Clear,
        Cooldown,
        Triggered
    }

    struct Track {
        address vault;
        address asset;
        address pool; // MODE_DIRECT_POOL only
        address creator;
        uint8 mode;
        uint8 ageSource;
        uint8 vaultDecimals;
        uint8 assetDecimals;
        uint32 window; // TWAP window, seconds
        uint32 maxNavAge;
        uint32 maxPriceAge;
        uint64 createdAt;
        bool legsFixed; // legs fixed once the first checkpoint exists
    }

    struct Checkpoint {
        uint64 timestamp;
        uint64 navUpdatedAt; // oldest constituent price time, 0 when unknown
        uint64 priceUpdatedAt; // oldest pool observation time on the market side, 0 when no market
        uint128 nav; // asset units per index token, 1e18
        uint128 price; // market side, 1e18, 0 when no market
        int64 gapPpm;
        uint16 flags;
        address recorder;
    }

    struct Rule {
        address owner;
        uint64 trackId;
        uint8 direction;
        uint32 thresholdBps;
        uint32 cooldown;
        bool active;
        uint64 lastFiredAt;
        uint64 lastFiredCheckpoint; // checkpoint index + 1, 0 = never
        uint32 fireCount;
    }

    IVellenV3Factory public immutable factory;

    Track[] private _tracks;
    mapping(uint256 => Checkpoint[]) private _checkpoints;
    mapping(uint256 => address[]) private _legTokens;
    mapping(uint256 => mapping(address => address)) public legPool;
    Rule[] private _rules;
    mapping(address => uint256[]) private _rulesOf;

    event TrackOpened(uint256 indexed trackId, address indexed vault, uint8 mode, address pool, address indexed creator);
    event LegSet(uint256 indexed trackId, address indexed token, address pool);
    event CheckpointRecorded(
        uint256 indexed trackId, uint256 indexed index, uint256 nav, uint256 price, int256 gapPpm, uint16 flags, address recorder
    );
    event RuleRegistered(uint256 indexed ruleId, address indexed owner, uint256 indexed trackId, uint8 direction, uint32 thresholdBps, uint32 cooldown);
    event RuleActiveSet(uint256 indexed ruleId, bool active);
    event RuleFired(uint256 indexed ruleId, address indexed owner, uint256 indexed trackId, uint256 checkpointIndex, int256 gapPpm);

    error BadMode();
    error BadWindow();
    error BadAge();
    error NotAContract();
    error PoolNotFromFactory();
    error PoolPairMismatch();
    error AgeSourceUnavailable();
    error UnknownTrack();
    error UnknownRule();
    error NotCreator();
    error TrackSealed();
    error TooManyLegs();
    error LengthMismatch();
    error LegMissing(address token);
    error SameTimestamp();
    error BadDirection();
    error BadThreshold();
    error BadCooldown();
    error TooManyRules();
    error NotRuleOwner();
    error NotTriggered(Status status);
    error EmptyList();

    constructor(address v3Factory) {
        if (v3Factory.code.length == 0) revert NotAContract();
        factory = IVellenV3Factory(v3Factory);
    }

    // ---------------------------------------------------------------- tracks

    function openTrack(address vault, uint8 mode, address pool, uint8 ageSource, uint32 window, uint32 maxNavAge, uint32 maxPriceAge)
        external
        returns (uint256 trackId)
    {
        if (mode > MODE_BASKET) revert BadMode();
        if (ageSource > AGE_INDEX_ORACLE) revert BadMode();
        if (vault.code.length == 0) revert NotAContract();
        if (mode != MODE_NAV_ONLY && (window < MIN_WINDOW || window > MAX_WINDOW)) revert BadWindow();
        if (maxNavAge == 0 || maxNavAge > MAX_AGE_LIMIT || maxPriceAge > MAX_AGE_LIMIT) revert BadAge();
        if (mode != MODE_NAV_ONLY && maxPriceAge == 0) revert BadAge();

        address asset = IVellenIndexVault(vault).asset();
        if (asset.code.length == 0) revert NotAContract();
        uint8 vd = IVellenIndexVault(vault).decimals();
        uint8 ad = IVellenErc20(asset).decimals();
        if (vd > 36 || ad > 18) revert VellenGapMath.DecimalsTooLarge();

        if (mode == MODE_DIRECT_POOL) {
            _checkPool(pool, vault, asset);
        } else if (pool != address(0)) {
            revert BadMode();
        }
        if (ageSource == AGE_INDEX_ORACLE) {
            // Both lookups must answer now; they are read again at every checkpoint.
            try IVellenIndexVault(vault).navOracle() returns (address o) {
                if (o.code.length == 0) revert AgeSourceUnavailable();
            } catch {
                revert AgeSourceUnavailable();
            }
            try IVellenIndexVault(vault).indexRegistry() returns (address r) {
                if (r.code.length == 0) revert AgeSourceUnavailable();
            } catch {
                revert AgeSourceUnavailable();
            }
        } else if (mode == MODE_BASKET) {
            // The basket needs the constituent list.
            revert AgeSourceUnavailable();
        }

        trackId = _tracks.length;
        _tracks.push(
            Track({
                vault: vault,
                asset: asset,
                pool: pool,
                creator: msg.sender,
                mode: mode,
                ageSource: ageSource,
                vaultDecimals: vd,
                assetDecimals: ad,
                window: mode == MODE_NAV_ONLY ? 0 : window,
                maxNavAge: maxNavAge,
                maxPriceAge: mode == MODE_NAV_ONLY ? 0 : maxPriceAge,
                createdAt: uint64(block.timestamp),
                legsFixed: false
            })
        );
        emit TrackOpened(trackId, vault, mode, pool, msg.sender);
    }

    /// @notice Basket tracks: the creator names one pool per constituent (token vs the index asset). Allowed until the
    ///         first checkpoint; after that the legs are fixed so the history keeps one meaning.
    function setLegs(uint256 trackId, address[] calldata tokens, address[] calldata pools) external {
        Track storage t = _track(trackId);
        if (t.creator != msg.sender) revert NotCreator();
        if (t.mode != MODE_BASKET) revert BadMode();
        if (t.legsFixed) revert TrackSealed();
        if (tokens.length != pools.length) revert LengthMismatch();
        if (tokens.length == 0) revert EmptyList();
        for (uint256 i = 0; i < tokens.length; i++) {
            _checkPool(pools[i], tokens[i], t.asset);
            if (legPool[trackId][tokens[i]] == address(0)) {
                if (_legTokens[trackId].length >= MAX_LEGS) revert TooManyLegs();
                _legTokens[trackId].push(tokens[i]);
            }
            legPool[trackId][tokens[i]] = pools[i];
            emit LegSet(trackId, tokens[i], pools[i]);
        }
    }

    function _checkPool(address pool, address base, address asset) private view {
        if (pool.code.length == 0) revert NotAContract();
        address t0 = IVellenV3Pool(pool).token0();
        address t1 = IVellenV3Pool(pool).token1();
        if (!((t0 == base && t1 == asset) || (t0 == asset && t1 == base))) revert PoolPairMismatch();
        if (factory.getPool(t0, t1, IVellenV3Pool(pool).fee()) != pool) revert PoolNotFromFactory();
    }

    // ---------------------------------------------------------------- checkpoints

    /// @notice Computes the gap now and stores it. One checkpoint per track per second.
    function recordCheckpoint(uint256 trackId) external returns (uint256 index) {
        Track storage t = _track(trackId);
        Checkpoint memory c = preview(trackId);
        Checkpoint[] storage list = _checkpoints[trackId];
        if (list.length > 0 && list[list.length - 1].timestamp >= c.timestamp) revert SameTimestamp();
        c.recorder = msg.sender;
        if (!t.legsFixed) t.legsFixed = true;
        list.push(c);
        index = list.length - 1;
        emit CheckpointRecorded(trackId, index, c.nav, c.price, c.gapPpm, c.flags, msg.sender);
    }

    /// @notice What a checkpoint would store if recorded now (same computation, nothing written).
    function preview(uint256 trackId) public view returns (Checkpoint memory c) {
        Track storage t = _track(trackId);
        c.timestamp = uint64(block.timestamp);
        IVellenIndexVault v = IVellenIndexVault(t.vault);

        uint256 navRaw = v.convertToAssets(10 ** t.vaultDecimals);
        c.nav = uint128(VellenGapMath.to1e18(navRaw, t.assetDecimals));
        if (c.nav == 0) c.flags |= F_NAV_INVALID;

        address[] memory tokens;
        IVellenNavObserver obs;
        if (t.ageSource == AGE_INDEX_ORACLE) {
            obs = IVellenNavObserver(v.navOracle());
            tokens = IVellenConstituentList(v.indexRegistry()).getActiveTokens();
            uint256 oldest = type(uint256).max;
            for (uint256 i = 0; i < tokens.length; i++) {
                (, uint256 at, bool ok) = obs.observe(tokens[i]);
                if (!ok) c.flags |= F_NAV_INVALID;
                if (at < oldest) oldest = at;
            }
            if (tokens.length == 0) {
                c.flags |= F_NAV_AGE_UNKNOWN;
            } else {
                c.navUpdatedAt = uint64(oldest);
                if (block.timestamp > oldest && block.timestamp - oldest > t.maxNavAge) c.flags |= F_NAV_STALE;
            }
        } else {
            c.flags |= F_NAV_AGE_UNKNOWN;
        }

        if (t.mode == MODE_NAV_ONLY) {
            c.flags |= F_NO_MARKET;
            return c;
        }

        uint256 oldestObs;
        if (t.mode == MODE_DIRECT_POOL) {
            (uint256 p, uint256 at) = _twap(t.pool, t.vault, t.vaultDecimals, t.assetDecimals, t.window);
            c.price = uint128(p);
            oldestObs = at;
        } else {
            (uint256 p, uint256 at, bool covered) = _basket(trackId, t, tokens, obs);
            c.price = uint128(p);
            oldestObs = at;
            if (!covered) c.flags |= F_COVERAGE;
        }
        c.priceUpdatedAt = uint64(oldestObs);
        if (block.timestamp > oldestObs && block.timestamp - oldestObs > t.maxPriceAge) c.flags |= F_PRICE_STALE;
        if (c.nav > 0) c.gapPpm = int64(VellenGapMath.gapPpm(c.price, c.nav));
    }

    /// @dev Time-weighted price of `base` in the pool over `window` seconds, plus the time of the pool's latest observation.
    function _twap(address pool, address base, uint8 baseDecimals, uint8 assetDecimals, uint32 window)
        private
        view
        returns (uint256 price, uint256 lastObservation)
    {
        IVellenV3Pool p = IVellenV3Pool(pool);
        uint32[] memory ago = new uint32[](2);
        ago[0] = window;
        (int56[] memory cum,) = p.observe(ago);
        int24 tick = VellenGapMath.meanTick(cum[0], cum[1], window);
        uint160 sqrtP = VellenGapMath.sqrtPriceAtTick(tick);
        price = VellenGapMath.priceFromSqrt(sqrtP, p.token0() == base, baseDecimals, assetDecimals);
        (,, uint16 idx,,,,) = p.slot0();
        (uint32 ts,,,) = p.observations(idx);
        lastObservation = ts;
    }

    /// @dev Look-through price: holdings priced at each leg's TWAP plus the asset cash, divided by supply. Also checks
    ///      that the same holdings priced at the index's own oracle match totalAssets (coverage of the constituent list).
    function _basket(uint256 trackId, Track storage t, address[] memory tokens, IVellenNavObserver obs)
        private
        view
        returns (uint256 price, uint256 oldestObs, bool covered)
    {
        uint256 atPools; // asset value, 1e18
        uint256 atOracle; // USD value, 1e18
        oldestObs = type(uint256).max;
        for (uint256 i = 0; i < tokens.length; i++) {
            (uint256 vp, uint256 vo, uint256 at) = _leg(trackId, t, tokens[i], obs);
            atPools += vp;
            atOracle += vo;
            if (at < oldestObs) oldestObs = at;
        }
        if (tokens.length == 0) oldestObs = 0;
        uint256 cash = VellenGapMath.to1e18(IVellenErc20(t.asset).balanceOf(t.vault), t.assetDecimals);
        atPools += cash;
        atOracle += cash;
        uint256 supply = IVellenIndexVault(t.vault).totalSupply();
        price = supply == 0 ? 0 : VellenGapMath.mulDiv(atPools, 10 ** t.vaultDecimals, supply);
        uint256 ta = VellenGapMath.to1e18(IVellenIndexVault(t.vault).totalAssets(), t.assetDecimals);
        uint256 diff = ta > atOracle ? ta - atOracle : atOracle - ta;
        covered = ta > 0 && diff * VellenGapMath.PPM <= ta * COVERAGE_TOLERANCE_PPM;
    }

    /// @dev One basket leg: the vault's balance valued at the leg pool's TWAP and at the index oracle (both 1e18).
    function _leg(uint256 trackId, Track storage t, address token, IVellenNavObserver obs)
        private
        view
        returns (uint256 atPool, uint256 atOracle, uint256 lastObservation)
    {
        address pool = legPool[trackId][token];
        if (pool == address(0)) revert LegMissing(token);
        uint256 bal = IVellenErc20(token).balanceOf(t.vault);
        uint8 dec = IVellenErc20(token).decimals();
        uint256 px;
        (px, lastObservation) = _twap(pool, token, dec, t.assetDecimals, t.window);
        atPool = VellenGapMath.mulDiv(bal, px, 10 ** dec);
        (uint256 op,,) = obs.observe(token);
        atOracle = VellenGapMath.mulDiv(bal, op, 10 ** dec);
    }

    // ---------------------------------------------------------------- rules

    function registerRule(uint256 trackId, uint8 direction, uint32 thresholdBps, uint32 cooldown) external returns (uint256 ruleId) {
        _track(trackId);
        if (direction < VellenGapMath.DIR_PREMIUM || direction > VellenGapMath.DIR_EITHER) revert BadDirection();
        if (thresholdBps == 0 || thresholdBps > MAX_THRESHOLD_BPS) revert BadThreshold();
        if (cooldown > MAX_COOLDOWN) revert BadCooldown();
        if (_rulesOf[msg.sender].length >= MAX_RULES_PER_OWNER) revert TooManyRules();
        ruleId = _rules.length;
        _rules.push(
            Rule({
                owner: msg.sender,
                trackId: uint64(trackId),
                direction: direction,
                thresholdBps: thresholdBps,
                cooldown: cooldown,
                active: true,
                lastFiredAt: 0,
                lastFiredCheckpoint: 0,
                fireCount: 0
            })
        );
        _rulesOf[msg.sender].push(ruleId);
        emit RuleRegistered(ruleId, msg.sender, trackId, direction, thresholdBps, cooldown);
    }

    function setRuleActive(uint256 ruleId, bool active) external {
        Rule storage r = _rule(ruleId);
        if (r.owner != msg.sender) revert NotRuleOwner();
        r.active = active;
        emit RuleActiveSet(ruleId, active);
    }

    /// @notice Status of a rule against the latest checkpoint of its track.
    function evaluate(uint256 ruleId) public view returns (Status status, int256 gapPpm, uint256 checkpointIndex) {
        Rule storage r = _rule(ruleId);
        Checkpoint[] storage list = _checkpoints[r.trackId];
        if (list.length == 0) return (Status.NoCheckpoint, 0, 0);
        checkpointIndex = list.length - 1;
        Checkpoint storage c = list[checkpointIndex];
        gapPpm = c.gapPpm;
        if (!r.active) return (Status.Inactive, gapPpm, checkpointIndex);
        uint16 f = c.flags;
        if (f & F_NO_MARKET != 0) return (Status.NoMarket, gapPpm, checkpointIndex);
        if (f & F_NAV_INVALID != 0) return (Status.NavInvalid, gapPpm, checkpointIndex);
        if (f & F_NAV_STALE != 0) return (Status.NavStale, gapPpm, checkpointIndex);
        if (f & F_PRICE_STALE != 0) return (Status.PriceStale, gapPpm, checkpointIndex);
        if (f & F_COVERAGE != 0) return (Status.Coverage, gapPpm, checkpointIndex);
        if (!VellenGapMath.crosses(r.direction, r.thresholdBps, gapPpm)) return (Status.Clear, gapPpm, checkpointIndex);
        if (r.lastFiredCheckpoint == checkpointIndex + 1) return (Status.Cooldown, gapPpm, checkpointIndex);
        if (r.lastFiredAt != 0 && c.timestamp < uint256(r.lastFiredAt) + r.cooldown) return (Status.Cooldown, gapPpm, checkpointIndex);
        return (Status.Triggered, gapPpm, checkpointIndex);
    }

    /// @notice Records that a rule crossed on the latest checkpoint. Anyone may call; it only succeeds when evaluate says
    ///         Triggered, and at most once per checkpoint and per cooldown.
    function fire(uint256 ruleId) external {
        (Status s, int256 gap, uint256 idx) = evaluate(ruleId);
        if (s != Status.Triggered) revert NotTriggered(s);
        Rule storage r = _rule(ruleId);
        r.lastFiredAt = _checkpoints[r.trackId][idx].timestamp;
        r.lastFiredCheckpoint = uint64(idx + 1);
        r.fireCount += 1;
        emit RuleFired(ruleId, r.owner, r.trackId, idx, gap);
    }

    // ---------------------------------------------------------------- views

    function crosses(uint8 direction, uint32 thresholdBps, int256 gapPpm) external pure returns (bool) {
        return VellenGapMath.crosses(direction, thresholdBps, gapPpm);
    }

    function gapOf(uint256 price, uint256 nav) external pure returns (int256) {
        return VellenGapMath.gapPpm(price, nav);
    }

    function trackCount() external view returns (uint256) {
        return _tracks.length;
    }

    function getTrack(uint256 trackId) external view returns (Track memory) {
        return _track(trackId);
    }

    function legsOf(uint256 trackId) external view returns (address[] memory tokens, address[] memory pools) {
        _track(trackId);
        tokens = _legTokens[trackId];
        pools = new address[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) pools[i] = legPool[trackId][tokens[i]];
    }

    function checkpointCount(uint256 trackId) external view returns (uint256) {
        return _checkpoints[trackId].length;
    }

    function getCheckpoints(uint256 trackId, uint256 start, uint256 count) external view returns (Checkpoint[] memory out) {
        Checkpoint[] storage list = _checkpoints[trackId];
        if (start >= list.length) return new Checkpoint[](0);
        uint256 end = start + count > list.length ? list.length : start + count;
        out = new Checkpoint[](end - start);
        for (uint256 i = start; i < end; i++) out[i - start] = list[i];
    }

    function ruleCount() external view returns (uint256) {
        return _rules.length;
    }

    function getRule(uint256 ruleId) external view returns (Rule memory) {
        return _rule(ruleId);
    }

    function rulesOf(address owner) external view returns (uint256[] memory) {
        return _rulesOf[owner];
    }

    function _track(uint256 trackId) private view returns (Track storage) {
        if (trackId >= _tracks.length) revert UnknownTrack();
        return _tracks[trackId];
    }

    function _rule(uint256 ruleId) private view returns (Rule storage) {
        if (ruleId >= _rules.length) revert UnknownRule();
        return _rules[ruleId];
    }
}
