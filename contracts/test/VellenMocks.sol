// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract MockErc20 {
    uint8 public decimals;
    mapping(address => uint256) public balanceOf;

    constructor(uint8 d) {
        decimals = d;
    }

    function setBalance(address a, uint256 v) external {
        balanceOf[a] = v;
    }
}

contract MockList {
    address[] internal _t;

    function set(address[] memory t) external {
        _t = t;
    }

    function getActiveTokens() external view returns (address[] memory) {
        return _t;
    }
}

contract MockObserver {
    struct P {
        uint256 price;
        uint256 at;
        bool ok;
    }

    mapping(address => P) public p;

    function set(address token, uint256 price, uint256 at, bool ok) external {
        p[token] = P(price, at, ok);
    }

    function observe(address token) external view returns (uint256, uint256, bool) {
        P memory x = p[token];
        return (x.price, x.at, x.ok);
    }
}

/// @dev Minimal ERC-4626 shape: NAV per share set directly (assets units per 10**decimals shares).
contract MockVault {
    address public asset;
    uint8 public decimals = 18;
    uint256 public totalSupply;
    uint256 public totalAssets;
    uint256 public navPerShare;
    address public navOracle;
    address public indexRegistry;
    bool public breakOracle;

    constructor(address a) {
        asset = a;
    }

    function set(uint256 supply, uint256 assets, uint256 nav) external {
        totalSupply = supply;
        totalAssets = assets;
        navPerShare = nav;
    }

    function setIndex(address o, address r) external {
        navOracle = o;
        indexRegistry = r;
    }

    function convertToAssets(uint256 shares) external view returns (uint256) {
        return shares * navPerShare / 10 ** decimals;
    }
}

/// @dev Vault without navOracle()/indexRegistry() (plain ERC-4626).
contract MockPlainVault {
    address public asset;
    uint8 public decimals = 18;
    uint256 public totalSupply = 1e18;
    uint256 public totalAssets = 1e6;

    constructor(address a) {
        asset = a;
    }

    function convertToAssets(uint256) external pure returns (uint256) {
        return 1e6;
    }
}

/// @dev Pool with a constant tick over time: tickCumulative = tick * t.
contract MockPool {
    address public token0;
    address public token1;
    uint24 public fee;
    int24 public tick;
    uint32 public lastObs;
    bool public tooYoung;

    constructor(address a, address b, uint24 f) {
        (token0, token1) = a < b ? (a, b) : (b, a);
        fee = f;
    }

    function setTick(int24 t, uint32 obsAt) external {
        tick = t;
        lastObs = obsAt;
    }

    function setTooYoung(bool v) external {
        tooYoung = v;
    }

    function slot0() external view returns (uint160, int24, uint16, uint16, uint16, uint8, bool) {
        return (0, tick, 3, 10, 10, 0, true);
    }

    function observations(uint256) external view returns (uint32, int56, uint160, bool) {
        return (lastObs, 0, 0, true);
    }

    function observe(uint32[] calldata ago) external view returns (int56[] memory c, uint160[] memory s) {
        require(!tooYoung, "OLD");
        c = new int56[](ago.length);
        s = new uint160[](ago.length);
        for (uint256 i = 0; i < ago.length; i++) {
            c[i] = int56(tick) * int56(uint56(block.timestamp - ago[i]));
        }
    }
}

contract MockFactory {
    mapping(bytes32 => address) internal _p;

    function add(MockPool pool) external {
        _p[keccak256(abi.encode(pool.token0(), pool.token1(), pool.fee()))] = address(pool);
    }

    function getPool(address a, address b, uint24 f) external view returns (address) {
        (address t0, address t1) = a < b ? (a, b) : (b, a);
        return _p[keccak256(abi.encode(t0, t1, f))];
    }
}
