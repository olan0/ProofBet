// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TokenVesting
 * @dev A token holder contract that can release its token balance gradually like a
 * typical vesting scheme, with a cliff and vesting period.
 * Tokens get released linearly.
 */
contract TokenVesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct VestingSchedule {
        bool initialized;
        address beneficiary;
        uint64 cliff;
        uint64 start;
        uint64 duration;
        uint256 totalAmount;
        uint256 released;
    }

    // ERC20 token being vested
    IERC20 public immutable token;

    // Mapping from beneficiary to their vesting schedule
    mapping(address => VestingSchedule) private _vestingSchedules;
    
    // Array of all beneficiaries
    address[] private _beneficiaries;

    event Released(address indexed beneficiary, uint256 amount);
    event VestingScheduleCreated(address indexed beneficiary, uint256 amount, uint64 start, uint64 cliff, uint64 duration);

    /**
     * @dev Creates a vesting contract.
     * @param token_ The address of the ERC20 token to be vested.
     */
    constructor(address token_) Ownable(msg.sender) {
        require(token_ != address(0), "Token address cannot be zero");
        token = IERC20(token_);
    }

    /**
     * @dev Adds a new vesting schedule for a beneficiary.
     * @param beneficiary_ The address of the beneficiary.
     * @param start_ The timestamp when the vesting begins.
     * @param cliff_ The duration in seconds of the cliff period.
     * @param duration_ The duration in seconds of the entire vesting period.
     * @param totalAmount_ The total amount of tokens to be vested.
     */
    function createVestingSchedule(
        address beneficiary_,
        uint64 start_,
        uint64 cliff_,
        uint64 duration_,
        uint256 totalAmount_
    ) external onlyOwner {
        require(!_vestingSchedules[beneficiary_].initialized, "Beneficiary already has a schedule");
        require(totalAmount_ > 0, "Amount must be greater than 0");
        require(duration_ > 0, "Duration must be greater than 0");
        require(cliff_ <= duration_, "Cliff cannot be longer than duration");
        
        uint256 contractBalance = token.balanceOf(address(this));
        require(contractBalance >= totalAmount_, "Insufficient tokens in contract to create schedule");

        _vestingSchedules[beneficiary_] = VestingSchedule({
            initialized: true,
            beneficiary: beneficiary_,
            cliff: start_ + cliff_,
            start: start_,
            duration: duration_,
            totalAmount: totalAmount_,
            released: 0
        });

        _beneficiaries.push(beneficiary_);
        emit VestingScheduleCreated(beneficiary_, uint256(totalAmount_), start_, cliff_, duration_);
    }

    /**
     * @dev Releases the vested tokens for a specific beneficiary.
     * @param beneficiary_ The address of the beneficiary.
     */
    function release(address beneficiary_) external nonReentrant {
        VestingSchedule storage schedule = _vestingSchedules[beneficiary_];
        require(schedule.initialized, "No vesting schedule for this beneficiary");
        
        uint256 vestedAmount = _vestedAmount(beneficiary_);
        uint256 releasableAmount = vestedAmount - schedule.released;

        require(releasableAmount > 0, "No tokens to release");

        schedule.released += releasableAmount;

        token.safeTransfer(beneficiary_, releasableAmount);
        emit Released(beneficiary_, uint256(releasableAmount));
    }
    
    /**
     * @dev Calculates the amount of tokens that have vested for a beneficiary.
     */
    function _vestedAmount(address beneficiary_) internal view returns (uint256) {
        VestingSchedule storage schedule = _vestingSchedules[beneficiary_];
        if (!schedule.initialized) {
            return 0;
        }
        if (block.timestamp < schedule.cliff) {
            return 0;
        }
        if (block.timestamp >= schedule.start + schedule.duration) {
            return schedule.totalAmount;
        }
        // Ensure duration is not zero to prevent division by zero, although createVestingSchedule should prevent this.
        if (schedule.duration == 0) {
            return 0; 
        }
        return (schedule.totalAmount * (block.timestamp - schedule.start)) / schedule.duration;
    }
    
    // --- View Functions ---
    
    function getVestingSchedule(address beneficiary_) public view returns (VestingSchedule memory) {
        return _vestingSchedules[beneficiary_];
    }
    
    function getReleasableAmount(address beneficiary_) public view returns (uint256) {
        VestingSchedule storage schedule = _vestingSchedules[beneficiary_];
        if (!schedule.initialized) {
            return 0;
        }
        return _vestedAmount(beneficiary_) - schedule.released;
    }
    
    function getAllBeneficiaries() public view returns (address[] memory) {
        return _beneficiaries;
    }
}